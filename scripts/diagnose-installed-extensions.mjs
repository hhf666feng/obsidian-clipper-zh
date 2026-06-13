import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const strict = args.includes('--strict');

function readArg(name) {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : '';
}

const chromeRoot = readArg('--chrome-root')
	|| path.join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
const expectedVersionName = readArg('--expected-version-name') || readPackageVersion();

function readPackageVersion() {
	try {
		const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
		return pkg.version || '';
	} catch {
		return '';
	}
}

function readJson(filePath) {
	try {
		return JSON.parse(readFileSync(filePath, 'utf8'));
	} catch {
		return null;
	}
}

function listDirectories(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.map(name => path.join(directory, name))
		.filter(entry => {
			try {
				return statSync(entry).isDirectory();
			} catch {
				return false;
			}
		});
}

function isClipperManifest(manifest) {
	const text = `${manifest?.name || ''} ${manifest?.description || ''}`;
	return /obsidian|clipper|web clipper/i.test(text);
}

function parseVersionParts(version) {
	const normalized = String(version || '').replace(/^v/, '').replace(/-zh\./, '.');
	const match = normalized.match(/\d+(?:\.\d+)*/);
	return match ? match[0].split('.').map(part => Number(part)) : [];
}

function compareVersions(left, right) {
	const a = parseVersionParts(left);
	const b = parseVersionParts(right);
	const length = Math.max(a.length, b.length);
	for (let index = 0; index < length; index += 1) {
		const diff = (a[index] || 0) - (b[index] || 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function readPopupStatus(extensionVersionDir, manifest) {
	const popupFile = manifest?.action?.default_popup;
	if (!popupFile) {
		return { defaultPopup: '', hasBootstrap: false };
	}

	const popupPath = path.join(extensionVersionDir, popupFile);
	if (!existsSync(popupPath)) {
		return { defaultPopup: popupFile, hasBootstrap: false };
	}

	const popupHtml = readFileSync(popupPath, 'utf8');
	return {
		defaultPopup: popupFile,
		hasBootstrap: popupHtml.includes('popup-bootstrap.js'),
	};
}

function preferenceState(profileDir, extensionId) {
	const preferences = readJson(path.join(profileDir, 'Preferences'));
	const settings = preferences?.extensions?.settings?.[extensionId];
	return {
		state: settings?.state,
		location: settings?.location,
	};
}

function scanInstalledClippers(root) {
	const findings = [];
	for (const profileDir of listDirectories(root)) {
		const extensionsDir = path.join(profileDir, 'Extensions');
		if (!existsSync(extensionsDir)) continue;

		for (const extensionIdDir of listDirectories(extensionsDir)) {
			const extensionId = path.basename(extensionIdDir);
			for (const versionDir of listDirectories(extensionIdDir)) {
				const manifest = readJson(path.join(versionDir, 'manifest.json'));
				if (!manifest || !isClipperManifest(manifest)) continue;

				const popupStatus = readPopupStatus(versionDir, manifest);
				const versionName = manifest.version_name || manifest.version || '';
				const status = [];
				if (expectedVersionName && compareVersions(versionName, expectedVersionName) < 0) {
					status.push('OUTDATED');
				}
				if (!popupStatus.hasBootstrap) {
					status.push('MISSING_BOOTSTRAP');
				}
				if (status.length === 0) {
					status.push('OK');
				}

				findings.push({
					profile: path.basename(profileDir),
					extensionId,
					versionDir: path.basename(versionDir),
					name: manifest.name || '',
					version: manifest.version || '',
					versionName,
					defaultPopup: popupStatus.defaultPopup,
					hasBootstrap: popupStatus.hasBootstrap,
					...preferenceState(profileDir, extensionId),
					status,
					path: versionDir,
				});
			}
		}
	}
	return findings;
}

function printFindings(findings) {
	console.log(`Chrome root: ${chromeRoot}`);
	if (expectedVersionName) {
		console.log(`Expected version: ${expectedVersionName}`);
	}

	if (findings.length === 0) {
		console.log('No installed Obsidian Web Clipper extension packages found.');
		return;
	}

	for (const finding of findings) {
		console.log([
			`profile=${finding.profile}`,
			`id=${finding.extensionId}`,
			`version=${finding.versionName}`,
			`popup=${finding.defaultPopup || 'none'}`,
			`bootstrap=${finding.hasBootstrap ? 'yes' : 'no'}`,
			`state=${finding.state ?? 'unknown'}`,
			`status=${finding.status.join(',')}`,
		].join(' '));
		console.log(`  path=${finding.path}`);
	}
}

const findings = scanInstalledClippers(chromeRoot);
printFindings(findings);

if (strict) {
	const failingFindings = findings.filter(finding => !finding.status.includes('OK'));
	if (failingFindings.length > 0) {
		console.error(`Installed extension check failed: ${failingFindings.length} stale or unsafe package(s) found.`);
		process.exit(1);
	}
}
