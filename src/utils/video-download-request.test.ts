import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { DEFAULT_VIDEO_CLIPPING_SETTINGS } from './video-clipping';
import { buildVideoDownloadRequest } from './video-download-request';

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
			title: '如何构建 CLI 工具',
			author: '技术频道',
			platform: 'bilibili',
			vault: 'Obsidian Vault',
			notePath: 'Clippings/Videos',
			noteName: '如何构建 CLI 工具',
			outputDirectory: '/tmp/videos',
			executable: '/opt/homebrew/bin/yt-dlp',
			requestedAt: '2026-05-07T00:00:00.000Z',
		});
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
		const outputDirectory = makeTempDirectory();
		const response = await runNativeHost({
			type: 'download-video',
			version: 1,
			url: 'https://example.com/video',
			title: '课程/第一讲?',
			outputDirectory,
			executable: '/bin/echo',
		});

		expect(response.ok).toBe(true);
		expect(response.pid).toEqual(expect.any(Number));
		expect(response.outputTemplate).toBe(path.join(outputDirectory, '课程_第一讲_.%(ext)s'));
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
		}, { HOME: homeDirectory });

		expect(response.ok).toBe(true);
		expect(response.outputTemplate).toBe(path.join(vaultRoot, '99-Assets', 'Clippings', 'Videos', 'Demo video.%(ext)s'));
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
		expect(response.error).toContain('spawn');
	});
});
