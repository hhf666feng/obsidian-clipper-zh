import { describe, expect, test } from 'vitest';
import {
	DEFAULT_FOLDER_ROUTING_SETTINGS,
	parseSiteFolderRulesText,
	resolveFolderPathForUrl,
	serializeSiteFolderRules,
} from './folder-routing';

describe('folder routing', () => {
	test('routes built-in sites under the default Clippings folder', () => {
		expect(resolveFolderPathForUrl('https://mp.weixin.qq.com/s/example', DEFAULT_FOLDER_ROUTING_SETTINGS, 'Clippings')).toBe('Clippings/微信公众号');
		expect(resolveFolderPathForUrl('https://www.bilibili.com/video/BV123', DEFAULT_FOLDER_ROUTING_SETTINGS, 'Clippings/Videos')).toBe('Clippings/哔哩哔哩');
		expect(resolveFolderPathForUrl('https://m.youtube.com/watch?v=abc', DEFAULT_FOLDER_ROUTING_SETTINGS, 'Clippings/Videos')).toBe('Clippings/YouTube');
		expect(resolveFolderPathForUrl('https://www.douyin.com/video/7625484359843319083', DEFAULT_FOLDER_ROUTING_SETTINGS, 'Clippings/Videos')).toBe('Clippings/抖音');
		expect(resolveFolderPathForUrl('https://v.douyin.com/iExample/', DEFAULT_FOLDER_ROUTING_SETTINGS, 'Clippings/Videos')).toBe('Clippings/抖音');
	});

	test('uses the configured default folder while preserving explicit template folders', () => {
		const settings = {
			defaultPath: 'Inbox',
			rules: [],
		};

		expect(resolveFolderPathForUrl('https://example.com/page', settings, 'Clippings')).toBe('Inbox');
		expect(resolveFolderPathForUrl('https://example.com/page', settings, '')).toBe('Inbox');
		expect(resolveFolderPathForUrl('https://example.com/page', settings, 'Research/Articles')).toBe('Research/Articles');
	});

	test('matches configurable domain and regex rules', () => {
		const settings = {
			defaultPath: 'Clippings',
			rules: [
				{ patternType: 'domain' as const, pattern: 'youtube.com', path: 'Media/YouTube' },
				{ patternType: 'regex' as const, pattern: '^https://news\\.ycombinator\\.com/item\\?id=', path: 'Forums/Hacker News' },
			],
		};

		expect(resolveFolderPathForUrl('https://www.youtube.com/shorts/abc', settings, 'Clippings')).toBe('Media/YouTube');
		expect(resolveFolderPathForUrl('https://news.ycombinator.com/item?id=123', settings, 'Clippings')).toBe('Forums/Hacker News');
		expect(resolveFolderPathForUrl('https://news.ycombinator.com/news', settings, 'Clippings')).toBe('Clippings');
	});

	test('parses editable rule text and serializes it back predictably', () => {
		const rules = parseSiteFolderRulesText([
			'mp.weixin.qq.com => Clippings/微信',
			'regex:^https://example\\.com/articles/ => Clippings/Example',
			'# comments are ignored',
			'',
		].join('\n'));

		expect(rules).toEqual([
			{ patternType: 'domain', pattern: 'mp.weixin.qq.com', path: 'Clippings/微信' },
			{ patternType: 'regex', pattern: '^https://example\\.com/articles/', path: 'Clippings/Example' },
		]);
		expect(serializeSiteFolderRules(rules)).toBe([
			'domain:mp.weixin.qq.com => Clippings/微信',
			'regex:^https://example\\.com/articles/ => Clippings/Example',
		].join('\n'));
	});
});
