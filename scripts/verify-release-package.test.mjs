import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const tempDir = mkdtempSync(path.join(tmpdir(), 'clipper-release-gate-'));

function writeJson(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(filePath, value) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, value);
}

try {
	const buildsDir = path.join(tempDir, 'builds');
	const smokeCalls = path.join(tempDir, 'smoke-calls.log');
	const packageJson = path.join(tempDir, 'package.json');

	writeJson(packageJson, { version: '1.6.2-zh.28' });
	for (const browserName of ['chrome', 'firefox', 'safari']) {
		writeText(path.join(buildsDir, `obsidian-web-clipper-1.6.2-zh.28-${browserName}.zip`), 'fake zip');
	}

	const output = execFileSync(process.execPath, [
		path.join(process.cwd(), 'scripts', 'verify-release-package.mjs'),
		'--package-json',
		packageJson,
		'--builds-dir',
		buildsDir,
		'--smoke-cmd',
		process.execPath,
		'--smoke-arg',
		'-e',
		'--smoke-arg',
		`require('fs').appendFileSync(${JSON.stringify(smokeCalls)}, process.argv[1] + '\\n')`,
	], {
		cwd: process.cwd(),
		encoding: 'utf8',
	});

	assert.match(output, /release package verified/);
	const calls = readText(smokeCalls).trim().split('\n').map(line => path.basename(line));
	assert.deepEqual(calls, [
		'obsidian-web-clipper-1.6.2-zh.28-chrome.zip',
		'obsidian-web-clipper-1.6.2-zh.28-firefox.zip',
		'obsidian-web-clipper-1.6.2-zh.28-safari.zip',
	]);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

function readText(filePath) {
	return execFileSync('cat', [filePath], { encoding: 'utf8' });
}
