import dayjs from 'dayjs';
import { Template, VideoClippingSettings } from '../types/types';

export type VideoPlatform = '' | 'bilibili' | 'douyin' | 'youtube';

export interface VideoClipData {
	platform: Exclude<VideoPlatform, ''>;
	title: string;
	author: string;
	published: string;
	cover: string;
	description: string;
	summary: string;
	transcript: string;
	url: string;
}

export interface VideoClipExtractionInput {
	url: string;
	title: string;
	author: string;
	description: string;
	image: string;
	published: string;
	schemaOrgData?: any;
	metaTags?: { name?: string | null; property?: string | null; content: string | null }[];
	extractedContent?: Record<string, string>;
	fullHtml?: string;
}

export interface VideoProvider {
	platform: Exclude<VideoPlatform, ''>;
	matches: (url: URL) => boolean;
	extract: (input: VideoClipExtractionInput) => Partial<VideoClipData>;
}

export const DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE = 'yt-dlp "{{url}}" -o "{{videoTitle}}.%(ext)s"';

export const DEFAULT_VIDEO_CLIPPING_SETTINGS: VideoClippingSettings = {
	enableVideoTemplate: true,
	includeTranscript: true,
	includeSummary: true,
	includeDownloadCommand: false,
	downloadCommandTemplate: DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE,
};

function normalizedHost(url: URL): string {
	return url.hostname.replace(/^www\./, '');
}

export const VIDEO_PROVIDER_REGISTRY: VideoProvider[] = [
	{
		platform: 'bilibili',
		matches: (url) => {
			const host = normalizedHost(url);
			return (host === 'bilibili.com' || host === 'm.bilibili.com') && url.pathname.startsWith('/video/');
		},
		extract: extractBilibiliVideo,
	},
	{
		platform: 'douyin',
		matches: (url) => {
			const host = normalizedHost(url);
			return host === 'douyin.com' || host === 'v.douyin.com';
		},
		extract: extractDouyinVideo,
	},
	{
		platform: 'youtube',
		matches: (url) => {
			const host = normalizedHost(url);
			return ((host === 'youtube.com' || host === 'm.youtube.com') && (url.pathname === '/watch' || url.pathname.startsWith('/shorts/')))
				|| host === 'youtu.be';
		},
		extract: () => ({}),
	},
];

export function getVideoProvider(urlValue: string): VideoProvider | null {
	try {
		const url = new URL(urlValue);
		return VIDEO_PROVIDER_REGISTRY.find(provider => provider.matches(url)) || null;
	} catch {
		return null;
	}
}

export function detectVideoPlatform(urlValue: string): VideoPlatform {
	return getVideoProvider(urlValue)?.platform || '';
}

function firstValue(value: any): string {
	if (Array.isArray(value)) {
		return firstValue(value[0]);
	}
	if (value && typeof value === 'object') {
		if ('name' in value) return firstValue(value.name);
		if ('nickname' in value) return firstValue(value.nickname);
		if ('url' in value) return firstValue(value.url);
	}
	return value == null ? '' : String(value);
}

function normalizeUrl(value: string, baseUrl: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	try {
		return new URL(trimmed, baseUrl).href;
	} catch {
		return trimmed;
	}
}

function normalizeBilibiliImageUrl(value: string, baseUrl: string): string {
	const normalized = normalizeUrl(value, baseUrl);
	if (!normalized) return '';
	try {
		const url = new URL(normalized);
		if (!url.hostname.endsWith('hdslb.com')) {
			return normalized;
		}
		url.protocol = 'https:';
		const styleIndex = url.pathname.indexOf('@');
		if (styleIndex !== -1) {
			url.pathname = url.pathname.slice(0, styleIndex);
		}
		return url.href;
	} catch {
		return normalized;
	}
}

function normalizeDate(value: any): string {
	if (value == null || value === '') return '';
	if (typeof value === 'number') {
		const millis = value < 100000000000 ? value * 1000 : value;
		return new Date(millis).toISOString();
	}
	const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
	if (!Number.isNaN(numeric)) {
		return normalizeDate(numeric);
	}
	const parsed = dayjs(String(value));
	return parsed.isValid() ? parsed.toISOString() : String(value);
}

function metaContent(metaTags: VideoClipExtractionInput['metaTags'], key: string): string {
	return metaTags?.find(meta => meta.property === key || meta.name === key)?.content?.trim() || '';
}

function flattenSchemas(schemaOrgData: any): any[] {
	if (!schemaOrgData) return [];
	const queue = Array.isArray(schemaOrgData) ? [...schemaOrgData] : [schemaOrgData];
	const schemas: any[] = [];
	while (queue.length > 0) {
		const item = queue.shift();
		if (Array.isArray(item)) {
			queue.push(...item);
		} else if (item && typeof item === 'object') {
			schemas.push(item);
		}
	}
	return schemas;
}

function isVideoSchema(schema: any): boolean {
	const types = Array.isArray(schema?.['@type']) ? schema['@type'] : [schema?.['@type']];
	return types.includes('VideoObject');
}

function extractSchemaVideo(input: VideoClipExtractionInput): Partial<VideoClipData> {
	const schema = flattenSchemas(input.schemaOrgData).find(isVideoSchema);
	if (!schema) return {};
	return {
		title: firstValue(schema.name),
		author: firstValue(schema.author),
		published: normalizeDate(schema.uploadDate || schema.datePublished),
		cover: normalizeUrl(firstValue(schema.thumbnailUrl || schema.image), input.url),
		description: firstValue(schema.description),
	};
}

function extractJsonAssignment(fullHtml: string, variableName: string): any {
	const marker = `${variableName}`;
	const start = fullHtml.indexOf(marker);
	if (start === -1) return null;
	const equals = fullHtml.indexOf('=', start);
	if (equals === -1) return null;
	const objectStart = fullHtml.indexOf('{', equals);
	if (objectStart === -1) return null;

	let depth = 0;
	let inString = false;
	let quote = '';
	let escaped = false;
	for (let i = objectStart; i < fullHtml.length; i++) {
		const char = fullHtml[i];
		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === quote) {
				inString = false;
			}
			continue;
		}
		if (char === '"' || char === "'") {
			inString = true;
			quote = char;
			continue;
		}
		if (char === '{') depth++;
		if (char === '}') depth--;
		if (depth === 0) {
			try {
				const objectLiteral = fullHtml.slice(objectStart, i + 1);
				try {
					return JSON.parse(objectLiteral);
				} catch {
					// Fall back for older fixtures and sites that still use JS object literals.
				}
				const json = objectLiteral
					.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3')
					.replace(/'/g, '"')
					.replace(/,\s*([}\]])/g, '$1');
				return JSON.parse(json);
			} catch {
				return null;
			}
		}
	}
	return null;
}

function findObjectsByKeys(root: any, keys: string[]): any[] {
	const found: any[] = [];
	const seen = new Set<any>();
	const visit = (value: any) => {
		if (!value || typeof value !== 'object' || seen.has(value)) return;
		seen.add(value);
		if (keys.some(key => key in value)) {
			found.push(value);
		}
		for (const child of Object.values(value)) {
			if (typeof child === 'object') visit(child);
		}
	};
	visit(root);
	return found;
}

function extractBilibiliVideo(input: VideoClipExtractionInput): Partial<VideoClipData> {
	const state = extractJsonAssignment(input.fullHtml || '', 'window.__INITIAL_STATE__');
	const videoData = state?.videoData || state?.videoInfo || {};
	return {
		title: firstValue(videoData.title),
		author: firstValue(videoData.owner?.name || videoData.author),
		published: normalizeDate(videoData.pubdate || videoData.ctime),
		cover: normalizeBilibiliImageUrl(firstValue(videoData.pic || videoData.cover), input.url),
		description: firstValue(videoData.desc || videoData.description),
	};
}

function extractDouyinVideo(input: VideoClipExtractionInput): Partial<VideoClipData> {
	const match = (input.fullHtml || '').match(/<script[^>]+id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i);
	let data: any = null;
	if (match?.[1]) {
		try {
			data = JSON.parse(decodeURIComponent(match[1].trim()));
		} catch {
			data = null;
		}
	}
	const candidates = findObjectsByKeys(data, ['desc', 'createTime', 'author', 'video']);
	const video = candidates.find(candidate => candidate.video || candidate.author || candidate.desc) || {};
	return {
		title: firstValue(video.desc || video.title),
		author: firstValue(video.author?.nickname || video.author?.name || video.nickname),
		published: normalizeDate(video.createTime || video.create_time),
		cover: normalizeUrl(firstValue(video.video?.cover?.urlList || video.video?.cover?.url_list || video.cover), input.url),
		description: firstValue(video.desc || video.description),
	};
}

function summaryFrom(description: string, transcript: string): string {
	const source = (description || transcript || '').replace(/\s+/g, ' ').trim();
	return source.length > 240 ? `${source.slice(0, 240).trim()}...` : source;
}

function mergeVideoData(input: VideoClipExtractionInput, platform: Exclude<VideoPlatform, ''>, platformData: Partial<VideoClipData>): VideoClipData {
	const schemaData = extractSchemaVideo(input);
	const transcript = input.extractedContent?.transcript || input.extractedContent?.videoTranscript || '';
	const description = platformData.description
		|| schemaData.description
		|| metaContent(input.metaTags, 'og:description')
		|| input.description
		|| '';

	return {
		platform,
		title: platformData.title
			|| schemaData.title
			|| metaContent(input.metaTags, 'og:title')
			|| input.title
			|| '',
		author: platformData.author
			|| schemaData.author
			|| metaContent(input.metaTags, 'author')
			|| input.author
			|| '',
		published: platformData.published
			|| schemaData.published
			|| input.published
			|| '',
		cover: platformData.cover
			|| schemaData.cover
			|| metaContent(input.metaTags, 'og:image')
			|| input.image
			|| '',
		description,
		summary: summaryFrom(description, transcript),
		transcript,
		url: input.url.replace(/#:~:text=[^&]+(&|$)/, ''),
	};
}

export function extractVideoClipData(input: VideoClipExtractionInput): VideoClipData | null {
	const provider = getVideoProvider(input.url);
	if (!provider) return null;

	return mergeVideoData(input, provider.platform, provider.extract(input));
}

function escapeCommandValue(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function renderDownloadCommand(video: VideoClipData, template: string): string {
	const replacements: Record<string, string> = {
		'{{url}}': video.url,
		'{{videoUrl}}': video.url,
		'{{videoTitle}}': video.title,
		'{{videoAuthor}}': video.author,
		'{{videoPlatform}}': video.platform,
	};
	return Object.entries(replacements).reduce(
		(result, [key, value]) => result.split(key).join(escapeCommandValue(value)),
		template
	);
}

export function buildVideoVariables(
	video: VideoClipData | null,
	settings: VideoClippingSettings = DEFAULT_VIDEO_CLIPPING_SETTINGS
): Record<string, string> {
	if (!video) {
		return {
			'{{videoPlatform}}': '',
			'{{videoTitle}}': '',
			'{{videoAuthor}}': '',
			'{{videoPublished}}': '',
			'{{videoCover}}': '',
			'{{videoDescription}}': '',
			'{{videoSummary}}': '',
			'{{videoTranscript}}': '',
			'{{videoDownloadCommand}}': '',
		};
	}

	return {
		'{{videoPlatform}}': video.platform,
		'{{videoTitle}}': video.title,
		'{{videoAuthor}}': video.author,
		'{{videoPublished}}': video.published,
		'{{videoCover}}': video.cover,
		'{{videoDescription}}': video.description,
		'{{videoSummary}}': settings.includeSummary ? video.summary : '',
		'{{videoTranscript}}': settings.includeTranscript ? video.transcript : '',
		'{{videoDownloadCommand}}': settings.includeDownloadCommand
			? renderDownloadCommand(video, settings.downloadCommandTemplate || DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE)
			: '',
	};
}

export function createVideoClipTemplate(): Template {
	return {
		id: 'builtin-video-clip',
		name: '视频剪切',
		behavior: 'create',
		noteNameFormat: '{{videoAuthor}} - {{videoTitle}}',
		path: 'Clippings/Videos',
		noteContentFormat: [
			'![{{videoTitle}}]({{videoCover}})',
			'',
			'{{videoDescription}}',
			'',
			'{% if videoSummary %}## 摘要',
			'',
			'{{videoSummary}}',
			'{% endif %}',
			'',
			'{% if videoTranscript %}## 字幕 / 转写',
			'',
			'{{videoTranscript}}',
			'{% endif %}',
			'',
			'{% if videoDownloadCommand %}## 下载命令',
			'',
			'```sh',
			'{{videoDownloadCommand}}',
			'```',
			'{% endif %}',
			'',
			'[打开视频]({{url}})',
		].join('\n'),
		properties: [
			{ name: 'title', value: '{{videoTitle}}', type: 'text' },
			{ name: 'author', value: '{{videoAuthor|wikilink}}', type: 'multitext' },
			{ name: 'published', value: '{{videoPublished|date:YYYY-MM-DD}}', type: 'date' },
			{ name: 'source', value: '{{url}}', type: 'text' },
			{ name: 'platform', value: '{{videoPlatform}}', type: 'text' },
			{ name: 'cover', value: '{{videoCover}}', type: 'text' },
			{ name: 'tags', value: 'videos', type: 'text' },
		],
		triggers: [
			'https://www.bilibili.com/video/',
			'https://m.bilibili.com/video/',
			'https://www.douyin.com/video/',
			'https://v.douyin.com/',
			'https://youtube.com/watch',
			'https://www.youtube.com/watch',
			'https://m.youtube.com/watch',
			'https://youtube.com/shorts/',
			'https://www.youtube.com/shorts/',
			'https://m.youtube.com/shorts/',
			'https://youtu.be/',
		],
	};
}
