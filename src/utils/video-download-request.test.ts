import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { DEFAULT_VIDEO_CLIPPING_SETTINGS } from './video-clipping';
import { buildVideoDownloadRequest } from './video-download-request';
import { buildVariables } from './shared';

const nativeHostPath = fileURLToPath(new URL('../../native-downloader/host.cjs', import.meta.url));
const tempDirectories: string[] = [];

function makeTempDirectory(): string {
	const directory = mkdtempSync(path.join(tmpdir(), 'obsidian-clipper-native-host-'));
	tempDirectories.push(directory);
	return directory;
}

function encodeNativeMessage(payload: Record<string, unknown>): Buffer {
	const body = Buffer.from(JSON.stringify(payload), 'utf8');
	const header = Buffer.alloc(4);
	header.writeUInt32LE(body.length, 0);
	return Buffer.concat([header, body]);
}

function decodeNativeMessage(buffer: Buffer): any {
	const bodyLength = buffer.readUInt32LE(0);
	return JSON.parse(buffer.subarray(4, 4 + bodyLength).toString('utf8'));
}

function runNativeHost(payload: Record<string, unknown>, env: Record<string, string> = {}): Promise<any> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [nativeHostPath], {
			env: { ...process.env, ...env },
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		const timeout = setTimeout(() => {
			child.kill();
			reject(new Error('Native host did not respond in time'));
		}, 2000);

		child.stdout.on('data', chunk => stdout.push(chunk));
		child.stderr.on('data', chunk => stderr.push(chunk));
		child.once('error', error => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once('close', () => {
			clearTimeout(timeout);
			try {
				resolve(decodeNativeMessage(Buffer.concat(stdout)));
			} catch (error) {
				reject(new Error(`Failed to decode native host response: ${String(error)}\n${Buffer.concat(stderr).toString('utf8')}`));
			}
		});

		child.stdin.end(encodeNativeMessage(payload));
	});
}

function runNativeJob(jobPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [nativeHostPath, '--run-job', jobPath], {
			stdio: ['ignore', 'ignore', 'ignore'],
		});
		child.once('error', reject);
		child.once('close', code => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`Native job exited with code ${code}`));
		});
	});
}

async function waitForText(filePath: string, expectedText: string, timeoutMs = 2000): Promise<string> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (existsSync(filePath)) {
			const text = readFileSync(filePath, 'utf8');
			if (text.includes(expectedText)) {
				return text;
			}
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

async function waitForFile(filePath: string, timeoutMs = 2000): Promise<boolean> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (existsSync(filePath)) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 50));
	}
	return existsSync(filePath);
}

afterEach(() => {
	for (const directory of tempDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe('video download requests', () => {
	test('builds a native download request for detected video variables', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'bilibili',
				'{{url}}': 'https://www.bilibili.com/video/BV1abc123',
				'{{videoTitle}}': '如何构建 CLI 工具',
				'{{videoAuthor}}': '技术频道',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownload: true,
				autoDownloadDirectory: '/tmp/videos',
				autoDownloadExecutable: '/opt/homebrew/bin/yt-dlp',
			},
			{
				vault: 'Obsidian Vault',
				path: 'Clippings/Videos',
				noteName: '如何构建 CLI 工具',
			},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request).toEqual({
			type: 'download-video',
			version: 1,
			url: 'https://www.bilibili.com/video/BV1abc123',
			downloadUrl: '',
			userAgent: '',
			title: '如何构建 CLI 工具',
			author: '技术频道',
			platform: 'bilibili',
			vault: 'Obsidian Vault',
			notePath: 'Clippings/Videos',
			noteName: '如何构建 CLI 工具',
			outputDirectory: '/tmp/videos',
			executable: '/opt/homebrew/bin/yt-dlp',
			extractTranscript: true,
			transcriptLanguages: 'all,-live_chat,-danmaku',
			cookieMode: 'browser',
			cookieBrowser: 'chrome',
			cookieProfile: '',
			cookieFile: '',
			requestedAt: '2026-05-07T00:00:00.000Z',
		});
	});

	test('adds browser cookie configuration to native download requests', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'bilibili',
				'{{url}}': 'https://www.bilibili.com/video/BV1abc123',
				'{{videoTitle}}': 'Demo video',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				cookieMode: 'browser',
				cookieBrowser: 'chrome',
				cookieProfile: 'Profile 1',
			},
			{},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request?.cookieMode).toBe('browser');
		expect(request?.cookieBrowser).toBe('chrome');
		expect(request?.cookieProfile).toBe('Profile 1');
		expect(request?.cookieFile).toBe('');
	});

	test('does not send pure YouTube playlist URLs to the native downloader', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'youtube',
				'{{videoUrl}}': 'https://www.youtube.com/playlist?list=PLmWCw1CzcFilebjK89WLb5cAvM8K0cLB3',
				'{{videoTitle}}': 'Claude Code 101',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownload: true,
			},
		);

		expect(request).toBeNull();
	});

	test('allows YouTube watch URLs with playlist context for native download', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'youtube',
				'{{videoUrl}}': 'https://www.youtube.com/watch?v=0kILa02vKuI&list=PLmWCw1CzcFilebjK89WLb5cAvM8K0cLB3&index=4',
				'{{videoTitle}}': 'Claude Code 101',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownload: true,
			},
		);

		expect(request?.url).toBe('https://www.youtube.com/watch?v=0kILa02vKuI&list=PLmWCw1CzcFilebjK89WLb5cAvM8K0cLB3&index=4');
	});

	test('does not build a request when auto download is disabled or variables are not from a video page', () => {
		const variables = {
			'{{videoPlatform}}': 'youtube',
			'{{url}}': 'https://www.youtube.com/watch?v=abc123',
			'{{videoTitle}}': 'Demo video',
		};

		expect(buildVideoDownloadRequest(variables, {
			...DEFAULT_VIDEO_CLIPPING_SETTINGS,
			autoDownload: false,
		})).toBeNull();

		expect(buildVideoDownloadRequest({
			'{{url}}': 'https://example.com/article',
			'{{title}}': 'Plain article',
		}, DEFAULT_VIDEO_CLIPPING_SETTINGS)).toBeNull();
	});

	test('uses configured defaults when optional auto download settings are blank', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'youtube',
				'{{videoUrl}}': 'https://youtu.be/abc123',
				'{{videoTitle}}': 'Demo video',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownloadDirectory: '',
				autoDownloadExecutable: '',
			},
			{
				vault: 'Obsidian Vault',
				path: 'Clippings/Videos',
				noteName: 'Demo video',
			},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request?.outputDirectory).toBe('{{vaultRoot}}/99-Assets/Clippings/Videos');
		expect(request?.executable).toBe('yt-dlp');
		expect(request?.extractTranscript).toBe(true);
	});

	test('limits YouTube subtitle requests to practical preferred languages', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'youtube',
				'{{videoUrl}}': 'https://www.youtube.com/watch?v=NpXk6bQwWrE',
				'{{videoTitle}}': 'Claude Opus 4.7解锁的9个副业',
			},
			DEFAULT_VIDEO_CLIPPING_SETTINGS,
			{},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request?.transcriptLanguages).toBe('zh-Hans,zh-Hant,zh,en,en-orig');
		expect(request?.transcriptLanguages).not.toContain('all');
	});

	test('renders vault-relative asset directory templates safely', () => {
		const request = buildVideoDownloadRequest(
			{
				'{{videoPlatform}}': 'bilibili',
				'{{url}}': 'https://www.bilibili.com/video/BV1abc123',
				'{{videoTitle}}': '课程/第一讲?',
				'{{videoAuthor}}': '技术频道',
			},
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownloadDirectory: '~/Documents/{{vault}}/99-Assets/{{path}}/{{noteName}}',
			},
			{
				vault: 'Obsidian Vault',
				path: '/Clippings//Videos/',
				noteName: '课程/第一讲?',
			},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request?.outputDirectory).toBe('~/Documents/Obsidian Vault/99-Assets/Clippings/Videos/课程_第一讲_');
		expect(request?.vault).toBe('Obsidian Vault');
		expect(request?.notePath).toBe('Clippings/Videos');
		expect(request?.noteName).toBe('课程_第一讲_');
	});

	test('native host reads one framed request and starts the configured executable', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: '课程/第一讲?',
			outputDirectory,
			executable: '/bin/echo',
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		expect(response.pid).toEqual(expect.any(Number));
		expect(response.outputTemplate).toBe(path.join(outputDirectory, '课程_第一讲_.%(ext)s'));
		expect(response.outputPath).toBe(path.join(outputDirectory, '课程_第一讲_.mp4'));
		expect(response.transcriptPath).toBe('');
		expect(response.logPath).toContain(path.join(homeDirectory, '.obsidian-clipper-zh', 'logs'));
		expect(existsSync(response.logPath)).toBe(true);
	});

	test('native host resolves vaultRoot from local Obsidian config', async () => {
		const homeDirectory = makeTempDirectory();
		const vaultRoot = path.join(homeDirectory, 'Documents', 'Obsidian Vault');
		const obsidianConfigDirectory = path.join(homeDirectory, 'Library', 'Application Support', 'obsidian');
		mkdirSync(obsidianConfigDirectory, { recursive: true });
		writeFileSync(path.join(obsidianConfigDirectory, 'obsidian.json'), JSON.stringify({
			vaults: {
				vault1: {
					path: vaultRoot,
					open: true,
				},
			},
		}));

		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: 'Demo video',
			vault: 'Obsidian Vault',
			notePath: 'Clippings/Videos',
			noteName: 'Demo video',
			outputDirectory: '{{vaultRoot}}/99-Assets/{{path}}',
			executable: '/bin/echo',
			extractTranscript: true,
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		expect(response.outputTemplate).toBe(path.join(vaultRoot, '99-Assets', 'Clippings', 'Videos', 'Demo video.%(ext)s'));
		expect(response.outputPath).toBe(path.join(vaultRoot, '99-Assets', 'Clippings', 'Videos', 'Demo video.mp4'));
		expect(response.vaultRelativeOutputPath).toBe('99-Assets/Clippings/Videos/Demo video.mp4');
		expect(response.embedMarkdown).toBe('![[99-Assets/Clippings/Videos/Demo video.mp4]]');
		expect(response.vaultRelativeTranscriptPath).toBe('99-Assets/Clippings/Videos/Demo video.transcript.md');
		expect(response.transcriptMarkdown).toBe('![[99-Assets/Clippings/Videos/Demo video.transcript.md|打开文稿]]');
		expect(readFileSync(response.transcriptPath, 'utf8')).toContain('状态：正在生成');
	});

	test('native host passes browser cookie args to the configured executable', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: 'Demo video',
			outputDirectory,
			executable: '/bin/echo',
			cookieMode: 'browser',
			cookieBrowser: 'chrome',
			cookieProfile: 'Profile 1',
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		const logText = await waitForText(response.logPath, '--cookies-from-browser chrome:Profile 1');
		expect(logText).toContain('--cookies-from-browser chrome:Profile 1');
	});

	test('native host limits YouTube downloads to archive-friendly formats', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://www.youtube.com/watch?v=NpXk6bQwWrE',
			title: 'Demo video',
			platform: 'youtube',
			outputDirectory,
			executable: '/bin/echo',
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		const logText = await waitForText(response.logPath, 'best[height<=720]');
		expect(logText).toContain('-f best[height<=720][ext=mp4]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720]/best');
	});

	test('native host retries YouTube video download without subtitles when subtitle download is rate limited', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const fakeYtdlp = path.join(homeDirectory, 'fake-yt-dlp.sh');
		writeFileSync(fakeYtdlp, [
			'#!/bin/sh',
			'out=""',
			'prev=""',
			'has_subs=0',
			'for arg in "$@"; do',
			'  if [ "$arg" = "--write-subs" ]; then has_subs=1; fi',
			'  if [ "$prev" = "-o" ]; then out="$arg"; fi',
			'  prev="$arg"',
			'done',
			'if [ "$has_subs" = "1" ]; then',
			'  echo "ERROR: Unable to download video subtitles for zh-Hans: HTTP Error 429: Too Many Requests" >&2',
			'  exit 1',
			'fi',
			'base="${out%.%(ext)s}"',
			'printf "video" > "$base.mp4"',
			'exit 0',
			'',
		].join('\n'));
		chmodSync(fakeYtdlp, 0o755);

		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://www.youtube.com/watch?v=IkaPHiMDazM',
			title: 'Hooks in Claude Code',
			platform: 'youtube',
			outputDirectory,
			executable: fakeYtdlp,
			extractTranscript: true,
			cookieMode: 'none',
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		expect(await waitForFile(response.outputPath)).toBe(true);
		const logText = await waitForText(response.logPath, 'Video download succeeded without subtitles');
		expect(logText).toContain('Unable to download video subtitles');
		expect(logText).toContain('retrying video download without subtitle options');
		expect(logText).toContain('Video download succeeded without subtitles');
		expect(readFileSync(response.transcriptPath, 'utf8')).toContain('状态：暂未生成');
	});

	test('native host prefers Homebrew yt-dlp over older PATH shims', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const pathShimDirectory = path.join(homeDirectory, 'bin');
		const homebrewDirectory = path.join(homeDirectory, 'homebrew', 'bin');
		mkdirSync(pathShimDirectory, { recursive: true });
		mkdirSync(homebrewDirectory, { recursive: true });
		const oldShim = path.join(pathShimDirectory, 'yt-dlp');
		const homebrewYtdlp = path.join(homebrewDirectory, 'yt-dlp');
		writeFileSync(oldShim, '#!/bin/sh\necho old-shim "$@"\n');
		writeFileSync(homebrewYtdlp, '#!/bin/sh\necho homebrew "$@"\n');
		chmodSync(oldShim, 0o755);
		chmodSync(homebrewYtdlp, 0o755);

		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://www.youtube.com/watch?v=ei_rJvFS-Jw',
			title: 'Demo video',
			platform: 'youtube',
			outputDirectory,
			executable: 'yt-dlp',
		}, {
			HOME: homeDirectory,
			PATH: pathShimDirectory,
			OBSIDIAN_CLIPPER_YTDLP_PREFERRED_PATHS: homebrewYtdlp,
		});

		expect(response.ok).toBe(true);
		expect(response.executable).toBe(homebrewYtdlp);
		const logText = await waitForText(response.logPath, 'homebrew --no-playlist');
		expect(logText).toContain('homebrew --no-playlist');
		expect(logText).not.toContain('old-shim');
	});

	test('native host forces overwriting stale video files on retry', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: 'Demo video',
			outputDirectory,
			executable: '/bin/echo',
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		const logText = await waitForText(response.logPath, '--force-overwrites');
		expect(logText).toContain('--force-overwrites');
		expect(logText).toContain('--no-continue');
	});

	test('native host prefers cookies collected from the current browser extension context', async () => {
		const homeDirectory = makeTempDirectory();
		const outputDirectory = makeTempDirectory();
		const fakeYtdlp = path.join(homeDirectory, 'fake-yt-dlp.sh');
		const usedCookiePath = path.join(homeDirectory, 'used-cookie-path.txt');
		writeFileSync(fakeYtdlp, [
			'#!/bin/sh',
			'cookies=""',
			'prev=""',
			'for arg in "$@"; do',
			'  if [ "$prev" = "--cookies" ]; then cookies="$arg"; fi',
			'  prev="$arg"',
			'done',
			'if [ -z "$cookies" ]; then exit 7; fi',
			'grep -q "sessionid" "$cookies" || exit 8',
			'printf "%s" "$cookies" > "$HOME/used-cookie-path.txt"',
			'exit 0',
			'',
		].join('\n'));
		chmodSync(fakeYtdlp, 0o755);

		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://www.douyin.com/video/7626747241792802098',
			title: 'Demo video',
			outputDirectory,
			executable: fakeYtdlp,
			cookieMode: 'browser',
			cookieBrowser: 'chrome',
			cookies: [
				{
					name: 'sessionid',
					value: 'secret-session-value',
					domain: '.douyin.com',
					path: '/',
					secure: true,
					httpOnly: true,
					hostOnly: false,
					expirationDate: 1893456000,
				},
			],
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		let logText = await waitForText(response.logPath, 'Using current browser cookies: 1 cookies');
		logText = await waitForText(response.logPath, '--cookies ');
		expect(logText).toContain('--cookies ');
		expect(logText).not.toContain('--cookies-from-browser');
		expect(logText).not.toContain('secret-session-value');
		expect(await waitForText(usedCookiePath, 'video-download')).toContain('cookies.txt');
		const cookiePath = readFileSync(usedCookiePath, 'utf8');
		logText = await waitForText(response.logPath, 'Temporary cookie file removed');
		expect(logText).toContain('Exited with code=0');
		expect(existsSync(cookiePath)).toBe(false);
	});

	test('end-to-end starts a Douyin native download and writes local video plus transcript', async () => {
		const homeDirectory = makeTempDirectory();
		const vaultRoot = path.join(homeDirectory, 'Documents', 'Obsidian Vault');
		const obsidianConfigDirectory = path.join(homeDirectory, 'Library', 'Application Support', 'obsidian');
		mkdirSync(obsidianConfigDirectory, { recursive: true });
		writeFileSync(path.join(obsidianConfigDirectory, 'obsidian.json'), JSON.stringify({
			vaults: {
				vault1: {
					path: vaultRoot,
					open: true,
				},
			},
		}));
		const fakeYtdlp = path.join(homeDirectory, 'fake-yt-dlp.sh');
		writeFileSync(fakeYtdlp, [
			'#!/bin/sh',
			'out=""',
			'prev=""',
			'for arg in "$@"; do',
			'  if [ "$prev" = "-o" ]; then out="$arg"; fi',
			'  prev="$arg"',
			'done',
			'base="${out%.%(ext)s}"',
			'printf "video" > "$base.mp4"',
			'cat > "$base.zh-Hans.srt" <<\'SRT\'',
			'1',
			'00:00:00,000 --> 00:00:01,000',
			'第一句抖音字幕',
			'',
			'2',
			'00:00:01,000 --> 00:00:02,000',
			'第二句抖音字幕',
			'SRT',
			'exit 0',
			'',
		].join('\n'));
		chmodSync(fakeYtdlp, 0o755);

		const fullHtml = `
			<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
				{
					"__DEFAULT_SCOPE__": {
						"webapp.video-detail": {
							"aweme_detail": {
								"aweme_id": "7340000000000000000",
								"desc": "真正的抖音视频文案",
								"create_time": 1717200000,
								"author": { "nickname": "中文创作者" },
								"video": {
									"cover": {
										"url_list": ["https://p3-sign.douyinpic.com/cover.jpeg"]
									},
									"play_addr": {
										"url_list": ["https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000example&is_play_url=1"]
									}
								}
							}
						}
					}
				}
			</script>
		`;
		const variables = buildVariables({
			title: '污染标题 - 抖音',
			author: '',
			content: '',
			contentHtml: '',
			url: 'https://v.douyin.com/iExample/',
			fullHtml,
			description: '在抖音，记录美好生活。',
			favicon: '',
			image: '',
			published: '',
			site: '抖音',
			language: 'zh-CN',
			wordCount: 0,
			schemaOrgData: null,
			metaTags: [],
			extractedContent: {},
		});
		const request = buildVideoDownloadRequest(
			variables,
			{
				...DEFAULT_VIDEO_CLIPPING_SETTINGS,
				autoDownloadExecutable: fakeYtdlp,
			},
			{
				vault: 'Obsidian Vault',
				path: 'Clippings/Videos',
				noteName: '中文创作者 - 真正的抖音视频文案',
			},
			'2026-05-07T00:00:00.000Z',
		);

		expect(request).toMatchObject({
			platform: 'douyin',
			url: 'https://www.douyin.com/video/7340000000000000000',
			downloadUrl: 'https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000example&is_play_url=1',
			title: '真正的抖音视频文案',
			author: '中文创作者',
			cookieMode: 'browser',
			cookieBrowser: 'chrome',
			extractTranscript: true,
		});

		const response = await runNativeHost(request as unknown as Record<string, unknown>, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		expect(response.outputPath).toBe(path.join(vaultRoot, '99-Assets', 'Clippings', 'Videos', '真正的抖音视频文案.mp4'));
		expect(response.embedMarkdown).toBe('![[99-Assets/Clippings/Videos/真正的抖音视频文案.mp4]]');
		expect(response.transcriptMarkdown).toBe('![[99-Assets/Clippings/Videos/真正的抖音视频文案.transcript.md|打开文稿]]');
		expect(await waitForFile(response.outputPath)).toBe(true);
		const transcriptText = await waitForText(response.transcriptPath, '第二句抖音字幕');
		expect(transcriptText).toContain('第一句抖音字幕\n第二句抖音字幕');
		const logText = readFileSync(response.logPath, 'utf8');
		expect(logText).toContain('--cookies-from-browser chrome');
		expect(logText).toContain('Using direct video URL extracted from the current page');
		expect(logText).toContain('--referer https://www.douyin.com/video/7340000000000000000');
		expect(logText).toContain('https://www.douyin.com/aweme/v1/play/?video_id=v0200fg10000example&is_play_url=1');
	});

	test('native host reports a missing executable without throwing malformed output', async () => {
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: 'Demo video',
			outputDirectory,
			executable: path.join(outputDirectory, 'missing-yt-dlp'),
		});

		expect(response.ok).toBe(false);
		expect(response.error).toContain('Executable not found');
	});

	test('native job converts downloaded subtitles into a transcript markdown file', async () => {
		const outputDirectory = makeTempDirectory();
		const homeDirectory = makeTempDirectory();
		const jobPath = path.join(homeDirectory, 'video-download-job.json');
		const logPath = path.join(homeDirectory, 'video-download.log');
		const transcriptPath = path.join(outputDirectory, 'Demo.transcript.md');
		writeFileSync(path.join(outputDirectory, 'Demo.zh-Hans.srt'), [
			'1',
			'00:00:00,000 --> 00:00:01,000',
			'第一句字幕',
			'',
			'2',
			'00:00:01,000 --> 00:00:02,000',
			'第一句字幕',
			'',
			'3',
			'00:00:02,000 --> 00:00:03,000',
			'第二句字幕',
			'',
		].join('\n'));
		writeFileSync(jobPath, JSON.stringify({
			executable: '/usr/bin/true',
			args: [],
			logPath,
			url: 'https://example.com/video',
			title: 'Demo',
			outputDirectory,
			outputBaseName: 'Demo',
			transcriptPath,
			extractTranscript: true,
		}));

		await runNativeJob(jobPath);

		expect(existsSync(jobPath)).toBe(false);
		expect(readFileSync(transcriptPath, 'utf8')).toContain('# Demo 文稿');
		expect(readFileSync(transcriptPath, 'utf8')).toContain('来源：https://example.com/video');
		expect(readFileSync(transcriptPath, 'utf8')).toContain('第一句字幕\n第二句字幕');
	});

	test('native job replaces legacy generated transcript markdown on retry', async () => {
		const outputDirectory = makeTempDirectory();
		const homeDirectory = makeTempDirectory();
		const jobPath = path.join(homeDirectory, 'video-download-job.json');
		const logPath = path.join(homeDirectory, 'video-download.log');
		const transcriptPath = path.join(outputDirectory, 'Demo.transcript.md');
		writeFileSync(path.join(outputDirectory, 'Demo.zh-Hans.srt'), [
			'1',
			'00:00:00,000 --> 00:00:01,000',
			'新字幕',
			'',
		].join('\n'));
		writeFileSync(transcriptPath, [
			'# Demo 文稿',
			'',
			'来源：https://www.youtube.com/watch?v=wrong',
			'字幕文件：`Demo.zh-Hans.vtt`',
			'',
			'旧字幕',
			'',
		].join('\n'));
		writeFileSync(jobPath, JSON.stringify({
			executable: '/usr/bin/true',
			args: [],
			logPath,
			url: 'https://example.com/video',
			title: 'Demo',
			outputDirectory,
			outputBaseName: 'Demo',
			transcriptPath,
			extractTranscript: true,
		}));

		await runNativeJob(jobPath);

		const transcript = readFileSync(transcriptPath, 'utf8');
		expect(transcript).toContain('来源：https://example.com/video');
		expect(transcript).toContain('新字幕');
		expect(transcript).not.toContain('旧字幕');
	});

	test('native job ignores stale subtitles from previous failed attempts', async () => {
		const outputDirectory = makeTempDirectory();
		const homeDirectory = makeTempDirectory();
		const jobPath = path.join(homeDirectory, 'video-download-job.json');
		const logPath = path.join(homeDirectory, 'video-download.log');
		const transcriptPath = path.join(outputDirectory, 'Demo.transcript.md');
		const staleSubtitlePath = path.join(outputDirectory, 'Demo.zh-Hans.vtt');
		writeFileSync(staleSubtitlePath, [
			'WEBVTT',
			'',
			'00:00:00.000 --> 00:00:01.000',
			'旧错误字幕',
			'',
		].join('\n'));
		utimesSync(staleSubtitlePath, new Date('2026-05-07T00:00:00.000Z'), new Date('2026-05-07T00:00:00.000Z'));
		writeFileSync(transcriptPath, [
			'# Demo 文稿',
			'',
			'来源：https://www.youtube.com/watch?v=wrong',
			'字幕文件：`Demo.zh-Hans.vtt`',
			'',
			'旧错误字幕',
			'',
		].join('\n'));
		writeFileSync(jobPath, JSON.stringify({
			executable: '/usr/bin/false',
			args: [],
			logPath,
			url: 'https://example.com/video',
			title: 'Demo',
			outputDirectory,
			outputBaseName: 'Demo',
			transcriptPath,
			extractTranscript: true,
			startedAt: new Date('2026-05-08T00:00:00.000Z').getTime(),
		}));

		await runNativeJob(jobPath);

		const transcript = readFileSync(transcriptPath, 'utf8');
		expect(transcript).toContain('状态：暂未生成');
		expect(transcript).toContain('没有找到可用字幕文件');
		expect(transcript).not.toContain('旧错误字幕');
	});

	test('native job replaces an empty transcript with an unavailable status when no subtitles exist', async () => {
		const outputDirectory = makeTempDirectory();
		const homeDirectory = makeTempDirectory();
		const jobPath = path.join(homeDirectory, 'video-download-job.json');
		const logPath = path.join(homeDirectory, 'video-download.log');
		const transcriptPath = path.join(outputDirectory, 'Demo.transcript.md');
		writeFileSync(transcriptPath, '');
		writeFileSync(jobPath, JSON.stringify({
			executable: '/usr/bin/true',
			args: [],
			logPath,
			url: 'https://example.com/video',
			title: 'Demo',
			outputDirectory,
			outputBaseName: 'Demo',
			transcriptPath,
			extractTranscript: true,
		}));

		await runNativeJob(jobPath);

		const transcript = readFileSync(transcriptPath, 'utf8');
		expect(transcript).toContain('状态：暂未生成');
		expect(transcript).toContain('没有下载到可用字幕文件');
		expect(transcript).toContain('不会把弹幕当作文稿');
	});
});
