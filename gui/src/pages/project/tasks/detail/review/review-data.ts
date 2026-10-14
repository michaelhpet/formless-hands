import type { ReviewFile } from "@/components/diff-viewer";
import type { DiffHunk as ApiHunk, Task, TaskDiff } from "@/lib/api/tasks";
import { taskDisplayId } from "../../tasks-data";

function mapHunk(path: string, hunk: ApiHunk): ReviewFile["hunks"][number] {
	return {
		oldRange: hunk.oldRange,
		newRange: hunk.newRange,
		header: hunk.header,
		oldLines: hunk.oldLines.map((line) => ({
			no: line.no,
			text: line.text,
			kind:
				line.kind === "added" || line.kind === "removed"
					? line.kind
					: ("context" as const),
		})),
		newLines: hunk.newLines.map((line) => ({
			no: line.no,
			text: line.text,
			kind:
				line.kind === "added" || line.kind === "removed"
					? line.kind
					: ("context" as const),
		})),
		thread: hunk.thread
			? {
					author: hunk.thread.author,
					path: hunk.thread.path,
					state: hunk.thread.state === "resolved" ? "resolved" : "open",
					body: hunk.thread.body,
					age: hunk.thread.age,
					replies: hunk.thread.replies.map((reply) => ({
						author: reply.author,
						age: reply.age,
						body: reply.body,
					})),
				}
			: undefined,
		threadAfterNewLine: hunk.threadAfterNewLine,
		agentNotes: hunk.notes.map((note) => ({
			scope: `AGENT · ${path} ${hunk.newRange}`,
			body: note.body,
			source: note.source,
		})),
	};
}

export function diffSubtitle(
	diff: TaskDiff | undefined,
	task: Task,
	prRef: string,
): string {
	if (!diff || diff.files.length === 0) {
		return `${taskDisplayId(task)} · ${prRef}`;
	}
	const stale = diff.stale ? " · stale" : "";
	return `${taskDisplayId(task)} · ${diff.files.length} files · work #${diff.workId ?? "?"}${stale}`;
}

export function diffFiles(diff: TaskDiff | undefined): ReviewFile[] {
	if (!diff) {
		return [];
	}
	return diff.files.map((file) => ({
		path: file.path,
		stats: file.stats,
		hunks: file.hunks.map((hunk) => mapHunk(file.path, hunk)),
	}));
}
