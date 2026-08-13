import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';
import {
	detectFeishuDoc,
	getFeishuDocInfo,
	getFeishuDocMarkdown,
	createFeishuClipTemplate,
	FEISHU_CLIP_TEMPLATE_ID,
} from './feishu-clipping';

function docFromBody(inner: string): Document {
	const { document } = parseHTML(
		`<!DOCTYPE html><html><head><title>t</title></head><body><div class="doc-body">${inner}</div></body></html>`,
	);
	return document as unknown as Document;
}

describe('detectFeishuDoc', () => {
	it('recognizes feishu.cn docx pages', () => {
		expect(detectFeishuDoc('https://www.feishu.cn/docx/abcdef')).toBe('feishu');
		expect(detectFeishuDoc('https://feishu.cn/wiki/xyz')).toBe('feishu');
	});

	it('recognizes larksuite.com sheets/base pages', () => {
		expect(detectFeishuDoc('https://www.larksuite.com/sheets/abc')).toBe('larksuite');
		expect(detectFeishuDoc('https://larksuite.com/base/xyz')).toBe('larksuite');
	});

	it('ignores non-doc pages (home / drive list)', () => {
		expect(detectFeishuDoc('https://www.feishu.cn/')).toBe('');
		expect(detectFeishuDoc('https://www.feishu.cn/drive/home')).toBe('');
	});

	it('ignores unrelated sites', () => {
		expect(detectFeishuDoc('https://example.com/docx/abc')).toBe('');
	});
});

describe('getFeishuDocInfo', () => {
	it('returns docType from path', () => {
		expect(getFeishuDocInfo('https://www.feishu.cn/wiki/abc').docType).toBe('wiki');
		expect(getFeishuDocInfo('https://www.larksuite.com/sheets/abc').docType).toBe('sheets');
		expect(getFeishuDocInfo('https://www.feishu.cn/').docType).toBe('unknown');
	});
});

describe('getFeishuDocMarkdown', () => {
	it('preserves heading levels', () => {
		const doc = docFromBody('<h1>Title</h1><h2>Sub</h2><p>body text</p>');
		const md = getFeishuDocMarkdown(doc);
		expect(md).toContain('# Title');
		expect(md).toContain('## Sub');
		expect(md).toContain('body text');
	});

	it('preserves tables (the key gap vs generic web extraction)', () => {
		const doc = docFromBody(
			'<table><tr><th>Name</th><th>Role</th></tr><tr><td>Alice</td><td>PM</td></tr><tr><td>Bob</td><td>Eng</td></tr></table>',
		);
		const md = getFeishuDocMarkdown(doc);
		expect(md).toContain('| Name | Role |');
		expect(md).toContain('| --- | --- |');
		expect(md).toContain('| Alice | PM |');
		expect(md).toContain('| Bob | Eng |');
	});

	it('preserves code blocks', () => {
		const doc = docFromBody('<pre><code class="language-ts">const a = 1;</code></pre>');
		const md = getFeishuDocMarkdown(doc);
		expect(md).toContain('```ts');
		expect(md).toContain('const a = 1;');
		expect(md).toContain('```');
	});

	it('preserves ordered/unordered lists and blockquotes', () => {
		const doc = docFromBody(
			'<ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol><blockquote>quoted</blockquote>',
		);
		const md = getFeishuDocMarkdown(doc);
		expect(md).toContain('- one');
		expect(md).toContain('- two');
		expect(md).toContain('1. first');
		expect(md).toContain('2. second');
		expect(md).toContain('> quoted');
	});

	it('preserves text around nested block elements in document order', () => {
		const doc = docFromBody(
			'<div><a href="https://example.com"><span>Before</span></a><table><tr><th>Name</th></tr><tr><td>Alice</td></tr></table><img src="https://example.com/image.png" alt="Example">After</div>',
		);
		const md = getFeishuDocMarkdown(doc);
		expect(md).toMatch(/\[Before\]\(https:\/\/example\.com\)[\s\S]*\| Name \|[\s\S]*!\[Example\]\(https:\/\/example\.com\/image\.png\)[\s\S]*After/);
	});

	it('returns empty string when no doc root is found', () => {
		const { document } = parseHTML('<html><body></body></html>');
		expect(getFeishuDocMarkdown(document as unknown as Document)).toBe('');
	});
});

describe('createFeishuClipTemplate', () => {
	it('has the builtin id, feishu path, and doc-style triggers', () => {
		const t = createFeishuClipTemplate();
		expect(t.id).toBe(FEISHU_CLIP_TEMPLATE_ID);
		expect(t.path).toBe('Clippings/Feishu');
		expect(t.properties.some((p) => p.name === 'platform' && p.value === 'feishu')).toBe(true);
		expect((t.triggers ?? []).some((tr) => tr.includes('feishu\\.cn'))).toBe(true);
		expect((t.triggers ?? []).some((tr) => tr.includes('larksuite\\.com'))).toBe(true);
	});
});
