import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

describe('popup-bootstrap fallback', () => {
	function runBootstrap(document: Document, window: Window, browser: any, listeners: Record<string, (event: any) => void>) {
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
	}

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

		runBootstrap(document as unknown as Document, window as unknown as Window, browser, listeners);

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

	test('does not replace an initialized popup after later non-fatal errors', () => {
		const { window, document } = parseHTML(`
			<html>
				<body data-popup-ready="true">
					<p class="error-message" style="display: none;"></p>
					<div class="clipper" style="display: block;">
						<textarea id="note-name-field">Existing note</textarea>
						<div class="metadata-properties"></div>
						<textarea id="note-content-field">Existing content</textarea>
						<input id="path-name-field" value="Existing/Path">
					</div>
				</body>
			</html>
		`);
		const listeners: Record<string, (event: any) => void> = {};
		const browser = {
			tabs: {
				query: () => Promise.resolve([{
					title: 'Late tab title',
					url: 'https://example.com/late',
				}]),
			},
		};

		runBootstrap(document as unknown as Document, window as unknown as Window, browser, listeners);
		listeners.error({ error: new Error('late optional UI failure') });

		return Promise.resolve().then(() => {
			expect(document.body.dataset.fallbackRendered).toBeUndefined();
			expect((document.getElementById('note-name-field') as HTMLTextAreaElement).value).toBe('Existing note');
			expect((document.getElementById('note-content-field') as HTMLTextAreaElement).value).toBe('Existing content');
			expect((document.getElementById('path-name-field') as HTMLInputElement).value).toBe('Existing/Path');
		});
	});
});
