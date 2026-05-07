import { beforeAll, describe, expect, test } from 'vitest';
import { parseHTML } from 'linkedom';
import { Template } from './types/types';

class LinkedomDOMParser {
	parseFromString(html: string): Document {
		return parseHTML(html).document as unknown as Document;
	}
}

const documentParser = new LinkedomDOMParser();

beforeAll(() => {
	(globalThis as any).window = globalThis;
	(globalThis as any).DOMParser = LinkedomDOMParser;
	(globalThis as any).window.DOMParser = LinkedomDOMParser;
	(globalThis as any).document = parseHTML('<!doctype html><html><body></body></html>').document;
});

describe('clip', () => {
	test('extracts content and lazy-loaded images from parsed HTML documents', async () => {
		const { clip } = await import('./api');
		const template: Template = {
			id: 'lazy-image',
			name: 'Lazy image',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: '',
			noteContentFormat: '{{content}}',
			properties: [],
		};

		const result = await clip({
			html: `
				<html>
					<head><title>Lazy Article</title></head>
					<body>
						<article>
							<h1>Lazy Article</h1>
							<p>Intro</p>
							<img data-original="/images/lazy.jpg">
						</article>
					</body>
				</html>
			`,
			url: 'https://example.com/articles/lazy',
			template,
			documentParser,
		});

		expect(result.noteName).toBe('Lazy Article');
		expect(result.content).toContain('Intro');
		expect(result.content).toContain('![](https://example.com/images/lazy.jpg)');
	});

	test('keeps distinct WeChat images that share the generic runtime alt text', async () => {
		const { clip } = await import('./api');
		const firstImageUrl = 'https://mmbiz.qpic.cn/mmbiz_png/example-one/640?wx_fmt=png&from=appmsg';
		const secondImageUrl = 'https://mmbiz.qpic.cn/mmbiz_png/example-two/640?wx_fmt=png&from=appmsg';
		const template: Template = {
			id: 'wechat-images',
			name: 'WeChat images',
			behavior: 'create',
			noteNameFormat: '{{title}}',
			path: '',
			noteContentFormat: '{{content}}',
			properties: [],
		};

		const result = await clip({
			html: `
				<html>
					<head><title>WeChat Article</title></head>
					<body>
						<div id="js_content">
							<h1>WeChat Article</h1>
							<p>Intro</p>
							<section>
								<img class="rich_pages wxw-img" alt="图片" src="${firstImageUrl}&tp=webp&wxfrom=5&wx_lazy=1#imgIndex=0" data-src="${firstImageUrl}#imgIndex=0">
							</section>
							<section>
								<img class="rich_pages wxw-img js_img_placeholder wx_img_placeholder" alt="图片" src="data:image/svg+xml,placeholder" data-src="${secondImageUrl}#imgIndex=1">
							</section>
						</div>
					</body>
				</html>
			`,
			url: 'https://mp.weixin.qq.com/s/example',
			template,
			documentParser,
		});

		expect(result.content.match(/!\[\]\(https:\/\/mmbiz\.qpic\.cn/g)).toHaveLength(2);
		expect(result.content).toContain(`![](${firstImageUrl})`);
		expect(result.content).toContain(`![](${secondImageUrl})`);
		expect(result.content).not.toContain('wx_lazy=1');
		expect(result.content).not.toContain('#imgIndex=');
	});

	test('renders video clipping variables through the API template path', async () => {
		const { clip } = await import('./api');
		const { createVideoClipTemplate } = await import('./utils/video-clipping');

		const result = await clip({
			html: `
				<html>
					<head>
						<title>如何构建一个 CLI 工具</title>
						<script>
							window.__INITIAL_STATE__ = {
								videoData: {
									title: '如何构建一个 CLI 工具',
									desc: '这是一段面向开发者的视频简介。',
									bvid: 'BV1abc123',
									pubdate: 1717200000,
									pic: '//i0.hdslb.com/bfs/archive/cover.jpg',
									owner: { name: '技术频道' }
								}
							};
						</script>
					</head>
					<body><main>Video page shell</main></body>
				</html>
			`,
			url: 'https://www.bilibili.com/video/BV1abc123',
			template: createVideoClipTemplate(),
			documentParser,
		});

		expect(result.noteName).toBe('技术频道 - 如何构建一个 CLI 工具');
		expect(result.frontmatter).toContain('platform: "bilibili"');
		expect(result.frontmatter).toContain('cover: "https://i0.hdslb.com/bfs/archive/cover.jpg"');
		expect(result.content).toContain('![如何构建一个 CLI 工具](https://i0.hdslb.com/bfs/archive/cover.jpg)');
		expect(result.content).toContain('这是一段面向开发者的视频简介。');
		expect(result.content).not.toContain('## 下载命令');
	});
});
