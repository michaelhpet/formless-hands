import { IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { usePollProject, useProjects } from "@/lib/api/projects";
import {
	useCreateSource,
	useDeleteSource,
	useSetSourceEnabled,
	useSources,
} from "@/lib/api/sources";
import { formatStamp } from "@/lib/datetime";
import { AddSourceDialog } from "./add-source-dialog";

interface EditableSource {
	id: number;
	name: string;
	on: boolean;
	config: string;
	cursor: string;
	lastPolled: string | null;
}

const SOURCE_DISPLAY: Record<string, string> = {
	linear: "Linear",
	github: "GitHub",
};

function sourceDisplay(name: string): string {
	return SOURCE_DISPLAY[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export function ProjectSettingsPage() {
	const { projectId } = useParams({ strict: false });
	const projectsQuery = useProjects();
	const sourcesQuery = useSources();
	const apiProject = (projectsQuery.data ?? []).find(
		(item) => item.name === projectId,
	);
	const project = apiProject
		? {
				id: apiProject.name,
				name: apiProject.name,
				remote: apiProject.remote_url,
				localPath: apiProject.local_path,
				branch: apiProject.default_branch,
				status: apiProject.status,
			}
		: undefined;
	const liveSources: EditableSource[] = (sourcesQuery.data ?? [])
		.filter((source) => apiProject && source.project_id === apiProject.id)
		.map((source) => ({
			id: source.id,
			name: source.kind,
			on: source.enabled,
			config: source.config_json,
			cursor: source.cursor,
			lastPolled: source.last_polled_at,
		}));
	const liveKey = `${projectId ?? ""}:${liveSources.map((source) => source.id).join(",")}`;
	const syncedKey = useRef("");
	const [name, setName] = useState("");
	const [remote, setRemote] = useState("");
	const [localPath, setLocalPath] = useState("");
	const [branch, setBranch] = useState("");
	const [baseline, setBaseline] = useState({ name, remote, localPath, branch });
	const [sources, setSources] = useState<EditableSource[]>([]);
	const [lastPolled, setLastPolled] = useState("polled 30s ago");
	const [savedAt, setSavedAt] = useState<string | null>(null);
	const pollMutation = usePollProject();
	const createSourceMutation = useCreateSource();
	const setEnabledMutation = useSetSourceEnabled();
	const deleteSourceMutation = useDeleteSource();

	useEffect(() => {
		if (syncedKey.current === liveKey) {
			return;
		}
		syncedKey.current = liveKey;
		setName(project?.name ?? "");
		setRemote(project?.remote ?? "");
		setLocalPath(project?.localPath ?? "");
		setBranch(project?.branch ?? "");
		setBaseline({
			name: project?.name ?? "",
			remote: project?.remote ?? "",
			localPath: project?.localPath ?? "",
			branch: project?.branch ?? "",
		});
		setSources(liveSources);
		setSavedAt(null);
	});

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

	const dirty =
		name !== baseline.name ||
		remote !== baseline.remote ||
		localPath !== baseline.localPath ||
		branch !== baseline.branch;

	const save = () => {
		setBaseline({ name, remote, localPath, branch });
		setSavedAt("saved just now");
	};

	const pollNow = () => {
		if (projectId === undefined) {
			return;
		}
		pollMutation.mutate(projectId, {
			onSuccess: (result) => {
				setLastPolled(
					`polled just now · ${result.sources} sources · ${result.upserted} issues`,
				);
			},
			onError: (error) => {
				setLastPolled(
					error instanceof Error
						? `poll failed: ${error.message}`
						: "poll failed",
				);
			},
		});
	};

	const toggleSource = (sourceId: number) => {
		const current = sources.find((source) => source.id === sourceId);
		setSources((prev) =>
			prev.map((source) =>
				source.id === sourceId ? { ...source, on: !source.on } : source,
			),
		);
		if (current) {
			setEnabledMutation.mutate({ id: sourceId, enabled: !current.on });
		}
	};

	const removeSource = (sourceId: number) => {
		setSources((prev) => prev.filter((source) => source.id !== sourceId));
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
							{name || projectId} · sources polled hourly
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
						<Button onClick={save} disabled={!dirty}>
							Save changes
						</Button>
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
								value={name}
								disabled
								title="Inferred from the repository — cannot be renamed"
								className="h-7 max-w-80 border-transparent text-right font-bold opacity-70 shadow-none"
							/>
						</div>
						<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
							<span className="shrink-0 text-muted-foreground">Remote</span>
							<Input
								aria-label="Remote URL"
								value={remote}
								onChange={(event) => setRemote(event.target.value)}
								className="h-7 max-w-80 border-transparent text-right shadow-none hover:border-input focus-visible:border-input"
							/>
						</div>
						<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
							<span className="shrink-0 text-muted-foreground">Local path</span>
							<Input
								aria-label="Local path"
								value={localPath}
								onChange={(event) => setLocalPath(event.target.value)}
								className="h-7 max-w-80 border-transparent text-right text-muted-foreground shadow-none hover:border-input focus-visible:border-input"
							/>
						</div>
						<div className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5">
							<span className="shrink-0 text-muted-foreground">
								Default branch
							</span>
							<Input
								aria-label="Default branch"
								value={branch}
								onChange={(event) => setBranch(event.target.value)}
								className="h-7 max-w-80 border-transparent text-right shadow-none hover:border-input focus-visible:border-input"
							/>
						</div>
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
						<span className="text-muted-foreground">
							{(() => {
								const stamps = liveSources
									.map((source) => source.lastPolled)
									.filter((stamp): stamp is string => stamp !== null)
									.sort();
								return stamps.length > 0
									? `last polled ${formatStamp(stamps[stamps.length - 1])}`
									: lastPolled;
							})()}
						</span>
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
								<span className="text-muted-foreground">
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
							{createSourceMutation.isError ? (
								<p className="px-3.5 py-2 text-destructive">
									Couldn't add source:{" "}
									{createSourceMutation.error instanceof Error
										? createSourceMutation.error.message
										: "unknown error"}
								</p>
							) : null}
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
