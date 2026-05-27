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

	if (response.downloadSource === 'direct') {
		lines.push('- 下载方式：页面直链（优先，绕过 yt-dlp 页面解析）');
	} else if (response.downloadSource === 'page') {
		lines.push('- 下载方式：页面地址（由 yt-dlp 解析媒体地址）');
	}
	if (response.cookieSource) {
		const cookieDetail = response.cookieSource === 'current-browser' && typeof response.cookieCount === 'number'
			? `，${response.cookieCount} 个 Cookie`
			: '';
		lines.push(`- Cookie 来源：${response.cookieSource}${cookieDetail}`);
	}
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
