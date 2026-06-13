import { describe, expect, test, vi } from 'vitest';
import type { Template } from '../types/types';
import { chooseFallbackTemplate, isUsableTemplate, runOptionalStep, runRequiredStep } from './resilience';

const defaultTemplate: Template = {
	id: 'default',
	name: 'Default',
	behavior: 'create',
	noteNameFormat: '{{title}}',
	path: 'Clippings',
	noteContentFormat: '{{content}}',
	properties: [],
	triggers: [],
};

describe('runOptionalStep', () => {
	test('continues when a recoverable setup step fails', async () => {
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await runOptionalStep('setup language', () => {
			throw new Error('storage unavailable');
		}, logger);

		expect(result).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(
			'setup language failed; continuing with degraded functionality.',
			expect.any(Error),
		);
	});
});

describe('runRequiredStep', () => {
	test('preserves hard failures with step context', async () => {
		await expect(runRequiredStep('load templates', () => {
			throw new Error('sync storage unavailable');
		})).rejects.toThrow('load templates failed: sync storage unavailable');
	});
});

describe('isUsableTemplate', () => {
	test('rejects malformed templates before fallback rendering', () => {
		expect(isUsableTemplate({
			id: 'bad',
			name: 'Bad',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: 'Clippings',
			noteContentFormat: '{{content}}',
			properties: null,
		} as unknown as Template)).toBe(false);
	});
});

describe('chooseFallbackTemplate', () => {
	test('uses default template when current template is malformed', () => {
		const badTemplate = {
			id: 'bad',
			name: 'Bad',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: 'Clippings',
			noteContentFormat: '{{content}}',
			properties: 'not-an-array',
		} as unknown as Template;

		expect(chooseFallbackTemplate([badTemplate], badTemplate, defaultTemplate)).toBe(defaultTemplate);
	});

	test('prefers usable built-in video template for video fallback', () => {
		const videoTemplate = {
			...defaultTemplate,
			id: 'builtin-video-clip',
			name: 'Video',
		};

		expect(chooseFallbackTemplate([videoTemplate], defaultTemplate, defaultTemplate, { preferVideoTemplate: true })).toBe(videoTemplate);
	});
});
