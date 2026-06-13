import { describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { showPopupError, clearPopupError } from './popup-error-state';

function createPopupDocument() {
	return parseHTML(`
		<body>
			<p class="error-message" style="display: none;"></p>
			<div class="clipper" style="display: block;">
				<textarea id="note-content-field">draft</textarea>
			</div>
		</body>
	`).document as unknown as Document;
}

describe('popup error state', () => {
	test('non-fatal errors keep the clipper visible', () => {
		const document = createPopupDocument();

		showPopupError(document, 'Automatic video download failed', { fatal: false });

		expect((document.querySelector('.error-message') as HTMLElement).textContent).toBe('Automatic video download failed');
		expect((document.querySelector('.error-message') as HTMLElement).style.display).toBe('flex');
		expect((document.querySelector('.clipper') as HTMLElement).style.display).toBe('block');
		expect(document.body.classList.contains('has-error')).toBe(false);
		expect(document.body.classList.contains('has-inline-error')).toBe(true);
	});

	test('fatal errors hide the clipper', () => {
		const document = createPopupDocument();

		showPopupError(document, 'This page cannot be clipped.', { fatal: true });

		expect((document.querySelector('.clipper') as HTMLElement).style.display).toBe('none');
		expect(document.body.classList.contains('has-error')).toBe(true);
		expect(document.body.classList.contains('has-inline-error')).toBe(false);
	});

	test('clearing errors restores the clipper and removes error state classes', () => {
		const document = createPopupDocument();
		showPopupError(document, 'Transient failure', { fatal: false });

		clearPopupError(document);

		expect((document.querySelector('.error-message') as HTMLElement).style.display).toBe('none');
		expect((document.querySelector('.clipper') as HTMLElement).style.display).toBe('block');
		expect(document.body.classList.contains('has-error')).toBe(false);
		expect(document.body.classList.contains('has-inline-error')).toBe(false);
	});
});
