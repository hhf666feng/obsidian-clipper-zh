import { describe, expect, test } from 'vitest';
import { appendVideoDownloadLocation } from './video-download-note';

describe('video download note annotation', () => {
	test('appends the local download target and log path to the clipped note', () => {
		const content = appendVideoDownloadLocation('正文', {
			ok: true,
			outputPath: '/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos/Demo.mp4',
			outputTemplate: '/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos/Demo.%(ext)s',
			vaultRelativeOutputPath: '99-Assets/Clippings/Videos/Demo.mp4',
			embedMarkdown: '![[99-Assets/Clippings/Videos/Demo.mp4]]',
			transcriptPath: '/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos/Demo.transcript.md',
			vaultRelativeTranscriptPath: '99-Assets/Clippings/Videos/Demo.transcript.md',
			transcriptMarkdown: '![[99-Assets/Clippings/Videos/Demo.transcript.md|打开文稿]]',
			logPath: '/Users/admin/.obsidian-clipper-zh/logs/video-download.log',
		});

		expect(content).toContain('## 本地视频');
		expect(content).toContain('![[99-Assets/Clippings/Videos/Demo.mp4]]');
		expect(content).toContain('保存位置：`/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos/Demo.mp4`');
		expect(content).toContain('下载日志：`/Users/admin/.obsidian-clipper-zh/logs/video-download.log`');
		expect(content).toContain('文稿状态：平台提供字幕或自动字幕时，下载完成后会自动生成');
		expect(content).toContain('文稿位置：`/Users/admin/Documents/Obsidian Vault/99-Assets/Clippings/Videos/Demo.transcript.md`');
		expect(content).toContain('文稿链接：![[99-Assets/Clippings/Videos/Demo.transcript.md|打开文稿]]');
	});

	test('does not modify notes when no download target is available', () => {
		expect(appendVideoDownloadLocation('正文', null)).toBe('正文');
		expect(appendVideoDownloadLocation('正文', { ok: false, error: 'missing host' })).toBe('正文');
		expect(appendVideoDownloadLocation('正文', { ok: true })).toBe('正文');
	});
});
