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
