import { AppLayout } from "@/components/app-layout";
import type { Project as SourceProject } from "@/lib/api/projects";
import { useCreateProject, useProjects } from "@/lib/api/projects";
import type { Source } from "@/lib/api/sources";
import { useSources } from "@/lib/api/sources";
import type { Task as TaskRecord } from "@/lib/api/tasks";
import { useTasks } from "@/lib/api/tasks";
import type { NewProjectInput } from "./new-project-dialog";
import { NewProjectDialog } from "./new-project-dialog";
import type { Project } from "./projects-table";
import { mapApiProject, ProjectTable } from "./projects-table";
import { StatCards } from "./stats-cards";

function projectSources(
	sources: Source[] | undefined,
	projectId: number,
): { name: string; on: boolean }[] {
	return (sources ?? [])
		.filter((source) => source.project_id === projectId)
		.map((source) => ({ name: source.kind, on: source.enabled }));
}

function taskCounts(tasks: TaskRecord[] | undefined, projectId: number) {
	const rows = (tasks ?? []).filter((task) => task.project_id === projectId);
	return {
		running: rows.filter((task) => task.status === "in-progress").length,
		failed: rows.filter((task) => task.status === "blocked").length,
	};
}

export function HomePage() {
	const projectsQuery = useProjects();
	const sourcesQuery = useSources();
	const tasksQuery = useTasks({ limit: 500 });
	const createMutation = useCreateProject();

	const projects: Project[] = (projectsQuery.data ?? []).map(
		(project: SourceProject) => {
			const counts = taskCounts(tasksQuery.data, project.id);
			return mapApiProject(
				project,
				projectSources(sourcesQuery.data, project.id),
				counts.running,
				counts.failed,
			);
		},
	);

	const connected = projects.filter(
		(project) => project.status === "connected",
	).length;

	const errors = projects.filter(
		(project) => project.status === "error",
	).length;

	const createProject = (input: NewProjectInput) => {
		createMutation.mutate({ repo: input.repo });
	};

	const loading = projectsQuery.isLoading;
	const loadError =
		projectsQuery.isError || sourcesQuery.isError || tasksQuery.isError
			? [projectsQuery.error, sourcesQuery.error, tasksQuery.error].find(
					(error) => error instanceof Error,
				)
			: undefined;

	return (
		<AppLayout>
			<div className="flex w-full flex-col gap-3 px-5 py-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h1 className="text-lg leading-5.5 font-bold">Projects</h1>
						<p className="text-muted-foreground">
							{projects.length} tracked · {connected} connected · {errors} error
						</p>
					</div>
					<NewProjectDialog onCreate={createProject} />
				</div>
				<StatCards projectCount={projects.length} />
				{createMutation.isError ? (
					<p className="text-destructive">
						Couldn't create project:{" "}
						{createMutation.error instanceof Error
							? createMutation.error.message
							: "unknown error"}
					</p>
				) : null}
				{loading ? (
					<p className="text-muted-foreground">Loading projects…</p>
				) : null}
				{loadError instanceof Error ? (
					<p className="text-destructive">
						Couldn't load projects: {loadError.message}
					</p>
				) : null}
				{!loading ? <ProjectTable projects={projects} /> : null}
			</div>
		</AppLayout>
	);
}
