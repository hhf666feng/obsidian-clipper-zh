import { VideoClippingSettings } from '../types/types';
import {
	DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY,
	DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
} from './video-clipping';

export const DEFAULT_NATIVE_VIDEO_DOWNLOADER_HOST = 'obsidian_clipper_zh_downloader';

export interface VideoDownloadRequest {
	type: 'download-video';
	version: 1;
	url: string;
	title: string;
	author: string;
	platform: string;
	outputDirectory: string;
	executable: string;
	requestedAt: string;
}

export function buildVideoDownloadRequest(
	variables: Record<string, string>,
	settings: VideoClippingSettings,
	requestedAt = new Date().toISOString(),
): VideoDownloadRequest | null {
	if (!settings.autoDownload) {
		return null;
	}

	const platform = (variables['{{videoPlatform}}'] || '').trim();
	const url = (variables['{{url}}'] || variables['{{videoUrl}}'] || '').trim();
	const title = (variables['{{videoTitle}}'] || variables['{{title}}'] || '').trim();
	if (!platform || !url || !title) {
		return null;
	}

	return {
		type: 'download-video',
		version: 1,
		url,
		title,
		author: (variables['{{videoAuthor}}'] || '').trim(),
		platform,
		outputDirectory: settings.autoDownloadDirectory || DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY,
		executable: settings.autoDownloadExecutable || DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
		requestedAt,
	};
}
