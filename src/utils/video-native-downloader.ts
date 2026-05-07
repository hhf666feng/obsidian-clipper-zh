import browser from './browser-polyfill';
import { VideoClippingSettings } from '../types/types';
import {
	DEFAULT_NATIVE_VIDEO_DOWNLOADER_HOST,
	VideoDownloadRequest,
	VideoDownloadContext,
	buildVideoDownloadRequest,
} from './video-download-request';

export interface VideoDownloadResponse {
	ok: boolean;
	pid?: number;
	executable?: string;
	outputTemplate?: string;
	error?: string;
}

export async function startNativeVideoDownload(
	variables: Record<string, string>,
	settings: VideoClippingSettings,
	context: VideoDownloadContext = {},
): Promise<VideoDownloadResponse | null> {
	const request = buildVideoDownloadRequest(variables, settings, context);
	if (!request) {
		return null;
	}

	try {
		const runtime = browser.runtime as unknown as {
			sendNativeMessage?: (hostName: string, message: VideoDownloadRequest) => Promise<VideoDownloadResponse>;
		};
		if (typeof runtime.sendNativeMessage !== 'function') {
			return { ok: false, error: 'nativeMessagingUnavailable' };
		}

		return await runtime.sendNativeMessage(DEFAULT_NATIVE_VIDEO_DOWNLOADER_HOST, request);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn('Failed to start native video download:', message);
		return { ok: false, error: message };
	}
}
