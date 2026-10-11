import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "./config";

export const TASKS_QUERY_KEY = "tasks";

export interface Task {
	id: number;
	project_id: number;
	task_source_id: number | null;
	source_kind: string | null;
	external_id: string | null;
	title: string;
	body?: string;
	labels?: string;
	status: string;
	priority: number;
	pr_number: number | null;
	branch?: string;
	attempts?: number;
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
		queryKey: [TASKS_QUERY_KEY, params],
		queryFn: () => getTasks(params),
	});
}

export function useTask(id: string | undefined) {
	return useQuery({
		queryKey: [TASKS_QUERY_KEY, id ?? null],
		queryFn: async (): Promise<Task | undefined> => {
			if (id === undefined || !/^\d+$/.test(id)) {
				return undefined;
			}
			return getTask(Number(id));
		},
		enabled: id !== undefined,
	});
}

export interface CreateTaskParams {
	project: string;
	title: string;
	body?: string;
	priority?: number;
}

function createTask(params: CreateTaskParams): Promise<Task> {
	return request<Task>("/api/tasks", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params),
	});
}

export function useCreateTask() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createTask,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
		},
	});
}

export interface UpdateTaskParams {
	id: number;
	status?: string;
	priority?: number;
	instructions?: string;
}

function updateTask({ id, ...patch }: UpdateTaskParams): Promise<Task> {
	return request<Task>(`/api/tasks/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(patch),
	});
}

export function useUpdateTask() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: updateTask,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
		},
	});
}
