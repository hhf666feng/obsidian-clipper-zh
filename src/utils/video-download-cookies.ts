import browser from './browser-polyfill';
import type { VideoDownloadCookie } from './video-download-request';

type BrowserCookie = chrome.cookies.Cookie;

const PLATFORM_COOKIE_DOMAINS: Record<string, string[]> = {
	bilibili: ['bilibili.com', 'biliapi.net', 'bilivideo.com'],
	douyin: ['douyin.com', 'iesdouyin.com', 'amemv.com'],
	youtube: ['youtube.com'],
};

function baseDomainFromHost(hostname: string): string {
	const parts = hostname.replace(/^www\./, '').split('.').filter(Boolean);
	if (parts.length <= 2) {
		return parts.join('.');
	}
	return parts.slice(-2).join('.');
}

export function cookieDomainsForVideo(url: string, platform: string): string[] {
	const domains = new Set<string>();
	try {
		const parsed = new URL(url);
		domains.add(baseDomainFromHost(parsed.hostname));
	} catch {
		// Fall through to platform defaults.
	}

	for (const domain of PLATFORM_COOKIE_DOMAINS[platform] || []) {
		domains.add(domain);
	}
	return [...domains].filter(Boolean);
}

function cookieKey(cookie: BrowserCookie): string {
	return [
		cookie.storeId || '',
		cookie.domain,
		cookie.path,
		cookie.name,
	].join('\t');
}

function normalizeCookie(cookie: BrowserCookie): VideoDownloadCookie | null {
	if (!cookie.name || !cookie.domain) {
		return null;
	}

	return {
		name: cookie.name,
		value: cookie.value || '',
		domain: cookie.domain,
		path: cookie.path || '/',
		secure: Boolean(cookie.secure),
		httpOnly: Boolean(cookie.httpOnly),
		hostOnly: Boolean(cookie.hostOnly),
		expirationDate: typeof cookie.expirationDate === 'number'
			? Math.floor(cookie.expirationDate)
			: undefined,
	};
}

export async function collectCurrentBrowserVideoCookies(url: string, platform: string): Promise<VideoDownloadCookie[]> {
	const cookiesApi = (browser as unknown as {
		cookies?: {
			getAll(details: chrome.cookies.GetAllDetails): Promise<BrowserCookie[]>;
		};
	}).cookies;
	if (!cookiesApi || typeof cookiesApi.getAll !== 'function') {
		return [];
	}

	const domains = cookieDomainsForVideo(url, platform);
	const collected = new Map<string, BrowserCookie>();
	for (const domain of domains) {
		try {
			for (const cookie of await cookiesApi.getAll({ domain })) {
				collected.set(cookieKey(cookie), cookie);
			}
		} catch (error) {
			console.warn(`Unable to collect cookies for ${domain}:`, error);
		}
	}

	try {
		const parsed = new URL(url);
		for (const cookie of await cookiesApi.getAll({ url: `${parsed.origin}/` })) {
			collected.set(cookieKey(cookie), cookie);
		}
	} catch {
		// Ignore malformed or unsupported URLs; domain-based cookies above are enough.
	}

	return [...collected.values()]
		.map(normalizeCookie)
		.filter((cookie): cookie is VideoDownloadCookie => Boolean(cookie));
}
