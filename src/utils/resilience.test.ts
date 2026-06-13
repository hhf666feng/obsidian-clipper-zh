import { describe, expect, test, vi } from 'vitest';
import { runOptionalStep, runRequiredStep } from './resilience';

describe('runOptionalStep', () => {
	test('continues when a recoverable setup step fails', async () => {
		const logger = { warn: vi.fn(), error: vi.fn() };

		const result = await runOptionalStep('setup language', () => {
			throw new Error('storage unavailable');
		}, logger);

		expect(result).toBeUndefined();
		expect(logger.warn).toHaveBeenCalledWith(
			'setup language failed; continuing with degraded functionality.',
			expect.any(Error),
		);
	});
});

describe('runRequiredStep', () => {
	test('preserves hard failures with step context', async () => {
		await expect(runRequiredStep('load templates', () => {
			throw new Error('sync storage unavailable');
		})).rejects.toThrow('load templates failed: sync storage unavailable');
	});
});
