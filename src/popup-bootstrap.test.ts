import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

describe('popup-bootstrap fallback', () => {
	test('replaces reload-only popup state after an early script error', () => {
		const { window, document } = parseHTML(`
			<html>
				<body class="has-error has-inline-error">
					<p class="error-message" style="display: flex;">Please try reloading the page.</p>
					<div class="clipper" style="display: none;">
						<textarea id="note-name-field"></textarea>
						<div class="metadata-properties"></div>
						<textarea id="note-content-field"></textarea>
						<input id="path-name-field">
					</div>
				</body>
			</html>
		`);
		document.title = 'Obsidian Web Clipper';
		const listeners: Record<string, (event: any) => void> = {};
		const browser = {
			tabs: {
				query: () => Promise.resolve([{
					title: 'Feishu doc',
					url: 'https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf',
				}]),
			},
		};
		const script = readFileSync(join(process.cwd(), 'src/popup-bootstrap.js'), 'utf8');

		vm.runInNewContext(script, {
			window: {
				...window,
				browser,
				addEventListener: (type: string, listener: (event: any) => void) => {
					listeners[type] = listener;
				},
				setTimeout: (callback: () => void) => callback(),
			},
			document,
			browser,
		});

		listeners.error({ error: new Error('module failed before popup.ts') });

		return Promise.resolve().then(() => {
			expect((document.querySelector('.clipper') as HTMLElement).style.display).toBe('block');
			expect((document.querySelector('.error-message') as HTMLElement).style.display).toBe('none');
			expect(document.body.classList.contains('has-error')).toBe(false);
			expect(document.body.classList.contains('has-inline-error')).toBe(false);
			expect(document.body.dataset.fallbackRendered).toBe('bootstrap');
			expect((document.getElementById('note-name-field') as HTMLTextAreaElement).value).toBe('Feishu doc');
			expect((document.getElementById('path-name-field') as HTMLInputElement).value).toBe('Clippings');
			expect((document.getElementById('source') as HTMLInputElement).value).toBe('https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf');
		});
	});
});
