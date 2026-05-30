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

import { extractPageContent } from './content-extractor';

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
});
