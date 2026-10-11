export class ApiError extends Error {
	status: number;
	body: string;

	constructor(status: number, body: string) {
		super(body.trim() !== "" ? body : `Request failed with status ${status}`);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	}
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(path, init);
	if (!response.ok) {
		throw new ApiError(response.status, await response.text());
	}
	return (await response.json()) as T;
}
