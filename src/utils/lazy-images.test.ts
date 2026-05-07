import { describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { normalizeLazyLoadedImages } from './lazy-images';

describe('normalizeLazyLoadedImages', () => {
	test('promotes WeChat data-src images to src', () => {
		const imageUrl = 'https://mmbiz.qpic.cn/mmbiz_png/example/640?wx_fmt=png&from=appmsg';
		const { document } = parseHTML(`<main><img data-src="${imageUrl}" data-type="png"></main>`);

		normalizeLazyLoadedImages(document, 'https://mp.weixin.qq.com/s/example');

		expect(document.querySelector('img')?.getAttribute('src')).toBe(imageUrl);
	});

	test('replaces known placeholder src values and resolves URL values', () => {
		const { document } = parseHTML(`
			<main>
				<img src="https://res.wx.qq.com/mmbizappmsg/images/pic_blank.gif" data-src="//cdn.example.com/a.jpg">
				<img data-original="/images/b.png">
			</main>
		`);

		normalizeLazyLoadedImages(document, 'https://example.com/articles/page');

		const images = Array.from(document.querySelectorAll('img'));
		expect(images[0].getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
		expect(images[1].getAttribute('src')).toBe('https://example.com/images/b.png');
	});

	test('keeps an existing real src when a lazy candidate also exists', () => {
		const { document } = parseHTML(`
			<main>
				<img src="https://example.com/loaded.jpg" data-src="https://example.com/lazy.jpg">
			</main>
		`);

		normalizeLazyLoadedImages(document, 'https://example.com/articles/page');

		expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/loaded.jpg');
	});

	test('prefers WeChat data-src over runtime lazy URLs and clears placeholder classes', () => {
		const canonicalUrl = 'https://mmbiz.qpic.cn/mmbiz_jpg/example/640?wx_fmt=jpeg&from=appmsg';
		const runtimeUrl = `${canonicalUrl}&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=0`;
		const { document } = parseHTML(`
			<main>
				<img
					class="rich_pages wxw-img js_img_placeholder wx_img_placeholder"
					alt="图片"
					src="${runtimeUrl}"
					data-src="${canonicalUrl}#imgIndex=0"
				>
			</main>
		`);

		normalizeLazyLoadedImages(document, 'https://mp.weixin.qq.com/s/example');

		const image = document.querySelector('img');
		expect(image?.getAttribute('src')).toBe(canonicalUrl);
		expect(image?.className).toBe('rich_pages wxw-img');
		expect(image?.hasAttribute('alt')).toBe(false);
	});

	test('promotes data-srcset and derives src from its first candidate', () => {
		const { document } = parseHTML(`
			<picture>
				<source data-srcset="/wide.webp 2x, /wide-small.webp 1x">
				<img data-srcset="/image-640.jpg 640w, /image-320.jpg 320w">
			</picture>
		`);

		normalizeLazyLoadedImages(document, 'https://example.com/articles/page');

		expect(document.querySelector('source')?.getAttribute('srcset')).toBe('https://example.com/wide.webp 2x, https://example.com/wide-small.webp 1x');
		expect(document.querySelector('img')?.getAttribute('srcset')).toBe('https://example.com/image-640.jpg 640w, https://example.com/image-320.jpg 320w');
		expect(document.querySelector('img')?.getAttribute('src')).toBe('https://example.com/image-640.jpg');
	});
});
