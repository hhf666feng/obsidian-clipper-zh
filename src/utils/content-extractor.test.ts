import { afterEach, describe, expect, test, vi } from 'vitest';
import type { AnyHighlightData } from './highlighter';
import browser from './browser-polyfill';

vi.mock('./highlighter', () => ({
	collapseGroupsForExport: (highlights: AnyHighlightData[]) => highlights,
}));

vi.mock('./storage-utils', () => ({
	generalSettings: {
		highlighterEnabled: false,
		highlightBehavior: 'no-highlights',
		videoClipping: {},
	},
}));

import { createMarkdownContent } from 'defuddle/full';
import { extractPageContent, initializePageContent } from './content-extractor';

vi.mock('defuddle/full', () => ({
	createMarkdownContent: vi.fn((html: string) => `markdown:${html}`),
}));

describe('extractPageContent', () => {
	afterEach(() => {
		(browser.runtime as any).sendMessage = async () => ({});
		(browser.tabs as any).get = async () => ({});
	});

	test('returns minimal fallback content after extraction retry fails', async () => {
		(browser.runtime as any).sendMessage = async (message: any) => {
			if (message.action === 'forceInjectContentScript') {
				return { success: true };
			}
			return { success: false, error: 'Content script did not respond after injection' };
		};
		(browser.tabs as any).get = async () => ({
			id: 123,
			url: 'https://www.bilibili.com/video/BV1KMQnBFEHu/?spm_id_from=333.337.search-card.all.click',
			title: 'Bilibili fallback title',
		});

		const response = await extractPageContent(123);

		expect(response).toMatchObject({
			url: 'https://www.bilibili.com/video/BV1KMQnBFEHu/?spm_id_from=333.337.search-card.all.click',
			content: '',
			title: 'Bilibili fallback title',
			wordCount: 0,
			metaTags: [],
		});
		expect(response?.extractedContent.extractionFallback).toBe('true');
		expect(response?.extractedContent.extractionError).toContain('Content script did not respond');
	});

	test('normalizes partial content script responses into complete content data', async () => {
		(browser.runtime as any).sendMessage = async () => ({
			content: '',
			url: 'https://mp.weixin.qq.com/s/current-window',
			title: 'Partial response title',
		});

		const response = await extractPageContent(321);

		expect(response).toMatchObject({
			url: 'https://mp.weixin.qq.com/s/current-window',
			content: '',
			selectedHtml: '',
			title: 'Partial response title',
			author: '',
			description: '',
			fullHtml: '',
			highlights: [],
			wordCount: 0,
			metaTags: [],
		});
		expect(response?.domain).toBe('qq.com');
		expect(response?.site).toBe('qq.com');
	});

	test('returns fallback content even when tab lookup also fails', async () => {
		(browser.runtime as any).sendMessage = async (message: any) => {
			if (message.action === 'forceInjectContentScript') {
				throw new Error('Cannot inject into tab');
			}
			return { success: false, error: 'No receiver for getPageContent' };
		};
		(browser.tabs as any).get = async () => {
			throw new Error('Tab no longer exists');
		};

		const response = await extractPageContent(999);

		expect(response).toMatchObject({
			url: '',
			content: '',
			title: 'Untitled',
			domain: '',
			site: '',
			wordCount: 0,
			metaTags: [],
		});
		expect(response?.extractedContent.extractionFallback).toBe('true');
		expect(response?.extractedContent.extractionError).toContain('No receiver');
	});
});

describe('initializePageContent', () => {
	afterEach(() => {
		vi.mocked(createMarkdownContent).mockImplementation((html: string) => `markdown:${html}`);
	});

	test('returns fallback variables when markdown conversion fails', async () => {
		vi.mocked(createMarkdownContent).mockImplementation(() => {
			throw new Error('Cannot convert this page');
		});

		const result = await initializePageContent(
			'<article>Body</article>',
			'',
			{},
			'https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf',
			null,
			'<html><body>Body</body></html>',
			undefined,
			[],
			'Feishu doc',
			'',
			'',
			'',
			'',
			'',
			'my.feishu.cn',
			0,
			'',
			[],
		);

		expect(result.currentVariables['{{title}}']).toBe('Feishu doc');
		expect(result.currentVariables['{{url}}']).toBe('https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf');
		expect(result.currentVariables['{{content}}']).toBe('');
		expect(result.currentVariables['{{contentHtml}}']).toBe('<article>Body</article>');
		expect(result.currentVariables['{{extractionFallback}}']).toBe('true');
		expect(result.currentVariables['{{extractionError}}']).toContain('Cannot convert this page');
	});
});
