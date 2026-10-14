import type { Work } from "@/lib/api/works";
import { workDurationText, workStartedText, workTaskRef } from "../works-data";

export type TranscriptTone = "plain" | "accent" | "danger" | "success";

export interface TranscriptLine {
	time: string;
	text: string;
	tone: TranscriptTone;
}

export function genericTranscript(work: Work): TranscriptLine[] {
	const started = workStartedText(work);
	if (work.finished_at === null) {
		return [
			{
				time: started,
				text: `worker claimed ${workTaskRef(work)} · worktree ${work.worktree_path}`,
				tone: "plain",
			},
			{
				time: started,
				text: `read task instructions for ${workTaskRef(work)}`,
				tone: "plain",
			},
			{
				time: started,
				text: `branch ${work.branch} checked out in worktree`,
				tone: "accent",
			},
		];
	}
	return [
		{
			time: started,
			text: `worker claimed ${workTaskRef(work)} · worktree ${work.worktree_path}`,
			tone: "plain",
		},
		{
			time: started,
			text: `$ opencode run --branch ${work.branch}`,
			tone: "plain",
		},
		work.exit_code === 0
			? {
					time: started,
					text: `ok — finished in ${workDurationText(work)}, exit 0`,
					tone: "success",
				}
			: {
					time: started,
					text: `FAILED — exit ${work.exit_code ?? "?"} after ${workDurationText(work)}`,
					tone: "danger",
				},
	];
}
