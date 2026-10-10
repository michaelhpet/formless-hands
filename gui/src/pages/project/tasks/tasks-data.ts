export type TaskStatus =
	| "open"
	| "triaged"
	| "in-progress"
	| "completed"
	| "in-review"
	| "merged"
	| "closed"
	| "blocked"
	| "needs-context";

export type TaskSourceKind = "linear" | "github";

export interface Task {
	id: string;
	source: TaskSourceKind;
	title: string;
	status: TaskStatus;
	priority: 0 | 1 | 2 | 3;
	meta: string;
	ref: string;
	age: string;
}

export type KanbanColumnKey =
	| "needs-triage"
	| "ready"
	| "in-progress"
	| "completed"
	| "done";

export const KANBAN_COLUMNS: {
	key: KanbanColumnKey;
	title: string;
	statuses: TaskStatus[];
}[] = [
	{
		key: "needs-triage",
		title: "NEEDS TRIAGE",
		statuses: ["open", "needs-context"],
	},
	{ key: "ready", title: "READY", statuses: ["triaged", "blocked"] },
	{
		key: "in-progress",
		title: "IN PROGRESS",
		statuses: ["in-progress"],
	},
	{
		key: "completed",
		title: "COMPLETED",
		statuses: ["completed", "in-review"],
	},
	{ key: "done", title: "DONE", statuses: ["merged", "closed"] },
];

export const STATUS_FILTERS: ("all" | TaskStatus)[] = [
	"all",
	"open",
	"triaged",
	"in-progress",
	"completed",
	"in-review",
	"blocked",
	"needs-context",
	"merged",
	"closed",
];

export const SOURCE_LABELS: Record<"all" | TaskSourceKind, string> = {
	all: "All sources",
	linear: "Linear",
	github: "GitHub",
};

export const STATUS_LABELS: Record<"all" | TaskStatus, string> = {
	all: "Status: all",
	open: "Open",
	triaged: "Triaged",
	"in-progress": "In progress",
	completed: "Completed",
	"in-review": "In review",
	blocked: "Blocked",
	"needs-context": "Needs context",
	merged: "Merged",
	closed: "Closed",
};

export const PRIORITY_LABELS: Record<string, string> = {
	"0": "P0 — Urgent",
	"1": "P1 — High",
	"2": "P2 — Normal",
	"3": "P3 — Low",
};

export const INITIAL_TASKS: Task[] = [
	{
		id: "LIN-144",
		source: "linear",
		title: "Migrate daemon state file",
		status: "blocked",
		priority: 0,
		meta: "blocked · waiting 4d",
		ref: "—",
		age: "4d",
	},
	{
		id: "LIN-150",
		source: "linear",
		title: "Add retry with backoff to source poller",
		status: "open",
		priority: 1,
		meta: "open · 6d old",
		ref: "—",
		age: "6d",
	},
	{
		id: "LIN-149",
		source: "linear",
		title: "Wire task priority into queue order",
		status: "triaged",
		priority: 1,
		meta: "triaged · instructions set",
		ref: "—",
		age: "3d",
	},
	{
		id: "LIN-142",
		source: "linear",
		title: "Fix auth refresh loop",
		status: "in-progress",
		priority: 1,
		meta: "wt-auth-fix · try 2 · 12m",
		ref: "wt-auth-fix · try 2",
		age: "12m",
	},
	{
		id: "GH-881",
		source: "github",
		title: "Implement task table for GUI",
		status: "completed",
		priority: 1,
		meta: "wt-gui-table · completed · 28m",
		ref: "wt-gui-table · try 1",
		age: "28m",
	},
	{
		id: "LIN-151",
		source: "linear",
		title: "Triage uncategorized linear imports",
		status: "needs-context",
		priority: 2,
		meta: "needs-context · no body",
		ref: "—",
		age: "1d",
	},
	{
		id: "LIN-139",
		source: "linear",
		title: "Add backoff to source poller",
		status: "in-review",
		priority: 2,
		meta: "PR #412 · 2 comments",
		ref: "PR #412 · 2 comments",
		age: "4m",
	},
	{
		id: "GH-893",
		source: "github",
		title: "Add empty states for docs tab",
		status: "triaged",
		priority: 2,
		meta: "triaged · 1d old",
		ref: "—",
		age: "1d",
	},
	{
		id: "LIN-138",
		source: "linear",
		title: "Cache poller cursor per source",
		status: "merged",
		priority: 2,
		meta: "merged · PR #408",
		ref: "PR #408",
		age: "2d",
	},
	{
		id: "GH-895",
		source: "github",
		title: "Document source config schema",
		status: "open",
		priority: 3,
		meta: "open · 2d old",
		ref: "—",
		age: "2d",
	},
	{
		id: "GH-870",
		source: "github",
		title: "Update CLI help text",
		status: "in-review",
		priority: 3,
		meta: "PR #87 · 1 comment",
		ref: "PR #87 · 1 comment",
		age: "9m",
	},
	{
		id: "GH-865",
		source: "github",
		title: "Fix watcher debounce interval",
		status: "closed",
		priority: 3,
		meta: "closed · no PR",
		ref: "—",
		age: "5d",
	},
];

export function columnForStatus(status: TaskStatus): KanbanColumnKey {
	for (const column of KANBAN_COLUMNS) {
		if (column.statuses.includes(status)) {
			return column.key;
		}
	}
	return "needs-triage";
}

export function sortTasks(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => {
		if (a.priority !== b.priority) {
			return a.priority - b.priority;
		}
		return a.id.localeCompare(b.id);
	});
}

export interface TaskStats {
	needsTriage: number;
	ready: number;
	inProgress: number;
	completed: number;
	done: number;
	blocked: number;
	open: number;
}

export function summarizeTasks(tasks: Task[]): TaskStats {
	const count = (statuses: TaskStatus[]) =>
		tasks.filter((task) => statuses.includes(task.status)).length;
	const open = tasks.filter(
		(task) => task.status !== "merged" && task.status !== "closed",
	).length;
	return {
		needsTriage: count(["open", "needs-context"]),
		ready: count(["triaged"]),
		inProgress: count(["in-progress"]),
		completed: count(["completed", "in-review"]),
		done: count(["merged", "closed"]),
		blocked: count(["blocked"]),
		open,
	};
}
