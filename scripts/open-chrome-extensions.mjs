import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function readArg(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : '';
}

const unpackedDir = readArg('--unpacked-dir') || path.join(process.cwd(), 'builds', 'chrome-unpacked-current');
const manifestPath = path.join(unpackedDir, 'manifest.json');

if (!existsSync(manifestPath)) {
	throw new Error(`Missing Chrome unpacked extension at ${unpackedDir}. Run npm run prepare:chrome-unpacked first.`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
console.log(`Chrome unpacked directory: ${unpackedDir}`);
console.log(`Version: ${manifest.version_name || manifest.version || 'unknown'}`);
console.log('In chrome://extensions, remove the stale Obsidian Web Clipper, then Load unpacked with the directory above.');
console.log('After loading it, run: npm run verify:installed');

if (!dryRun) {
	execFileSync('open', ['-a', 'Google Chrome', 'chrome://extensions'], { stdio: 'inherit' });
}
