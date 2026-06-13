import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('popup error contract', () => {
	test('uses explicit fatal or action error helpers', () => {
		const source = readFileSync(join(process.cwd(), 'src/core/popup.ts'), 'utf8');

		expect(source).not.toContain('showError(');
		expect(source).toContain('showFatalError(');
		expect(source).toContain('showActionError(');
	});

	test('does not route generic initialization exceptions directly to fatal popup errors', () => {
		const source = readFileSync(join(process.cwd(), 'src/core/popup.ts'), 'utf8');

		expect(source).toContain('recoverWithFallbackFields(');
		expect(source).not.toContain("showFatalError(error instanceof Error ? error.message : 'Failed to initialize popup.');");
		expect(source).not.toContain('showFatalError(errorMessage);');
	});
});
