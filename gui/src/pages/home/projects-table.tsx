import {
	IconDotsVertical,
	IconFolderOpen,
	IconRefresh,
	IconSearch,
} from "@tabler/icons-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import type { Project } from "@/lib/api/projects";
import { usePollProject } from "@/lib/api/projects";
import type { Source } from "@/lib/api/sources";
import type { ProjectsSearch } from "@/router";

export type ProjectStatus = "connected" | "error";

type StatusFilter = "all" | ProjectStatus;

const PAGE_SIZE = 10;

const SOURCE_DISPLAY: Record<string, string> = {
	linear: "Linear",
	github: "GitHub",
};

function sourceDisplay(name: string): string {
	return SOURCE_DISPLAY[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

function projectStatus(project: Project): ProjectStatus {
	return project.status === "connected" ? "connected" : "error";
}

function SourcesCell({ sources }: { sources: Source[] }) {
	if (sources.length === 0) {
		return <span className="text-muted-foreground">— No sources</span>;
	}
	return (
		<span className="flex flex-col gap-0.5">
			{sources.map((source) => (
				<span
					key={source.id}
					className={cn(
						"flex items-center gap-1.5",
						source.enabled ? "text-foreground" : "text-muted-foreground",
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							source.enabled
								? "bg-foreground"
								: "border border-muted-foreground bg-transparent",
						)}
						aria-hidden="true"
					/>
					{sourceDisplay(source.kind)} {source.enabled ? "On" : "Off"}
				</span>
			))}
		</span>
	);
}

function TasksCell({ running, failed }: { running: number; failed: number }) {
	if (running === 0 && failed === 0) {
		return <span className="text-muted-foreground">— Idle</span>;
	}
	return (
		<span className="flex flex-col gap-0.5">
			{running > 0 ? (
				<span className="flex items-center gap-1.5 text-warning">
					<span
						className="size-1.5 rounded-full bg-warning"
						aria-hidden="true"
					/>
					{running} running
				</span>
			) : null}
			{failed > 0 ? (
				<span className="flex items-center gap-1.5 text-destructive">
					<span
						className="size-1.5 rounded-full bg-destructive"
						aria-hidden="true"
					/>
					{failed} failed
				</span>
			) : null}
		</span>
	);
}

function ProjectRowMenu({ project }: { project: Project }) {
	const navigate = useNavigate();
	const pollMutation = usePollProject();
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={`Actions for ${project.name}`}
					>
						<IconDotsVertical />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem
						onClick={() =>
							navigate({
								to: "/$projectId/tasks",
								params: { projectId: project.name },
							})
						}
					>
						<IconFolderOpen data-icon="inline-start" />
						Open
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={pollMutation.isPending}
						onClick={() => pollMutation.mutate(project.name)}
					>
						<IconRefresh data-icon="inline-start" />
						{pollMutation.isPending ? "Polling…" : "Poll sources"}
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ProjectTable({
	projects,
	sources,
	runningByProject,
	failedByProject,
}: {
	projects: Project[];
	sources: Source[];
	runningByProject: Map<number, number>;
	failedByProject: Map<number, number>;
}) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/" });
	const query = search.q ?? "";
	const filter: StatusFilter = search.status ?? "all";
	const page = search.page ?? 1;

	const updateSearch = (patch: Partial<ProjectsSearch>) => {
		navigate({
			from: "/",
			search: (prev) => ({ ...prev, ...patch }),
			replace: true,
		});
	};
	const [draft, setQuery] = useDebounce(query, (value) =>
		updateSearch({ q: value || undefined, page: undefined }),
	);
	const setFilter = (value: StatusFilter) => {
		updateSearch({
			status: value === "all" ? undefined : value,
			page: undefined,
		});
	};

	const visible = projects.filter((project) => {
		if (filter !== "all" && projectStatus(project) !== filter) {
			return false;
		}
		const q = query.trim().toLowerCase();
		if (!q) {
			return true;
		}
		return [project.name, project.remote_url, project.local_path].some(
			(field) => field.toLowerCase().includes(q),
		);
	});

	const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const start = (currentPage - 1) * PAGE_SIZE;
	const pageItems = visible.slice(start, start + PAGE_SIZE);

	const goToPage = (next: number) => {
		const clamped = Math.min(Math.max(1, next), pageCount);
		updateSearch({ page: clamped === 1 ? undefined : clamped });
	};

	const openProject = (projectName: string) => {
		navigate({
			to: "/$projectId/tasks",
			params: { projectId: projectName },
		});
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex gap-2">
				<InputGroup className="max-w-sm flex-1">
					<InputGroupAddon>
						<IconSearch />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search name, remote, path..."
						aria-label="Search projects"
						value={draft}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<div className="ml-auto flex gap-2">
					<ToggleGroup
						variant="outline"
						size="default"
						spacing={0}
						value={[filter]}
						onValueChange={(value) => {
							const next = value[0] as StatusFilter | undefined;
							if (next) {
								setFilter(next);
							}
						}}
						aria-label="Filter by status"
					>
						<ToggleGroupItem value="all" aria-label="Show all projects">
							All
						</ToggleGroupItem>
						<ToggleGroupItem
							value="connected"
							aria-label="Show connected projects"
						>
							Connected
						</ToggleGroupItem>
						<ToggleGroupItem
							value="error"
							aria-label="Show projects with errors"
						>
							Error
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
			</div>

			{visible.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>No projects found</EmptyTitle>
						<EmptyDescription>
							No projects match "{query}"
							{filter !== "all" ? ` with status ${filter}` : ""}. Try a
							different search or filter.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								updateSearch({
									q: undefined,
									status: undefined,
									page: undefined,
								});
							}}
						>
							Clear filters
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				<div className="flex flex-col gap-3">
					<div className="border">
						<Table>
							<TableHeader>
								<TableRow className="divide-x divide-border hover:bg-transparent">
									<TableHead className="text-muted-foreground">
										PROJECT
									</TableHead>
									<TableHead className="text-muted-foreground">
										STATUS
									</TableHead>
									<TableHead className="text-muted-foreground">
										REMOTE / LOCAL
									</TableHead>
									<TableHead className="text-muted-foreground">
										SOURCES
									</TableHead>
									<TableHead className="text-muted-foreground">TASKS</TableHead>
									<TableHead aria-label="Row actions">
										<span className="sr-only">Actions</span>
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{pageItems.map((project) => (
									<TableRow
										key={project.id}
										tabIndex={0}
										className="cursor-default divide-x divide-border"
										onClick={() => openProject(project.name)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												openProject(project.name);
											}
										}}
									>
										<TableCell>
											<span className="flex flex-col gap-0.5">
												<span className="text-[13px] font-bold">
													{project.name}
												</span>
												<span className="text-muted-foreground">
													{project.default_branch}
												</span>
											</span>
										</TableCell>
										<TableCell>
											<StatusBadge status={projectStatus(project)} />
										</TableCell>
										<TableCell>
											<span className="flex max-w-72 flex-col gap-0.5">
												<span className="truncate" title={project.remote_url}>
													{project.remote_url}
												</span>
												{projectStatus(project) === "error" ? (
													<span className="text-destructive">
														{project.status_detail || "Error"}
													</span>
												) : (
													<span className="text-muted-foreground">
														{project.local_path}
													</span>
												)}
											</span>
										</TableCell>
										<TableCell>
											<SourcesCell
												sources={sources.filter(
													(source) => source.project_id === project.id,
												)}
											/>
										</TableCell>
										<TableCell>
											<TasksCell
												running={runningByProject.get(project.id) ?? 0}
												failed={failedByProject.get(project.id) ?? 0}
											/>
										</TableCell>
										<TableCell
											className="text-center"
											onClick={(event) => event.stopPropagation()}
											onKeyDown={(event) => event.stopPropagation()}
										>
											<ProjectRowMenu project={project} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<div className="flex items-center justify-between gap-3">
						<p className="text-muted-foreground">
							{visible.length === 0
								? "0 projects"
								: `${start + 1} to ${start + pageItems.length} of ${visible.length}`}
						</p>
						{pageCount > 1 ? (
							<Pagination className="mx-0 w-auto">
								<PaginationContent>
									<PaginationItem>
										<PaginationPrevious
											text="Prev"
											href="#"
											aria-disabled={currentPage === 1}
											className={
												currentPage === 1
													? "pointer-events-none opacity-50"
													: undefined
											}
											onClick={(event) => {
												event.preventDefault();
												goToPage(currentPage - 1);
											}}
										/>
									</PaginationItem>
									{Array.from(
										{ length: pageCount },
										(_, index) => index + 1,
									).map((pageNumber) => (
										<PaginationItem key={pageNumber}>
											<PaginationLink
												href="#"
												isActive={currentPage === pageNumber}
												onClick={(event) => {
													event.preventDefault();
													goToPage(pageNumber);
												}}
											>
												{pageNumber}
											</PaginationLink>
										</PaginationItem>
									))}
									<PaginationItem>
										<PaginationNext
											text="Next"
											href="#"
											aria-disabled={currentPage === pageCount}
											className={
												currentPage === pageCount
													? "pointer-events-none opacity-50"
													: undefined
											}
											onClick={(event) => {
												event.preventDefault();
												goToPage(currentPage + 1);
											}}
										/>
									</PaginationItem>
								</PaginationContent>
							</Pagination>
						) : null}
					</div>
				</div>
			)}
		</div>
	);
}
