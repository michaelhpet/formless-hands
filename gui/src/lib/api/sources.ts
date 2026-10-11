import { useQuery } from "@tanstack/react-query";
import { request } from "./config";

export const SOURCES_QUERY_KEY = "sources";

export interface Source {
	id: number;
	project_id: number;
	kind: string;
	enabled: boolean;
	last_polled_at: string | null;
	cursor: string;
	config_json: string;
	backoff_until: string;
	backoff_count: number;
	last_error: string;
}

function getSources(): Promise<Source[]> {
	return request<Source[]>("/api/sources");
}

export function useSources() {
	return useQuery({
		queryKey: [SOURCES_QUERY_KEY],
		queryFn: getSources,
	});
}
