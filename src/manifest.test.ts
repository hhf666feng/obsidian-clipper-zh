import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const chromeManifestPath = fileURLToPath(new URL('./manifest.chrome.json', import.meta.url));
const chromeNativeHostExtensionId = 'cnjifjpddelmedmihgijeibhnjfabmlf';

function extensionIdFromKey(key: string): string {
	const hash = createHash('sha256').update(Buffer.from(key, 'base64')).digest().subarray(0, 16);
	return [...hash]
		.map(byte => byte.toString(16).padStart(2, '0'))
		.join('')
		.replace(/[0-9a-f]/g, char => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(char, 16)))
		.slice(0, 32);
}

describe('extension manifests', () => {
	test('keeps the Chrome extension ID aligned with the native downloader allowlist', () => {
		const manifest = JSON.parse(readFileSync(chromeManifestPath, 'utf8')) as { key?: string };

		expect(manifest.key).toBeTruthy();
		expect(extensionIdFromKey(manifest.key || '')).toBe(chromeNativeHostExtensionId);
	});
});
