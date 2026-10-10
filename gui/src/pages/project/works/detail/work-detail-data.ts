import { INITIAL_TASKS, type Task } from "../../tasks/tasks-data";
import type { Work } from "../works-data";

export type TranscriptTone = "plain" | "accent" | "danger" | "success";

export interface TranscriptLine {
	time: string;
	text: string;
	tone: TranscriptTone;
}

export interface WorkDetail extends Work {
	agent: string;
	logFile: string;
	task: Task | undefined;
	attempt: number;
	transcript: TranscriptLine[];
}

const AUTH_FIX_TRANSCRIPT: TranscriptLine[] = [
	{
		time: "10:24:01",
		text: "worker claimed LIN-142 · worktree ~/wt-auth-fix",
		tone: "plain",
	},
	{
		time: "10:24:03",
		text: "read src/daemon/auth.rs (412 lines)",
		tone: "plain",
	},
	{
		time: "10:24:19",
		text: "edit src/poller.rs — add backoff state + jitter",
		tone: "accent",
	},
	{ time: "10:25:44", text: "$ cargo test poller", tone: "plain" },
	{
		time: "10:26:02",
		text: "FAILED backoff_resets_across_polls — delay restarts at 0",
		tone: "danger",
	},
	{
		time: "10:27:15",
		text: "edit src/poller.rs — persist delay in task metadata",
		tone: "accent",
	},
	{ time: "10:28:40", text: "$ cargo test poller", tone: "plain" },
	{
		time: "10:28:55",
		text: "ok — 14 passed, backoff holds across polls",
		tone: "success",
	},
	{
		time: "10:31:10",
		text: "read src/daemon/auth.rs — verifying single refresh path…",
		tone: "plain",
	},
];

function genericTranscript(work: Work): TranscriptLine[] {
	if (work.status === "running") {
		return [
			{
				time: work.started,
				text: `worker claimed ${work.taskRef} · worktree ${work.worktree}`,
				tone: "plain",
			},
			{
				time: work.started,
				text: `read task instructions for ${work.taskRef}`,
				tone: "plain",
			},
			{
				time: work.started,
				text: `branch ${work.branch} checked out in worktree`,
				tone: "accent",
			},
		];
	}
	return [
		{
			time: work.started,
			text: `worker claimed ${work.taskRef} · worktree ${work.worktree}`,
			tone: "plain",
		},
		{
			time: work.started,
			text: `$ opencode run --branch ${work.branch}`,
			tone: "plain",
		},
		work.exitCode === 0
			? {
					time: work.started,
					text: `ok — finished in ${work.duration}, exit 0`,
					tone: "success",
				}
			: {
					time: work.started,
					text: `FAILED — exit ${work.exitCode ?? "?"} after ${work.duration}`,
					tone: "danger",
				},
	];
}

export function getWorkDetail(work: Work, allWorks: Work[]): WorkDetail {
	return {
		...work,
		agent: "opencode CLI",
		logFile: `work-${work.id}.log`,
		task: INITIAL_TASKS.find((item) => item.id === work.taskRef),
		attempt:
			allWorks.filter(
				(item) => item.taskRef === work.taskRef && item.id <= work.id,
			).length || 1,
		transcript: work.id === 128 ? AUTH_FIX_TRANSCRIPT : genericTranscript(work),
	};
}
