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
	downloadUrl: string;
	userAgent: string;
}

export interface VideoClipExtractionInput {
	url: string;
	title: string;
	author: string;
	description: string;
	image: string;
	published: string;
	schemaOrgData?: any;
	metaTags?: { name?: string | null; property?: string | null; itemprop?: string | null; content: string | null }[];
	extractedContent?: Record<string, string>;
	fullHtml?: string;
}

export interface VideoProvider {
	platform: Exclude<VideoPlatform, ''>;
	matches: (url: URL) => boolean;
	extract: (input: VideoClipExtractionInput) => Partial<VideoClipData>;
}

export const DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE = 'yt-dlp "{{url}}" -o "{{videoTitle}}.%(ext)s"';
export const YTDLP_INSTALL_GUIDE = '如果终端提示 yt-dlp 未安装，请先安装：macOS 可运行 `brew install yt-dlp`；Windows 可运行 `winget install yt-dlp`；或使用 Python 运行 `python3 -m pip install -U yt-dlp`。';
export const LEGACY_VIDEO_AUTO_DOWNLOAD_DIRECTORY = '~/Downloads/Obsidian Web Clipper Videos';
export const DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY = '{{vaultRoot}}/99-Assets/{{path}}';
export const DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE = 'yt-dlp';
export const DEFAULT_VIDEO_TRANSCRIPT_LANGUAGES = 'all,-live_chat,-danmaku';
export const DEFAULT_VIDEO_COOKIE_BROWSER = 'chrome';

export const DEFAULT_VIDEO_CLIPPING_SETTINGS: VideoClippingSettings = {
	enableVideoTemplate: true,
	includeTranscript: true,
	includeSummary: true,
	includeDownloadCommand: true,
	downloadCommandTemplate: DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE,
	autoDownload: true,
	autoDownloadDirectory: DEFAULT_VIDEO_AUTO_DOWNLOAD_DIRECTORY,
	autoDownloadExecutable: DEFAULT_VIDEO_AUTO_DOWNLOAD_EXECUTABLE,
	cookieMode: 'browser',
	cookieBrowser: DEFAULT_VIDEO_COOKIE_BROWSER,
	cookieProfile: '',
	cookieFile: '',
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
			return host === 'douyin.com'
				|| host === 'm.douyin.com'
				|| host === 'v.douyin.com'
				|| host === 'iesdouyin.com';
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

export interface ScopedVideoDownloadCandidate {
	url: string;
	pageUrl?: string;
	startedAt?: number;
}

export interface ScopedVideoDownloadOptions {
	minStartedAt?: number;
}

function douyinVideoIdFromUrl(urlValue: string): string {
	try {
		const url = new URL(urlValue);
		const pathMatch = url.pathname.match(/(?:\/video\/|\/share\/video\/)(\d+)/);
		if (pathMatch?.[1]) return pathMatch[1];

		for (const key of ['aweme_id', 'awemeId', 'modal_id', 'item_id', 'itemId']) {
			const value = url.searchParams.get(key);
			if (value && /^\d+$/.test(value)) return value;
		}
		return '';
	} catch {
		return '';
	}
}

function isScopedToCurrentVideo(candidate: ScopedVideoDownloadCandidate, platform: VideoPlatform, pageUrl: string): boolean {
	if (platform !== 'douyin' || !candidate.pageUrl) return true;

	const currentId = douyinVideoIdFromUrl(pageUrl);
	const candidateId = douyinVideoIdFromUrl(candidate.pageUrl);
	return !currentId || !candidateId || currentId === candidateId;
}

export function findBestScopedVideoDownloadUrl(
	candidates: ScopedVideoDownloadCandidate[],
	platform: VideoPlatform,
	pageUrl: string,
	options: ScopedVideoDownloadOptions = {},
): string {
	return findBestVideoDownloadUrl(
		candidates
			.filter(candidate => candidate.url)
			.filter(candidate => typeof options.minStartedAt !== 'number'
				|| typeof candidate.startedAt !== 'number'
				|| candidate.startedAt >= options.minStartedAt)
			.filter(candidate => isScopedToCurrentVideo(candidate, platform, pageUrl))
			.map(candidate => candidate.url),
		platform,
		pageUrl,
	);
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

function decodePossiblyEncodedText(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	try {
		return /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed;
	} catch {
		return trimmed;
	}
}

function cleanBilibiliTitle(value: string): string {
	return decodePossiblyEncodedText(value)
		.replace(/_哔哩哔哩_bilibili$/i, '')
		.trim();
}

function cleanBilibiliDescription(value: string): string {
	return decodePossiblyEncodedText(value)
		.replace(/\s+/g, ' ')
		.split(/[,，]\s*(?:视频播放量|弹幕量|点赞数|投硬币枚数|收藏人数|转发人数|视频作者|作者简介|相关视频)[：:]?/)[0]
		.trim();
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
	return metaTags?.find(meta => meta.property === key || meta.name === key || meta.itemprop === key)?.content?.trim() || '';
}

function htmlMetaContent(fullHtml: string, key: string): string {
	if (!fullHtml) return '';

	const metaTagPattern = /<meta\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = metaTagPattern.exec(fullHtml)) !== null) {
		const tag = match[0];
		const matchesKey = ['property', 'name', 'itemprop'].some(attr => {
			const value = htmlAttributeValue(tag, attr);
			return value === key;
		});
		if (matchesKey) {
			return htmlAttributeValue(tag, 'content').trim();
		}
	}
	return '';
}

function htmlAttributeValue(tag: string, attr: string): string {
	const pattern = new RegExp(`${attr}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
	const match = tag.match(pattern);
	return decodeHtmlEntities(match?.[2] || match?.[3] || match?.[4] || '');
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>');
}

function htmlLinkHref(fullHtml: string, rel: string): string {
	if (!fullHtml) return '';

	const linkTagPattern = /<link\b[^>]*>/gi;
	let match: RegExpExecArray | null;
	while ((match = linkTagPattern.exec(fullHtml)) !== null) {
		const tag = match[0];
		const relValue = htmlAttributeValue(tag, 'rel').toLowerCase();
		if (relValue.split(/\s+/).includes(rel.toLowerCase())) {
			return htmlAttributeValue(tag, 'href').trim();
		}
	}
	return '';
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
	let start = fullHtml.indexOf(marker);
	while (start !== -1) {
		let equals = start + marker.length;
		while (/\s/.test(fullHtml[equals] || '')) equals++;
		if (fullHtml[equals] === '=') break;
		start = fullHtml.indexOf(marker, start + marker.length);
	}
	if (start === -1) return null;
	let equals = start + marker.length;
	while (/\s/.test(fullHtml[equals] || '')) equals++;
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

function parseJsonPayload(value: string): any {
	const trimmed = decodeHtmlEntities(value).trim();
	if (!trimmed) return null;
	const candidates = [trimmed];
	if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
		try {
			candidates.push(decodeURIComponent(trimmed));
		} catch {
			// Keep the raw payload candidate; some sites mix encoded and plain JSON.
		}
	}

	for (const candidate of candidates) {
		try {
			return JSON.parse(candidate);
		} catch {
			// Try the next representation.
		}
	}
	return null;
}

function extractJsonScriptById(fullHtml: string, id: string): any {
	if (!fullHtml) return null;

	const pattern = new RegExp(`<script\\b(?=[^>]*\\bid\\s*=\\s*["']${id}["'])[^>]*>([\\s\\S]*?)<\\/script>`, 'i');
	const match = fullHtml.match(pattern);
	return match?.[1] ? parseJsonPayload(match[1]) : null;
}

function extractApplicationJsonScripts(fullHtml: string): any[] {
	if (!fullHtml) return [];

	const scripts: any[] = [];
	const pattern = /<script\b(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(fullHtml)) !== null) {
		const data = parseJsonPayload(match[1]);
		if (data) scripts.push(data);
	}
	return scripts;
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
	const schemaData = extractSchemaVideo(input);
	const rawUploadDate = metaContent(input.metaTags, 'uploadDate')
		|| metaContent(input.metaTags, 'datePublished')
		|| htmlMetaContent(input.fullHtml || '', 'uploadDate')
		|| htmlMetaContent(input.fullHtml || '', 'datePublished');
	const title = cleanBilibiliTitle(firstValue(videoData.title)
		|| schemaData.title
		|| metaContent(input.metaTags, 'title')
		|| metaContent(input.metaTags, 'og:title')
		|| input.title);
	const description = cleanBilibiliDescription(firstValue(videoData.desc || videoData.description)
		|| schemaData.description
		|| metaContent(input.metaTags, 'description')
		|| input.description);
	return {
		title,
		author: firstValue(videoData.owner?.name || videoData.author)
			|| metaContent(input.metaTags, 'author')
			|| schemaData.author
			|| input.author,
		published: normalizeDate(videoData.pubdate || videoData.ctime)
			|| normalizeDate(rawUploadDate)
			|| schemaData.published,
		cover: normalizeBilibiliImageUrl(firstValue(videoData.pic || videoData.cover)
			|| schemaData.cover
			|| metaContent(input.metaTags, 'og:image')
			|| metaContent(input.metaTags, 'thumbnailUrl')
			|| metaContent(input.metaTags, 'image'), input.url),
		description,
	};
}

function valueAtPath(root: any, path: string[]): any {
	let current = root;
	for (const segment of path) {
		if (!current || typeof current !== 'object' || !(segment in current)) {
			return undefined;
		}
		current = current[segment];
	}
	return current;
}

function firstValueAtPath(root: any, paths: string[][]): string {
	for (const path of paths) {
		const value = firstValue(valueAtPath(root, path));
		if (value) return value;
	}
	return '';
}

function firstRawValueAtPath(root: any, paths: string[][]): any {
	for (const path of paths) {
		const value = valueAtPath(root, path);
		if (value != null && value !== '') return value;
	}
	return undefined;
}

function firstUrlFrom(value: any): string {
	if (Array.isArray(value)) {
		for (const item of value) {
			const url = firstUrlFrom(item);
			if (url) return url;
		}
		return '';
	}
	if (value && typeof value === 'object') {
		for (const key of ['urlList', 'url_list', 'url', 'href', 'src']) {
			if (key in value) {
				const url = firstUrlFrom(value[key]);
				if (url) return url;
			}
		}
		return '';
	}
	const text = firstValue(value).trim();
	return /^https?:\/\//i.test(text) || text.startsWith('//') ? text : '';
}

function collectUrlCandidatesFromValue(value: any): string[] {
	const urls: string[] = [];
	const seen = new Set<any>();
	const visit = (current: any) => {
		if (current == null) return;
		if (typeof current === 'string') {
			const text = decodeHtmlEntities(current).replace(/\\u0026/g, '&').replace(/\\\//g, '/').trim();
			if (/^(https?:)?\/\//i.test(text)) {
				urls.push(text);
				return;
			}
			for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
				urls.push(match[0]);
			}
			return;
		}
		if (typeof current !== 'object' || seen.has(current)) return;
		seen.add(current);
		if (Array.isArray(current)) {
			current.forEach(visit);
			return;
		}
		Object.values(current).forEach(visit);
	};
	visit(value);
	return urls;
}

function normalizeCandidateUrl(value: string, baseUrl: string): string {
	const normalized = normalizeUrl(
		decodeHtmlEntities(value)
			.replace(/\\u0026/g, '&')
			.replace(/\\\//g, '/')
			.trim(),
		baseUrl,
	);
	try {
		const url = new URL(normalized);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
		return url.href;
	} catch {
		return '';
	}
}

function scoreVideoDownloadUrl(urlValue: string, platform: VideoPlatform): number {
	let url: URL;
	try {
		url = new URL(urlValue);
	} catch {
		return -1000;
	}
	const host = url.hostname.toLowerCase();
	const pathAndQuery = `${url.pathname}${url.search}`.toLowerCase();
	if (/\.(?:jpe?g|png|gif|webp|avif|svg|ico)(?:[?#]|$)/i.test(pathAndQuery)) return -1000;
	if (/cover|poster|avatar|image|emoji/.test(pathAndQuery)) return -1000;

	let score = 0;
	if (/\.mp4(?:[?#]|$)/i.test(pathAndQuery)) score += 120;
	if (/\.m3u8(?:[?#]|$)/i.test(pathAndQuery)) score += 80;
	if (/mime_type=video|video\/mp4|is_play_url=1|video_id=/.test(pathAndQuery)) score += 60;
	if (/play_addr|download_addr|playwm|video\/tos|tos-/.test(pathAndQuery)) score += 45;

	if (platform === 'douyin') {
		if (/douyinvod|douyinvideo|bytecdn|bytedance|snssdk|amemv/.test(host)) score += 100;
		if (host.endsWith('douyin.com') && /\/aweme\/v1\/play/.test(pathAndQuery)) score += 120;
		if (/douyinpic|byteimg/.test(host)) score -= 200;
	}

	return score;
}

export function findBestVideoDownloadUrl(candidates: string[], platform: VideoPlatform, pageUrl: string): string {
	const seen = new Set<string>();
	return candidates
		.map(candidate => normalizeCandidateUrl(candidate, pageUrl))
		.filter(Boolean)
		.filter(candidate => {
			if (seen.has(candidate)) return false;
			seen.add(candidate);
			return true;
		})
		.map(candidate => ({ url: candidate, score: scoreVideoDownloadUrl(candidate, platform) }))
		.filter(candidate => candidate.score > 0)
		.sort((a, b) => b.score - a.score)[0]?.url || '';
}

function cleanDouyinText(value: string): string {
	return decodePossiblyEncodedText(decodeHtmlEntities(value))
		.replace(/\u200b/g, '')
		.replace(/\s+/g, ' ')
		.replace(/[｜|]\s*抖音.*$/i, '')
		.replace(/\s*[-_]\s*抖音$/i, '')
		.replace(/[，,]\s*在抖音，记录美好生活。?$/i, '')
		.trim();
}

function cleanDouyinAuthor(value: string): string {
	return cleanDouyinText(value)
		.replace(/^@+/, '')
		.trim();
}

function douyinMetaDescription(input: VideoClipExtractionInput): string {
	return metaContent(input.metaTags, 'description')
		|| htmlMetaContent(input.fullHtml || '', 'description');
}

function douyinTitleFromMetaDescription(value: string): string {
	const cleaned = cleanDouyinText(value);
	return cleaned.split(/\s+-\s+.+?于\d{4}/)[0]?.trim() || cleaned;
}

function douyinAuthorFromMetaDescription(value: string): string {
	const match = cleanDouyinText(value).match(/\s+-\s*(.+?)于(?:\d{8}|\d{4}[-/年]\d{1,2}[-/月]\d{1,2})发布在抖音/);
	return cleanDouyinAuthor(match?.[1] || '');
}

function douyinPublishedFromMetaDescription(value: string): string {
	const match = cleanDouyinText(value).match(/于(\d{8}|\d{4}[-/年]\d{1,2}[-/月]\d{1,2})发布在抖音/);
	const rawDate = match?.[1] || '';
	if (!rawDate) return '';
	if (/^\d{8}$/.test(rawDate)) {
		return normalizeDate(`${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`);
	}
	return normalizeDate(rawDate.replace(/年|月/g, '-').replace(/日/g, ''));
}

function douyinCandidateScore(candidate: any): number {
	if (!candidate || typeof candidate !== 'object') return 0;

	let score = 0;
	if ('aweme_id' in candidate || 'awemeId' in candidate || 'itemId' in candidate) score += 8;
	if ('video' in candidate || 'images' in candidate || 'cover' in candidate) score += 6;
	if ('desc' in candidate || 'description' in candidate || 'title' in candidate) score += 5;
	if ('author' in candidate || 'authorInfo' in candidate || 'user' in candidate || 'userInfo' in candidate) score += 4;
	if ('createTime' in candidate || 'create_time' in candidate || 'publishTime' in candidate) score += 3;
	if ('share_info' in candidate || 'shareInfo' in candidate) score += 2;
	return score;
}

function bestDouyinVideoCandidate(roots: any[]): any {
	const candidates = roots.flatMap(root => findObjectsByKeys(root, [
		'aweme_id',
		'awemeId',
		'itemId',
		'video',
		'images',
		'desc',
		'description',
		'title',
		'author',
		'authorInfo',
		'createTime',
		'create_time',
		'publishTime',
	]));
	return candidates
		.map(candidate => ({ candidate, score: douyinCandidateScore(candidate) }))
		.filter(item => item.score > 0)
		.sort((a, b) => b.score - a.score)[0]?.candidate || {};
}

function collectDouyinJsonRoots(fullHtml: string): any[] {
	const roots = [
		extractJsonScriptById(fullHtml, 'RENDER_DATA'),
		extractJsonScriptById(fullHtml, '__UNIVERSAL_DATA_FOR_REHYDRATION__'),
		extractJsonScriptById(fullHtml, 'SIGI_STATE'),
		extractJsonAssignment(fullHtml, 'window._ROUTER_DATA'),
		extractJsonAssignment(fullHtml, 'window.__INIT_PROPS__'),
		extractJsonAssignment(fullHtml, 'window.__INITIAL_STATE__'),
		...extractApplicationJsonScripts(fullHtml),
	];
	return roots.filter(Boolean);
}

function douyinCanonicalUrl(input: VideoClipExtractionInput, video: any): string {
	const explicitUrl = firstValueAtPath(video, [
		['share_url'],
		['shareUrl'],
		['share_info', 'share_url'],
		['shareInfo', 'shareUrl'],
		['url'],
	]);
	if (/^https?:\/\//i.test(explicitUrl)) {
		return explicitUrl;
	}

	const metaUrl = metaContent(input.metaTags, 'og:url')
		|| metaContent(input.metaTags, 'twitter:url')
		|| htmlLinkHref(input.fullHtml || '', 'canonical');
	if (metaUrl) {
		return normalizeUrl(metaUrl, input.url);
	}

	const awemeId = firstValueAtPath(video, [
		['aweme_id'],
		['awemeId'],
		['itemId'],
		['id'],
	]);
	return awemeId ? `https://www.douyin.com/video/${awemeId}` : '';
}

function extractDouyinVideo(input: VideoClipExtractionInput): Partial<VideoClipData> {
	const roots = collectDouyinJsonRoots(input.fullHtml || '');
	const video = bestDouyinVideoCandidate(roots);
	const schemaData = extractSchemaVideo(input);
	const metaDescription = douyinMetaDescription(input);
	const structuredDownloadUrl = findBestVideoDownloadUrl([
		...collectUrlCandidatesFromValue(firstRawValueAtPath(video, [
			['video', 'play_addr'],
			['video', 'playAddr'],
			['video', 'download_addr'],
			['video', 'downloadAddr'],
			['video', 'bit_rate'],
			['video', 'bitRate'],
			['play_addr'],
			['playAddr'],
			['download_addr'],
			['downloadAddr'],
		])),
		...collectUrlCandidatesFromValue(video),
	], 'douyin', input.url);
	const liveDownloadUrl = findBestVideoDownloadUrl([
		input.extractedContent?.videoDownloadUrl || '',
	], 'douyin', input.url);
	const downloadUrl = structuredDownloadUrl || liveDownloadUrl;
	const rawTitle = firstValueAtPath(video, [
		['desc'],
		['description'],
		['title'],
		['share_info', 'share_title'],
		['shareInfo', 'shareTitle'],
	])
		|| schemaData.title
		|| metaContent(input.metaTags, 'lark:url:video_title')
		|| metaContent(input.metaTags, 'og:title')
		|| douyinTitleFromMetaDescription(metaDescription)
		|| input.title;
	const rawDescription = firstValueAtPath(video, [
		['desc'],
		['description'],
		['share_info', 'share_desc'],
		['shareInfo', 'shareDesc'],
	])
		|| schemaData.description
		|| metaContent(input.metaTags, 'lark:url:video_title')
		|| douyinTitleFromMetaDescription(metaDescription)
		|| input.description;
	const coverValue = firstRawValueAtPath(video, [
		['video', 'cover', 'urlList'],
		['video', 'cover', 'url_list'],
		['video', 'cover'],
		['video', 'origin_cover', 'url_list'],
		['video', 'originCover', 'urlList'],
		['video', 'dynamic_cover', 'url_list'],
		['video', 'dynamicCover', 'urlList'],
		['cover', 'urlList'],
		['cover', 'url_list'],
		['cover'],
		['images'],
		['share_info', 'share_cover', 'url_list'],
		['shareInfo', 'shareCover', 'urlList'],
	]);
	return {
		title: cleanDouyinText(rawTitle),
		author: cleanDouyinAuthor(firstValueAtPath(video, [
			['author', 'nickname'],
			['author', 'name'],
			['authorInfo', 'nickname'],
			['authorInfo', 'name'],
			['user', 'nickname'],
			['userInfo', 'nickname'],
			['nickname'],
		]) || schemaData.author || metaContent(input.metaTags, 'author') || input.author || douyinAuthorFromMetaDescription(metaDescription)),
		published: normalizeDate(firstValueAtPath(video, [
			['createTime'],
			['create_time'],
			['createTimestamp'],
			['publishTime'],
			['publishedTime'],
		])) || schemaData.published || normalizeDate(input.published) || douyinPublishedFromMetaDescription(metaDescription),
		cover: normalizeUrl(firstUrlFrom(coverValue)
			|| schemaData.cover
			|| metaContent(input.metaTags, 'lark:url:video_cover_image_url')
			|| metaContent(input.metaTags, 'og:image')
			|| metaContent(input.metaTags, 'twitter:image')
			|| input.image, input.url),
		description: cleanDouyinText(rawDescription),
		url: douyinCanonicalUrl(input, video),
		downloadUrl,
		userAgent: input.extractedContent?.videoUserAgent || '',
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
		url: (platformData.url || input.url).replace(/#:~:text=[^&]+(&|$)/, ''),
		downloadUrl: platformData.downloadUrl
			|| findBestVideoDownloadUrl([input.extractedContent?.videoDownloadUrl || ''], platform, input.url),
		userAgent: platformData.userAgent || input.extractedContent?.videoUserAgent || '',
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
		'{{videoDownloadUrl}}': video.downloadUrl,
		'{{videoUserAgent}}': video.userAgent,
	};
	return Object.entries(replacements).reduce(
		(result, [key, value]) => result.split(key).join(escapeCommandValue(value)),
		template
	);
}

function commandUsesYtdlp(command: string): boolean {
	return /(?:^|[\s/\\])yt-dlp(?:\s|$)/.test(command);
}

export function buildVideoVariables(
	video: VideoClipData | null,
	settings: VideoClippingSettings = DEFAULT_VIDEO_CLIPPING_SETTINGS
): Record<string, string> {
	if (!video) {
		return {
			'{{videoPlatform}}': '',
			'{{videoUrl}}': '',
			'{{videoTitle}}': '',
			'{{videoAuthor}}': '',
			'{{videoPublished}}': '',
			'{{videoCover}}': '',
			'{{videoDescription}}': '',
			'{{videoSummary}}': '',
			'{{videoTranscript}}': '',
			'{{videoDownloadUrl}}': '',
			'{{videoUserAgent}}': '',
			'{{videoDownloadCommand}}': '',
			'{{videoDownloadCommandInstallGuide}}': '',
		};
	}

	const videoDownloadCommand = settings.includeDownloadCommand
		? renderDownloadCommand(video, settings.downloadCommandTemplate || DEFAULT_VIDEO_DOWNLOAD_COMMAND_TEMPLATE)
		: '';

	return {
		'{{videoPlatform}}': video.platform,
		'{{videoUrl}}': video.url,
		'{{videoTitle}}': video.title,
		'{{videoAuthor}}': video.author,
		'{{videoPublished}}': video.published,
		'{{videoCover}}': video.cover,
		'{{videoDescription}}': video.description,
		'{{videoSummary}}': settings.includeSummary ? video.summary : '',
		'{{videoTranscript}}': settings.includeTranscript ? video.transcript : '',
		'{{videoDownloadUrl}}': video.downloadUrl,
		'{{videoUserAgent}}': video.userAgent,
		'{{videoDownloadCommand}}': videoDownloadCommand,
		'{{videoDownloadCommandInstallGuide}}': commandUsesYtdlp(videoDownloadCommand) ? YTDLP_INSTALL_GUIDE : '',
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
			'{% if videoDownloadCommandInstallGuide %}',
			'',
			'> {{videoDownloadCommandInstallGuide}}',
			'{% endif %}',
			'{% endif %}',
			'',
			'[打开视频]({{videoUrl}})',
		].join('\n'),
		properties: [
			{ name: 'title', value: '{{videoTitle}}', type: 'text' },
			{ name: 'author', value: '{{videoAuthor|wikilink}}', type: 'multitext' },
			{ name: 'published', value: '{{videoPublished|date:YYYY-MM-DD}}', type: 'date' },
			{ name: 'source', value: '{{videoUrl}}', type: 'text' },
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
