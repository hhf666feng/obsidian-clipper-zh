import { beforeEach, describe, expect, test, vi } from 'vitest';
import browser from './browser-polyfill';
import { saveSettings } from './storage-utils';

describe('saveSettings', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('persists Feishu template preferences', async () => {
		const set = vi.spyOn(browser.storage.sync, 'set');

		await saveSettings({
			feishuClipping: { enableFeishuTemplate: false },
		});

		expect(set).toHaveBeenCalledWith(expect.objectContaining({
			feishu_clipping_settings: { enableFeishuTemplate: false },
		}));
	});
});
