import type { Task } from "@/lib/api/tasks";
import { formatStamp, parseUtcStamp } from "@/lib/datetime";

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

export const PRIORITY_OPTIONS: { value: string; label: string }[] = [
	{ value: "0", label: "P0: Urgent" },
	{ value: "1", label: "P1: High" },
	{ value: "2", label: "P2: Normal" },
	{ value: "3", label: "P3: Low" },
	{ value: "4", label: "No priority" },
];

export function statusLabel(status: string): string {
	return (STATUS_LABELS as Record<string, string>)[status] ?? status;
}

export function parseLabels(labels: string): string[] {
	try {
		const parsed: unknown = JSON.parse(labels);
		if (Array.isArray(parsed)) {
			return parsed.filter(
				(label): label is string => typeof label === "string",
			);
		}
	} catch {
		return [];
	}
	return [];
}

export function sourceKindOf(task: Pick<Task, "source_kind">): TaskSourceKind {
	return task.source_kind === "linear"
		? "linear"
		: task.source_kind === "github"
			? "github"
			: "fh";
}

export function sourceLabelOf(task: Pick<Task, "source_kind">): string {
	return SOURCE_LABELS[sourceKindOf(task)];
}

export function taskDisplayId(task: Pick<Task, "id" | "external_id">): string {
	return task.external_id ?? `#${task.id}`;
}

export function taskRef(task: Pick<Task, "pr_number" | "external_id">): string {
	return task.pr_number !== null
		? `PR #${task.pr_number}`
		: (task.external_id ?? "None");
}

export function taskMeta(
	task: Pick<Task, "status" | "pr_number" | "external_id">,
): string {
	return `${statusLabel(task.status)} · ${taskRef(task)}`;
}

export function columnForStatus(status: string): KanbanColumnKey {
	for (const column of KANBAN_COLUMNS) {
		if ((column.statuses as string[]).includes(status)) {
			return column.key;
		}
	}
	return "needs-triage";
}

export function sortTasks(tasks: Task[]): Task[] {
	return [...tasks].sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function minutesSince(stamp: string): number {
	const time = parseUtcStamp(stamp).getTime();
	if (!Number.isFinite(time)) {
		return Number.MAX_SAFE_INTEGER;
	}
	return Math.max(0, Math.round((Date.now() - time) / 60000));
}

export function ageText(stamp: string): string {
	const minutes = minutesSince(stamp);
	if (!Number.isFinite(minutes) || minutes === Number.MAX_SAFE_INTEGER) {
		return "unknown";
	}
	if (minutes < 1) {
		return "just now";
	}
	if (minutes < 60) {
		return `${minutes}m`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 48) {
		return `${hours}h`;
	}
	return formatStamp(stamp);
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
		const minutes = minutesSince(task.created_at);
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
	const count = (statuses: string[]) =>
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
