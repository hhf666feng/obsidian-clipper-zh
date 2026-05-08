import { VideoClippingSettings } from '../types/types';
import {
	DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY,
	DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
	DEFAULT_VIDEO_TRANSCRIPT_LANGUAGES,
} from './video-clipping';

export const DEFAULT_NATIVE_VIDEO_DOWNLOADER_HOST = 'obsidian_clipper_zh_downloader';

export interface VideoDownloadCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	secure: boolean;
	httpOnly: boolean;
	hostOnly: boolean;
	expirationDate?: number;
}

export interface VideoDownloadRequest {
	type: 'download-video';
	version: 1;
	url: string;
	downloadUrl?: string;
	userAgent?: string;
	title: string;
	author: string;
	platform: string;
	vault: string;
	notePath: string;
	noteName: string;
	outputDirectory: string;
	executable: string;
	extractTranscript: boolean;
	transcriptLanguages: string;
	cookieMode: VideoClippingSettings['cookieMode'];
	cookieBrowser: string;
	cookieProfile: string;
	cookieFile: string;
	cookies?: VideoDownloadCookie[];
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
	const url = (variables['{{videoUrl}}'] || variables['{{url}}'] || '').trim();
	const downloadUrl = (variables['{{videoDownloadUrl}}'] || '').trim();
	const userAgent = (variables['{{videoUserAgent}}'] || '').trim();
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
		downloadUrl,
		userAgent,
		title,
		author: (variables['{{videoAuthor}}'] || '').trim(),
		platform,
		vault,
		notePath,
		noteName,
		outputDirectory,
		executable: settings.autoDownloadExecutable || DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
		extractTranscript: settings.includeTranscript,
		transcriptLanguages: DEFAULT_VIDEO_TRANSCRIPT_LANGUAGES,
		cookieMode: settings.cookieMode || 'browser',
		cookieBrowser: settings.cookieBrowser || 'chrome',
		cookieProfile: settings.cookieProfile || '',
		cookieFile: settings.cookieFile || '',
		requestedAt,
	};
}
