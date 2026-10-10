import {
	SOURCE_LABELS,
	type Task,
	type TaskSourceKind,
	type TaskStatus,
} from "../tasks-data";

export interface AcceptanceItem {
	text: string;
	done: boolean;
}

export interface Attachment {
	name: string;
	size: string;
}

export interface ReviewReply {
	author: string;
	age: string;
	body: string;
}

export interface ReviewComment {
	author: string;
	path: string;
	state: "open" | "resolved";
	body: string;
	age: string;
	replies: ReviewReply[];
}

export interface Note {
	author: string;
	age: string;
	body: string;
}

export type WorkStatus = "running" | "failed" | "success" | "queued";

export interface TaskWork {
	id: number;
	status: WorkStatus;
	meta: string;
}

export interface ActivityItem {
	text: string;
	sub: string;
}

export interface TaskDetail {
	id: string;
	source: TaskSourceKind;
	title: string;
	status: TaskStatus;
	priority: Task["priority"];
	openedAge: string;
	updatedAge: string;
	lead: string;
	body: string[];
	criteria: AcceptanceItem[];
	attachments: Attachment[];
	reviews: ReviewComment[];
	notes: Note[];
	lastError?: { attempt: number; text: string };
	works: TaskWork[];
	branch: string;
	worktree: string;
	pr: string;
	labels: string;
	attempts: string;
	locked: string;
	created: string;
	updated: string;
	activity: ActivityItem[];
}

const LIN_142: TaskDetail = {
	id: "LIN-142",
	source: "linear",
	title: "Fix auth refresh loop",
	status: "in-progress",
	priority: 1,
	openedAge: "2d ago",
	updatedAge: "12m ago",
	lead: "Auth refresh loops tightly after 401s, flooding poller logs within minutes.",
	body: [
		"The daemon keeps hitting the token endpoint in a tight loop after a 401: refresh fails, the old token is retried immediately, and the poller logs fill up within minutes. Expected behaviour is a single refresh attempt followed by exponential backoff, then the task is marked blocked with the provider error attached.",
		"The loop also masks the real failure — by the time anyone looks, the log window only shows retries, never the original 401 with its scope and timestamp. Backoff state must be visible in task metadata so the next run can resume the delay instead of starting cold.",
	],
	criteria: [
		{ text: "No more than 1 refresh per minute per source", done: true },
		{ text: "Backoff state visible in task metadata", done: false },
		{ text: "Existing sessions untouched by the fix", done: false },
	],
	attachments: [
		{ name: "log-flood.png", size: "84 KB" },
		{ name: "token-flow.png", size: "61 KB" },
	],
	reviews: [
		{
			author: "michael",
			path: "src/poller.rs:88",
			state: "open",
			body: "Backoff resets when the source is repolled — should the delay survive across polls?",
			age: "2h ago",
			replies: [],
		},
		{
			author: "worker",
			path: "src/daemon/auth.rs:41",
			state: "resolved",
			body: "Refresh path now goes through a single helper — old inline retry removed.",
			age: "1d ago",
			replies: [],
		},
	],
	notes: [
		{
			author: "michael",
			age: "3h ago",
			body: "Staging token expires every 15 min — reproduce with short-lived tokens, not prod ones.",
		},
	],
	lastError: {
		attempt: 1,
		text: "token endpoint returned 401 — refresh token expired, worker exited before writing backoff state.",
	},
	works: [
		{ id: 128, status: "running", meta: "wt-auth-fix · 10:24 · 12m · exit —" },
		{ id: 121, status: "failed", meta: "wt-auth-fix · Oct 12 · 2h · exit 1" },
		{ id: 119, status: "success", meta: "wt-auth-fix · Oct 11 · 9m · exit 0" },
	],
	branch: "wt-auth-fix",
	worktree: "~/wt-auth-fix",
	pr: "—",
	labels: "[auth] [bug]",
	attempts: "2",
	locked: "No",
	created: "Oct 7",
	updated: "12m ago",
	activity: [
		{ text: "Work #128 started", sub: "12m ago · wt-auth-fix" },
		{ text: "Attempt 1 failed", sub: "2h ago · 401 from token endpoint" },
		{ text: "Triaged → In progress", sub: "1d ago · instructions set" },
		{ text: "Polled from Linear", sub: "2d ago · LIN-142" },
	],
};

function fallbackDetail(task: Task): TaskDetail {
	const age = task.age === "now" ? "just now" : `${task.age} ago`;
	const isPr = task.ref.startsWith("PR ");
	return {
		id: task.id,
		source: task.source,
		title: task.title,
		status: task.status,
		priority: task.priority,
		openedAge: age,
		updatedAge: age,
		lead: "No description yet.",
		body: [],
		criteria: [],
		attachments: [],
		reviews: [],
		notes: [],
		works: [],
		branch: !isPr && task.ref !== "—" ? task.ref.split(" · ")[0] : "—",
		worktree: "—",
		pr: isPr ? task.ref : "—",
		labels: "—",
		attempts: "—",
		locked: "—",
		created: age,
		updated: age,
		activity: [
			{
				text: `Polled from ${SOURCE_LABELS[task.source]}`,
				sub: `${age} · ${task.id}`,
			},
		],
	};
}

export function getTaskDetail(task: Task): TaskDetail {
	if (task.id === LIN_142.id) {
		return structuredClone(LIN_142);
	}
	return fallbackDetail(task);
}
