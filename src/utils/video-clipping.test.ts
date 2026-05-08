import { describe, expect, test } from 'vitest';
import { buildVariables } from './shared';
import {
	DEFAULT_VIDEO_CLIPPING_SETTINGS,
	YTDLP_INSTALL_GUIDE,
	buildVideoVariables,
	createVideoClipTemplate,
	detectVideoPlatform,
	extractVideoClipData,
} from './video-clipping';

describe('video clipping', () => {
	test('detects supported video platforms', () => {
		expect(detectVideoPlatform('https://www.bilibili.com/video/BV1abc123')).toBe('bilibili');
		expect(detectVideoPlatform('https://v.douyin.com/iExample/')).toBe('douyin');
		expect(detectVideoPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
		expect(detectVideoPlatform('https://m.youtube.com/watch?v=abc123')).toBe('youtube');
		expect(detectVideoPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube');
		expect(detectVideoPlatform('https://example.com/articles/video')).toBe('');
	});

	test('extracts Bilibili video data from embedded initial state', () => {
		const fullHtml = `
			<html>
				<head>
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
			</html>
		`;

		const data = extractVideoClipData({
			url: 'https://www.bilibili.com/video/BV1abc123',
			title: '',
			author: '',
			description: '',
			image: '',
			published: '',
			schemaOrgData: null,
			metaTags: [],
			extractedContent: {},
			fullHtml,
		});

		expect(data).toMatchObject({
			platform: 'bilibili',
			title: '如何构建一个 CLI 工具',
			author: '技术频道',
			description: '这是一段面向开发者的视频简介。',
			cover: 'https://i0.hdslb.com/bfs/archive/cover.jpg',
			url: 'https://www.bilibili.com/video/BV1abc123',
		});
		expect(data?.published).toContain('2024-06-01');
	});

	test('extracts Bilibili data from real JSON initial state without falling back to page metadata', () => {
		const fullHtml = `
			<html>
				<head>
					<script>
						var vd = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData;
					</script>
					<script>
						window.__INITIAL_STATE__={
							"videoData":{
								"title":"全网最全！60分钟全面掌握Claude Code～【附完整文档】",
								"desc":"Claude Code's 保姆级教学【收藏起来不会错！】\\n从上手安装，到高级用法，这期一次讲全～",
								"bvid":"BV1NvRyBzEhq",
								"pubdate":1777990105,
								"pic":"//i2.hdslb.com/bfs/archive/4ef379f4341e05c09ba920b4a4ccc6d6cf54f076.jpg@100w_100h_1c.png",
								"owner":{"name":"秋芝2046"}
							}
						};
					</script>
				</head>
			</html>
		`;

		const data = extractVideoClipData({
			url: 'https://www.bilibili.com/video/BV1NvRyBzEhq/?spm_id_from=333.1007.tianma.1-1-1.click',
			title: '全网最全！60分钟全面掌握Claude Code～【附完整文档】_哔哩哔哩_bilibili',
			author: '',
			description: '视频播放量 251025、弹幕量 1552、相关推荐污染内容',
			image: '//i2.hdslb.com/bfs/archive/4ef379f4341e05c09ba920b4a4ccc6d6cf54f076.jpg@100w_100h_1c.png',
			published: '',
			schemaOrgData: null,
			metaTags: [],
			extractedContent: {},
			fullHtml,
		});

		expect(data).toMatchObject({
			platform: 'bilibili',
			title: '全网最全！60分钟全面掌握Claude Code～【附完整文档】',
			author: '秋芝2046',
			description: "Claude Code's 保姆级教学【收藏起来不会错！】 从上手安装，到高级用法，这期一次讲全～",
			cover: 'https://i2.hdslb.com/bfs/archive/4ef379f4341e05c09ba920b4a4ccc6d6cf54f076.jpg',
		});
		expect(data?.published).toBe('2026-05-05T14:08:25.000Z');
		expect(data?.summary).not.toContain('相关推荐');
	});

	test('extracts clean Bilibili data from live-page schema and meta fallbacks', () => {
		const data = extractVideoClipData({
			url: 'https://www.bilibili.com/video/BV1NvRyBzEhq/?spm_id_from=333.1007.tianma.1-1-1.click',
			title: '%E5%85%A8%E7%BD%91%E6%9C%80%E5%85%A8%EF%BC%8160%E5%88%86%E9%92%9F%E5%85%A8%E9%9D%A2%E6%8E%8C%E6%8F%A1Claude%20Code%EF%BD%9E%E3%80%90%E9%99%84%E5%AE%8C%E6%95%B4%E6%96%87%E6%A1%A3%E3%80%91',
			author: '',
			description: 'Claude Code保姆级教学【收藏起来不会错！】从上手安装，到高级用法，这期一次讲全～, 视频播放量 254762、弹幕量 1576、点赞数 17014、相关视频：污染内容',
			image: '',
			published: '',
			schemaOrgData: {
				'@context': 'https://schema.org',
				'@type': 'VideoObject',
				name: '%E5%85%A8%E7%BD%91%E6%9C%80%E5%85%A8%EF%BC%8160%E5%88%86%E9%92%9F%E5%85%A8%E9%9D%A2%E6%8E%8C%E6%8F%A1Claude%20Code%EF%BD%9E%E3%80%90%E9%99%84%E5%AE%8C%E6%95%B4%E6%96%87%E6%A1%A3%E3%80%91',
				description: 'Claude%20Code%E4%BF%9D%E5%A7%86%E7%BA%A7%E6%95%99%E5%AD%A6%E3%80%90%E6%94%B6%E8%97%8F%E8%B5%B7%E6%9D%A5%E4%B8%8D%E4%BC%9A%E9%94%99%EF%BC%81%E3%80%91%0A%E4%BB%8E%E4%B8%8A%E6%89%8B%E5%AE%89%E8%A3%85%EF%BC%8C%E5%88%B0%E9%AB%98%E7%BA%A7%E7%94%A8%E6%B3%95%EF%BC%8C%E8%BF%99%E6%9C%9F%E4%B8%80%E6%AC%A1%E8%AE%B2%E5%85%A8%EF%BD%9E',
				thumbnailUrl: ['http://i2.hdslb.com/bfs/archive/cover.jpg@189w_107h.jpg'],
				uploadDate: '2026-05-07T06:22:55.316Z',
			},
			metaTags: [
				{ name: 'author', content: '秋芝2046' },
				{ name: 'title', itemprop: 'name', content: '全网最全！60分钟全面掌握Claude Code～【附完整文档】_哔哩哔哩_bilibili' },
				{ itemprop: 'thumbnailUrl', content: '//i2.hdslb.com/bfs/archive/4ef379f4341e05c09ba920b4a4ccc6d6cf54f076.jpg@100w_100h_1c.png' },
				{ itemprop: 'uploadDate', content: '2026-05-05 22:08:25' },
			],
			extractedContent: {},
			fullHtml: '<script>var vd = window.__INITIAL_STATE__ && window.__INITIAL_STATE__.videoData</script>',
		});

		expect(data).toMatchObject({
			platform: 'bilibili',
			title: '全网最全！60分钟全面掌握Claude Code～【附完整文档】',
			author: '秋芝2046',
			description: 'Claude Code保姆级教学【收藏起来不会错！】 从上手安装，到高级用法，这期一次讲全～',
			cover: 'https://i2.hdslb.com/bfs/archive/cover.jpg',
		});
		expect(data?.published).toBe('2026-05-05T14:08:25.000Z');
		expect(data?.summary).not.toContain('视频播放量');
		expect(data?.summary).not.toContain('相关视频');
	});

	test('uses Bilibili raw HTML meta upload date when extracted meta tags are missing', () => {
		const data = extractVideoClipData({
			url: 'https://www.bilibili.com/video/BV1NvRyBzEhq/',
			title: '全网最全！60分钟全面掌握Claude Code～【附完整文档】_哔哩哔哩_bilibili',
			author: '秋芝2046',
			description: 'Claude Code保姆级教学【收藏起来不会错！】从上手安装，到高级用法，这期一次讲全～',
			image: '//i2.hdslb.com/bfs/archive/4ef379f4341e05c09ba920b4a4ccc6d6cf54f076.jpg@100w_100h_1c.png',
			published: '',
			schemaOrgData: {
				'@context': 'https://schema.org',
				'@type': 'VideoObject',
				name: '全网最全！60分钟全面掌握Claude Code～【附完整文档】',
				uploadDate: '2026-05-07T06:53:56.190Z',
			},
			metaTags: [],
			extractedContent: {},
			fullHtml: [
				'<html><head>',
				'<meta data-vue-meta="true" itemprop="uploadDate" content="2026-05-05 22:08:25">',
				'<meta data-vue-meta="true" itemprop="datePublished" content="2026-05-05 22:08:25">',
				'</head></html>',
			].join(''),
		});

		expect(data?.published).toBe('2026-05-05T14:08:25.000Z');
	});

	test('extracts Douyin video data from universal render data', () => {
		const fullHtml = `
			<html>
				<head>
					<script id="RENDER_DATA" type="application/json">
						%7B%22app%22%3A%7B%22videoDetail%22%3A%7B%22desc%22%3A%22%E6%8A%96%E9%9F%B3%E8%A7%86%E9%A2%91%E6%96%87%E6%A1%88%22%2C%22author%22%3A%7B%22nickname%22%3A%22%E5%88%9B%E4%BD%9C%E8%80%85%22%7D%2C%22video%22%3A%7B%22cover%22%3A%7B%22urlList%22%3A%5B%22https%3A%2F%2Fp3.douyinpic.com%2Fcover.jpeg%22%5D%7D%7D%2C%22createTime%22%3A1717200000%7D%7D%7D
					</script>
				</head>
			</html>
		`;

		const data = extractVideoClipData({
			url: 'https://www.douyin.com/video/7340000000000000000',
			title: '',
			author: '',
			description: '',
			image: '',
			published: '',
			schemaOrgData: null,
			metaTags: [],
			extractedContent: {},
			fullHtml,
		});

		expect(data).toMatchObject({
			platform: 'douyin',
			title: '抖音视频文案',
			author: '创作者',
			description: '抖音视频文案',
			cover: 'https://p3.douyinpic.com/cover.jpeg',
		});
		expect(data?.published).toContain('2024-06-01');
	});

	test('injects video variables and includes download command by default', () => {
		const variables = buildVariables({
			title: 'How to Build a CLI Tool',
			author: 'Tech Channel',
			content: '',
			contentHtml: '',
			url: 'https://www.youtube.com/watch?v=abc123',
			fullHtml: '',
			description: 'A tutorial on building CLI tools with Node.js',
			favicon: '',
			image: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
			published: '',
			site: 'YouTube',
			language: 'en',
			wordCount: 0,
			schemaOrgData: {
				'@type': 'VideoObject',
				name: 'How to Build a CLI Tool',
				author: 'Tech Channel',
				uploadDate: '2024-06-15T12:00:00Z',
				description: 'A tutorial on building CLI tools with Node.js',
				thumbnailUrl: ['https://i.ytimg.com/vi/abc123/maxresdefault.jpg'],
			},
			metaTags: [],
			extractedContent: {
				transcript: '00:00 Intro\n00:10 Build the command line parser',
			},
		});

		expect(variables['{{videoPlatform}}']).toBe('youtube');
		expect(variables['{{videoTitle}}']).toBe('How to Build a CLI Tool');
		expect(variables['{{videoAuthor}}']).toBe('Tech Channel');
		expect(variables['{{videoCover}}']).toBe('https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
		expect(variables['{{videoTranscript}}']).toContain('Build the command line parser');
		expect(variables['{{videoDownloadCommand}}']).toBe('yt-dlp "https://www.youtube.com/watch?v=abc123" -o "How to Build a CLI Tool.%(ext)s"');
		expect(variables['{{videoDownloadCommandInstallGuide}}']).toBe(YTDLP_INSTALL_GUIDE);
	});

	test('can suppress download command when disabled', () => {
		const variables = buildVariables({
			title: 'How to Build a CLI Tool',
			author: 'Tech Channel',
			content: '',
			contentHtml: '',
			url: 'https://www.youtube.com/watch?v=abc123',
			fullHtml: '',
			description: 'A tutorial on building CLI tools with Node.js',
			favicon: '',
			image: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
			published: '',
			site: 'YouTube',
			language: 'en',
			wordCount: 0,
			schemaOrgData: {
				'@type': 'VideoObject',
				name: 'How to Build a CLI Tool',
				author: 'Tech Channel',
				uploadDate: '2024-06-15T12:00:00Z',
				description: 'A tutorial on building CLI tools with Node.js',
				thumbnailUrl: ['https://i.ytimg.com/vi/abc123/maxresdefault.jpg'],
			},
			metaTags: [],
			extractedContent: {},
			videoClippingSettings: {
				includeDownloadCommand: false,
			},
		});

		expect(variables['{{videoDownloadCommand}}']).toBe('');
		expect(variables['{{videoDownloadCommandInstallGuide}}']).toBe('');
	});

	test('renders a configurable yt-dlp download command when enabled', () => {
		const video = {
			platform: 'bilibili' as const,
			title: '如何构建 "CLI" 工具',
			author: '技术频道',
			published: '2024-06-01T00:00:00.000Z',
			cover: 'https://i0.hdslb.com/bfs/archive/cover.jpg',
			description: '简介',
			summary: '简介',
			transcript: '',
			url: 'https://www.bilibili.com/video/BV1abc123',
		};

		const variables = buildVideoVariables(video, {
			...DEFAULT_VIDEO_CLIPPING_SETTINGS,
			includeDownloadCommand: true,
		});

		expect(variables['{{videoDownloadCommand}}']).toBe('yt-dlp "https://www.bilibili.com/video/BV1abc123" -o "如何构建 \\"CLI\\" 工具.%(ext)s"');
		expect(variables['{{videoDownloadCommandInstallGuide}}']).toBe(YTDLP_INSTALL_GUIDE);
	});

	test('omits the yt-dlp install guide for other download commands', () => {
		const video = {
			platform: 'youtube' as const,
			title: 'How to Build a CLI Tool',
			author: 'Tech Channel',
			published: '2024-06-15T12:00:00.000Z',
			cover: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
			description: 'A tutorial on building CLI tools with Node.js',
			summary: 'A tutorial on building CLI tools with Node.js',
			transcript: '',
			url: 'https://www.youtube.com/watch?v=abc123',
		};

		const variables = buildVideoVariables(video, {
			...DEFAULT_VIDEO_CLIPPING_SETTINGS,
			downloadCommandTemplate: 'echo "{{url}}"',
		});

		expect(variables['{{videoDownloadCommand}}']).toBe('echo "https://www.youtube.com/watch?v=abc123"');
		expect(variables['{{videoDownloadCommandInstallGuide}}']).toBe('');
	});

	test('creates an auto-triggered default video template', () => {
		const template = createVideoClipTemplate();

		expect(template.name).toContain('视频');
		expect(template.triggers).toEqual(expect.arrayContaining([
			'https://www.bilibili.com/video/',
			'https://www.douyin.com/video/',
			'https://www.youtube.com/watch',
		]));
		expect(template.noteContentFormat).toContain('{{videoTranscript}}');
		expect(template.noteContentFormat).toContain('{{videoDownloadCommand}}');
		expect(template.noteContentFormat).toContain('{{videoDownloadCommandInstallGuide}}');
	});
});
