import { describe, test, expect } from 'vitest';
import {
	buildVariables,
	BuildVariablesParams,
	buildFallbackVariables,
	generateFrontmatter,
	extractContentBySelector,
	addSchemaOrgDataToVariables,
} from './shared';

// ---------------------------------------------------------------------------
// Helper to create minimal BuildVariablesParams with overrides
// ---------------------------------------------------------------------------

function makeParams(overrides: Partial<BuildVariablesParams> = {}): BuildVariablesParams {
	return {
		title: 'Test Title',
		author: 'Test Author',
		content: 'markdown body',
		contentHtml: '<p>html body</p>',
		url: 'https://example.com/page',
		fullHtml: '<html></html>',
		description: 'A description',
		favicon: 'https://example.com/favicon.ico',
		image: 'https://example.com/image.png',
		published: '2024-01-15',
		site: 'Example',
		language: 'en',
		wordCount: 42,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// buildVariables
// ---------------------------------------------------------------------------

describe('buildVariables', () => {
	test('maps basic fields to template variables', () => {
		const vars = buildVariables(makeParams());
		expect(vars['{{title}}']).toBe('Test Title');
		expect(vars['{{author}}']).toBe('Test Author');
		expect(vars['{{content}}']).toBe('markdown body');
		expect(vars['{{contentHtml}}']).toBe('<p>html body</p>');
		expect(vars['{{url}}']).toBe('https://example.com/page');
		expect(vars['{{description}}']).toBe('A description');
		expect(vars['{{favicon}}']).toBe('https://example.com/favicon.ico');
		expect(vars['{{image}}']).toBe('https://example.com/image.png');
		expect(vars['{{site}}']).toBe('Example');
		expect(vars['{{language}}']).toBe('en');
		expect(vars['{{words}}']).toBe('42');
		expect(vars['{{domain}}']).toBe('example.com');
	});

	test('strips text fragment from URL', () => {
		const vars = buildVariables(makeParams({
			url: 'https://example.com/page#:~:text=some%20text',
		}));
		expect(vars['{{url}}']).toBe('https://example.com/page');
	});

	test('strips text fragment with trailing ampersand', () => {
		const vars = buildVariables(makeParams({
			url: 'https://example.com/page#:~:text=foo&bar=1',
		}));
		expect(vars['{{url}}']).toBe('https://example.com/pagebar=1');
	});

	test('trims whitespace from string fields', () => {
		const vars = buildVariables(makeParams({
			title: '  padded title  ',
			author: '  padded author  ',
		}));
		expect(vars['{{title}}']).toBe('padded title');
		expect(vars['{{author}}']).toBe('padded author');
	});

	test('handles empty/falsy values', () => {
		const vars = buildVariables(makeParams({
			author: '',
			description: '',
			favicon: '',
			image: '',
			published: '',
			site: '',
			language: '',
			wordCount: 0,
		}));
		expect(vars['{{author}}']).toBe('');
		expect(vars['{{description}}']).toBe('');
		expect(vars['{{favicon}}']).toBe('');
		expect(vars['{{image}}']).toBe('');
		expect(vars['{{published}}']).toBe('');
		expect(vars['{{site}}']).toBe('');
		expect(vars['{{language}}']).toBe('');
		expect(vars['{{words}}']).toBe('0');
	});

	test('drops YouTube page URLs when Defuddle reports them as the primary image', () => {
		const vars = buildVariables(makeParams({
			url: 'https://www.youtube.com/playlist?list=PLmWCw1CzcFilebjK89WLb5cAvM8K0cLB3',
			image: 'https://www.youtube.com/watch?v=embed',
		}));

		expect(vars['{{image}}']).toBe('');
	});

	test('keeps YouTube thumbnail URLs as the primary image', () => {
		const vars = buildVariables(makeParams({
			url: 'https://www.youtube.com/watch?v=abc123',
			image: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg',
		}));

		expect(vars['{{image}}']).toBe('https://i.ytimg.com/vi/abc123/maxresdefault.jpg');
	});

	test('takes first element of comma-separated published field', () => {
		const vars = buildVariables(makeParams({
			published: '2024-01-15, 2024-02-20',
		}));
		expect(vars['{{published}}']).toBe('2024-01-15');
	});

	test('defaults optional fields to empty strings', () => {
		const vars = buildVariables(makeParams());
		expect(vars['{{selection}}']).toBe('');
		expect(vars['{{selectionHtml}}']).toBe('');
		expect(vars['{{highlights}}']).toBe('');
	});

	test('includes selection and highlights when provided', () => {
		const vars = buildVariables(makeParams({
			selection: 'selected text',
			selectionHtml: '<mark>selected text</mark>',
			highlights: '[{"text":"highlight"}]',
		}));
		expect(vars['{{selection}}']).toBe('selected text');
		expect(vars['{{selectionHtml}}']).toBe('<mark>selected text</mark>');
		expect(vars['{{highlights}}']).toBe('[{"text":"highlight"}]');
	});

	test('uses raw HTML for video metadata while keeping fullHtml sanitized for templates', () => {
		const encodedTitle = encodeURIComponent('全网最全！60分钟全面掌握Claude Code～【附完整文档】');
		const rawHtml = `
			<html>
				<head>
					<script>
						window.__INITIAL_STATE__={
							"videoData":{
								"title":"全网最全！60分钟全面掌握Claude Code～【附完整文档】",
								"desc":"Claude Code 保姆级教学",
								"pubdate":1777990105,
								"pic":"//i2.hdslb.com/bfs/archive/cover.jpg@100w_100h_1c.png",
								"owner":{"name":"秋芝2046"}
							}
						};
					</script>
				</head>
			</html>
		`;
		const vars = buildVariables(makeParams({
			url: 'https://www.bilibili.com/video/BV1NvRyBzEhq/',
			title: encodedTitle,
			description: '视频播放量 251025、相关推荐污染内容',
			image: '//i2.hdslb.com/bfs/archive/cover.jpg@100w_100h_1c.png',
			published: '',
			fullHtml: '<html><head></head><body>cleaned page</body></html>',
			rawHtml,
		}));

		expect(vars['{{fullHtml}}']).toBe('<html><head></head><body>cleaned page</body></html>');
		expect(vars['{{videoTitle}}']).toBe('全网最全！60分钟全面掌握Claude Code～【附完整文档】');
		expect(vars['{{videoAuthor}}']).toBe('秋芝2046');
		expect(vars['{{videoDescription}}']).toBe('Claude Code 保姆级教学');
		expect(vars['{{videoCover}}']).toBe('https://i2.hdslb.com/bfs/archive/cover.jpg');
		expect(vars['{{videoSummary}}']).not.toContain('相关推荐');
	});

	test('builds minimal Bilibili video variables when page extraction has no HTML metadata', () => {
		const vars = buildVariables(makeParams({
			url: 'https://www.bilibili.com/video/BV1KMQnBFEHu/?spm_id_from=333.337.search-card.all.click&vd_source=13e32190a48660ccde5a27f6c3760d83',
			title: 'Bilibili clip fallback',
			author: '',
			content: '',
			contentHtml: '',
			fullHtml: '',
			description: '',
			image: '',
			published: '',
			site: '哔哩哔哩',
			wordCount: 0,
		}));

		expect(vars['{{videoPlatform}}']).toBe('bilibili');
		expect(vars['{{videoUrl}}']).toBe('https://www.bilibili.com/video/BV1KMQnBFEHu');
		expect(vars['{{videoTitle}}']).toBe('Bilibili clip fallback');
		expect(vars['{{videoDownloadCommand}}']).toBe('yt-dlp "https://www.bilibili.com/video/BV1KMQnBFEHu" -o "Bilibili clip fallback.%(ext)s"');
	});

	test('produces date and time in ISO-like format', () => {
		const vars = buildVariables(makeParams());
		// Both should be identical timestamps
		expect(vars['{{date}}']).toBe(vars['{{time}}']);
		// Should match YYYY-MM-DDTHH:mm:ssZ pattern
		expect(vars['{{date}}']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
	});

	test('adds extracted content as template variables', () => {
		const vars = buildVariables(makeParams({
			extractedContent: {
				transcript: 'Hello world transcript',
				summary: 'A summary',
			},
		}));
		expect(vars['{{transcript}}']).toBe('Hello world transcript');
		expect(vars['{{summary}}']).toBe('A summary');
	});

	test('adds meta tags as template variables', () => {
		const vars = buildVariables(makeParams({
			metaTags: [
				{ name: 'description', property: null, content: 'meta desc' },
				{ name: null, property: 'og:title', content: 'OG Title' },
				{ name: 'author', property: 'article:author', content: 'Both' },
			],
		}));
		expect(vars['{{meta:name:description}}']).toBe('meta desc');
		expect(vars['{{meta:property:og:title}}']).toBe('OG Title');
		expect(vars['{{meta:name:author}}']).toBe('Both');
		expect(vars['{{meta:property:article:author}}']).toBe('Both');
	});

	test('skips meta tags with null content', () => {
		const vars = buildVariables(makeParams({
			metaTags: [
				{ name: 'robots', property: null, content: null },
			],
		}));
		expect(vars['{{meta:name:robots}}']).toBeUndefined();
	});

	test('includes schema.org data', () => {
		const vars = buildVariables(makeParams({
			schemaOrgData: [{ '@type': 'Article', headline: 'Test' }],
		}));
		expect(vars['{{schema:@Article:headline}}']).toBe('Test');
	});
});

describe('buildFallbackVariables', () => {
	test('builds usable variables for ordinary article pages when extraction fails', () => {
		const vars = buildFallbackVariables({
			url: 'https://mp.weixin.qq.com/s/7OAo2uHmkEpPntPVPPFJnA',
			title: '从超级个体到超级团队：AI时代组织变革的涌现报告',
			extractionError: 'Content script did not respond after injection',
		});

		expect(vars['{{title}}']).toBe('从超级个体到超级团队：AI时代组织变革的涌现报告');
		expect(vars['{{noteName}}']).toBe('从超级个体到超级团队：AI时代组织变革的涌现报告');
		expect(vars['{{url}}']).toBe('https://mp.weixin.qq.com/s/7OAo2uHmkEpPntPVPPFJnA');
		expect(vars['{{domain}}']).toBe('qq.com');
		expect(vars['{{site}}']).toBe('mp.weixin.qq.com');
		expect(vars['{{content}}']).toBe('');
		expect(vars['{{extractionFallback}}']).toBe('true');
		expect(vars['{{extractionError}}']).toContain('Content script did not respond');
	});
});

// ---------------------------------------------------------------------------
// addSchemaOrgDataToVariables
// ---------------------------------------------------------------------------

describe('addSchemaOrgDataToVariables', () => {
	test('processes object with @type when wrapped in array', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{ '@type': 'Article', headline: 'Test' }], vars);
		expect(vars['{{schema:@Article:headline}}']).toBe('Test');
	});

	test('processes bare object without @type prefix', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables({ '@type': 'Article', headline: 'Test' }, vars);
		// Bare object: @type is not used for prefixing, keys go under empty prefix
		expect(vars['{{schema:headline}}']).toBe('Test');
	});

	test('processes array of typed objects', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([
			{ '@type': 'Article', headline: 'First' },
			{ '@type': 'Person', name: 'Alice' },
		], vars);
		expect(vars['{{schema:@Article:headline}}']).toBe('First');
		expect(vars['{{schema:@Person:name}}']).toBe('Alice');
	});

	test('handles multiple @type values', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{ '@type': ['Article', 'BlogPosting'], headline: 'Multi' }], vars);
		expect(vars['{{schema:@Article:headline}}']).toBe('Multi');
		expect(vars['{{schema:@BlogPosting:headline}}']).toBe('Multi');
	});

	test('uses array index when no @type', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{ foo: 'bar' }], vars);
		expect(vars['{{schema:[0]:foo}}']).toBe('bar');
	});

	test('processes nested objects recursively', () => {
		const vars: Record<string, string> = {};
		const author = { '@type': 'Person', name: 'Alice' };
		addSchemaOrgDataToVariables([{ '@type': 'Article', author }], vars);
		expect(vars['{{schema:@Article:author.name}}']).toBe('Alice');
	});

	test('serializes array values as JSON and recurses', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{
			'@type': 'Article',
			keywords: ['javascript', 'typescript'],
		}], vars);
		expect(vars['{{schema:@Article:keywords}}']).toBe('["javascript","typescript"]');
	});

	test('converts number and boolean values to string', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{
			'@type': 'Product',
			price: 29.99,
			inStock: true,
		}], vars);
		expect(vars['{{schema:@Product:price}}']).toBe('29.99');
		expect(vars['{{schema:@Product:inStock}}']).toBe('true');
	});

	test('skips null and primitive array items', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([null, 'string', 42], vars);
		expect(Object.keys(vars)).toHaveLength(0);
	});

	test('stores entire typed object as JSON', () => {
		const vars: Record<string, string> = {};
		addSchemaOrgDataToVariables([{ '@type': 'Article', headline: 'Test' }], vars);
		// Prefix is "@Article:", trailing dot stripped → "@Article:"
		const parsed = JSON.parse(vars['{{schema:@Article:}}']);
		expect(parsed.headline).toBe('Test');
	});
});

// ---------------------------------------------------------------------------
// generateFrontmatter
// ---------------------------------------------------------------------------

describe('generateFrontmatter', () => {
	test('generates basic text properties', () => {
		const result = generateFrontmatter([
			{ name: 'title', value: 'Hello World' },
			{ name: 'author', value: 'Alice' },
		]);
		expect(result).toBe('---\ntitle: "Hello World"\nauthor: "Alice"\n---\n');
	});

	test('returns empty string for empty properties', () => {
		expect(generateFrontmatter([])).toBe('');
	});

	test('quotes property names with special characters', () => {
		const result = generateFrontmatter([
			{ name: 'my-property', value: 'val' },
		]);
		expect(result).toContain('"my-property":');
	});

	test('quotes property names starting with digits', () => {
		const result = generateFrontmatter([
			{ name: '1st', value: 'val' },
		]);
		expect(result).toContain('"1st":');
	});

	test('quotes YAML reserved words', () => {
		const result = generateFrontmatter([
			{ name: 'true', value: 'val' },
		]);
		expect(result).toContain('"true":');
	});

	test('uses single quotes when name contains double quotes', () => {
		const result = generateFrontmatter([
			{ name: 'say "hi"', value: 'val' },
		]);
		expect(result).toContain("'say \"hi\"':");
	});

	test('handles multitext type with JSON array', () => {
		const result = generateFrontmatter(
			[{ name: 'tags', value: '["tag1","tag2"]' }],
			{ tags: 'multitext' }
		);
		expect(result).toContain('  - "tag1"');
		expect(result).toContain('  - "tag2"');
	});

	test('handles multitext type with comma-separated values', () => {
		const result = generateFrontmatter(
			[{ name: 'tags', value: 'tag1, tag2, tag3' }],
			{ tags: 'multitext' }
		);
		expect(result).toContain('  - "tag1"');
		expect(result).toContain('  - "tag2"');
		expect(result).toContain('  - "tag3"');
	});

	test('preserves wikilinks in multitext splitting', () => {
		const result = generateFrontmatter(
			[{ name: 'tags', value: '[[link1]], [[link2]]' }],
			{ tags: 'multitext' }
		);
		expect(result).toContain('  - "[[link1]]"');
		expect(result).toContain('  - "[[link2]]"');
	});

	test('handles number type', () => {
		const result = generateFrontmatter(
			[{ name: 'count', value: '42' }],
			{ count: 'number' }
		);
		expect(result).toContain('count: 42');
	});

	test('handles number type with non-numeric characters', () => {
		const result = generateFrontmatter(
			[{ name: 'price', value: '$19.99 USD' }],
			{ price: 'number' }
		);
		expect(result).toContain('price: 19.99');
	});

	test('handles checkbox type', () => {
		const result = generateFrontmatter(
			[{ name: 'done', value: 'true' }],
			{ done: 'checkbox' }
		);
		expect(result).toContain('done: true');
	});

	test('handles checkbox type with false', () => {
		const result = generateFrontmatter(
			[{ name: 'done', value: 'false' }],
			{ done: 'checkbox' }
		);
		expect(result).toContain('done: false');
	});

	test('handles date type', () => {
		const result = generateFrontmatter(
			[{ name: 'created', value: '2024-01-15' }],
			{ created: 'date' }
		);
		expect(result).toContain('created: 2024-01-15');
	});

	test('handles empty values', () => {
		const result = generateFrontmatter([
			{ name: 'empty', value: '' },
		]);
		expect(result).toContain('empty:\n');
	});

	test('escapes double quotes in text values', () => {
		const result = generateFrontmatter([
			{ name: 'quote', value: 'she said "hello"' },
		]);
		expect(result).toContain('quote: "she said \\"hello\\""');
	});
});

// ---------------------------------------------------------------------------
// extractContentBySelector
// ---------------------------------------------------------------------------

describe('extractContentBySelector', () => {
	// Minimal mock document for testing
	function mockDoc(elements: any[]) {
		return {
			querySelectorAll: () => elements,
		};
	}

	function mockElement(text: string, html: string, attrs: Record<string, string> = {}) {
		return {
			textContent: text,
			outerHTML: html,
			getAttribute: (name: string) => attrs[name] || '',
		};
	}

	test('returns empty string when no elements match', () => {
		const result = extractContentBySelector(mockDoc([]), 'p');
		expect(result).toBe('');
	});

	test('returns array for single element', () => {
		const el = mockElement('Hello', '<p>Hello</p>');
		const result = extractContentBySelector(mockDoc([el]), 'p');
		expect(result).toEqual(['Hello']);
	});

	test('returns array of HTML for single element with extractHtml', () => {
		const el = mockElement('Hello', '<p>Hello</p>');
		const result = extractContentBySelector(mockDoc([el]), 'p', undefined, true);
		expect(result).toEqual(['<p>Hello</p>']);
	});

	test('returns array of attribute for single element', () => {
		const el = mockElement('', '', { href: 'https://example.com' });
		const result = extractContentBySelector(mockDoc([el]), 'a', 'href');
		expect(result).toEqual(['https://example.com']);
	});

	test('returns array for multiple elements', () => {
		const el1 = mockElement('One', '<p>One</p>');
		const el2 = mockElement('Two', '<p>Two</p>');
		const result = extractContentBySelector(mockDoc([el1, el2]), 'p');
		expect(result).toEqual(['One', 'Two']);
	});

	test('returns array of HTML for multiple elements with extractHtml', () => {
		const el1 = mockElement('One', '<p>One</p>');
		const el2 = mockElement('Two', '<p>Two</p>');
		const result = extractContentBySelector(mockDoc([el1, el2]), 'p', undefined, true);
		expect(result).toEqual(['<p>One</p>', '<p>Two</p>']);
	});

	test('returns array of attributes for multiple elements', () => {
		const el1 = mockElement('', '', { class: 'a' });
		const el2 = mockElement('', '', { class: 'b' });
		const result = extractContentBySelector(mockDoc([el1, el2]), 'div', 'class');
		expect(result).toEqual(['a', 'b']);
	});

	test('returns empty string on error', () => {
		const doc = {
			querySelectorAll: () => { throw new Error('bad selector'); },
		};
		const result = extractContentBySelector(doc, '!!!invalid');
		expect(result).toBe('');
	});
});
