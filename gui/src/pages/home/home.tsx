import { AppLayout } from "@/components/app-layout";
import { useErrorToast } from "@/hooks/use-error-toast";
import { useCreateProject, useProjects } from "@/lib/api/projects";
import { useSources } from "@/lib/api/sources";
import { useTasks } from "@/lib/api/tasks";
import { useWorks } from "@/lib/api/works";
import type { NewProjectInput } from "./new-project-dialog";
import { NewProjectDialog } from "./new-project-dialog";
import { ProjectTable } from "./projects-table";
import { StatCards } from "./stats-cards";

function countBy<T>(rows: T[], key: (row: T) => number): Map<number, number> {
	const counts = new Map<number, number>();
	for (const row of rows) {
		const id = key(row);
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return counts;
}

export function HomePage() {
	const projectsQuery = useProjects();
	const sourcesQuery = useSources();
	const tasksQuery = useTasks({ limit: 500 });
	const worksQuery = useWorks({ limit: 500 });
	const createMutation = useCreateProject();

	const projects = projectsQuery.data ?? [];
	const tasks = tasksQuery.data ?? [];

	const connected = projects.filter(
		(project) => project.status === "connected",
	).length;

	const errors = projects.filter(
		(project) => project.status !== "connected",
	).length;

	const runningByProject = countBy(
		tasks.filter((task) => task.status === "in-progress"),
		(task) => task.project_id,
	);
	const failedByProject = countBy(
		tasks.filter((task) => task.status === "blocked"),
		(task) => task.project_id,
	);

	const createProject = (input: NewProjectInput) => {
		createMutation.mutate({ repo: input.repo });
	};

	const loading = projectsQuery.isLoading;
	const loadError =
		projectsQuery.isError ||
		sourcesQuery.isError ||
		tasksQuery.isError ||
		worksQuery.isError
			? [
					projectsQuery.error,
					sourcesQuery.error,
					tasksQuery.error,
					worksQuery.error,
				].find((error) => error instanceof Error)
			: undefined;
	useErrorToast(loadError, "Couldn't load projects");
	useErrorToast(createMutation.error, "Couldn't create project");

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
				<StatCards
					projects={projects}
					tasks={tasks}
					works={worksQuery.data ?? []}
					projectCount={projects.length}
					connectedCount={connected}
				/>
				{loading ? (
					<p className="text-muted-foreground">Loading projects…</p>
				) : null}
				{!loading ? (
					<ProjectTable
						projects={projects}
						sources={sourcesQuery.data ?? []}
						runningByProject={runningByProject}
						failedByProject={failedByProject}
					/>
				) : null}
			</div>
		</AppLayout>
	);
}
