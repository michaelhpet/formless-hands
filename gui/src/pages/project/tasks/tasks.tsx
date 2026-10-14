import { IconRefresh, IconSearch } from "@tabler/icons-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import { errorMessage, useErrorToast } from "@/hooks/use-error-toast";
import { usePollProject } from "@/lib/api/projects";
import { useCreateTask, useTasks } from "@/lib/api/tasks";
import type { TasksSearch } from "@/router";
import { AttentionView } from "./attention-view";
import { NewTaskDialog, type NewTaskInput } from "./new-task-dialog";
import { TaskKanban } from "./task-kanban";
import {
	SOURCE_LABELS,
	STATUS_FILTERS,
	STATUS_LABELS,
	sortTasks,
	sourceKindOf,
	summarizeTasks,
	TASK_VIEWS,
	type TaskSourceKind,
	type TaskStatus,
	type TaskView,
	taskDisplayId,
	taskRef,
	VIEW_LABELS,
} from "./tasks-data";
import { TasksTableView } from "./tasks-table-view";
import { TimelineView } from "./timeline-view";

type View = TaskView;
type SourceFilter = "all" | TaskSourceKind;
type StatusFilter = "all" | TaskStatus;

export function TasksPage() {
	const { projectId } = useParams({ strict: false });
	const createMutation = useCreateTask();
	const pollMutation = usePollProject();
	const [pollText, setPollText] = useState<string | null>(null);
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/tasks" });
	const query = search.q ?? "";
	const source: SourceFilter = search.source ?? "all";
	const status: StatusFilter = search.status ?? "all";
	const view: View = search.view ?? "kanban";
	const tasksQuery = useTasks({
		project: projectId,
		status: status === "all" ? undefined : status,
		limit: 200,
	});
	const tasks = tasksQuery.data ?? [];

	const updateSearch = (patch: Partial<TasksSearch>) => {
		navigate({
			from: "/$projectId/tasks",
			search: (prev) => ({ ...prev, ...patch }),
			replace: true,
		});
	};
	const [draft, setQuery] = useDebounce(query, (value) =>
		updateSearch({ q: value || undefined, page: undefined }),
	);
	const setSource = (value: SourceFilter) => {
		updateSearch({
			source: value === "all" ? undefined : value,
			page: undefined,
		});
	};
	const setStatus = (value: StatusFilter) => {
		updateSearch({
			status: value === "all" ? undefined : value,
			page: undefined,
		});
	};
	const setView = (value: View) => {
		updateSearch({ view: value === "kanban" ? undefined : value });
	};

	const stats = summarizeTasks(tasks);

	const visible = sortTasks(
		tasks.filter((task) => {
			if (source !== "all" && sourceKindOf(task) !== source) {
				return false;
			}
			if (status !== "all" && task.status !== status) {
				return false;
			}
			const q = query.trim().toLowerCase();
			if (!q) {
				return true;
			}
			return [taskDisplayId(task), task.title, taskRef(task)].some((field) =>
				field.toLowerCase().includes(q),
			);
		}),
	);

	const createTask = (input: NewTaskInput) => {
		if (projectId === undefined) {
			return;
		}
		createMutation.mutate({
			project: projectId,
			title: input.title,
			priority: input.priority,
		});
	};

	const pollNow = () => {
		if (projectId === undefined || pollMutation.isPending) {
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
	useErrorToast(tasksQuery.error, "Couldn't load tasks");
	useErrorToast(createMutation.error, "Couldn't create task");

	const filtering = query.trim() !== "" || status !== "all" || source !== "all";

	const clearFilters = () => {
		updateSearch({
			q: undefined,
			source: undefined,
			status: undefined,
			page: undefined,
		});
	};

	return (
		<div
			className={
				view === "kanban"
					? "flex h-full w-full flex-col gap-3 overflow-hidden px-5 py-4"
					: "flex w-full flex-col gap-3 px-5 py-4"
			}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-lg leading-5.5 font-bold">Tasks</h1>
					<p className="text-muted-foreground">
						{stats.open} open · {stats.blocked} blocked
						{pollText ? ` · ${pollText}` : null}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={source}
						onValueChange={(value) => setSource(value as SourceFilter)}
						items={SOURCE_LABELS}
					>
						<SelectTrigger aria-label="Filter by source">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{SOURCE_LABELS.all}</SelectItem>
							<SelectItem value="linear">{SOURCE_LABELS.linear}</SelectItem>
							<SelectItem value="github">{SOURCE_LABELS.github}</SelectItem>
							<SelectItem value="fh">{SOURCE_LABELS.fh}</SelectItem>
						</SelectContent>
					</Select>
					<Button
						variant="outline"
						onClick={pollNow}
						disabled={pollMutation.isPending}
					>
						<IconRefresh data-icon="inline-start" />
						{pollMutation.isPending ? "Polling…" : "Poll now"}
					</Button>
					<NewTaskDialog onCreate={createTask} />
				</div>
			</div>

			<div className="flex gap-2">
				<InputGroup className="max-w-sm flex-1">
					<InputGroupAddon>
						<IconSearch />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search id, title, branch..."
						aria-label="Search tasks"
						value={draft}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<div className="ml-auto flex gap-2">
					<Select
						value={status}
						onValueChange={(value) => setStatus(value as StatusFilter)}
						items={STATUS_LABELS}
					>
						<SelectTrigger aria-label="Filter by status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUS_FILTERS.map((option) => (
								<SelectItem key={option} value={option}>
									{STATUS_LABELS[option]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<ToggleGroup
						variant="outline"
						size="default"
						spacing={0}
						value={[view]}
						onValueChange={(value) => {
							const next = value[0] as View | undefined;
							if (next) {
								setView(next);
							}
						}}
						aria-label="Switch view"
					>
						{TASK_VIEWS.map((option) => (
							<ToggleGroupItem
								key={option}
								value={option}
								aria-label={`Show ${VIEW_LABELS[option].toLowerCase()} view`}
							>
								{VIEW_LABELS[option]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</div>

			{tasksQuery.isLoading ? (
				<p className="text-muted-foreground">Loading tasks…</p>
			) : null}
			{visible.length === 0 && !tasksQuery.isLoading ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>No tasks found</EmptyTitle>
						<EmptyDescription>
							{filtering ? (
								<>
									No tasks match "{query.trim()}"
									{status !== "all"
										? ` with status ${STATUS_LABELS[status]}`
										: ""}
									{source !== "all" ? ` from ${SOURCE_LABELS[source]}` : ""}.
									Try a different search or filter.
								</>
							) : (
								"No tasks yet. Poll a source or create the first task to see it here."
							)}
						</EmptyDescription>
					</EmptyHeader>
					{filtering ? (
						<EmptyContent>
							<Button variant="outline" size="sm" onClick={clearFilters}>
								Clear filters
							</Button>
						</EmptyContent>
					) : null}
				</Empty>
			) : view === "kanban" ? (
				<div className="min-h-0 flex-1 overflow-hidden">
					<TaskKanban tasks={visible} />
				</div>
			) : view === "table" ? (
				<TasksTableView key={`${query}-${status}-${source}`} tasks={visible} />
			) : view === "attention" ? (
				<AttentionView tasks={visible} />
			) : (
				<TimelineView tasks={visible} />
			)}
		</div>
	);
}
