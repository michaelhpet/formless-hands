import { IconSearch } from "@tabler/icons-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import type { TasksSearch } from "@/router";
import { NewTaskDialog, type NewTaskInput } from "./new-task-dialog";
import { TaskKanban } from "./task-kanban";
import {
	INITIAL_TASKS,
	SOURCE_LABELS,
	STATUS_FILTERS,
	STATUS_LABELS,
	sortTasks,
	summarizeTasks,
	type Task,
	type TaskSourceKind,
	type TaskStatus,
} from "./tasks-data";
import { TasksTableView } from "./tasks-table-view";

type View = "kanban" | "table";
type SourceFilter = "all" | TaskSourceKind;
type StatusFilter = "all" | TaskStatus;

function StatCard({
	label,
	value,
	sub,
	valueClassName,
}: {
	label: string;
	value: number;
	sub: string;
	valueClassName?: string;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-1">
				<div className={cn("text-[26px] leading-8 font-bold", valueClassName)}>
					{value}
				</div>
				<p className="text-muted-foreground">{sub}</p>
			</CardContent>
		</Card>
	);
}

export function TasksPage() {
	const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/tasks" });
	const query = search.q ?? "";
	const source: SourceFilter = search.source ?? "all";
	const status: StatusFilter = search.status ?? "all";
	const view: View = search.view ?? "kanban";

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
			if (source !== "all" && task.source !== source) {
				return false;
			}
			if (status !== "all" && task.status !== status) {
				return false;
			}
			const q = query.trim().toLowerCase();
			if (!q) {
				return true;
			}
			return [task.id, task.title, task.ref].some((field) =>
				field.toLowerCase().includes(q),
			);
		}),
	);

	const createTask = (input: NewTaskInput) => {
		setTasks((prev) => [
			{
				id: `TASK-${prev.length + 1}`,
				source: input.source,
				title: input.title,
				status: "open",
				priority: input.priority,
				meta: "open · just now",
				ref: "—",
				age: "now",
			},
			...prev,
		]);
	};

	const clearFilters = () => {
		updateSearch({
			q: undefined,
			source: undefined,
			status: undefined,
			page: undefined,
		});
	};

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-lg leading-5.5 font-bold">Tasks</h1>
					<p className="text-muted-foreground">
						{stats.open} open · {stats.blocked} blocked · ordered by priority ↓
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
						</SelectContent>
					</Select>
					<NewTaskDialog onCreate={createTask} />
				</div>
			</div>

			<div className="grid w-full grid-cols-2 gap-2.5 xl:grid-cols-5">
				<StatCard
					label="NEEDS TRIAGE"
					value={stats.needsTriage}
					sub="Awaiting triage"
				/>
				<StatCard
					label="READY"
					value={stats.ready}
					sub={`${stats.ready} Ready to start`}
				/>
				<StatCard
					label="IN PROGRESS"
					value={stats.inProgress}
					sub="Active works"
					valueClassName="text-warning"
				/>
				<StatCard
					label="COMPLETED"
					value={stats.completed}
					sub={`${stats.completed} Awaiting review`}
				/>
				<StatCard
					label="DONE"
					value={stats.done}
					sub={`${stats.done} Approved`}
					valueClassName="text-success"
				/>
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
						<ToggleGroupItem value="kanban" aria-label="Show kanban view">
							Kanban
						</ToggleGroupItem>
						<ToggleGroupItem value="table" aria-label="Show table view">
							Table
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
						<EmptyTitle>No tasks found</EmptyTitle>
						<EmptyDescription>
							No tasks match “{query}”
							{status !== "all" ? ` with status ${STATUS_LABELS[status]}` : ""}
							{source !== "all" ? ` from ${SOURCE_LABELS[source]}` : ""}. Try a
							different search or filter.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={clearFilters}>
							Clear filters
						</Button>
					</EmptyContent>
				</Empty>
			) : view === "kanban" ? (
				<TaskKanban tasks={visible} />
			) : (
				<TasksTableView key={`${query}-${status}-${source}`} tasks={visible} />
			)}
		</div>
	);
}
