import { useQuery } from "@tanstack/react-query";
import { request } from "./config";

export const TASKS_QUERY_KEY = "tasks";

export interface Task {
	id: number;
	project_id: number;
	task_source_id: number | null;
	source_kind: string | null;
	external_id: string | null;
	title: string;
	status: string;
	priority: number;
	pr_number: number | null;
}

export interface GetTasksParams {
	project?: string;
	status?: string;
	limit?: number;
	page?: number;
}

function getTasks(params: GetTasksParams): Promise<Task[]> {
	const search = new URLSearchParams();
	if (params.project !== undefined) {
		search.set("project", params.project);
	}
	if (params.status !== undefined) {
		search.set("status", params.status);
	}
	if (params.limit !== undefined) {
		search.set("limit", String(params.limit));
	}
	if (params.page !== undefined) {
		search.set("page", String(params.page));
	}
	const query = search.toString();
	return request<Task[]>(`/api/tasks${query === "" ? "" : `?${query}`}`);
}

function getTask(id: number): Promise<Task> {
	return request<Task>(`/api/tasks/${id}`);
}

export function useTasks(params: GetTasksParams) {
	return useQuery({
		queryKey: [
			TASKS_QUERY_KEY,
			params.project ?? null,
			params.status ?? null,
			params.limit ?? null,
			params.page ?? null,
		],
		queryFn: () => getTasks(params),
	});
}

export function useTask(project: string | undefined, id: string | undefined) {
	const numericId = id !== undefined && /^\d+$/.test(id) ? Number(id) : null;
	const direct = useQuery({
		queryKey: [TASKS_QUERY_KEY, numericId],
		queryFn: () =>
			numericId === null ? Promise.resolve(undefined) : getTask(numericId),
		enabled: numericId !== null,
	});
	const list = useTasks({ project, limit: 500 });
	if (numericId !== null) {
		return direct;
	}
	const match = list.data?.find(
		(task) => (task.external_id ?? `#${task.id}`) === id,
	);
	return { ...list, data: match };
}
