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

function expandPath(value) {
	const trimmed = String(value || '').trim();
	if (!trimmed || trimmed === '~') {
		return path.join(os.homedir(), 'Downloads', 'Obsidian Web Clipper Videos');
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
	const outputDirectory = expandPath(request.outputDirectory);
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
