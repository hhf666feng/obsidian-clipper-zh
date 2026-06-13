export interface MinimalFallbackRenderOptions {
	document?: Document;
	variables: Record<string, string>;
	path?: string;
}

export function markPopupFallbackRendered(doc: Document, mode: 'template' | 'minimal'): void {
	if (doc.body?.dataset) {
		doc.body.dataset.fallbackRendered = mode;
	}
}

function setInputValue(element: Element | null, value: string): boolean {
	if (!element || !('value' in element)) return false;
	(element as HTMLInputElement | HTMLTextAreaElement).value = value;
	return true;
}

function appendPropertyInput(doc: Document, container: Element, name: string, value: string): void {
	const property = doc.createElement('div');
	property.className = 'metadata-property';

	const key = doc.createElement('div');
	key.className = 'metadata-property-key';

	const label = doc.createElement('label');
	label.setAttribute('for', name);
	label.textContent = name;
	key.appendChild(label);

	const valueContainer = doc.createElement('div');
	valueContainer.className = 'metadata-property-value';

	const input = doc.createElement('input');
	input.id = name;
	input.setAttribute('data-type', 'text');
	input.value = value;
	valueContainer.appendChild(input);

	property.appendChild(key);
	property.appendChild(valueContainer);
	container.appendChild(property);
}

export function renderMinimalFallbackFields(options: MinimalFallbackRenderOptions): boolean {
	const doc = options.document ?? globalThis.document;
	if (!doc) return false;

	const title = options.variables['{{title}}'] || 'Untitled';
	const url = options.variables['{{url}}'] || '';
	const path = options.path || 'Clippings';

	const noteNameOk = setInputValue(doc.getElementById('note-name-field'), title);
	const contentOk = setInputValue(doc.getElementById('note-content-field'), options.variables['{{content}}'] || '');
	setInputValue(doc.getElementById('path-name-field'), path);

	const metadataProperties = doc.querySelector('.metadata-properties');
	if (metadataProperties) {
		metadataProperties.textContent = '';
		appendPropertyInput(doc, metadataProperties, 'title', title);
		appendPropertyInput(doc, metadataProperties, 'source', url);
	}

	const errorMessage = doc.querySelector('.error-message') as HTMLElement | null;
	if (errorMessage) {
		errorMessage.style.display = 'none';
		errorMessage.textContent = '';
	}

	const clipper = doc.querySelector('.clipper') as HTMLElement | null;
	if (clipper) {
		clipper.style.display = 'block';
	}

	doc.body?.classList.remove('has-error');
	doc.body?.classList.remove('has-inline-error');
	markPopupFallbackRendered(doc, 'minimal');

	return noteNameOk && contentOk;
}
