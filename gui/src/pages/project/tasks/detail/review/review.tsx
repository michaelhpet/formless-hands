import { IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { DiffViewer, type ReviewFile } from "@/components/diff-viewer";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/hooks/use-error-toast";
import {
	type Task,
	useCreateReview,
	useTask,
	useTaskDiff,
} from "@/lib/api/tasks";
import { taskDisplayId, taskRef } from "../../tasks-data";
import { FinishReviewMenu, type ReviewDecision } from "./finish-review-menu";
import { diffFiles, diffSubtitle } from "./review-data";

export function TaskReviewPage() {
	const { projectId, taskId } = useParams({ strict: false });
	const liveTask = useTask(taskId);
	const task = liveTask.data;

	if (liveTask.isLoading) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<p className="text-muted-foreground">Loading task…</p>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>Task not found</EmptyTitle>
						<EmptyDescription>
							No task with id "{taskId}" in this project.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		);
	}

	return <TaskReviewView key={task.id} projectId={projectId} task={task} />;
}

function TaskReviewView({
	projectId,
	task,
}: {
	projectId: string | undefined;
	task: Task;
}) {
	const createReview = useCreateReview();
	const diffQuery = useTaskDiff(task.id);
	const [localFiles, setLocalFiles] = useState<ReviewFile[] | null>(null);
	const files = localFiles ?? diffFiles(diffQuery.data);
	const prRef = taskRef(task);
	const subtitle = diffSubtitle(diffQuery.data, task, prRef);
	const [approved, setApproved] = useState(false);
	const [replyingKey, setReplyingKey] = useState<string | null>(null);
	const [replyBody, setReplyBody] = useState("");
	const [notesClosed, setNotesClosed] = useState<ReadonlySet<string>>(
		new Set(),
	);
	const [summary, setSummary] = useState<{
		decision: ReviewDecision;
		message: string;
	} | null>(null);

	const toggleNotes = (key: string) => {
		setNotesClosed((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const anyNotesOpen =
		files.some((file, fileIndex) =>
			file.hunks.some(
				(hunk, hunkIndex) =>
					hunk.agentNotes.length > 0 &&
					!notesClosed.has(`${fileIndex}:${hunkIndex}`),
			),
		) ?? false;

	const openComments = files.reduce(
		(count, file) =>
			count + file.hunks.filter((hunk) => hunk.thread?.state === "open").length,
		0,
	);

	const submitReply = (key: string) => {
		const body = replyBody.trim();
		if (!body) {
			return;
		}
		const [fileIndex, hunkIndex] = key.split(":").map(Number);
		setLocalFiles((prev) => {
			const base = prev ?? diffFiles(diffQuery.data);
			return base.map((file, fi) =>
				fi !== fileIndex
					? file
					: {
							...file,
							hunks: file.hunks.map((hunk, hi) =>
								hi !== hunkIndex || !hunk.thread
									? hunk
									: {
											...hunk,
											thread: {
												...hunk.thread,
												replies: [
													...hunk.thread.replies,
													{ author: "You", age: "just now", body },
												],
											},
										},
							),
						},
			);
		});
		setReplyBody("");
		setReplyingKey(null);
	};

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex flex-col gap-2">
				<PageBreadcrumb
					items={[
						<Link key="project" to="/">
							{projectId}
						</Link>,
						<Link
							key="tasks"
							to="/$projectId/tasks"
							params={{ projectId: projectId ?? "" }}
						>
							Tasks
						</Link>,
						<Link
							key="task"
							to="/$projectId/tasks/$taskId"
							params={{
								projectId: projectId ?? "",
								taskId: String(task.id),
							}}
						>
							{taskDisplayId(task)}
						</Link>,
						"Review",
					]}
				/>
				<div className="flex items-start justify-between gap-3 max-lg:flex-col">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="text-lg leading-6.5 font-bold">Review · {prRef}</h1>
						<p className="text-muted-foreground">{subtitle}</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						<Badge variant="outline">
							<span
								className={cn(
									"flex items-center gap-1.5",
									approved ? "text-success" : "text-destructive",
								)}
							>
								{approved ? "Approved" : "Changes requested"}
							</span>
						</Badge>
						<FinishReviewMenu
							openComments={openComments}
							onSubmit={(decision, message) => {
								setApproved(decision === "approved");
								const trimmed = message.trim();
								setSummary(trimmed ? { decision, message: trimmed } : null);
								createReview.mutate(
									{
										taskId: task.id,
										body:
											trimmed === ""
												? decision === "approved"
													? "Approved"
													: "Changes requested"
												: trimmed,
										kind:
											decision === "approved"
												? "approved"
												: "changes-requested",
									},
									{
										onError: (error) => {
											toast.add({
												type: "error",
												title: "Couldn't submit review",
												description: errorMessage(error),
											});
										},
									},
								);
							}}
						/>
					</div>
				</div>
			</div>

			{summary ? (
				<Card>
					<CardContent className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between">
							<span className="text-foreground">You · just now</span>
							<span
								className={
									summary.decision === "approved"
										? "text-success"
										: "text-destructive"
								}
							>
								{summary.decision === "approved"
									? "Approved"
									: "Changes requested"}
							</span>
						</div>
						<p className="text-[13px] leading-4.5 text-foreground">
							{summary.message}
						</p>
					</CardContent>
				</Card>
			) : null}

			{diffQuery.isLoading ? (
				<p className="text-muted-foreground">Loading diff…</p>
			) : files.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>No reviewable changes</EmptyTitle>
						<EmptyDescription>
							No changed files to review on {taskDisplayId(task)} yet.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<DiffViewer
					files={files}
					replyingKey={replyingKey}
					replyBody={replyBody}
					notesClosed={notesClosed}
					reserveNotesSpace={anyNotesOpen}
					onStartReply={(key) => {
						setReplyingKey(key);
						setReplyBody("");
					}}
					onCancelReply={() => {
						setReplyingKey(null);
						setReplyBody("");
					}}
					onReplyBody={setReplyBody}
					onSubmitReply={submitReply}
					onToggleNotes={toggleNotes}
				/>
			)}
		</div>
	);
}
