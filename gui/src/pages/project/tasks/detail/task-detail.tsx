import { IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { type Task, useReviews, useTask, useUpdateTask } from "@/lib/api/tasks";
import { useWorks, type Work } from "@/lib/api/works";
import { formatStamp } from "@/lib/datetime";
import { EditTaskDialog } from "./edit-task-dialog";
import { PrCard } from "./pr-card";
import { TaskDetailSidebar } from "./task-detail-sidebar";

export interface ReviewReply {
	author: string;
	age: string;
	body: string;
}

export interface ReviewView {
	id: number;
	author: string;
	path: string;
	resolved: boolean;
	body: string;
	created_at: string;
	replies: ReviewReply[];
}

function DescriptionSection({ title, body }: { title: string; body: string }) {
	const paragraphs = body
		.split(/\n\n+/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph !== "");
	return (
		<section
			aria-label="Description"
			className="flex max-w-215 flex-col gap-2.5 px-0.5 pt-1.5 pb-0.5"
		>
			<p className="text-[15px] leading-5.5 font-bold text-foreground">
				{title}
			</p>
			{paragraphs.map((paragraph) => (
				<p key={paragraph.slice(0, 32)} className="text-[13px] leading-5.25">
					{paragraph}
				</p>
			))}
		</section>
	);
}

function ReviewSection({
	reviews,
	replyingTo,
	replyBody,
	onStartReply,
	onCancelReply,
	onReplyBody,
	onSubmitReply,
	onToggleResolved,
}: {
	reviews: ReviewView[];
	replyingTo: number | null;
	replyBody: string;
	onStartReply: (index: number) => void;
	onCancelReply: () => void;
	onReplyBody: (value: string) => void;
	onSubmitReply: (index: number) => void;
	onToggleResolved: (index: number) => void;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-2.5">
				<div className="flex items-center justify-between">
					<h2 className="tracking-wide text-muted-foreground">
						REVIEW · {reviews.length}
					</h2>
				</div>
				{reviews.length === 0 ? (
					<p className="text-muted-foreground">No review comments yet.</p>
				) : null}
				{reviews.map((comment, index) => {
					return (
						<div
							key={comment.id}
							className={cn(
								"flex flex-col gap-1.5 border bg-background px-3 py-2.5",
								comment.resolved && "opacity-70",
							)}
						>
							<div className="flex items-center justify-between">
								<span
									className={
										comment.resolved
											? "text-muted-foreground"
											: "text-foreground"
									}
								>
									{comment.author} · {comment.path}
								</span>
								<span
									className={comment.resolved ? "text-success" : "text-warning"}
								>
									{comment.resolved ? "Resolved" : "Open"}
								</span>
							</div>
							<p
								className={cn(
									"text-[13px] leading-4.5",
									comment.resolved
										? "text-muted-foreground"
										: "text-foreground",
								)}
							>
								{comment.body}
							</p>
							{comment.replies.map((reply) => (
								<div
									key={`${reply.author}-${reply.age}-${reply.body.slice(0, 16)}`}
									className="flex flex-col gap-1.5 border bg-card px-3 py-2.5"
								>
									<span className="text-muted-foreground">
										{reply.author} · {reply.age}
									</span>
									<p className="text-[13px] leading-4.75 text-foreground">
										{reply.body}
									</p>
								</div>
							))}
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">
									{comment.created_at}
									{comment.resolved ? null : (
										<>
											{" · "}
											<button
												type="button"
												className="underline-offset-4 hover:underline"
												onClick={() => onStartReply(index)}
											>
												Reply
											</button>
										</>
									)}
								</span>
								<Button
									variant="ghost"
									size="xs"
									onClick={() => onToggleResolved(index)}
								>
									{comment.resolved ? "Reopen" : "Resolve"}
								</Button>
							</div>
							{!comment.resolved && replyingTo === index ? (
								<form
									className="flex flex-col gap-2"
									onSubmit={(event) => {
										event.preventDefault();
										onSubmitReply(index);
									}}
								>
									<Textarea
										aria-label={`Reply to ${comment.author}`}
										placeholder="Reply..."
										value={replyBody}
										onChange={(event) => onReplyBody(event.target.value)}
									/>
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={onCancelReply}
										>
											Cancel
										</Button>
										<Button
											type="submit"
											size="sm"
											disabled={!replyBody.trim()}
										>
											Reply
										</Button>
									</div>
								</form>
							) : null}
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}

function NotesSection({
	instructions,
	sessionNotes,
	noteBody,
	pending,
	onNoteBody,
	onAddNote,
}: {
	instructions: string;
	sessionNotes: string[];
	noteBody: string;
	pending: boolean;
	onNoteBody: (value: string) => void;
	onAddNote: () => void;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-2.5">
				<h2 className="tracking-wide text-muted-foreground">
					NOTES · {sessionNotes.length}
				</h2>
				{instructions.trim() !== "" ? (
					<div className="flex flex-col gap-1.5 border bg-background px-3 py-2.5">
						<div className="flex items-center justify-between">
							<span className="text-foreground">Agent instructions</span>
							<span className="text-muted-foreground">live</span>
						</div>
						<p className="text-[13px] leading-4.5 text-foreground whitespace-pre-wrap">
							{instructions}
						</p>
					</div>
				) : null}
				{sessionNotes.map((note) => (
					<div
						key={note.slice(0, 32)}
						className="flex flex-col gap-1.5 border bg-background px-3 py-2.5"
					>
						<div className="flex items-center justify-between">
							<span className="text-foreground">You</span>
							<span className="text-muted-foreground">just now</span>
						</div>
						<p className="text-[13px] leading-4.5 text-foreground">{note}</p>
					</div>
				))}
				<form
					className="flex flex-col gap-2 border border-dashed bg-background px-3 py-2.5"
					onSubmit={(event) => {
						event.preventDefault();
						onAddNote();
					}}
				>
					<Textarea
						aria-label="Add context for the agent"
						placeholder="Add context for the agent..."
						value={noteBody}
						onChange={(event) => onNoteBody(event.target.value)}
					/>
					<div className="flex justify-end">
						<Button
							type="submit"
							size="sm"
							disabled={!noteBody.trim() || pending}
						>
							{pending ? "Saving…" : "Add note"}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export function TaskDetailPage() {
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
					<EmptyContent>
						<Link
							to="/$projectId/tasks"
							params={{ projectId: projectId ?? "" }}
						>
							<Button variant="outline" size="sm">
								Back to tasks
							</Button>
						</Link>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return <TaskDetailView key={task.id} projectId={projectId} task={task} />;
}

function TaskDetailView({
	projectId,
	task,
}: {
	projectId: string | undefined;
	task: Task;
}) {
	const reviewsQuery = useReviews(task.id);
	const worksQuery = useWorks({ project: projectId, limit: 500 });
	const updateMutation = useUpdateTask();
	const [noteBody, setNoteBody] = useState("");
	const [sessionNotes, setSessionNotes] = useState<string[]>([]);
	const [replyingTo, setReplyingTo] = useState<number | null>(null);
	const [replyBody, setReplyBody] = useState("");
	const [localReplies, setLocalReplies] = useState<
		Record<number, ReviewReply[]>
	>({});
	const [flipped, setFlipped] = useState<Record<number, boolean>>({});

	const reviews: ReviewView[] = (reviewsQuery.data ?? []).map((review) => ({
		id: review.id,
		author: review.author,
		path: review.path === "" ? "(general)" : review.path,
		resolved: review.resolved !== (flipped[review.id] ?? false),
		body: review.body,
		created_at: review.created_at,
		replies: localReplies[review.id] ?? [],
	}));

	const works: Work[] = (worksQuery.data ?? []).filter(
		(work) => work.task_id === task.id,
	);

	const toggleResolved = (index: number) => {
		const id = reviews[index]?.id;
		if (id === undefined) {
			return;
		}
		setFlipped((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }));
	};

	const submitReply = (index: number) => {
		const body = replyBody.trim();
		if (!body) {
			return;
		}
		const id = reviews[index]?.id;
		if (id === undefined) {
			return;
		}
		setLocalReplies((prev) => ({
			...prev,
			[id]: [...(prev[id] ?? []), { author: "You", age: "just now", body }],
		}));
		setReplyBody("");
		setReplyingTo(null);
	};

	const addNote = () => {
		const body = noteBody.trim();
		if (!body || updateMutation.isPending) {
			return;
		}
		setSessionNotes((prev) => [...prev, body]);
		updateMutation.mutate(
			{ id: task.id, instructions: body },
			{
				onSuccess: () => setNoteBody(""),
				onError: () =>
					setSessionNotes((prev) => prev.filter((note) => note !== body)),
			},
		);
	};

	const queueWork = () => {
		updateMutation.mutate({ id: task.id, status: "triaged" });
	};

	const latestWork = works[0];
	const latestStatus =
		latestWork == null
			? null
			: latestWork.finished_at === null
				? "running"
				: latestWork.exit_code === 0
					? "success"
					: "failed";
	const failed = task.status === "blocked" || latestStatus === "failed";
	const succeeded = !failed && latestStatus === "success";
	const locked =
		succeeded ||
		["completed", "in-review", "merged", "closed"].includes(task.status);
	const reviewable =
		["completed", "in-review", "merged"].includes(task.status) ||
		reviews.length > 0;
	const primaryIsReview = succeeded || (!failed && !latestWork && reviewable);

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
						String(task.id),
					]}
				/>
				<div className="flex items-start justify-between gap-3 max-lg:flex-col">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="text-lg leading-6.5 font-bold">{task.title}</h1>
						<p className="text-muted-foreground">
							Opened {formatStamp(task.created_at)}
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{locked ? null : (
							<EditTaskDialog
								key={task.id}
								priority={task.priority}
								onSave={(input) => {
									if (input.priority !== task.priority) {
										updateMutation.mutate({
											id: task.id,
											priority: input.priority,
										});
									}
								}}
							/>
						)}
						{failed ? (
							<Button
								variant="outline"
								onClick={queueWork}
								disabled={updateMutation.isPending}
							>
								Retry
							</Button>
						) : latestWork ? (
							succeeded ? (
								<Link
									to="/$projectId/tasks/$taskId/review"
									params={{
										projectId: projectId ?? "",
										taskId: String(task.id),
									}}
								>
									<Button>Review</Button>
								</Link>
							) : (
								<Link
									to="/$projectId/works"
									params={{ projectId: projectId ?? "" }}
									search={{ task: String(task.id) }}
								>
									<Button>See work</Button>
								</Link>
							)
						) : reviewable ? (
							<Link
								to="/$projectId/tasks/$taskId/review"
								params={{
									projectId: projectId ?? "",
									taskId: String(task.id),
								}}
							>
								<Button>Review</Button>
							</Link>
						) : (
							<Button onClick={queueWork} disabled={updateMutation.isPending}>
								Queue work
							</Button>
						)}
						{reviewable && !primaryIsReview ? (
							<Link
								to="/$projectId/tasks/$taskId/review"
								params={{
									projectId: projectId ?? "",
									taskId: String(task.id),
								}}
							>
								<Button variant="outline">Review</Button>
							</Link>
						) : null}
					</div>
				</div>
			</div>

			<div className="flex w-full items-start gap-4 max-xl:flex-col">
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					{task.last_error.trim() !== "" ? (
						<Card>
							<CardContent className="flex flex-col gap-1">
								<span className="text-[13px] font-bold text-destructive">
									Attempt {task.attempts} failed
								</span>
								<p className="text-[13px] text-foreground">{task.last_error}</p>
							</CardContent>
						</Card>
					) : null}
					<PrCard projectName={projectId} task={task} />
					<DescriptionSection title={task.title} body={task.body} />
					<ReviewSection
						reviews={reviews}
						replyingTo={replyingTo}
						replyBody={replyBody}
						onStartReply={(index) => {
							setReplyingTo(index);
							setReplyBody("");
						}}
						onCancelReply={() => {
							setReplyingTo(null);
							setReplyBody("");
						}}
						onReplyBody={setReplyBody}
						onSubmitReply={submitReply}
						onToggleResolved={toggleResolved}
					/>
					<NotesSection
						instructions={task.instructions}
						sessionNotes={sessionNotes}
						noteBody={noteBody}
						pending={updateMutation.isPending}
						onNoteBody={setNoteBody}
						onAddNote={addNote}
					/>
					{updateMutation.isError ? (
						<p className="text-destructive">
							Couldn't save:{" "}
							{updateMutation.error instanceof Error
								? updateMutation.error.message
								: "unknown error"}
						</p>
					) : null}
				</div>
				<TaskDetailSidebar
					projectId={projectId ?? ""}
					task={task}
					works={works}
				/>
			</div>
		</div>
	);
}
