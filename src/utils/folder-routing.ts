import type { FolderRoutingSettings, SiteFolderRule } from '../types/types';

const FALLBACK_DEFAULT_FOLDER = 'Clippings';

export const DEFAULT_FOLDER_ROUTING_SETTINGS: FolderRoutingSettings = {
	defaultPath: FALLBACK_DEFAULT_FOLDER,
	rules: [
		{ patternType: 'domain', pattern: 'mp.weixin.qq.com', path: 'Clippings/微信公众号' },
		{ patternType: 'domain', pattern: 'bilibili.com', path: 'Clippings/哔哩哔哩' },
		{ patternType: 'domain', pattern: 'youtube.com', path: 'Clippings/YouTube' },
		{ patternType: 'domain', pattern: 'youtu.be', path: 'Clippings/YouTube' },
	],
};

export function normalizeFolderPath(path: string): string {
	return path
		.trim()
		.replace(/\\/g, '/')
		.replace(/\/+/g, '/')
		.replace(/^\/+|\/+$/g, '');
}

export function normalizeFolderRoutingSettings(settings?: Partial<FolderRoutingSettings>): FolderRoutingSettings {
	return {
		defaultPath: normalizeFolderPath(settings?.defaultPath || DEFAULT_FOLDER_ROUTING_SETTINGS.defaultPath),
		rules: (Array.isArray(settings?.rules) ? settings.rules : DEFAULT_FOLDER_ROUTING_SETTINGS.rules)
			.map(normalizeSiteFolderRule)
			.filter((rule): rule is SiteFolderRule => rule !== null),
	};
}

function normalizeSiteFolderRule(rule: Partial<SiteFolderRule> | null | undefined): SiteFolderRule | null {
	if (!rule || typeof rule.pattern !== 'string' || typeof rule.path !== 'string') {
		return null;
	}

	const pattern = rule.pattern.trim();
	const path = normalizeFolderPath(rule.path);
	if (!pattern || !path) {
		return null;
	}

	return {
		patternType: rule.patternType === 'regex' ? 'regex' : 'domain',
		pattern,
		path,
	};
}

export function parseSiteFolderRulesText(value: string): SiteFolderRule[] {
	return value
		.split(/\r?\n/)
		.map(line => parseSiteFolderRuleLine(line))
		.filter((rule): rule is SiteFolderRule => rule !== null);
}

function parseSiteFolderRuleLine(line: string): SiteFolderRule | null {
	const trimmed = line.trim();
	if (!trimmed || trimmed.startsWith('#')) {
		return null;
	}

	const [left, ...rightParts] = trimmed.split(/\s*=>\s*/);
	const path = normalizeFolderPath(rightParts.join('=>'));
	if (!left || !path) {
		return null;
	}

	const typedMatch = left.match(/^(domain|regex)\s*:\s*(.+)$/i);
	const patternType = typedMatch?.[1].toLowerCase() === 'regex' ? 'regex' : 'domain';
	const pattern = (typedMatch?.[2] || left).trim();
	if (!pattern) {
		return null;
	}

	return { patternType, pattern, path };
}

export function serializeSiteFolderRules(rules: SiteFolderRule[]): string {
	return rules
		.map(normalizeSiteFolderRule)
		.filter((rule): rule is SiteFolderRule => rule !== null)
		.map(rule => `${rule.patternType}:${rule.pattern} => ${rule.path}`)
		.join('\n');
}

export function resolveFolderPathForUrl(
	urlValue: string,
	settings?: Partial<FolderRoutingSettings>,
	templatePath = '',
): string {
	const normalizedSettings = normalizeFolderRoutingSettings(settings);
	const matchingRule = findMatchingSiteFolderRule(urlValue, normalizedSettings.rules);
	if (matchingRule) {
		return matchingRule.path;
	}

	const normalizedTemplatePath = normalizeFolderPath(templatePath);
	if (!normalizedTemplatePath || normalizedTemplatePath === FALLBACK_DEFAULT_FOLDER) {
		return normalizedSettings.defaultPath;
	}

	return normalizedTemplatePath;
}

export function findMatchingSiteFolderRule(urlValue: string, rules: SiteFolderRule[]): SiteFolderRule | null {
	const url = parseUrl(urlValue);
	if (!url) {
		return null;
	}

	return rules.find(rule => siteFolderRuleMatches(rule, url)) || null;
}

function siteFolderRuleMatches(rule: SiteFolderRule, url: URL): boolean {
	if (rule.patternType === 'regex') {
		return regexMatchesUrl(rule.pattern, url);
	}

	const domain = normalizeDomainPattern(rule.pattern);
	const host = normalizeHost(url.hostname);
	return !!domain && (host === domain || host.endsWith(`.${domain}`));
}

function regexMatchesUrl(pattern: string, url: URL): boolean {
	try {
		const regex = new RegExp(pattern, 'i');
		return regex.test(url.href) || regex.test(url.hostname);
	} catch {
		return false;
	}
}

function parseUrl(urlValue: string): URL | null {
	try {
		return new URL(urlValue);
	} catch {
		return null;
	}
}

function normalizeDomainPattern(pattern: string): string {
	const trimmed = pattern.trim();
	if (!trimmed) return '';

	try {
		return normalizeHost(new URL(trimmed).hostname);
	} catch {
		return normalizeHost(trimmed.replace(/^[*.]+/, '').split('/')[0]);
	}
}

function normalizeHost(host: string): string {
	return host.trim().toLowerCase().replace(/^www\./, '');
}
