export function fieldErrors(
	errors: readonly unknown[],
): { message?: string }[] {
	return errors.map((error) => {
		const message =
			typeof error === "string"
				? error
				: (error as { message?: unknown } | null)?.message;
		return { message: typeof message === "string" ? message : undefined };
	});
}
