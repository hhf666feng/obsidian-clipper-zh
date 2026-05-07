import { createMarkdownContent } from 'defuddle/full';
import { normalizeLazyLoadedImagesInHtml } from '../lazy-images';

export const markdown = (str: string, param?: string): string => {
	const baseUrl = param || 'about:blank';
	try {
		return createMarkdownContent(normalizeLazyLoadedImagesInHtml(str, baseUrl), baseUrl);
	} catch (error) {
		console.error('Error in createMarkdownContent:', error);
		return str;
	}
};
