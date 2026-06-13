import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(tmpdir(), 'clipper-open-chrome-'));

function writeJson(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

try {
	const unpackedDir = path.join(tempDir, 'chrome-unpacked-current');
	writeJson(path.join(unpackedDir, 'manifest.json'), {
		name: 'Obsidian Web Clipper',
		version_name: '1.6.2-zh.29',
	});

	const output = execFileSync(process.execPath, [
		path.join(process.cwd(), 'scripts', 'open-chrome-extensions.mjs'),
		'--unpacked-dir',
		unpackedDir,
		'--dry-run',
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	assert.match(output, new RegExp(`Chrome unpacked directory: ${escapeRegExp(unpackedDir)}`));
	assert.match(output, /Version: 1\.6\.2-zh\.29/);
	assert.match(output, /npm run verify:installed/);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
