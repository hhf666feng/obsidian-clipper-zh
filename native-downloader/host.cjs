#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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

function safeFileName(value) {
	return String(value || 'video')
		.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 160) || 'video';
}

function assertValidRequest(request) {
	if (!request || request.type !== 'download-video') {
		throw new Error('Unsupported native message type');
	}
	const url = new URL(String(request.url || ''));
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('Only http(s) video URLs are supported');
	}
	return url.href;
}

function executableCandidates(executable) {
	if (executable.includes('/') || executable.includes('\\')) {
		return [executable];
	}
	if (executable !== 'yt-dlp') {
		return [executable];
	}
	return [
		executable,
		'/opt/homebrew/bin/yt-dlp',
		'/usr/local/bin/yt-dlp',
		path.join(os.homedir(), '.local', 'bin', 'yt-dlp'),
	];
}

function spawnDetached(candidates, args, index = 0) {
	return new Promise((resolve, reject) => {
		const child = spawn(candidates[index], args, {
			detached: true,
			stdio: 'ignore',
		});

		child.once('spawn', () => {
			child.unref();
			resolve({
				child,
				executable: candidates[index],
			});
		});

		child.once('error', (error) => {
			if (error && error.code === 'ENOENT' && index < candidates.length - 1) {
				spawnDetached(candidates, args, index + 1).then(resolve, reject);
				return;
			}
			reject(error);
		});
	});
}

function startDownload(request) {
	const url = assertValidRequest(request);
	const outputDirectory = expandPath(request.outputDirectory, request);
	fs.mkdirSync(outputDirectory, { recursive: true });

	const executable = String(request.executable || process.env.OBSIDIAN_CLIPPER_YTDLP || 'yt-dlp').trim() || 'yt-dlp';
	const outputTemplate = path.join(outputDirectory, `${safeFileName(request.title)}.%(ext)s`);
	const args = ['--no-playlist', url, '-o', outputTemplate];

	return spawnDetached(executableCandidates(executable), args).then(({ child, executable: resolvedExecutable }) => {
		return {
			ok: true,
			pid: child.pid,
			executable: resolvedExecutable,
			outputTemplate,
		};
	});
}

async function main() {
	try {
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
