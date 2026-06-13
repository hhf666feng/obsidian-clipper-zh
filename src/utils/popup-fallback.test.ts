import { describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { renderMinimalFallbackFields } from './popup-fallback';

describe('renderMinimalFallbackFields', () => {
	test('keeps the clipper editable when normal fallback rendering cannot run', () => {
		const { document } = parseHTML(`
			<body class="has-error">
				<p class="error-message" style="display: flex;">Please try reloading the page.</p>
				<div class="clipper" style="display: none;">
					<textarea id="note-name-field"></textarea>
					<div class="metadata-properties"></div>
					<textarea id="note-content-field"></textarea>
					<input id="path-name-field">
				</div>
			</body>
		`);

		const rendered = renderMinimalFallbackFields({
			document: document as unknown as Document,
			path: 'Clippings',
			variables: {
				'{{title}}': 'Feishu doc',
				'{{url}}': 'https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf',
				'{{content}}': '',
			},
		});

		expect(rendered).toBe(true);
		expect((document.getElementById('note-name-field') as HTMLTextAreaElement).value).toBe('Feishu doc');
		expect((document.getElementById('note-content-field') as HTMLTextAreaElement).value).toBe('');
		expect((document.getElementById('path-name-field') as HTMLInputElement).value).toBe('Clippings');
		expect((document.querySelector('.clipper') as HTMLElement).style.display).toBe('block');
		expect((document.querySelector('.error-message') as HTMLElement).style.display).toBe('none');
		expect(document.body.classList.contains('has-error')).toBe(false);
		expect((document.getElementById('title') as HTMLInputElement).value).toBe('Feishu doc');
		expect((document.getElementById('source') as HTMLInputElement).value).toBe('https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf');
	});
});
