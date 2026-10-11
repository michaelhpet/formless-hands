import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function getSource(id: number): Promise<Source> {
	return request<Source>(`/api/sources/${id}`);
}

export function useSource(id: number | undefined) {
	return useQuery({
		queryKey: [SOURCES_QUERY_KEY, id ?? null],
		queryFn: () =>
			id === undefined ? Promise.resolve(undefined) : getSource(id),
		enabled: id !== undefined,
	});
}

export interface CreateSourceParams {
	project: string;
	kind: string;
	config?: Record<string, string>;
	url?: string;
}

function createSource(params: CreateSourceParams): Promise<Source> {
	return request<Source>("/api/sources", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params),
	});
}

export function useCreateSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createSource,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [SOURCES_QUERY_KEY] });
		},
	});
}

function setSourceEnabled(id: number, enabled: boolean): Promise<Source> {
	return request<Source>(`/api/sources/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ enabled }),
	});
}

export function useSetSourceEnabled() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
			setSourceEnabled(id, enabled),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [SOURCES_QUERY_KEY] });
		},
	});
}

function deleteSource(id: number): Promise<void> {
	return request<void>(`/api/sources/${id}`, { method: "DELETE" });
}

export function useDeleteSource() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteSource,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [SOURCES_QUERY_KEY] });
		},
	});
}
