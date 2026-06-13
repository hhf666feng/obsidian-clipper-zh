import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const zipPath = process.argv[2];
if (!zipPath) {
	console.error('Usage: node scripts/smoke-popup-bootstrap.mjs <extension.zip>');
	process.exit(2);
}

function runBootstrap(script, document, window, browser, listeners) {
	vm.runInNewContext(script, {
		window: {
			...window,
			browser,
			addEventListener: (type, listener) => {
				listeners[type] = listener;
			},
			setTimeout: callback => callback(),
			MutationObserver: class {
				observe() {}
			},
		},
		document,
		browser,
		MutationObserver: class {
			observe() {}
		},
	});
}

async function assertEarlyFallback(script) {
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
	const listeners = {};
	const browser = {
		tabs: {
			query: () => Promise.resolve([{
				title: 'Feishu doc',
				url: 'https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf',
			}]),
		},
	};

	runBootstrap(script, document, window, browser, listeners);
	listeners.error({ error: new Error('module failed before popup.ts') });
	await Promise.resolve();

	const failed = [
		document.body.dataset.fallbackRendered !== 'bootstrap' && 'missing bootstrap marker',
		document.body.classList.contains('has-error') && 'has-error still set',
		document.body.classList.contains('has-inline-error') && 'has-inline-error still set',
		document.querySelector('.clipper')?.style.display !== 'block' && 'clipper not shown',
		document.querySelector('.error-message')?.style.display !== 'none' && 'error still shown',
		document.getElementById('note-name-field')?.value !== 'Feishu doc' && 'title not populated',
		document.getElementById('path-name-field')?.value !== 'Clippings' && 'path not populated',
		document.getElementById('source')?.value !== 'https://my.feishu.cn/docx/UIYZdMT4Mo7wCFxkSXXcBacontf' && 'source not populated',
	].filter(Boolean);
	if (failed.length > 0) {
		throw new Error(`early fallback failed: ${failed.join(', ')}`);
	}
}

async function assertReadyPopupIsNotOverwritten(script) {
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
	const listeners = {};
	const browser = {
		tabs: {
			query: () => Promise.resolve([{
				title: 'Late tab title',
				url: 'https://example.com/late',
			}]),
		},
	};

	runBootstrap(script, document, window, browser, listeners);
	listeners.error({ error: new Error('late optional UI failure') });
	await Promise.resolve();

	const failed = [
		document.body.dataset.fallbackRendered && 'unexpected bootstrap marker',
		document.getElementById('note-name-field')?.value !== 'Existing note' && 'title overwritten',
		document.getElementById('note-content-field')?.value !== 'Existing content' && 'content overwritten',
		document.getElementById('path-name-field')?.value !== 'Existing/Path' && 'path overwritten',
	].filter(Boolean);
	if (failed.length > 0) {
		throw new Error(`ready popup overwrite guard failed: ${failed.join(', ')}`);
	}
}

async function assertFatalStateFallback(script) {
	const { window, document } = parseHTML(`
		<html>
			<body class="has-error">
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
	const listeners = {};
	const browser = {
		tabs: {
			query: () => Promise.resolve([{
				title: 'WeChat article',
				url: 'https://mp.weixin.qq.com/s/7OAo2uHmkEpPntPVPPFJnA',
			}]),
		},
	};

	runBootstrap(script, document, window, browser, listeners);
	listeners.DOMContentLoaded?.({});
	await Promise.resolve();

	const failed = [
		document.body.dataset.fallbackRendered !== 'bootstrap' && 'missing bootstrap marker',
		document.querySelector('.clipper')?.style.display !== 'block' && 'clipper not shown',
		document.querySelector('.error-message')?.style.display !== 'none' && 'error still shown',
		document.getElementById('note-name-field')?.value !== 'WeChat article' && 'title not populated',
		document.getElementById('source')?.value !== 'https://mp.weixin.qq.com/s/7OAo2uHmkEpPntPVPPFJnA' && 'source not populated',
	].filter(Boolean);
	if (failed.length > 0) {
		throw new Error(`fatal state fallback failed: ${failed.join(', ')}`);
	}
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'clipper-popup-smoke-'));
try {
	execFileSync('unzip', ['-q', zipPath, 'popup-bootstrap.js', 'popup.html', 'manifest.json', '-d', tempDir]);
	const script = readFileSync(path.join(tempDir, 'popup-bootstrap.js'), 'utf8');
	const popupHtml = readFileSync(path.join(tempDir, 'popup.html'), 'utf8');
	const manifest = JSON.parse(readFileSync(path.join(tempDir, 'manifest.json'), 'utf8'));

	if (!popupHtml.includes('<script src="popup-bootstrap.js"></script>')) {
		throw new Error('popup.html does not load popup-bootstrap.js');
	}
	if (popupHtml.indexOf('popup-bootstrap.js') > popupHtml.indexOf('popup.js')) {
		throw new Error('popup-bootstrap.js must load before popup.js');
	}
	if (!manifest.action?.default_popup) {
		throw new Error('manifest action.default_popup is missing');
	}

	await assertEarlyFallback(script);
	await assertReadyPopupIsNotOverwritten(script);
	await assertFatalStateFallback(script);

	console.log(`popup bootstrap smoke passed: ${zipPath}`);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
