import type { ReviewFile } from "@/components/diff-viewer";
import type { Task } from "../../tasks-data";

export interface TaskReview {
	taskId: string;
	prRef: string;
	subtitle: string;
	files: ReviewFile[];
}

const LIN_142_REVIEW: TaskReview = {
	taskId: "LIN-142",
	prRef: "PR #412",
	subtitle: "LIN-142 · 3 files · +45 -12 · work #128",
	files: [
		{
			path: "src/poller.rs",
			stats: "+31 -4 · 2 comments",
			hunks: [
				{
					oldRange: "88–90",
					newRange: "88–93",
					oldLines: [
						{ no: 88, text: "  let state = load_state()", kind: "context" },
						{ no: 89, text: "  if retry { refresh() }", kind: "removed" },
						{ no: 90, text: "  log_attempt()", kind: "context" },
					],
					newLines: [
						{ no: 88, text: "  let state = load_state()", kind: "context" },
						{ no: 89, text: "  let delay = state.backoff()", kind: "added" },
						{
							no: 90,
							text: "  if retry && delay.elapsed() {",
							kind: "added",
						},
						{ no: 91, text: "      refresh()", kind: "added" },
						{ no: 92, text: "  }", kind: "added" },
						{ no: 93, text: "  log_attempt()", kind: "context" },
					],
					thread: {
						author: "michael",
						path: "src/poller.rs:90",
						state: "open",
						body: "Backoff resets when the source is repolled — should the delay survive across polls?",
						age: "2h ago",
						replies: [
							{
								author: "worker",
								age: "1h ago",
								body: "It does now — delay persists in task metadata, covered by backoff_resets_across_polls.",
							},
						],
					},
					threadAfterNewLine: 90,
					agentNotes: [
						{
							scope: "AGENT · POLLER.RS 88–93",
							body: "The old line retried immediately, which is the loop. The delay object persists in task metadata, so the backoff survives repolls and worker restarts — attempt 1 failed exactly because the first version kept it in memory.",
							source: "from work #128 transcript · 10:27",
						},
					],
				},
			],
		},
		{
			path: "src/daemon/auth.rs",
			stats: "+7 -8",
			hunks: [
				{
					oldRange: "40–41",
					newRange: "40–41",
					oldLines: [
						{ no: 40, text: "  retry_inline()", kind: "removed" },
						{ no: 41, text: "  post_refresh()", kind: "context" },
					],
					newLines: [
						{ no: 40, text: "  refresh_once()", kind: "added" },
						{ no: 41, text: "  post_refresh()", kind: "context" },
					],
					agentNotes: [
						{
							scope: "AGENT · AUTH.RS 40–41",
							body: "One path for token refresh — the inline retry that caused the loop is gone. Proposed in ADR-040, awaiting your sign-off.",
						},
					],
				},
			],
		},
		{
			path: "src/db.rs",
			stats: "+7 -0 · 2 hunks",
			hunks: [
				{
					oldRange: "41–43",
					newRange: "41–45",
					header: "@@ -41,3 +41,5 @@ CREATE TABLE tasks",
					oldLines: [
						{
							no: 41,
							text: "  priority INTEGER DEFAULT 0,",
							kind: "context",
						},
						{ no: 42, text: "  locked INTEGER DEFAULT 0,", kind: "context" },
					],
					newLines: [
						{
							no: 41,
							text: "  priority INTEGER DEFAULT 0,",
							kind: "context",
						},
						{
							no: 42,
							text: "  backoff_until TEXT DEFAULT '',",
							kind: "added",
						},
						{
							no: 43,
							text: "  backoff_count INTEGER DEFAULT 0,",
							kind: "added",
						},
						{ no: 44, text: "  locked INTEGER DEFAULT 0,", kind: "context" },
					],
					agentNotes: [
						{
							scope: "AGENT · DB.RS 41–45",
							body: "Additive with defaults — existing rows migrate untouched. This is the metadata the delay persists in.",
						},
					],
				},
				{
					oldRange: "80–82",
					newRange: "80–83",
					header: "@@ -80,3 +82,4 @@ fn migrate",
					oldLines: [
						{ no: 80, text: "  conn.execute_batch(SCHEMA)?;", kind: "context" },
					],
					newLines: [
						{ no: 80, text: "  conn.execute_batch(SCHEMA)?;", kind: "context" },
						{
							no: 81,
							text: "  // status index: triage queue",
							kind: "added",
						},
						{
							no: 82,
							text: "  idx_tasks_status ON tasks(status)",
							kind: "added",
						},
					],
					agentNotes: [
						{
							scope: "AGENT · DB.RS 80–83",
							body: "Index serves the triage queue's status filter — list_tasks stops scanning on large DBs.",
						},
					],
				},
			],
		},
	],
};

export function getTaskReview(task: Task, prRef: string): TaskReview {
	if (task.id === LIN_142_REVIEW.taskId) {
		return structuredClone(LIN_142_REVIEW);
	}
	return {
		taskId: task.id,
		prRef,
		subtitle: `${task.id} · ${prRef}`,
		files: [],
	};
}
