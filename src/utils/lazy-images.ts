const lazySrcAttributes = [
	'data-src',
	'data-original-src',
	'data-original',
	'data-lazy-src',
	'data-actualsrc',
	'data-url',
	'data-image',
	'data-img-src',
	'data-ks-lazyload',
	'data-echo',
	'data-src-retina',
];

const lazySrcsetAttributes = [
	'data-srcset',
	'data-original-srcset',
	'data-lazy-srcset',
];

const weChatRuntimeParams = ['tp', 'wxfrom', 'wx_lazy'];
const weChatGenericAltTexts = new Set(['图片', '图像', 'image']);
const weChatPlaceholderClasses = new Set(['js_img_placeholder', 'wx_img_placeholder']);

function getAttributeValue(element: Element, attributes: string[]): string {
	for (const attr of attributes) {
		const value = element.getAttribute(attr)?.trim();
		if (value) return value;
	}
	return '';
}

function resolveUrl(value: string, baseUrl: string): string {
	if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
		return value;
	}

	try {
		return new URL(value, baseUrl).href;
	} catch {
		return value;
	}
}

function isWeChatImageUrl(value: string, baseUrl: string): boolean {
	if (!value || value.startsWith('data:') || value.startsWith('blob:')) {
		return false;
	}

	try {
		const url = new URL(value, baseUrl);
		return url.hostname === 'mmbiz.qpic.cn';
	} catch {
		return false;
	}
}

function normalizeImageUrl(value: string, baseUrl: string): string {
	const resolved = resolveUrl(value, baseUrl);
	if (!isWeChatImageUrl(resolved, baseUrl)) {
		return resolved;
	}

	try {
		const url = new URL(resolved, baseUrl);
		for (const param of weChatRuntimeParams) {
			url.searchParams.delete(param);
		}
		if (/^#imgIndex=\d+$/i.test(url.hash)) {
			url.hash = '';
		}
		return url.href;
	} catch {
		return resolved;
	}
}

function resolveSrcset(value: string, baseUrl: string): string {
	return value.split(',')
		.map(candidate => {
			const parts = candidate.trim().split(/\s+/);
			const url = parts.shift();
			if (!url) return '';
			return [normalizeImageUrl(url, baseUrl), ...parts].join(' ');
		})
		.filter(Boolean)
		.join(', ');
}

function firstSrcsetUrl(value: string, baseUrl: string): string {
	const firstCandidate = value.split(',')[0]?.trim();
	if (!firstCandidate) return '';
	const [url] = firstCandidate.split(/\s+/);
	return url ? normalizeImageUrl(url, baseUrl) : '';
}

function isPlaceholderSrc(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return normalized === ''
		|| normalized === 'about:blank'
		|| normalized.includes('pic_blank')
		|| normalized.includes('placeholder')
		|| normalized.includes('transparent')
		|| normalized.startsWith('data:image/');
}

function isWeChatRuntimeSrc(value: string, baseUrl: string): boolean {
	if (!isWeChatImageUrl(value, baseUrl)) {
		return false;
	}

	try {
		const url = new URL(value, baseUrl);
		return weChatRuntimeParams.some(param => url.searchParams.has(param))
			|| /^#imgIndex=\d+$/i.test(url.hash);
	} catch {
		return false;
	}
}

function shouldUseLazySrc(currentSrc: string, lazySrc: string, baseUrl: string): boolean {
	if (!lazySrc) return false;
	if (isPlaceholderSrc(currentSrc)) return true;
	return isWeChatImageUrl(lazySrc, baseUrl) && isWeChatRuntimeSrc(currentSrc, baseUrl);
}

function clearWeChatPlaceholderClasses(element: Element): void {
	const classValue = element.getAttribute('class');
	if (!classValue) return;

	const classNames = classValue.split(/\s+/).filter(className => !weChatPlaceholderClasses.has(className));
	if (classNames.length > 0) {
		element.setAttribute('class', classNames.join(' '));
	} else {
		element.removeAttribute('class');
	}
}

function cleanWeChatImageElement(element: Element, baseUrl: string): void {
	const src = element.getAttribute('src') || '';
	const lazySrc = getAttributeValue(element, lazySrcAttributes);
	const lazySrcset = getAttributeValue(element, lazySrcsetAttributes);
	if (!isWeChatImageUrl(src, baseUrl) && !isWeChatImageUrl(lazySrc, baseUrl) && !isWeChatImageUrl(firstSrcsetUrl(lazySrcset, baseUrl), baseUrl)) {
		return;
	}

	clearWeChatPlaceholderClasses(element);
	const alt = element.getAttribute('alt')?.trim();
	if (alt && weChatGenericAltTexts.has(alt.toLowerCase())) {
		element.removeAttribute('alt');
	}
}

function normalizeImageElement(element: Element, baseUrl: string): void {
	const currentSrc = element.getAttribute('src') || '';
	const lazySrc = getAttributeValue(element, lazySrcAttributes);
	const lazySrcset = getAttributeValue(element, lazySrcsetAttributes);

	if (shouldUseLazySrc(currentSrc, lazySrc, baseUrl)) {
		element.setAttribute('src', normalizeImageUrl(lazySrc, baseUrl));
		clearWeChatPlaceholderClasses(element);
	} else if (!lazySrc && lazySrcset && isPlaceholderSrc(currentSrc)) {
		const firstUrl = firstSrcsetUrl(lazySrcset, baseUrl);
		if (firstUrl) {
			element.setAttribute('src', firstUrl);
		}
	} else if (isWeChatRuntimeSrc(currentSrc, baseUrl)) {
		element.setAttribute('src', normalizeImageUrl(currentSrc, baseUrl));
	}

	const currentSrcset = element.getAttribute('srcset') || '';
	if (lazySrcset && isPlaceholderSrc(currentSrcset)) {
		element.setAttribute('srcset', resolveSrcset(lazySrcset, baseUrl));
		clearWeChatPlaceholderClasses(element);
	}

	cleanWeChatImageElement(element, baseUrl);
}

function normalizeSourceElement(element: Element, baseUrl: string): void {
	const currentSrcset = element.getAttribute('srcset') || '';
	const lazySrcset = getAttributeValue(element, lazySrcsetAttributes);

	if (lazySrcset && isPlaceholderSrc(currentSrcset)) {
		element.setAttribute('srcset', resolveSrcset(lazySrcset, baseUrl));
	}
}

export function normalizeLazyLoadedImages(root: ParentNode, baseUrl: string): void {
	root.querySelectorAll('img').forEach(element => normalizeImageElement(element, baseUrl));
	root.querySelectorAll('source').forEach(element => normalizeSourceElement(element, baseUrl));
}

export function normalizeLazyLoadedImagesInHtml(html: string, baseUrl: string): string {
	if (!html.trim() || typeof DOMParser === 'undefined') {
		return html;
	}

	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	normalizeLazyLoadedImages(doc, baseUrl);
	return doc.body?.innerHTML || html;
}
