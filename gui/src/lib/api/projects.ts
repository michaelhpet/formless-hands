import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "./config";

export const PROJECTS_QUERY_KEY = "projects";

export interface Project {
	id: number;
	name: string;
	remote_url: string;
	local_path: string;
	default_branch: string;
	status: string;
	status_detail: string;
}

function getProjects(): Promise<Project[]> {
	return request<Project[]>("/api/projects");
}

export function useProjects() {
	return useQuery({
		queryKey: [PROJECTS_QUERY_KEY],
		queryFn: getProjects,
	});
}

function getProject(name: string): Promise<Project> {
	return request<Project>(`/api/projects/${encodeURIComponent(name)}`);
}

export function useProject(name: string | undefined) {
	return useQuery({
		queryKey: [PROJECTS_QUERY_KEY, name ?? null],
		queryFn: () =>
			name === undefined ? Promise.resolve(undefined) : getProject(name),
		enabled: name !== undefined,
	});
}

export interface CreateProjectParams {
	repo: string;
	path?: string;
}

function createProject(params: CreateProjectParams): Promise<Project> {
	return request<Project>("/api/projects", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params),
	});
}

export function useCreateProject() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createProject,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [PROJECTS_QUERY_KEY] });
		},
	});
}
