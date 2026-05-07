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
	vault: string;
	notePath: string;
	noteName: string;
	outputDirectory: string;
	executable: string;
	requestedAt: string;
}

export interface VideoDownloadContext {
	vault?: string;
	path?: string;
	noteName?: string;
}

function normalizePathForTemplate(value: string): string {
	return value
		.split(/[\\/]+/)
		.map(segment => segment.trim())
		.filter(Boolean)
		.map(segment => segment.replace(/[<>:"\\|?*\x00-\x1F]/g, '_'))
		.join('/');
}

function normalizeSegmentForTemplate(value: string): string {
	return value.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

function renderDirectoryTemplate(template: string, replacements: Record<string, string>): string {
	return Object.entries(replacements).reduce(
		(result, [key, value]) => result.split(key).join(value),
		template,
	);
}

export function buildVideoDownloadRequest(
	variables: Record<string, string>,
	settings: VideoClippingSettings,
	context: VideoDownloadContext = {},
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

	const vault = normalizeSegmentForTemplate(context.vault || '');
	const notePath = normalizePathForTemplate(context.path || '');
	const noteName = normalizeSegmentForTemplate(context.noteName || '');
	const outputDirectory = renderDirectoryTemplate(
		settings.autoDownloadDirectory || DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY,
		{
			'{{vault}}': vault,
			'{{path}}': notePath,
			'{{notePath}}': notePath,
			'{{noteName}}': noteName,
			'{{videoPlatform}}': normalizeSegmentForTemplate(platform),
			'{{videoAuthor}}': normalizeSegmentForTemplate((variables['{{videoAuthor}}'] || '').trim()),
			'{{videoTitle}}': normalizeSegmentForTemplate(title),
		},
	);

	return {
		type: 'download-video',
		version: 1,
		url,
		title,
		author: (variables['{{videoAuthor}}'] || '').trim(),
		platform,
		vault,
		notePath,
		noteName,
		outputDirectory,
		executable: settings.autoDownloadExecutable || DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
		requestedAt,
	};
}
