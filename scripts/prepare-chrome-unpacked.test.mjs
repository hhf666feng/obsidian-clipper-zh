import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(tmpdir(), 'clipper-chrome-unpacked-'));

function writeJson(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, value);
}

try {
	const packageJson = path.join(tempDir, 'package.json');
	const buildsDir = path.join(tempDir, 'builds');
	const sourceDir = path.join(tempDir, 'zip-source');
	const outputDir = path.join(tempDir, 'chrome-unpacked-current');

	writeJson(packageJson, { version: '1.6.2-zh.29' });
	writeJson(path.join(sourceDir, 'manifest.json'), {
		manifest_version: 3,
		name: 'Obsidian Web Clipper',
		version: '1.6.2.29',
		version_name: '1.6.2-zh.29',
		action: {
			default_popup: 'popup.html',
		},
	});
	writeText(path.join(sourceDir, 'popup.html'), [
		'<html><body>',
		'<script src="popup-bootstrap.js"></script>',
		'<script type="module" src="popup.js"></script>',
		'</body></html>',
	].join(''));
	writeText(path.join(sourceDir, 'popup-bootstrap.js'), '/* bootstrap */');
	writeText(path.join(sourceDir, 'popup.js'), '/* popup */');
	mkdirSync(buildsDir, { recursive: true });
	execFileSync('zip', ['-qr', path.join(buildsDir, 'obsidian-web-clipper-1.6.2-zh.29-chrome.zip'), '.'], {
		cwd: sourceDir,
	});

	const output = execFileSync(process.execPath, [
		path.join(process.cwd(), 'scripts', 'prepare-chrome-unpacked.mjs'),
		'--package-json',
		packageJson,
		'--builds-dir',
		buildsDir,
		'--output-dir',
		outputDir,
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	assert.match(output, /Chrome unpacked extension ready/);
	assert.equal(JSON.parse(readFileSync(path.join(outputDir, 'manifest.json'), 'utf8')).version_name, '1.6.2-zh.29');
	assert.match(readFileSync(path.join(outputDir, 'popup.html'), 'utf8'), /popup-bootstrap\.js/);
	assert.match(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'), /"prepare:chrome-unpacked": "node scripts\/prepare-chrome-unpacked\.mjs"/);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
