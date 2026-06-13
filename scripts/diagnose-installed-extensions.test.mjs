import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tempDir = mkdtempSync(path.join(tmpdir(), 'clipper-installed-fixture-'));

function writeJson(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, value);
}

try {
	const chromeRoot = path.join(tempDir, 'Google', 'Chrome');
	const extensionDir = path.join(chromeRoot, 'Profile 1', 'Extensions', 'staleclipperid', '1.6.1_0');

	writeJson(path.join(extensionDir, 'manifest.json'), {
		manifest_version: 3,
		name: 'Obsidian Web Clipper',
		version: '1.6.1',
		action: {
			default_popup: 'popup.html',
		},
	});
	writeText(path.join(extensionDir, 'popup.html'), '<html><body><script type="module" src="popup.js"></script></body></html>');
	writeJson(path.join(chromeRoot, 'Profile 1', 'Preferences'), {
		extensions: {
			settings: {
				staleclipperid: {
					state: 1,
					path: 'staleclipperid/1.6.1_0',
					manifest: {
						name: 'Obsidian Web Clipper',
						version: '1.6.1',
						action: {
							default_popup: 'popup.html',
						},
					},
				},
			},
		},
	});

	const output = execFileSync(process.execPath, [
		path.join(process.cwd(), 'scripts', 'diagnose-installed-extensions.mjs'),
		'--chrome-root',
		chromeRoot,
		'--expected-version-name',
		'1.6.2-zh.28',
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	assert.match(output, /Profile 1/);
	assert.match(output, /staleclipperid/);
	assert.match(output, /1\.6\.1/);
	assert.match(output, /OUTDATED/);
	assert.match(output, /MISSING_BOOTSTRAP/);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
