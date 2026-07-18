import { Template } from '../types/types';

/**
 * 飞书 / Lark 文档专属 provider。
 *
 * 飞书（feishu.cn）与 Lark（larksuite.com）文档原本被 clipper 当普通网页，
 * 用 defuddle 抽取会丢失块级结构（标题层级、表格、代码块、有序/无序列表）。
 * 这里提供：
 *   - detectFeishuDoc(url)        按域名 + 文档路径识别飞书/Lark 文档页
 *   - getFeishuDocMarkdown(doc)   结构化抽取正文为 markdown（保留表格/代码/层级）
 *   - createFeishuClipTemplate()  专属模板（frontmatter + Clippings/Feishu 路径）
 *   - syncFeishuClipTemplate()    模板同步（参照视频模板写法）
 *
 * 设计原则：纯 DOM 标签遍历，不依赖飞书/ Lark 具体的 minified class 名，
 * 因此对飞书与 Lark 两套渲染 DOM 都兼容。若识别不到正文根节点则回传空串，
 * 呼叫方会退回 defuddle，不会破坏原有流程。
 */

export type FeishuDocBrand = '' | 'feishu' | 'larksuite';

export const FEISHU_CLIP_TEMPLATE_ID = 'builtin-feishu-clip';

export type FeishuDocType = 'docx' | 'wiki' | 'sheets' | 'base' | 'unknown';

interface FeishuProvider {
	brand: Exclude<FeishuDocBrand, ''>;
	matches: (url: URL) => boolean;
}

function normalizedHost(url: URL): string {
	return url.hostname.replace(/^www\./, '');
}

function feishuDocTypeFromPath(pathname: string): FeishuDocType {
	if (/\/docx\//.test(pathname)) return 'docx';
	if (/\/wiki\//.test(pathname)) return 'wiki';
	if (/\/(sheets|sheet)\//.test(pathname)) return 'sheets';
	if (/\/base\//.test(pathname)) return 'base';
	return 'unknown';
}

export const FEISHU_PROVIDER_REGISTRY: FeishuProvider[] = [
	{
		brand: 'feishu',
		matches: (url) => {
			const host = normalizedHost(url);
			return (
				host === 'feishu.cn'
				|| host === 'www.feishu.cn'
				|| host.endsWith('.feishu.cn')
				|| host === 'vika.larksuite.com'
			);
		},
	},
	{
		brand: 'larksuite',
		matches: (url) => {
			const host = normalizedHost(url);
			return (
				host === 'larksuite.com'
				|| host === 'www.larksuite.com'
				|| host.endsWith('.larksuite.com')
			);
		},
	},
];

export function detectFeishuDoc(urlValue: string): FeishuDocBrand {
	try {
		const url = new URL(urlValue);
		// 必须落在文档型路径，避免命中飞书首页 / 云文档主页 / _drive 列表
		if (feishuDocTypeFromPath(url.pathname) === 'unknown') return '';
		const provider = FEISHU_PROVIDER_REGISTRY.find((p) => p.matches(url));
		return provider ? provider.brand : '';
	} catch {
		return '';
	}
}

export function getFeishuDocInfo(urlValue: string): { brand: FeishuDocBrand; docType: FeishuDocType } {
	try {
		const url = new URL(urlValue);
		return { brand: detectFeishuDoc(urlValue), docType: feishuDocTypeFromPath(url.pathname) };
	} catch {
		return { brand: '', docType: 'unknown' };
	}
}

/**
 * 找到飞书/Lark 文档正文根节点。按一组候选选择器逐个尝试，
 * 取第一个含非空文本的节点；都找不到则回传 null（呼叫方退回 defuddle）。
 */
function findFeishuDocRoot(document: Document): Element | null {
	const candidates = [
		'[class*="doc-body"]',
		'.lark-doc-reader',
		'#docx-reader',
		'.reader-sheet-container',
		'.fusion-docs',
		'[data-placeholder]',
		'main',
		'article',
	];
	for (const sel of candidates) {
		try {
			const el = document.querySelector(sel);
			if (el && (el.textContent || '').trim().length > 0) {
				return el;
			}
		} catch {
			// 某些 DOM 环境不支持个别选择器，跳过即可
		}
	}
	return null;
}

function inlineText(el: Element): string {
	let out = '';
	el.childNodes.forEach((node) => {
		if (node.nodeType === 3) {
			out += node.textContent || '';
		} else if (node.nodeType === 1) {
			const child = node as Element;
			const tag = child.tagName.toLowerCase();
			if (tag === 'a') {
				const href = child.getAttribute('href') || '';
				out += `[${child.textContent || ''}](${href})`;
			} else if (tag === 'br') {
				out += '\n';
			} else if (tag === 'code') {
				out += '`' + (child.textContent || '') + '`';
			} else if (tag === 'strong' || tag === 'b') {
				out += '**' + (child.textContent || '') + '**';
			} else if (tag === 'em' || tag === 'i') {
				out += '_' + (child.textContent || '') + '_';
			} else {
				out += inlineText(child);
			}
		}
	});
	return out.replace(/\s+/g, ' ').trim();
}

function tableToMarkdown(table: Element): string[] {
	const rows = Array.from(table.querySelectorAll('tr'));
	if (rows.length === 0) return [];
	const out: string[] = [];
	rows.forEach((tr, idx) => {
		const cells = Array.from(tr.querySelectorAll('th, td')).map((c) =>
			inlineText(c).replace(/\|/g, '\\|'),
		);
		out.push('| ' + cells.join(' | ') + ' |');
		if (idx === 0) {
			out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
		}
	});
	return out;
}

function pushIfText(lines: string[], text: string): void {
	const t = text.trim();
	if (t) {
		lines.push(t);
		lines.push('');
	}
}

function walkBlocks(parent: Element, lines: string[]): void {
	for (const child of Array.from(parent.children)) {
		const tag = child.tagName.toLowerCase();

		if (/^h[1-6]$/.test(tag)) {
			const level = parseInt(tag[1], 10);
			lines.push('#'.repeat(level) + ' ' + inlineText(child));
			lines.push('');
		} else if (tag === 'ul') {
			Array.from(child.querySelectorAll(':scope > li')).forEach((li) => {
				lines.push('- ' + inlineText(li));
			});
			lines.push('');
		} else if (tag === 'ol') {
			Array.from(child.querySelectorAll(':scope > li')).forEach((li, i) => {
				lines.push(`${i + 1}. ` + inlineText(li));
			});
			lines.push('');
		} else if (tag === 'table') {
			lines.push(...tableToMarkdown(child));
			lines.push('');
		} else if (tag === 'blockquote') {
			inlineText(child).split('\n').forEach((l) => lines.push('> ' + l));
			lines.push('');
		} else if (tag === 'hr') {
			lines.push('---');
			lines.push('');
		} else if (tag === 'img') {
			const src = child.getAttribute('src') || '';
			const alt = child.getAttribute('alt') || '';
			lines.push(`![${alt}](${src})`);
			lines.push('');
		} else if (tag === 'pre') {
			const code = child.querySelector('code') || child;
			const cls = (child.getAttribute('class') || '') + ' ' + (code.getAttribute('class') || '');
			const m = cls.match(/language-([a-zA-Z0-9+#-]+)/);
			const lang = m ? m[1] : '';
			lines.push('```' + lang);
			lines.push((code.textContent || '').replace(/\n+$/, ''));
			lines.push('```');
			lines.push('');
		} else if (tag === 'div' || tag === 'p' || tag === 'section') {
			// 含子块则递归，否则当段落
			if (child.querySelector('h1,h2,h3,h4,h5,h6,ul,ol,table,pre,blockquote')) {
				walkBlocks(child, lines);
			} else if (child.querySelector('pre')) {
				const code = child.querySelector('code') || child;
				const cls = (child.getAttribute('class') || '') + ' ' + (code.getAttribute('class') || '');
				const m = cls.match(/language-([a-zA-Z0-9+#-]+)/);
				const lang = m ? m[1] : '';
				lines.push('```' + lang);
				lines.push((code.textContent || '').replace(/\n+$/, ''));
				lines.push('```');
				lines.push('');
			} else {
				pushIfText(lines, inlineText(child));
			}
		} else if (child.children.length > 0) {
			walkBlocks(child, lines);
		}
	}
}

export function getFeishuDocMarkdown(document: Document): string {
	const root = findFeishuDocRoot(document);
	if (!root) return '';
	const lines: string[] = [];
	walkBlocks(root, lines);
	return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function createFeishuClipTemplate(): Template {
	return {
		id: FEISHU_CLIP_TEMPLATE_ID,
		name: '飞书文档',
		behavior: 'create',
		noteNameFormat: '{{title}}',
		path: 'Clippings/Feishu',
		noteContentFormat: '{{content}}',
		properties: [
			{ name: 'title', value: '{{title}}', type: 'text' },
			{ name: 'source', value: '{{url}}', type: 'text' },
			{ name: 'platform', value: 'feishu', type: 'text' },
			{ name: 'doc_type', value: '{{feishuDocType}}', type: 'text' },
			{ name: 'tags', value: 'feishu', type: 'text' },
		],
		triggers: [
			'https://www.feishu.cn/docx/',
			'https://www.feishu.cn/wiki/',
			'https://www.feishu.cn/sheets/',
			'https://www.feishu.cn/base/',
			'https://larksuite.com/docx/',
			'https://larksuite.com/wiki/',
			'https://larksuite.com/sheets/',
			'https://larksuite.com/base/',
		],
	};
}

export function syncFeishuClipTemplate(
	existing: Template,
	enableTriggers: boolean,
): { template: Template; changed: boolean } {
	const canonical = createFeishuClipTemplate();
	const next: Template = {
		...canonical,
		triggers: enableTriggers ? canonical.triggers : [],
		vault: existing.vault,
		context: existing.context,
	};

	const changed = JSON.stringify(existing) !== JSON.stringify(next);
	return { template: next, changed };
}
