import {
	IconDotsVertical,
	IconFolderOpen,
	IconRefresh,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
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

export type ProjectStatus = "connected" | "error";

export interface ProjectSource {
	name: string;
	on: boolean;
}

export interface Project {
	id: string;
	name: string;
	branch: string;
	updated: string;
	status: ProjectStatus;
	remote: string;
	localPath: string;
	error?: string;
	sources: ProjectSource[];
	tasksRunning: number;
	tasksFailed: number;
}

export const INITIAL_PROJECTS: Project[] = [
	{
		id: "formless-hands",
		name: "formless-hands",
		branch: "main",
		updated: "updated 2h",
		status: "connected",
		remote: "git@github.com:you/formless-hands.git",
		localPath: "~/Work/formless-hands",
		tasksRunning: 3,
		tasksFailed: 1,
		sources: [
			{ name: "linear", on: true },
			{ name: "github", on: true },
		],
	},
	{
		id: "classroom-api",
		name: "classroom-api",
		branch: "main",
		updated: "updated 1d",
		status: "connected",
		remote: "git@github.com:acme/classroom-api.git",
		localPath: "~/Work/classroom-api",
		tasksRunning: 1,
		tasksFailed: 0,
		sources: [
			{ name: "linear", on: true },
			{ name: "github", on: false },
		],
	},
	{
		id: "billing-worker",
		name: "billing-worker",
		branch: "—",
		updated: "clone failed",
		status: "error",
		remote: "git@github.com:acme/billing-worker.git",
		localPath: "~/Work/billing-worker",
		error: "SSH key rejected — check ~/.ssh/config",
		tasksRunning: 0,
		tasksFailed: 0,
		sources: [],
	},
	{
		id: "api-gateway",
		name: "api-gateway",
		branch: "develop",
		updated: "updated 5h",
		status: "connected",
		remote: "git@github.com:acme/api-gateway.git",
		localPath: "~/Work/api-gateway",
		tasksRunning: 2,
		tasksFailed: 0,
		sources: [
			{ name: "linear", on: true },
			{ name: "github", on: true },
		],
	},
	{
		id: "docs-site",
		name: "docs-site",
		branch: "main",
		updated: "updated 3d",
		status: "connected",
		remote: "git@github.com:acme/docs-site.git",
		localPath: "~/Work/docs-site",
		tasksRunning: 0,
		tasksFailed: 0,
		sources: [{ name: "github", on: true }],
	},
	{
		id: "ml-pipeline",
		name: "ml-pipeline",
		branch: "main",
		updated: "updated 2d",
		status: "connected",
		remote: "git@github.com:acme/ml-pipeline.git",
		localPath: "~/Work/ml-pipeline",
		tasksRunning: 0,
		tasksFailed: 0,
		sources: [
			{ name: "linear", on: false },
			{ name: "github", on: true },
		],
	},
];

type StatusFilter = "all" | ProjectStatus;

const PAGE_SIZE = 5;

function SourcesCell({ sources }: { sources: ProjectSource[] }) {
	if (sources.length === 0) {
		return <span className="text-muted-foreground">— no sources</span>;
	}
	return (
		<span className="flex flex-col gap-0.5">
			{sources.map((source) => (
				<span
					key={source.name}
					className={cn(
						"flex items-center gap-1.5",
						source.on ? "text-foreground" : "text-muted-foreground",
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							source.on
								? "bg-foreground"
								: "border border-muted-foreground bg-transparent",
						)}
						aria-hidden="true"
					/>
					{source.name} {source.on ? "on" : "off"}
				</span>
			))}
		</span>
	);
}

function TasksCell({ project }: { project: Project }) {
	if (project.tasksRunning === 0 && project.tasksFailed === 0) {
		return <span className="text-muted-foreground">— idle</span>;
	}
	return (
		<span className="flex flex-col gap-0.5">
			{project.tasksRunning > 0 ? (
				<span className="flex items-center gap-1.5 text-warning">
					<span
						className="size-1.5 rounded-full bg-warning"
						aria-hidden="true"
					/>
					{project.tasksRunning} running
				</span>
			) : null}
			{project.tasksFailed > 0 ? (
				<span className="flex items-center gap-1.5 text-destructive">
					<span
						className="size-1.5 rounded-full bg-destructive"
						aria-hidden="true"
					/>
					{project.tasksFailed} failed
				</span>
			) : null}
		</span>
	);
}

function ProjectRowMenu({ project }: { project: Project }) {
	const navigate = useNavigate();
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
								to: "/project/$projectId/tasks",
								params: { projectId: project.id },
							})
						}
					>
						<IconFolderOpen data-icon="inline-start" />
						Open
					</DropdownMenuItem>
					<DropdownMenuItem>
						<IconRefresh data-icon="inline-start" />
						Poll sources
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive">
						<IconTrash data-icon="inline-start" />
						Remove
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ProjectTable({ projects }: { projects: Project[] }) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [filter, setFilter] = useState<StatusFilter>("all");
	const [page, setPage] = useState(1);

	const visible = projects.filter((project) => {
		if (filter !== "all" && project.status !== filter) {
			return false;
		}
		const q = query.trim().toLowerCase();
		if (!q) {
			return true;
		}
		return [project.name, project.remote, project.localPath].some((field) =>
			field.toLowerCase().includes(q),
		);
	});

	const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const start = (currentPage - 1) * PAGE_SIZE;
	const pageItems = visible.slice(start, start + PAGE_SIZE);

	const goToPage = (next: number) => {
		setPage(Math.min(Math.max(1, next), pageCount));
	};

	const openProject = (projectId: string) => {
		navigate({
			to: "/project/$projectId/tasks",
			params: { projectId },
		});
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex gap-2">
				<InputGroup className="flex-1">
					<InputGroupAddon>
						<IconSearch />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search name, remote, path..."
						aria-label="Search projects"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
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
					<ToggleGroupItem value="error" aria-label="Show projects with errors">
						Error
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{visible.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>No projects found</EmptyTitle>
						<EmptyDescription>
							No projects match “{query}”
							{filter !== "all" ? ` with status ${filter}` : ""}. Try a
							different search or filter.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setQuery("");
								setFilter("all");
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
										onClick={() => openProject(project.id)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												openProject(project.id);
											}
										}}
									>
										<TableCell>
											<span className="flex flex-col gap-0.5">
												<span className="text-[13px] font-bold">
													{project.name}
												</span>
												<span className="text-muted-foreground">
													{project.branch} · {project.updated}
												</span>
											</span>
										</TableCell>
										<TableCell>
											<StatusBadge status={project.status} />
										</TableCell>
										<TableCell>
											<span className="flex max-w-72 flex-col gap-0.5">
												<span className="truncate" title={project.remote}>
													{project.remote}
												</span>
												{project.error ? (
													<span className="text-destructive">
														{project.error}
													</span>
												) : (
													<span className="text-muted-foreground">
														{project.localPath}
													</span>
												)}
											</span>
										</TableCell>
										<TableCell>
											<SourcesCell sources={project.sources} />
										</TableCell>
										<TableCell>
											<TasksCell project={project} />
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
								: `${start + 1}–${start + pageItems.length} of ${visible.length}`}
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
