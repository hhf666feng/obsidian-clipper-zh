export const runtime = {
	getURL: (path: string) => `chrome-extension://mock-id/${path}`,
	sendMessage: async () => ({}),
	onMessage: {
		addListener: () => {},
		removeListener: () => {},
	},
};

export const storage = {
	local: {
		get: async () => ({}),
		set: async () => {},
	},
	sync: {
		get: async () => ({}),
		set: async () => {},
	},
};

let tabsQuery = async (_query?: unknown) => [] as Array<{ id?: number; url?: string }>;

export const __setTabsQueryMock = (handler: typeof tabsQuery) => {
	tabsQuery = handler;
};

export const __resetTabsQueryMock = () => {
	tabsQuery = async () => [];
};

export const tabs = {
	query: (...args: Parameters<typeof tabsQuery>) => tabsQuery(...args),
	get: async () => ({}),
	sendMessage: async () => ({}),
};

export const i18n = {
	getMessage: (key: string) => key,
};

export default {
	runtime,
	storage,
	tabs,
	i18n,
};
