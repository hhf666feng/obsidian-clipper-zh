import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function readArg(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : '';
}

const packageJsonPath = readArg('--package-json') || path.join(process.cwd(), 'package.json');
const buildsDir = readArg('--builds-dir') || path.join(process.cwd(), 'builds');
const outputDir = readArg('--output-dir') || path.join(buildsDir, 'chrome-unpacked-current');

function readVersion() {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
	if (!pkg.version) {
		throw new Error(`Package version missing in ${packageJsonPath}`);
	}
	return pkg.version;
}

function assertFile(filePath, label) {
	if (!existsSync(filePath)) {
		throw new Error(`Missing ${label}: ${filePath}`);
	}
}

const version = readVersion();
const zipPath = path.join(buildsDir, `obsidian-web-clipper-${version}-chrome.zip`);
assertFile(zipPath, 'Chrome release zip');

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
execFileSync('unzip', ['-q', zipPath, '-d', outputDir], { stdio: 'inherit' });

const manifestPath = path.join(outputDir, 'manifest.json');
const popupPath = path.join(outputDir, 'popup.html');
assertFile(manifestPath, 'unpacked manifest');
assertFile(popupPath, 'unpacked popup');
assertFile(path.join(outputDir, 'popup-bootstrap.js'), 'unpacked popup bootstrap');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version_name !== version) {
	throw new Error(`Unpacked Chrome version mismatch: expected ${version}, got ${manifest.version_name || manifest.version || 'unknown'}`);
}

const popupHtml = readFileSync(popupPath, 'utf8');
if (!popupHtml.includes('<script src="popup-bootstrap.js"></script>')) {
	throw new Error('Unpacked popup.html does not load popup-bootstrap.js');
}

console.log(`Chrome unpacked extension ready: ${outputDir}`);
