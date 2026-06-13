export interface PopupErrorOptions {
	fatal?: boolean;
}

export function showPopupError(doc: Document, message: string, options: PopupErrorOptions = {}): boolean {
	const errorMessage = doc.querySelector('.error-message') as HTMLElement | null;
	const clipper = doc.querySelector('.clipper') as HTMLElement | null;
	if (!errorMessage || !clipper) return false;

	errorMessage.textContent = message;
	errorMessage.style.display = 'flex';

	if (options.fatal) {
		clipper.style.display = 'none';
		doc.body.classList.add('has-error');
		doc.body.classList.remove('has-inline-error');
	} else {
		clipper.style.display = 'block';
		doc.body.classList.remove('has-error');
		doc.body.classList.add('has-inline-error');
	}

	return true;
}

export function clearPopupError(doc: Document): boolean {
	const errorMessage = doc.querySelector('.error-message') as HTMLElement | null;
	const clipper = doc.querySelector('.clipper') as HTMLElement | null;
	if (!errorMessage || !clipper) return false;

	errorMessage.style.display = 'none';
	errorMessage.textContent = '';
	clipper.style.display = 'block';
	doc.body.classList.remove('has-error');
	doc.body.classList.remove('has-inline-error');
	return true;
}
