import { useQuery } from "@tanstack/react-query";
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
