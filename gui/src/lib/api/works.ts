import { useQuery } from "@tanstack/react-query";
import { request } from "./config";

export const WORKS_QUERY_KEY = "works";

export interface Work {
	id: number;
	task_id: number;
	task_external_id: string | null;
	task_title: string;
	project_id: number;
	worktree_path: string;
	branch: string;
	started_at: string;
	finished_at: string | null;
	exit_code: number | null;
	log_path: string;
}

export interface GetWorksParams {
	project?: string;
	limit?: number;
	page?: number;
}

function getWorks(params: GetWorksParams): Promise<Work[]> {
	const search = new URLSearchParams();
	if (params.project !== undefined) {
		search.set("project", params.project);
	}
	if (params.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	if (params.page !== undefined) {
		search.set("page", String(params.page));
	}
	const query = search.toString();
	return request<Work[]>(`/api/works${query === "" ? "" : `?${query}`}`);
}

function getWork(id: number): Promise<Work> {
	return request<Work>(`/api/works/${id}`);
}

export function useWorks(params: GetWorksParams) {
	return useQuery({
		queryKey: [WORKS_QUERY_KEY, params],
		queryFn: () => getWorks(params),
	});
}

export function useWork(id: string | undefined) {
	return useQuery({
		queryKey: [WORKS_QUERY_KEY, id ?? null],
		queryFn: async (): Promise<Work | undefined> => {
			if (id === undefined || !/^\d+$/.test(id)) {
				return undefined;
			}
			return getWork(Number(id));
		},
		enabled: id !== undefined,
	});
}
