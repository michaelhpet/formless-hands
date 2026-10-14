import { IconSearch } from "@tabler/icons-react";
import { useForm } from "@tanstack/react-form";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import * as z from "zod/mini";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { errorMessage, useErrorToast } from "@/hooks/use-error-toast";
import { usePollProject, useProjects } from "@/lib/api/projects";
import {
	useCreateSource,
	useDeleteSource,
	useSetSourceEnabled,
	useSources,
} from "@/lib/api/sources";
import { formatStamp } from "@/lib/datetime";
import { fieldErrors } from "@/lib/form";
import { AddSourceDialog } from "./add-source-dialog";

interface EditableSource {
	id: number;
	name: string;
	on: boolean;
	config: string;
	cursor: string;
	lastPolled: string | null;
}

interface ProjectFields {
	name: string;
	remote: string;
	localPath: string;
	branch: string;
	status: string;
}

const SOURCE_DISPLAY: Record<string, string> = {
	linear: "Linear",
	github: "GitHub",
};

function sourceDisplay(name: string): string {
	return SOURCE_DISPLAY[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

const nonEmpty = (label: string) =>
	z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", `${label} is required`),
		);

const projectSettingsSchema = z.object({
	remote: nonEmpty("Remote"),
	localPath: nonEmpty("Local path"),
	branch: nonEmpty("Branch"),
});

export function ProjectSettingsPage() {
	const { projectId } = useParams({ strict: false });
	const projectsQuery = useProjects();
	const sourcesQuery = useSources();
	const apiProject = (projectsQuery.data ?? []).find(
		(item) => item.name === projectId,
	);
	const project: ProjectFields | undefined = apiProject
		? {
				name: apiProject.name,
				remote: apiProject.remote_url,
				localPath: apiProject.local_path,
				branch: apiProject.default_branch,
				status: apiProject.status,
			}
		: undefined;
	const sources: EditableSource[] = (sourcesQuery.data ?? [])
		.filter((source) => apiProject && source.project_id === apiProject.id)
		.map((source) => ({
			id: source.id,
			name: source.kind,
			on: source.enabled,
			config: source.config_json,
			cursor: source.cursor,
			lastPolled: source.last_polled_at,
		}));

	if (!project) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>Project not found</EmptyTitle>
						<EmptyDescription>
							No project with id "{projectId}" is tracked.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Link to="/">
							<Button variant="outline" size="sm">
								Back to projects
							</Button>
						</Link>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<ProjectSettingsForm
			key={project.name}
			projectId={projectId}
			project={project}
			sources={sources}
		/>
	);
}

function ProjectSettingsForm({
	projectId,
	project,
	sources,
}: {
	projectId: string | undefined;
	project: ProjectFields;
	sources: EditableSource[];
}) {
	const pollMutation = usePollProject();
	const createSourceMutation = useCreateSource();
	const setEnabledMutation = useSetSourceEnabled();
	const deleteSourceMutation = useDeleteSource();
	const [pollText, setPollText] = useState<string | null>(null);
	const [savedAt, setSavedAt] = useState<string | null>(null);
	const form = useForm({
		defaultValues: {
			remote: project.remote,
			localPath: project.localPath,
			branch: project.branch,
		},
		validators: { onSubmit: projectSettingsSchema },
		onSubmit: ({ value }) => {
			form.reset(value);
			setSavedAt("saved just now");
		},
	});

	const pollNow = () => {
		if (projectId === undefined) {
			return;
		}
		pollMutation.mutate(projectId, {
			onSuccess: (result) => {
				setPollText(
					`polled just now · ${result.sources} sources · ${result.upserted} issues`,
				);
			},
			onError: (error) => {
				setPollText(null);
				toast.add({
					type: "error",
					title: "Poll failed",
					description: errorMessage(error),
				});
			},
		});
	};
	useErrorToast(setEnabledMutation.error, "Couldn't update source");
	useErrorToast(deleteSourceMutation.error, "Couldn't remove source");
	useErrorToast(createSourceMutation.error, "Couldn't add source");

	const toggleSource = (sourceId: number) => {
		const current = sources.find((source) => source.id === sourceId);
		if (current) {
			setEnabledMutation.mutate({ id: sourceId, enabled: !current.on });
		}
	};

	const removeSource = (sourceId: number) => {
		deleteSourceMutation.mutate(sourceId);
	};

	const createSource = (kind: string, config: string) => {
		if (projectId === undefined) {
			return;
		}
		const parsed: Record<string, string> = {};
		for (const line of config.split("\n")) {
			const eq = line.indexOf("=");
			if (eq === -1) {
				continue;
			}
			const key = line.slice(0, eq).trim();
			const value = line.slice(eq + 1).trim();
			if (key !== "") {
				parsed[key] = value;
			}
		}
		createSourceMutation.mutate({ project: projectId, kind, config: parsed });
	};

	const stamps = sources
		.map((source) => source.lastPolled)
		.filter((stamp): stamp is string => stamp !== null)
		.sort();
	const lastPolled =
		pollText ??
		(stamps.length > 0
			? `Last polled ${formatStamp(stamps[stamps.length - 1])}`
			: "Never polled");

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex flex-col gap-2">
				<PageBreadcrumb
					items={[
						<Link key="project" to="/">
							{projectId}
						</Link>,
						"Settings",
					]}
				/>
				<div className="flex items-end justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h1 className="text-xl leading-6.5 font-bold">Project settings</h1>
						<p className="text-muted-foreground">
							{project.name} · sources polled hourly
							{savedAt ? ` · ${savedAt}` : ""}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button
							variant="outline"
							onClick={pollNow}
							disabled={pollMutation.isPending}
						>
							{pollMutation.isPending ? "Polling..." : "Poll now"}
						</Button>
						<form.Subscribe selector={(state) => state.isDirty}>
							{(dirty) => (
								<Button
									onClick={() => void form.handleSubmit()}
									disabled={!dirty}
								>
									Save changes
								</Button>
							)}
						</form.Subscribe>
					</div>
				</div>
			</div>

			<div className="flex w-full max-w-220 flex-col gap-3">
				<Card className="gap-0 py-0">
					<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
						PROJECT
					</h2>
					<div className="flex flex-col">
						<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
							<span className="shrink-0 text-muted-foreground">Name</span>
							<Input
								aria-label="Project name"
								value={project.name}
								disabled
								title="Inferred from the repository — cannot be renamed"
								className="h-7 max-w-80 border-transparent text-right font-bold opacity-70 shadow-none"
							/>
						</div>
						<form.Field name="remote">
							{(field) => (
								<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
									<span className="shrink-0 text-muted-foreground">Remote</span>
									<Field>
										<Input
											aria-label="Remote URL"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="h-7 max-w-80 border-transparent text-right shadow-none hover:border-input focus-visible:border-input"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								</div>
							)}
						</form.Field>
						<form.Field name="localPath">
							{(field) => (
								<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
									<span className="shrink-0 text-muted-foreground">
										Local path
									</span>
									<Field>
										<Input
											aria-label="Local path"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="h-7 max-w-80 border-transparent text-right text-muted-foreground shadow-none hover:border-input focus-visible:border-input"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								</div>
							)}
						</form.Field>
						<form.Field name="branch">
							{(field) => (
								<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
									<span className="shrink-0 text-muted-foreground">
										Default branch
									</span>
									<Field>
										<Input
											aria-label="Default branch"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="h-7 max-w-80 border-transparent text-right shadow-none hover:border-input focus-visible:border-input"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								</div>
							)}
						</form.Field>
						<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span className="text-muted-foreground">Status</span>
							{project.status === "connected" ? (
								<StatusBadge status="connected" />
							) : (
								<StatusBadge status="error" />
							)}
						</div>
					</div>
				</Card>

				<Card className="gap-0 py-0">
					<div className="flex items-center justify-between border-b px-3.5 pt-3 pb-2.5">
						<h2 className="tracking-wide text-muted-foreground">
							SOURCES · {sources.length}
						</h2>
						<span className="text-muted-foreground">{lastPolled}</span>
					</div>
					<div className="flex flex-col">
						{sources.map((source) => (
							<div
								key={source.id}
								className="flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0"
							>
								<span className="flex items-center gap-1.5 text-[13px] text-foreground">
									<span
										className={cn(
											"size-1.5 rounded-full",
											source.on ? "bg-success" : "bg-muted-foreground",
										)}
										aria-hidden="true"
									/>
									{sourceDisplay(source.name)}
								</span>
								<span className="text-muted-foreground truncate">
									{source.config} · cursor {source.cursor}
								</span>
								<span className="grow" />
								<button
									type="button"
									onClick={() => toggleSource(source.id)}
									aria-pressed={source.on}
									aria-label={`Turn ${sourceDisplay(source.name)} ${source.on ? "off" : "on"}`}
									className="border bg-muted px-2.5 py-1 hover:bg-muted/50"
								>
									<span
										className={cn(
											source.on ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{source.on ? "On" : "Off"}
									</span>
								</button>
								<button
									type="button"
									onClick={() => removeSource(source.id)}
									className="text-destructive hover:underline hover:underline-offset-4"
								>
									Remove
								</button>
							</div>
						))}
						{sources.length === 0 ? (
							<p className="border-b px-3.5 py-3 text-muted-foreground">
								No sources. Add one below to start polling tasks.
							</p>
						) : null}
						<div className="px-0 py-0">
							<AddSourceDialog
								existing={sources.map((source) => source.name)}
								onCreate={({ kind, config }) => createSource(kind, config)}
							/>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
