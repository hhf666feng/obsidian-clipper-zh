import { describe, expect, test } from 'vitest';
import { shouldRegisterYouTubeInnertubeWebRequestFallback } from './youtube-innertube-headers';

describe('YouTube innertube header routing', () => {
	test('does not register blocking webRequest fallback in Chrome MV3 without webRequestBlocking permission', () => {
		expect(shouldRegisterYouTubeInnertubeWebRequestFallback({
			hasDeclarativeNetRequest: true,
			hasOnBeforeSendHeaders: true,
			permissions: ['webRequest', 'declarativeNetRequest'],
		})).toBe(false);
	});

	test('registers blocking webRequest fallback only when the manifest explicitly permits it', () => {
		expect(shouldRegisterYouTubeInnertubeWebRequestFallback({
			hasDeclarativeNetRequest: false,
			hasOnBeforeSendHeaders: true,
			permissions: ['webRequest', 'webRequestBlocking'],
		})).toBe(true);

		expect(shouldRegisterYouTubeInnertubeWebRequestFallback({
			hasDeclarativeNetRequest: false,
			hasOnBeforeSendHeaders: true,
			permissions: ['webRequest'],
		})).toBe(false);
	});
});
