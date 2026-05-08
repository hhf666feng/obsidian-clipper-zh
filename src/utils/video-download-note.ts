import type { VideoDownloadResponse } from './video-native-downloader';

function inlineCode(value: string): string {
	return `\`${value.replace(/`/g, '\\`')}\``;
}

export function appendVideoDownloadLocation(noteContent: string, response: VideoDownloadResponse | null): string {
	const downloadPath = response?.outputPath || response?.outputTemplate || '';
	if (!response?.ok || !downloadPath || noteContent.includes(downloadPath)) {
		return noteContent;
	}

	const lines = [
		'## 本地视频',
		'',
	];

	if (response.embedMarkdown) {
		lines.push(response.embedMarkdown, '');
	}

	lines.push(
		`- 保存位置：${inlineCode(downloadPath)}`,
		'- 下载状态：已提交到本机后台下载',
	);

	if (response.logPath) {
		lines.push(`- 下载日志：${inlineCode(response.logPath)}`);
	}
	if (response.transcriptPath) {
		lines.push('- 文稿状态：平台提供字幕或自动字幕时，下载完成后会自动生成');
		lines.push(`- 文稿位置：${inlineCode(response.transcriptPath)}`);
	}
	if (response.transcriptMarkdown) {
		lines.push(`- 文稿链接：${response.transcriptMarkdown}`);
	}

	return `${noteContent.trimEnd()}\n\n${lines.join('\n')}\n`;
}
