import { describe, expect, test } from 'vitest';
import { Template } from '../types/types';
import { createFeishuClipTemplate } from './feishu-clipping';
import { findMatchingTemplate, initializeTriggers, matchPattern } from './triggers';

function template(id: string, triggers: string[]): Template {
	return {
		id,
		name: id,
		behavior: 'create',
		noteNameFormat: '{{title}}',
		path: '',
		noteContentFormat: '{{content}}',
		properties: [],
		triggers,
	};
}

describe('trigger matching', () => {
	test('matches YouTube watch URLs with playlist parameters', async () => {
		const videoTemplate = template('video', ['https://www.youtube.com/watch']);
		initializeTriggers([
			template('default', []),
			videoTemplate,
		]);

		await expect(findMatchingTemplate(
			'https://www.youtube.com/watch?v=0kILa02vKuI&list=PLmWCw1CzcFilebjK89WLb5cAvM8K0cLB3&index=4',
			async () => null,
		)).resolves.toBe(videoTemplate);
	});

	test('does not reuse URL-prefix memo results across paths on the same origin', () => {
		expect(matchPattern('https://www.youtube.com/watch', 'https://www.youtube.com/watch?v=abc', null)).toBe(true);
		expect(matchPattern('https://www.youtube.com/watch', 'https://www.youtube.com/feed/subscriptions', null)).toBe(false);
	});

	test('matches Feishu and Lark tenant document URLs', async () => {
		const feishuTemplate = createFeishuClipTemplate();
		initializeTriggers([template('default', []), feishuTemplate]);

		await expect(findMatchingTemplate(
			'https://acme.feishu.cn/docx/abc123',
			async () => null,
		)).resolves.toBe(feishuTemplate);
		await expect(findMatchingTemplate(
			'https://acme.larksuite.com/wiki/xyz789',
			async () => null,
		)).resolves.toBe(feishuTemplate);
	});
});
