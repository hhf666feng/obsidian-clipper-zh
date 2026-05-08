import { describe, expect, test } from 'vitest';
import { cookieDomainsForVideo } from './video-download-cookies';

describe('video download cookie collection', () => {
	test('uses Douyin related domains so current browser cookies can satisfy yt-dlp', () => {
		expect(cookieDomainsForVideo('https://www.douyin.com/video/7626747241792802098', 'douyin')).toEqual([
			'douyin.com',
			'iesdouyin.com',
			'amemv.com',
		]);
	});

	test('falls back to the URL base domain for unknown platforms', () => {
		expect(cookieDomainsForVideo('https://sub.example.com/watch/1', 'unknown')).toEqual(['example.com']);
	});
});
