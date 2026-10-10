import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import type { NewProjectInput } from "./new-project-dialog";
import { NewProjectDialog } from "./new-project-dialog";
import type { Project } from "./projects-table";
import { INITIAL_PROJECTS, ProjectTable } from "./projects-table";
import { StatCards } from "./stats-cards";

export function HomePage() {
	const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);

	const connected = projects.filter(
		(project) => project.status === "connected",
	).length;

	const errors = projects.filter(
		(project) => project.status === "error",
	).length;

	const createProject = (input: NewProjectInput) => {
		setProjects((prev) => [
			...prev,
			{
				id: input.name,
				name: input.name,
				branch: "main",
				updated: "just now",
				status: "connected",
				remote: input.remote || "None",
				localPath: input.localPath || "None",
				tasksRunning: 0,
				tasksFailed: 0,
				sources: [],
			},
		]);
	};

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
				<ProjectTable projects={projects} />
			</div>
		</AppLayout>
	);
}
