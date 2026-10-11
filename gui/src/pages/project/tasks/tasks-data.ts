import type { Task as TaskRecord } from "@/lib/api/tasks";

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

export type TaskSourceKind = "linear" | "github" | "fh";

export interface Task {
	id: string;
	externalId: string | null;
	source: TaskSourceKind;
	title: string;
	body: string;
	labels: string[];
	status: TaskStatus;
	priority: 0 | 1 | 2 | 3;
	meta: string;
	ref: string;
	branch: string;
	attempts: number;
	age: string;
}

export type TaskView = "kanban" | "table" | "attention" | "timeline";

export const TASK_VIEWS: TaskView[] = [
	"kanban",
	"table",
	"attention",
	"timeline",
];

export const VIEW_LABELS: Record<TaskView, string> = {
	kanban: "Kanban",
	table: "Table",
	attention: "Attention",
	timeline: "Timeline",
};

export const ATTENTION_STATUSES: TaskStatus[] = ["blocked", "needs-context"];

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
	fh: "fh",
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
	"0": "P0: Urgent",
	"1": "P1: High",
	"2": "P2: Normal",
	"3": "P3: Low",
};

export const INITIAL_TASKS: Task[] = [
	{
		id: "LIN-144",
		externalId: "LIN-144",
		source: "linear",
		title: "Migrate daemon state file",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "blocked",
		priority: 0,
		meta: "Blocked · waiting 4d",
		ref: "None",
		age: "4d",
	},
	{
		id: "LIN-150",
		externalId: "LIN-150",
		source: "linear",
		title: "Add retry with backoff to source poller",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "open",
		priority: 1,
		meta: "Open · 6d old",
		ref: "None",
		age: "6d",
	},
	{
		id: "LIN-149",
		externalId: "LIN-149",
		source: "linear",
		title: "Wire task priority into queue order",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "triaged",
		priority: 1,
		meta: "Triaged · instructions set",
		ref: "None",
		age: "3d",
	},
	{
		id: "LIN-142",
		externalId: "LIN-142",
		source: "linear",
		title: "Fix auth refresh loop",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "in-progress",
		priority: 1,
		meta: "wt-auth-fix · try 2 · 12m",
		ref: "wt-auth-fix · try 2",
		age: "12m",
	},
	{
		id: "GH-881",
		externalId: "GH-881",
		source: "github",
		title: "Implement task table for GUI",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "completed",
		priority: 1,
		meta: "wt-gui-table · completed · 28m",
		ref: "wt-gui-table · try 1",
		age: "28m",
	},
	{
		id: "LIN-151",
		externalId: "LIN-151",
		source: "linear",
		title: "Triage uncategorized linear imports",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "needs-context",
		priority: 2,
		meta: "Needs context · no body",
		ref: "None",
		age: "1d",
	},
	{
		id: "LIN-139",
		externalId: "LIN-139",
		source: "linear",
		title: "Add backoff to source poller",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "in-review",
		priority: 2,
		meta: "PR #412 · 2 comments",
		ref: "PR #412 · 2 comments",
		age: "4m",
	},
	{
		id: "GH-893",
		externalId: "GH-893",
		source: "github",
		title: "Add empty states for docs tab",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "triaged",
		priority: 2,
		meta: "Triaged · 1d old",
		ref: "None",
		age: "1d",
	},
	{
		id: "LIN-138",
		externalId: "LIN-138",
		source: "linear",
		title: "Cache poller cursor per source",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "merged",
		priority: 2,
		meta: "merged · PR #408",
		ref: "PR #408",
		age: "2d",
	},
	{
		id: "GH-895",
		externalId: "GH-895",
		source: "github",
		title: "Document source config schema",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "open",
		priority: 3,
		meta: "Open · 2d old",
		ref: "None",
		age: "2d",
	},
	{
		id: "GH-870",
		externalId: "GH-870",
		source: "github",
		title: "Update CLI help text",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "in-review",
		priority: 3,
		meta: "PR #87 · 1 comment",
		ref: "PR #87 · 1 comment",
		age: "9m",
	},
	{
		id: "GH-865",
		externalId: "GH-865",
		source: "github",
		title: "Fix watcher debounce interval",
		body: "",
		labels: [],
		branch: "None",
		attempts: 0,
		status: "closed",
		priority: 3,
		meta: "Closed · no PR",
		ref: "None",
		age: "5d",
	},
];

const API_STATUSES: TaskStatus[] = [
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

export function mapApiTask(task: TaskRecord): Task {
	const status: TaskStatus = API_STATUSES.includes(task.status as TaskStatus)
		? (task.status as TaskStatus)
		: "open";
	const source: TaskSourceKind =
		task.source_kind === "github"
			? "github"
			: task.source_kind === "linear"
				? "linear"
				: "fh";
	const priority =
		task.priority >= 4
			? 0
			: task.priority <= 0
				? 3
				: ((4 - task.priority) as 0 | 1 | 2 | 3);
	const ref =
		task.pr_number !== null
			? `PR #${task.pr_number}`
			: (task.external_id ?? "None");
	let labels: string[] = [];
	try {
		const parsed: unknown = JSON.parse(task.labels ?? "[]");
		if (Array.isArray(parsed)) {
			labels = parsed.filter(
				(label): label is string => typeof label === "string",
			);
		}
	} catch {
		labels = [];
	}
	return {
		id: String(task.id),
		externalId: task.external_id,
		source,
		title: task.title,
		body: task.body ?? "",
		labels,
		status,
		priority,
		meta: `${STATUS_LABELS[status]} · ${ref}`,
		ref,
		branch: task.branch ? task.branch : "None",
		attempts: task.attempts ?? 0,
		age: "",
	};
}

export function taskDisplayId(task: Task): string {
	return task.externalId ?? task.id;
}

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

export function ageToMinutes(age: string): number {
	const text = age.trim().toLowerCase();
	if (text === "now") {
		return 0;
	}
	const match = text.match(/^(\d+)\s*([mhdw])$/);
	if (!match) {
		return Number.MAX_SAFE_INTEGER;
	}
	const amount = Number(match[1]);
	switch (match[2]) {
		case "h":
			return amount * 60;
		case "d":
			return amount * 1440;
		case "w":
			return amount * 10080;
		default:
			return amount;
	}
}

export interface AgeGroup {
	key: string;
	title: string;
	tasks: Task[];
}

export function groupTasksByAge(tasks: Task[]): AgeGroup[] {
	const groups: AgeGroup[] = [
		{ key: "now", title: "JUST NOW", tasks: [] },
		{ key: "today", title: "TODAY", tasks: [] },
		{ key: "week", title: "THIS WEEK", tasks: [] },
		{ key: "older", title: "OLDER", tasks: [] },
	];
	const limits = [60, 1440, 10080, Number.POSITIVE_INFINITY];
	for (const task of sortTasks(tasks)) {
		const minutes = ageToMinutes(task.age);
		const index = limits.findIndex((limit) => minutes < limit);
		groups[index === -1 ? groups.length - 1 : index].tasks.push(task);
	}
	return groups.filter((group) => group.tasks.length > 0);
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
