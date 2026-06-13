import type { Template } from '../types/types';

export type ResilienceLogger = Pick<Console, 'warn' | 'error'>;

export async function runOptionalStep<T>(
	label: string,
	step: () => Promise<T> | T,
	logger: ResilienceLogger = console,
): Promise<T | undefined> {
	try {
		return await step();
	} catch (error) {
		logger.warn(`${label} failed; continuing with degraded functionality.`, error);
		return undefined;
	}
}

export async function runRequiredStep<T>(
	label: string,
	step: () => Promise<T> | T,
): Promise<T> {
	try {
		return await step();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${label} failed: ${message}`);
	}
}

export function isUsableTemplate(template: Template | null | undefined): template is Template {
	return !!template
		&& typeof template.id === 'string'
		&& typeof template.name === 'string'
		&& typeof template.noteNameFormat === 'string'
		&& typeof template.path === 'string'
		&& typeof template.noteContentFormat === 'string'
		&& Array.isArray(template.properties);
}

export function chooseFallbackTemplate(
	templates: Template[],
	currentTemplate: Template | null,
	defaultTemplate: Template,
	options: { preferVideoTemplate?: boolean } = {},
): Template {
	const videoTemplate = options.preferVideoTemplate
		? templates.find(template => template.id === 'builtin-video-clip' && isUsableTemplate(template))
		: undefined;

	if (videoTemplate) return videoTemplate;
	if (isUsableTemplate(currentTemplate)) return currentTemplate;

	const firstUsableTemplate = templates.find(isUsableTemplate);
	return firstUsableTemplate || defaultTemplate;
}
