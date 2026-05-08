export interface YouTubeInnertubeHeaderRoutingCapabilities {
	hasDeclarativeNetRequest: boolean;
	hasOnBeforeSendHeaders: boolean;
	permissions?: readonly string[];
}

export function shouldRegisterYouTubeInnertubeWebRequestFallback(
	capabilities: YouTubeInnertubeHeaderRoutingCapabilities,
): boolean {
	return capabilities.hasOnBeforeSendHeaders
		&& (capabilities.permissions || []).includes('webRequestBlocking');
}
