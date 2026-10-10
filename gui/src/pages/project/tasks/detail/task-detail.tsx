import { IconFileText, IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useEffect, useState } from "react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Textarea } from "@/components/ui/textarea";
import { INITIAL_TASKS } from "../tasks-data";
import { EditTaskDialog } from "./edit-task-dialog";
import { NewWorkDialog } from "./new-work-dialog";
import { getTaskDetail, type TaskDetail } from "./task-detail-data";
import { TaskDetailSidebar } from "./task-detail-sidebar";

function DescriptionSection({
	detail,
	onToggleCriterion,
}: {
	detail: TaskDetail;
	onToggleCriterion: (index: number) => void;
}) {
	return (
		<section
			aria-label="Description"
			className="flex max-w-215 flex-col gap-2.5 px-0.5 pt-1.5 pb-0.5"
		>
			<p className="text-[15px] leading-5.5 font-bold text-foreground">
				{detail.lead}
			</p>
			{detail.body.map((paragraph) => (
				<p key={paragraph.slice(0, 32)} className="text-[13px] leading-5.25">
					{paragraph}
				</p>
			))}
			{detail.criteria.length > 0 ? (
				<>
					<h2 className="pt-1.5 tracking-wide text-foreground">
						ACCEPTANCE CRITERIA
					</h2>
					<ul className="flex flex-col gap-1.5">
						{detail.criteria.map((item, index) => (
							<li key={item.text}>
								<label
									htmlFor={`criterion-${index}`}
									className="flex cursor-pointer items-start gap-2.5"
								>
									<Checkbox
										id={`criterion-${index}`}
										checked={item.done}
										onCheckedChange={() => onToggleCriterion(index)}
										className={cn(
											item.done
												? "data-checked:border-success data-checked:bg-success"
												: "border-muted-foreground",
										)}
									/>
									<span className="text-[13px] text-foreground">
										{item.text}
									</span>
								</label>
							</li>
						))}
					</ul>
				</>
			) : null}
			{detail.attachments.length > 0 ? (
				<>
					<h2 className="pt-1.5 tracking-wide text-foreground">
						ATTACHMENTS · {detail.attachments.length}
					</h2>
					<div className="flex flex-wrap gap-2.5">
						{detail.attachments.map((file) => (
							<Card key={file.name} className="w-55 gap-0 py-0">
								<div className="flex h-30 items-center justify-center bg-card">
									<IconFileText
										aria-hidden="true"
										className="size-6 text-muted-foreground"
									/>
								</div>
								<p className="border-t px-2.5 py-2 text-muted-foreground">
									{file.name} · {file.size}
								</p>
							</Card>
						))}
					</div>
				</>
			) : null}
		</section>
	);
}

function ReviewSection({
	detail,
	replyingTo,
	replyBody,
	onStartReply,
	onCancelReply,
	onReplyBody,
	onSubmitReply,
	onToggleResolved,
}: {
	detail: TaskDetail;
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
						REVIEW · {detail.reviews.length}
					</h2>
				</div>
				{detail.reviews.length === 0 ? (
					<p className="text-muted-foreground">No review comments yet.</p>
				) : null}
				{detail.reviews.map((comment, index) => {
					const resolved = comment.state === "resolved";
					return (
						<div
							key={`${comment.author}-${comment.path}`}
							className={cn(
								"flex flex-col gap-1.5 border bg-background px-3 py-2.5",
								resolved && "opacity-70",
							)}
						>
							<div className="flex items-center justify-between">
								<span
									className={
										resolved ? "text-muted-foreground" : "text-foreground"
									}
								>
									{comment.author} · {comment.path}
								</span>
								<span className={resolved ? "text-success" : "text-warning"}>
									{resolved ? "Resolved" : "Open"}
								</span>
							</div>
							<p
								className={cn(
									"text-[13px] leading-4.5",
									resolved ? "text-muted-foreground" : "text-foreground",
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
									{comment.age}
									{resolved ? null : (
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
									{resolved ? "Reopen" : "Resolve"}
								</Button>
							</div>
							{!resolved && replyingTo === index ? (
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
	detail,
	noteBody,
	onNoteBody,
	onAddNote,
}: {
	detail: TaskDetail;
	noteBody: string;
	onNoteBody: (value: string) => void;
	onAddNote: () => void;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col gap-2.5">
				<h2 className="tracking-wide text-muted-foreground">
					NOTES · {detail.notes.length}
				</h2>
				{detail.notes.map((note) => (
					<div
						key={`${note.author}-${note.age}-${note.body.slice(0, 16)}`}
						className="flex flex-col gap-1.5 border bg-background px-3 py-2.5"
					>
						<div className="flex items-center justify-between">
							<span className="text-foreground">{note.author}</span>
							<span className="text-muted-foreground">{note.age}</span>
						</div>
						<p className="text-[13px] leading-4.5 text-foreground">
							{note.body}
						</p>
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
						<Button type="submit" size="sm" disabled={!noteBody.trim()}>
							Add note
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

export function TaskDetailPage() {
	const { projectId, taskId } = useParams({ strict: false });
	const task = INITIAL_TASKS.find((item) => item.id === taskId);
	const [detail, setDetail] = useState<TaskDetail | null>(
		task ? getTaskDetail(task) : null,
	);
	const [noteBody, setNoteBody] = useState("");
	const [replyingTo, setReplyingTo] = useState<number | null>(null);
	const [replyBody, setReplyBody] = useState("");

	useEffect(() => {
		setDetail(task ? getTaskDetail(task) : null);
		setNoteBody("");
		setReplyingTo(null);
		setReplyBody("");
	}, [task]);

	if (!task || !detail) {
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

	const toggleCriterion = (index: number) => {
		setDetail((prev) =>
			prev
				? {
						...prev,
						criteria: prev.criteria.map((item, i) =>
							i === index ? { ...item, done: !item.done } : item,
						),
					}
				: prev,
		);
	};

	const toggleResolved = (index: number) => {
		setDetail((prev) =>
			prev
				? {
						...prev,
						reviews: prev.reviews.map((comment, i) =>
							i === index
								? {
										...comment,
										state: comment.state === "open" ? "resolved" : "open",
									}
								: comment,
						),
					}
				: prev,
		);
	};

	const submitReply = (index: number) => {
		const body = replyBody.trim();
		if (!body) {
			return;
		}
		setDetail((prev) =>
			prev
				? {
						...prev,
						reviews: prev.reviews.map((comment, i) =>
							i === index
								? {
										...comment,
										replies: [
											...comment.replies,
											{ author: "You", age: "just now", body },
										],
									}
								: comment,
						),
					}
				: prev,
		);
		setReplyBody("");
		setReplyingTo(null);
	};

	const addNote = () => {
		const body = noteBody.trim();
		if (!body) {
			return;
		}
		setDetail((prev) =>
			prev
				? {
						...prev,
						notes: [...prev.notes, { author: "You", age: "just now", body }],
					}
				: prev,
		);
		setNoteBody("");
	};

	const startWork = (branch: string) => {
		setDetail((prev) => {
			if (!prev) {
				return prev;
			}
			const nextId =
				prev.works.length > 0
					? Math.max(...prev.works.map((w) => w.id)) + 1
					: 1;
			return {
				...prev,
				works: [
					{ id: nextId, status: "queued", meta: `${branch} · just now` },
					...prev.works,
				],
			};
		});
	};

	const latestWork = detail.works[0];
	const failed = detail.status === "blocked" || latestWork?.status === "failed";
	const succeeded = !failed && latestWork?.status === "success";
	const locked =
		succeeded ||
		["completed", "in-review", "merged", "closed"].includes(detail.status);
	const reviewable =
		["completed", "in-review", "merged"].includes(detail.status) ||
		detail.reviews.length > 0;
	const primaryIsReview = succeeded || (!failed && !latestWork && reviewable);

	const retryWork = () => {
		startWork(
			detail.branch !== "None"
				? detail.branch
				: `wt-${detail.id.toLowerCase()}`,
		);
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
						detail.id,
					]}
				/>
				<div className="flex items-start justify-between gap-3 max-lg:flex-col">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="text-lg leading-6.5 font-bold">{detail.title}</h1>
						<p className="text-muted-foreground">Opened {detail.openedAge}</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{locked ? null : (
							<EditTaskDialog
								title={detail.title}
								priority={detail.priority}
								onSave={(input) =>
									setDetail((prev) => (prev ? { ...prev, ...input } : prev))
								}
							/>
						)}
						{failed ? (
							<Button variant="outline" onClick={retryWork}>
								Retry
							</Button>
						) : latestWork ? (
							succeeded ? (
								<Link
									to="/$projectId/tasks/$taskId/review"
									params={{
										projectId: projectId ?? "",
										taskId: detail.id,
									}}
								>
									<Button>Review</Button>
								</Link>
							) : (
								<Link
									to="/$projectId/works"
									params={{ projectId: projectId ?? "" }}
								>
									<Button>See work</Button>
								</Link>
							)
						) : reviewable ? (
							<Link
								to="/$projectId/tasks/$taskId/review"
								params={{
									projectId: projectId ?? "",
									taskId: detail.id,
								}}
							>
								<Button>Review</Button>
							</Link>
						) : (
							<NewWorkDialog onCreate={startWork} />
						)}
						{reviewable && !primaryIsReview ? (
							<Link
								to="/$projectId/tasks/$taskId/review"
								params={{
									projectId: projectId ?? "",
									taskId: detail.id,
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
					<DescriptionSection
						detail={detail}
						onToggleCriterion={toggleCriterion}
					/>
					<ReviewSection
						detail={detail}
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
						detail={detail}
						noteBody={noteBody}
						onNoteBody={setNoteBody}
						onAddNote={addNote}
					/>
				</div>
				<TaskDetailSidebar projectId={projectId ?? ""} detail={detail} />
			</div>
		</div>
	);
}
