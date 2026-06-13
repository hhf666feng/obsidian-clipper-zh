import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const browsers = ['chrome', 'firefox', 'safari'];

function readArg(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : '';
}

function readRepeatedArg(name) {
	const values = [];
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] === name && args[index + 1]) {
			values.push(args[index + 1]);
			index += 1;
		}
	}
	return values;
}

const packageJsonPath = readArg('--package-json') || path.join(process.cwd(), 'package.json');
const buildsDir = readArg('--builds-dir') || path.join(process.cwd(), 'builds');
const smokeCmd = readArg('--smoke-cmd') || process.execPath;
const smokeArgs = readRepeatedArg('--smoke-arg');
const defaultSmokeArgs = [path.join(process.cwd(), 'scripts', 'smoke-popup-bootstrap.mjs')];

function readVersion() {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	if (!pkg.version) {
		throw new Error(`Package version missing in ${packageJsonPath}`);
	}
	return pkg.version;
}

function expectedZipPaths(version) {
	return browsers.map(browserName => path.join(
		buildsDir,
		`obsidian-web-clipper-${version}-${browserName}.zip`,
	));
}

function verifyZipExists(zipPath) {
	if (!existsSync(zipPath)) {
		throw new Error(`Missing release zip: ${zipPath}`);
	}
}

function runPopupSmoke(zipPath) {
	execFileSync(smokeCmd, [...(smokeArgs.length ? smokeArgs : defaultSmokeArgs), zipPath], {
		cwd: process.cwd(),
		stdio: 'inherit',
	});
}

const version = readVersion();
const zipPaths = expectedZipPaths(version);
for (const zipPath of zipPaths) {
	verifyZipExists(zipPath);
	runPopupSmoke(zipPath);
}

console.log(`release package verified: ${version}`);
