#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DEFAULT_SUBTITLE_LANGUAGES = 'all,-live_chat,-danmaku';
const YOUTUBE_ARCHIVE_FORMAT = 'best[height<=720][ext=mp4]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best';
const DEFAULT_COOKIE_BROWSER = 'chrome';
const TRANSCRIPT_STATUS_MARKER = '<!-- obsidian-clipper-zh-transcript-status -->';
const SUPPORTED_COOKIE_BROWSERS = new Set([
	'brave',
	'chrome',
	'chromium',
	'edge',
	'firefox',
	'opera',
	'safari',
	'vivaldi',
	'whale',
]);

function readNativeMessage() {
	const lengthBuffer = Buffer.alloc(4);
	const headerBytesRead = fs.readSync(0, lengthBuffer, 0, 4, null);
	if (headerBytesRead !== 4) {
		throw new Error('Missing native message header');
	}

	const messageLength = lengthBuffer.readUInt32LE(0);
	if (messageLength <= 0 || messageLength > 1024 * 1024) {
		throw new Error(`Invalid native message length: ${messageLength}`);
	}

	const messageBuffer = Buffer.alloc(messageLength);
	let offset = 0;
	while (offset < messageLength) {
		const bytesRead = fs.readSync(0, messageBuffer, offset, messageLength - offset, null);
		if (bytesRead <= 0) {
			throw new Error('Unexpected end of native message');
		}
		offset += bytesRead;
	}
	return JSON.parse(messageBuffer.toString('utf8'));
}

function writeNativeMessage(payload) {
	const body = Buffer.from(JSON.stringify(payload), 'utf8');
	const header = Buffer.alloc(4);
	header.writeUInt32LE(body.length, 0);
	fs.writeSync(1, header);
	fs.writeSync(1, body);
}

function safePathSegment(value) {
	return String(value || '')
		.trim()
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function safeRelativePath(value) {
	return String(value || '')
		.split(/[\\/]+/)
		.map(segment => safePathSegment(segment))
		.filter(Boolean)
		.join(path.sep);
}

function readObsidianVaults() {
	const configPath = path.join(os.homedir(), 'Library', 'Application Support', 'obsidian', 'obsidian.json');
	try {
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
		return Object.values(config.vaults || {}).filter(vault => vault && typeof vault === 'object');
	} catch {
		return [];
	}
}

function resolveVaultRoot(vaultName) {
	const normalizedVaultName = String(vaultName || '').trim();
	const vaults = readObsidianVaults();
	if (normalizedVaultName) {
		const exact = vaults.find(vault => typeof vault.path === 'string'
			&& (vault.path === normalizedVaultName || path.basename(vault.path) === normalizedVaultName));
		if (exact?.path) {
			return exact.path;
		}
		return path.join(os.homedir(), 'Documents', safePathSegment(normalizedVaultName));
	}

	const openVault = vaults.find(vault => vault.open && typeof vault.path === 'string');
	if (openVault?.path) {
		return openVault.path;
	}
	return path.join(os.homedir(), 'Documents');
}

function renderPathTemplate(value, request) {
	return String(value || '')
		.split('{{vaultRoot}}').join(resolveVaultRoot(request.vault))
		.split('{{vault}}').join(safePathSegment(request.vault))
		.split('{{path}}').join(safeRelativePath(request.notePath))
		.split('{{notePath}}').join(safeRelativePath(request.notePath))
		.split('{{noteName}}').join(safePathSegment(request.noteName))
		.split('{{videoPlatform}}').join(safePathSegment(request.platform))
		.split('{{videoAuthor}}').join(safePathSegment(request.author))
		.split('{{videoTitle}}').join(safePathSegment(request.title));
}

function expandPath(value, request) {
	const rendered = renderPathTemplate(value, request);
	const trimmed = rendered.trim();
	if (!trimmed || trimmed === '~') {
		return path.join(os.homedir(), 'Documents', '99-Assets');
	}
	if (trimmed.startsWith('~/')) {
		return path.join(os.homedir(), trimmed.slice(2));
	}
	if (path.isAbsolute(trimmed)) {
		return trimmed;
	}
	return path.join(os.homedir(), trimmed);
}

function expandUserPath(value) {
	const trimmed = String(value || '').trim();
	if (!trimmed) return '';
	if (trimmed === '~') return os.homedir();
	if (trimmed.startsWith('~/')) return path.join(os.homedir(), trimmed.slice(2));
	return trimmed;
}

function safeFileName(value) {
	return String(value || 'video')
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 160) || 'video';
}

function vaultRelativePath(absolutePath, request) {
	const vaultRoot = resolveVaultRoot(request.vault);
	const relativePath = path.relative(vaultRoot, absolutePath);
	if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
		return '';
	}
	return relativePath.split(path.sep).join('/');
}

function assertHttpUrl(value, label) {
	const url = new URL(String(value || ''));
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error(`${label} must be an http(s) URL`);
	}
	return url.href;
}

function assertValidRequest(request) {
	if (!request || request.type !== 'download-video') {
		throw new Error('Unsupported native message type');
	}
	return assertHttpUrl(request.url, 'Video URL');
}

function isYouTubeRequest(request, url) {
	if (String(request.platform || '').toLowerCase() === 'youtube') {
		return true;
	}
	try {
		const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
		return host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com';
	} catch {
		return false;
	}
}

function executableCandidates(executable) {
	if (executable.includes('/') || executable.includes('\\')) {
		return [executable];
	}
	if (executable !== 'yt-dlp') {
		return [executable];
	}
	const preferredYtdlpPaths = String(process.env.OBSIDIAN_CLIPPER_YTDLP_PREFERRED_PATHS || '')
		.split(path.delimiter)
		.map(candidate => candidate.trim())
		.filter(Boolean);
	return [
		...preferredYtdlpPaths,
		'/opt/homebrew/bin/yt-dlp',
		'/usr/local/bin/yt-dlp',
		path.join(os.homedir(), '.local', 'bin', 'yt-dlp'),
		executable,
	];
}

function createLogPath() {
	const logDirectory = path.join(os.homedir(), '.obsidian-clipper-zh', 'logs');
	fs.mkdirSync(logDirectory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return path.join(logDirectory, `video-download-${timestamp}.log`);
}

function createJobPath() {
	const jobDirectory = path.join(os.homedir(), '.obsidian-clipper-zh', 'jobs');
	fs.mkdirSync(jobDirectory, { recursive: true });
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return path.join(jobDirectory, `video-download-${timestamp}.json`);
}

function createCookiePath() {
	const cookieDirectory = path.join(os.homedir(), '.obsidian-clipper-zh', 'cookies');
	fs.mkdirSync(cookieDirectory, { recursive: true, mode: 0o700 });
	try {
		fs.chmodSync(cookieDirectory, 0o700);
	} catch {
		// Best effort; chmod can fail on some mounted volumes.
	}
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	return path.join(cookieDirectory, `video-download-${timestamp}.cookies.txt`);
}

function appendLogLine(logPath, message) {
	fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

function commandExists(candidate) {
	if (candidate.includes('/') || candidate.includes('\\')) {
		try {
			fs.accessSync(candidate, fs.constants.X_OK);
			return true;
		} catch {
			return false;
		}
	}
	const paths = String(process.env.PATH || '').split(path.delimiter).filter(Boolean);
	return paths.some(directory => {
		try {
			fs.accessSync(path.join(directory, candidate), fs.constants.X_OK);
			return true;
		} catch {
			return false;
		}
	});
}

function resolveExecutable(candidates) {
	const executable = candidates.find(commandExists);
	if (!executable) {
		throw new Error(`Executable not found: ${candidates.join(', ')}`);
	}
	return executable;
}

function ytdlpAgeWarning(versionText, now = new Date()) {
	const match = String(versionText || '').trim().match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
	if (!match) return '';
	const publishedAt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	const ageDays = Math.floor((now.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1000));
	if (!Number.isFinite(ageDays) || ageDays <= 45) return '';
	return `yt-dlp appears ${ageDays} days old; if a platform extractor fails, upgrade yt-dlp first.`;
}

function logYtdlpVersionIfRelevant(executable, logPath) {
	if (path.basename(executable) !== 'yt-dlp') return;
	const result = spawnSync(executable, ['--version'], {
		encoding: 'utf8',
		timeout: 3000,
	});
	const versionText = String(result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] || 'unknown';
	appendLogLine(logPath, `yt-dlp version: ${versionText}`);
	const warning = ytdlpAgeWarning(versionText);
	if (warning) {
		appendLogLine(logPath, `WARNING: ${warning}`);
	}
}

function cookieField(value) {
	return String(value || '').replace(/[\t\r\n]/g, '');
}

function cookieExpiry(cookie) {
	const expirationDate = Number(cookie.expirationDate);
	if (!Number.isFinite(expirationDate) || expirationDate <= 0) {
		return 0;
	}
	return Math.floor(expirationDate);
}

function cookieLine(cookie) {
	let domain = cookieField(cookie.domain);
	if (!domain) {
		return '';
	}
	const includeSubdomains = !cookie.hostOnly || domain.startsWith('.');
	if (cookie.httpOnly && !domain.startsWith('#HttpOnly_')) {
		domain = `#HttpOnly_${domain}`;
	}
	return [
		domain,
		includeSubdomains ? 'TRUE' : 'FALSE',
		cookieField(cookie.path || '/'),
		cookie.secure ? 'TRUE' : 'FALSE',
		String(cookieExpiry(cookie)),
		cookieField(cookie.name),
		cookieField(cookie.value),
	].join('\t');
}

function writeTemporaryCookieFile(cookies) {
	if (!Array.isArray(cookies) || cookies.length === 0) {
		return '';
	}
	const lines = cookies
		.map(cookieLine)
		.filter(Boolean);
	if (lines.length === 0) {
		return '';
	}
	const cookiePath = createCookiePath();
	const content = [
		'# Netscape HTTP Cookie File',
		'# Generated by Obsidian Clipper zh for a one-time yt-dlp download.',
		...lines,
		'',
	].join('\n');
	fs.writeFileSync(cookiePath, content, { encoding: 'utf8', mode: 0o600 });
	try {
		fs.chmodSync(cookiePath, 0o600);
	} catch {
		// Best effort; the containing directory is still private.
	}
	return cookiePath;
}

function buildCookieArgs(request) {
	const mode = String(request.cookieMode || 'browser');
	if (mode === 'browser') {
		const temporaryCookieFile = writeTemporaryCookieFile(request.cookies);
		if (temporaryCookieFile) {
			return {
				args: ['--cookies', temporaryCookieFile],
				temporaryCookieFile,
				source: 'current-browser',
				count: request.cookies.length,
			};
		}
		const browserName = String(request.cookieBrowser || DEFAULT_COOKIE_BROWSER).trim().toLowerCase();
		if (!SUPPORTED_COOKIE_BROWSERS.has(browserName)) {
			throw new Error(`Unsupported cookie browser: ${browserName || '(empty)'}`);
		}
		const profile = String(request.cookieProfile || '').trim();
		return {
			args: ['--cookies-from-browser', profile ? `${browserName}:${profile}` : browserName],
			temporaryCookieFile: '',
			source: 'browser-database',
			count: 0,
		};
	}
	if (mode === 'file') {
		const cookieFile = expandUserPath(request.cookieFile);
		if (!cookieFile) {
			throw new Error('Cookie file path is required when cookie mode is file');
		}
		return {
			args: ['--cookies', cookieFile],
			temporaryCookieFile: '',
			source: 'file',
			count: 0,
		};
	}
	if (mode !== 'none') {
		throw new Error(`Unsupported cookie mode: ${mode}`);
	}
	return {
		args: [],
		temporaryCookieFile: '',
		source: 'none',
		count: 0,
	};
}

function spawnDetached(executable, args, logPath) {
	return new Promise((resolve, reject) => {
		appendLogLine(logPath, `Starting: ${executable} ${args.join(' ')}`);
		const logFd = fs.openSync(logPath, 'a');
		const child = spawn(executable, args, {
			detached: true,
			stdio: ['ignore', logFd, logFd],
		});

		child.once('spawn', () => {
			fs.closeSync(logFd);
			child.unref();
			resolve({
				child,
				executable,
			});
		});

		child.once('error', (error) => {
			fs.closeSync(logFd);
			appendLogLine(logPath, `Failed: ${error.message}`);
			reject(error);
		});
	});
}

function runCommand(executable, args, logPath) {
	return new Promise((resolve, reject) => {
		appendLogLine(logPath, `Running: ${executable} ${args.join(' ')}`);
		const logFd = fs.openSync(logPath, 'a');
		const child = spawn(executable, args, {
			stdio: ['ignore', logFd, logFd],
		});
		child.once('error', (error) => {
			fs.closeSync(logFd);
			appendLogLine(logPath, `Failed: ${error.message}`);
			reject(error);
		});
		child.once('close', (code, signal) => {
			fs.closeSync(logFd);
			appendLogLine(logPath, `Exited with code=${code} signal=${signal || ''}`);
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${executable} exited with code ${code}`));
		});
	});
}

function logIndicatesSubtitleDownloadFailure(logPath) {
	try {
		const logText = fs.readFileSync(logPath, 'utf8');
		return /Unable to download video subtitles/i.test(logText)
			|| /(?:subtitles?|字幕).*(?:HTTP Error|Too Many Requests|429|failed|error)/i.test(logText);
	} catch {
		return false;
	}
}

function shouldRetryWithoutSubtitles(job) {
	return Boolean(job.extractTranscript)
		&& Array.isArray(job.fallbackArgs)
		&& job.fallbackArgs.length > 0
		&& !fs.existsSync(job.outputPath)
		&& logIndicatesSubtitleDownloadFailure(job.logPath);
}

function subtitleSortScore(fileName) {
	if (/(zh|zho|chi|cmn|cn|hans|chs)/i.test(fileName)) return 0;
	if (/(en|eng)/i.test(fileName)) return 1;
	return 2;
}

function findSubtitleFile(outputDirectory, outputBaseName, startedAt = 0) {
	const prefix = `${outputBaseName}.`;
	try {
		return fs.readdirSync(outputDirectory)
			.filter(fileName => fileName.startsWith(prefix) && /\.(srt|vtt)$/i.test(fileName) && !/\.danmaku\./i.test(fileName))
			.filter(fileName => {
				if (!startedAt) return true;
				try {
					return fs.statSync(path.join(outputDirectory, fileName)).mtimeMs >= startedAt - 1000;
				} catch {
					return false;
				}
			})
			.sort((a, b) => subtitleSortScore(a) - subtitleSortScore(b) || a.localeCompare(b))[0] || '';
	} catch {
		return '';
	}
}

function subtitleToText(content) {
	const lines = content.replace(/\r/g, '').split('\n');
	const textLines = [];
	for (const rawLine of lines) {
		const line = rawLine
			.replace(/<[^>]+>/g, '')
			.replace(/\{\\[^}]+\}/g, '')
			.trim();
		if (!line || line === 'WEBVTT' || /^\d+$/.test(line) || /-->/.test(line) || /^NOTE\b/.test(line)) {
			continue;
		}
		if (textLines[textLines.length - 1] !== line) {
			textLines.push(line);
		}
	}
	return textLines.join('\n');
}

function shouldReplaceTranscriptStatus(transcriptPath) {
	try {
		if (!fs.existsSync(transcriptPath)) {
			return true;
		}
		const stats = fs.statSync(transcriptPath);
		if (stats.size === 0) {
			return true;
		}
		const content = fs.readFileSync(transcriptPath, 'utf8');
		return content.includes(TRANSCRIPT_STATUS_MARKER)
			|| /^来源：https?:\/\/.+\n字幕文件：`.+\.(?:srt|vtt)`/m.test(content)
			|| /^状态：(?:正在生成|暂未生成)/m.test(content);
	} catch {
		return true;
	}
}

function writeTranscriptStatusMarkdown(job, status, details = []) {
	if (!job.extractTranscript) {
		return;
	}
	if (!shouldReplaceTranscriptStatus(job.transcriptPath)) {
		appendLogLine(job.logPath, `Transcript status was not written because a non-generated file already exists: ${job.transcriptPath}`);
		return;
	}
	const content = [
		TRANSCRIPT_STATUS_MARKER,
		`# ${job.title} 文稿`,
		'',
		`状态：${status}`,
		`来源：${job.url}`,
		`下载日志：\`${job.logPath}\``,
		...details,
		'',
	].join('\n');
	fs.writeFileSync(job.transcriptPath, content, 'utf8');
	appendLogLine(job.logPath, `Transcript status markdown written: ${job.transcriptPath}`);
}

function writePendingTranscriptMarkdown(job) {
	writeTranscriptStatusMarkdown(job, '正在生成，下载完成后会自动更新。');
}

function writeUnavailableTranscriptMarkdown(job, reason) {
	writeTranscriptStatusMarkdown(job, '暂未生成', [
		`原因：${reason}`,
		'说明：当前只基于平台字幕或自动字幕生成文稿，不会把弹幕当作文稿，也不内置本地语音识别。',
		'如果是 B 站、抖音等平台，字幕或下载接口可能要求登录 Cookie；请确认当前浏览器已登录，或在扩展设置里配置 cookies.txt / 浏览器 Profile 回退。',
	]);
}

function writeTranscriptMarkdown(job, runError = null) {
	if (!job.extractTranscript) {
		return;
	}
	const subtitleFileName = findSubtitleFile(job.outputDirectory, job.outputBaseName, Number(job.startedAt) || 0);
	if (!subtitleFileName) {
		const reason = runError
			? `下载任务未成功完成，且没有找到可用字幕文件。错误：${runError.message}`
			: '没有下载到可用字幕文件。平台可能没有公开字幕，或字幕需要登录权限。';
		writeUnavailableTranscriptMarkdown(job, reason);
		return;
	}
	const subtitlePath = path.join(job.outputDirectory, subtitleFileName);
	const transcriptText = subtitleToText(fs.readFileSync(subtitlePath, 'utf8'));
	if (!transcriptText) {
		writeUnavailableTranscriptMarkdown(job, `字幕文件清洗后没有可用文本：${subtitlePath}`);
		return;
	}
	const content = [
		`# ${job.title} 文稿`,
		'',
		`来源：${job.url}`,
		`字幕文件：\`${subtitleFileName}\``,
		'',
		transcriptText,
		'',
	].join('\n');
	fs.writeFileSync(job.transcriptPath, content, 'utf8');
	appendLogLine(job.logPath, `Transcript markdown created: ${job.transcriptPath}`);
}

async function runJob(jobPath) {
	const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
	let runError = null;
	let succeededWithoutSubtitles = false;
	try {
		await runCommand(job.executable, job.args, job.logPath);
	} catch (error) {
		runError = error instanceof Error ? error : new Error(String(error));
		appendLogLine(job.logPath, `Job failed: ${runError.message}`);
		if (shouldRetryWithoutSubtitles(job)) {
			appendLogLine(job.logPath, 'Subtitle download failed; retrying video download without subtitle options.');
			try {
				await runCommand(job.executable, job.fallbackArgs, job.logPath);
				runError = null;
				succeededWithoutSubtitles = true;
			} catch (fallbackError) {
				runError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
				appendLogLine(job.logPath, `Fallback video download failed: ${runError.message}`);
			}
		}
	} finally {
		try {
			writeTranscriptMarkdown(job, runError);
			if (succeededWithoutSubtitles) {
				appendLogLine(job.logPath, 'Video download succeeded without subtitles.');
			}
		} finally {
			if (job.temporaryCookieFile) {
				try {
					fs.unlinkSync(job.temporaryCookieFile);
					appendLogLine(job.logPath, `Temporary cookie file removed: ${job.temporaryCookieFile}`);
				} catch (error) {
					appendLogLine(job.logPath, `Temporary cookie file cleanup skipped: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
			try {
				fs.unlinkSync(jobPath);
			} catch {
				// Keep going; the stale job file is harmless and useful for debugging.
			}
		}
	}
}

function startDownload(request) {
	const url = assertValidRequest(request);
	const downloadUrl = String(request.downloadUrl || '').trim()
		? assertHttpUrl(request.downloadUrl, 'Video download URL')
		: url;
	const outputDirectory = expandPath(request.outputDirectory, request);
	fs.mkdirSync(outputDirectory, { recursive: true });

	const executable = String(request.executable || process.env.OBSIDIAN_CLIPPER_YTDLP || 'yt-dlp').trim() || 'yt-dlp';
	const outputBaseName = safeFileName(request.title);
	const outputTemplate = path.join(outputDirectory, `${outputBaseName}.%(ext)s`);
	const outputPath = path.join(outputDirectory, `${outputBaseName}.mp4`);
	const transcriptPath = path.join(outputDirectory, `${outputBaseName}.transcript.md`);
	const relativeOutputPath = vaultRelativePath(outputPath, request);
	const relativeTranscriptPath = vaultRelativePath(transcriptPath, request);
	const extractTranscript = Boolean(request.extractTranscript);
	const logPath = createLogPath();
	const resolvedExecutable = resolveExecutable(executableCandidates(executable));
	logYtdlpVersionIfRelevant(resolvedExecutable, logPath);
	const args = ['--no-playlist', '--force-overwrites', '--no-continue', '--merge-output-format', 'mp4'];
	if (isYouTubeRequest(request, url)) {
		args.push('-f', YOUTUBE_ARCHIVE_FORMAT);
	}
	const cookieSetup = buildCookieArgs(request);
	args.push(...cookieSetup.args);
	if (downloadUrl !== url) {
		args.push('--referer', url);
		const userAgent = String(request.userAgent || '').trim();
		if (userAgent) {
			args.push('--user-agent', userAgent);
		}
		try {
			args.push('--add-header', `Origin: ${new URL(url).origin}`);
		} catch {
			// The source URL was already validated; this is only a defensive guard.
		}
	}
	const fallbackArgs = [...args, downloadUrl, '-o', outputTemplate];
	if (extractTranscript) {
		args.push(
			'--write-subs',
			'--write-auto-subs',
			'--sub-langs',
			String(request.transcriptLanguages || DEFAULT_SUBTITLE_LANGUAGES),
			'--convert-subs',
			'srt',
		);
	}
	args.push(downloadUrl, '-o', outputTemplate);
	const jobPath = createJobPath();
	if (cookieSetup.source === 'current-browser') {
		appendLogLine(logPath, `Using current browser cookies: ${cookieSetup.count} cookies`);
	} else if (cookieSetup.source === 'browser-database') {
		appendLogLine(logPath, 'Using yt-dlp browser cookie database fallback');
	}
	if (downloadUrl !== url) {
		appendLogLine(logPath, 'Using direct video URL extracted from the current page');
	} else {
		appendLogLine(logPath, 'Using page URL; yt-dlp must extract the media URL itself');
	}
	const job = {
		executable: resolvedExecutable,
		args,
		logPath,
		startedAt: Date.now(),
		url,
		downloadUrl,
		title: request.title,
		outputDirectory,
		outputBaseName,
		outputPath,
		transcriptPath,
		extractTranscript,
		temporaryCookieFile: cookieSetup.temporaryCookieFile,
		fallbackArgs: extractTranscript ? fallbackArgs : [],
	};
	writePendingTranscriptMarkdown(job);
	fs.writeFileSync(jobPath, JSON.stringify(job, null, 2), 'utf8');

	return spawnDetached(process.execPath, [__filename, '--run-job', jobPath], logPath).then(({ child }) => {
		return {
			ok: true,
			pid: child.pid,
			executable: resolvedExecutable,
			outputTemplate,
			outputPath,
			vaultRelativeOutputPath: relativeOutputPath,
			embedMarkdown: relativeOutputPath ? `![[${relativeOutputPath}]]` : '',
			pageUrl: url,
			sourceUrl: downloadUrl,
			downloadSource: downloadUrl !== url ? 'direct' : 'page',
			cookieSource: cookieSetup.source,
			cookieCount: cookieSetup.count,
			transcriptPath: extractTranscript ? transcriptPath : '',
			vaultRelativeTranscriptPath: extractTranscript ? relativeTranscriptPath : '',
			transcriptMarkdown: extractTranscript && relativeTranscriptPath ? `![[${relativeTranscriptPath}|打开文稿]]` : '',
			logPath,
		};
	});
}

async function main() {
	try {
		if (process.argv[2] === '--run-job') {
			await runJob(process.argv[3]);
			return;
		}
		const request = readNativeMessage();
		writeNativeMessage(await startDownload(request));
	} catch (error) {
		writeNativeMessage({
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

void main();
