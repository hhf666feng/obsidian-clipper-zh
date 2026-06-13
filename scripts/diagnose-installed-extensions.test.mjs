import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

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
	const healthyExtensionDir = path.join(chromeRoot, 'Profile 2', 'Extensions', 'freshclipperid', '1.6.2_29');
	const diagnoseScript = path.join(process.cwd(), 'scripts', 'diagnose-installed-extensions.mjs');

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
	writeJson(path.join(healthyExtensionDir, 'manifest.json'), {
		manifest_version: 3,
		name: 'Obsidian Web Clipper',
		version: '1.6.2.29',
		version_name: '1.6.2-zh.29',
		action: {
			default_popup: 'popup.html',
		},
	});
	writeText(path.join(healthyExtensionDir, 'popup.html'), [
		'<html><body>',
		'<script src="popup-bootstrap.js"></script>',
		'<script type="module" src="popup.js"></script>',
		'</body></html>',
	].join(''));

	const output = execFileSync(process.execPath, [
		diagnoseScript,
		'--chrome-root',
		chromeRoot,
		'--expected-version-name',
		'1.6.2-zh.29',
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	assert.match(output, /Profile 1/);
	assert.match(output, /staleclipperid/);
	assert.match(output, /1\.6\.1/);
	assert.match(output, /OUTDATED/);
	assert.match(output, /MISSING_BOOTSTRAP/);
	assert.match(output, /Profile 2/);
	assert.match(output, /freshclipperid/);
	assert.match(output, /1\.6\.2-zh\.29/);
	assert.match(output, /OK/);

	const strictResult = spawnSync(process.execPath, [
		diagnoseScript,
		'--chrome-root',
		chromeRoot,
		'--expected-version-name',
		'1.6.2-zh.29',
		'--strict',
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});
	assert.notEqual(strictResult.status, 0);
	assert.match(strictResult.stderr, /Installed extension check failed: 1 stale or unsafe package\(s\) found/);

	const healthyOnlyRoot = path.join(tempDir, 'Healthy Chrome');
	const healthyOnlyExtensionDir = path.join(healthyOnlyRoot, 'Profile 1', 'Extensions', 'freshclipperid', '1.6.2_29');
	writeJson(path.join(healthyOnlyExtensionDir, 'manifest.json'), {
		manifest_version: 3,
		name: 'Obsidian Web Clipper',
		version: '1.6.2.29',
		version_name: '1.6.2-zh.29',
		action: {
			default_popup: 'popup.html',
		},
	});
	writeText(path.join(healthyOnlyExtensionDir, 'popup.html'), [
		'<html><body>',
		'<script src="popup-bootstrap.js"></script>',
		'<script type="module" src="popup.js"></script>',
		'</body></html>',
	].join(''));
	const healthyStrictOutput = execFileSync(process.execPath, [
		diagnoseScript,
		'--chrome-root',
		healthyOnlyRoot,
		'--expected-version-name',
		'1.6.2-zh.29',
		'--strict',
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});
	assert.match(healthyStrictOutput, /OK/);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
