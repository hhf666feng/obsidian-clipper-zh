import browser from './browser-polyfill';

let currentActiveTabId: number | undefined;
let currentWindowId: number | undefined;

export interface ActiveTabResult {
	tabId?: number;
	error?: string;
}

export async function updateCurrentActiveTab(windowId: number) {
	const tabs = await browser.tabs.query({ active: true, windowId: windowId });
	if (tabs[0] && tabs[0].id && tabs[0].url) {
		currentActiveTabId = tabs[0].id;
		currentWindowId = windowId;
		browser.runtime.sendMessage({
			action: "activeTabChanged",
			tabId: currentActiveTabId,
			url: tabs[0].url,
			isValidUrl: isValidUrl(tabs[0].url),
			isBlankPage: isBlankPage(tabs[0].url),
			isRestrictedUrl: isRestrictedUrl(tabs[0].url)
		});
	}
}

export async function queryActiveTab(): Promise<ActiveTabResult> {
	const tabs = await browser.tabs.query({ active: true, currentWindow: true });
	let currentTab = tabs[0];

	// Fallback for extension pages and detached UI contexts where currentWindow
	// can point at the popup/devtools window instead of the browser tab.
	if (!currentTab?.id || isExtensionPageUrl(currentTab.url)) {
		const allActiveTabs = await browser.tabs.query({ active: true });
		currentTab = allActiveTabs.find(tab =>
			tab.id && tab.url && !isExtensionPageUrl(tab.url)
		) || allActiveTabs[0];
	}

	if (currentTab?.id) {
		return { tabId: currentTab.id };
	}
	return { error: 'No active tab found' };
}

function isExtensionPageUrl(url: string | undefined): boolean {
	if (!url) return false;
	return url.startsWith('chrome-extension://') ||
		url.startsWith('moz-extension://') ||
		url.startsWith('safari-web-extension://');
}

export function isValidUrl(url: string | undefined): boolean {
	if (!url) return false;
	return url.startsWith('http://') ||
		   url.startsWith('https://') ||
		   url.startsWith('file:///');
}

export function isBlankPage(url: string): boolean {
	return url === 'about:blank' || url === 'chrome://newtab/' || url === 'edge://newtab/';
}

// Returns true for tabs where content scripts can be injected.
// False for extension pages, restricted URLs, or tabs with unknown URLs.
export function isNormalPageUrl(url: string | undefined): boolean {
	return !!url && isValidUrl(url) && !isBlankPage(url);
}

export function isRestrictedUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;
		
		// Firefox addon store
		if (hostname === 'addons.mozilla.org') return true;
		
		// Chrome Web Store
		if (hostname === 'chrome.google.com' && urlObj.pathname.startsWith('/webstore')) return true;
		if (hostname === 'chromewebstore.google.com') return true;
		
		// Edge Add-ons
		if (hostname === 'microsoftedge.microsoft.com' && urlObj.pathname.startsWith('/addons')) return true;

		return false;
	} catch {
		return false;
	}
}
