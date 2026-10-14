import { IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { StatusBadge } from "@/components/status-badge";
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
import type { Task } from "@/lib/api/tasks";
import { useTasks } from "@/lib/api/tasks";
import type { Work } from "@/lib/api/works";
import { useWork, useWorks } from "@/lib/api/works";
import { formatStamp } from "@/lib/datetime";
import { PriorityLabel, TaskStatusMark } from "../../tasks/task-utils";
import { sourceLabelOf } from "../../tasks/tasks-data";
import {
	type WorkStatus,
	workDurationText,
	workStartedText,
	workStatusOf,
	workTaskRef,
} from "../works-data";
import {
	genericTranscript,
	type TranscriptLine,
	type TranscriptTone,
} from "./work-detail-data";

const TONE_CLASS: Record<TranscriptTone, string> = {
	plain: "text-foreground",
	accent: "text-warning",
	danger: "text-destructive",
	success: "text-success",
};

function TranscriptCard({
	logFile,
	lines,
	live,
	exitCode,
}: {
	logFile: string;
	lines: TranscriptLine[];
	live: boolean;
	exitCode: number | null;
}) {
	const [autoscroll, setAutoscroll] = useState(true);
	return (
		<Card className="gap-0 overflow-hidden bg-black py-0 dark:bg-black">
			<div className="flex items-center justify-between border-b px-3.5 py-2.5">
				<h2 className="tracking-wide text-muted-foreground">
					TRANSCRIPT · {logFile}
				</h2>
				<Button
					variant="outline"
					size="sm"
					onClick={() => setAutoscroll((prev) => !prev)}
					aria-pressed={autoscroll}
				>
					Autoscroll {autoscroll ? "on" : "off"}
				</Button>
			</div>
			<div className="flex flex-col gap-1.5 p-3.5">
				{lines.map((line) => (
					<p
						key={`${line.time}-${line.text.slice(0, 32)}`}
						className={cn("text-[12px] leading-4.75", TONE_CLASS[line.tone])}
					>
						{line.time} {line.text}
					</p>
				))}
				{live ? (
					<span
						aria-hidden="true"
						className="inline-block h-3.5 w-2 animate-pulse bg-warning"
					/>
				) : null}
			</div>
			<p className="border-t px-3.5 py-2.5 text-muted-foreground">
				{live ? "Streaming" : "Finished"} · {lines.length} lines ·{" "}
				{exitCode === null ? "No exit yet" : `Exit ${exitCode}`}
			</p>
		</Card>
	);
}

export function WorkDetailPage() {
	const { projectId, workId } = useParams({ strict: false });
	const liveWork = useWork(workId);
	const liveWorks = useWorks({ project: projectId, limit: 500 });
	const liveTasks = useTasks({ project: projectId, limit: 500 });
	const work = liveWork.data;
	const siblings = liveWorks.data ?? [];
	const tasks = liveTasks.data ?? [];

	if (liveWork.isLoading) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<p className="text-muted-foreground">Loading work…</p>
			</div>
		);
	}

	if (!work) {
		return (
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>Work not found</EmptyTitle>
						<EmptyDescription>
							No work with id "{workId}" in this project.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Link
							to="/$projectId/works"
							params={{ projectId: projectId ?? "" }}
						>
							<Button variant="outline" size="sm">
								Back to works
							</Button>
						</Link>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<WorkDetailView
			key={`${work.id}:${siblings.length}`}
			projectId={projectId}
			work={work}
			allWorks={siblings}
			tasks={tasks}
		/>
	);
}

function WorkDetailView({
	projectId,
	work,
	allWorks,
	tasks,
}: {
	projectId: string | undefined;
	work: Work;
	allWorks: Work[];
	tasks: Task[];
}) {
	const [live, setLive] = useState(work.finished_at === null);
	const [cancelled, setCancelled] = useState(false);
	const [retried, setRetried] = useState(false);

	const status: WorkStatus = cancelled
		? "failed"
		: live || retried
			? "running"
			: workStatusOf(work);
	const exitCode = cancelled ? 130 : work.exit_code;
	const task = tasks.find((item) => item.id === work.task_id);
	const attempt =
		allWorks.filter(
			(item) => item.task_id === work.task_id && item.id <= work.id,
		).length || 1;
	const transcript = [
		...genericTranscript(work),
		...(retried
			? [
					{
						time: "now",
						text: `retry queued on ${work.branch} · attempt ${attempt + 1}`,
						tone: "accent" as const,
					},
				]
			: []),
	];

	const cancel = () => {
		setCancelled(true);
		setLive(false);
	};

	const retry = () => {
		setCancelled(false);
		setRetried(true);
		setLive(true);
	};

	const copyLogPath = async () => {
		try {
			await navigator.clipboard.writeText(work.log_path);
		} catch {
			return;
		}
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
							key="works"
							to="/$projectId/works"
							params={{ projectId: projectId ?? "" }}
						>
							Works
						</Link>,
						`#${work.id}`,
					]}
				/>
				<div className="flex items-start justify-between gap-3 max-lg:flex-col">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="text-xl leading-6.5 font-bold">
							#{work.id} — {work.task_title}
						</h1>
						<p className="text-muted-foreground">
							Started {workStartedText(work)} · Opencode CLI
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{live ? (
							<Button variant="outline" onClick={cancel}>
								Cancel
							</Button>
						) : (
							<Button onClick={retry}>Retry</Button>
						)}
					</div>
				</div>
			</div>

			<div className="flex w-full items-start gap-4 max-xl:flex-col">
				<div className="min-w-0 flex-1">
					<TranscriptCard
						logFile={work.log_path}
						lines={transcript}
						live={live}
						exitCode={exitCode}
					/>
				</div>
				<div className="flex w-85 shrink-0 flex-col gap-3 max-xl:w-full">
					<Card>
						<CardContent className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<h2 className="tracking-wide text-muted-foreground">TASK</h2>
								{task ? (
									<Link
										to="/$projectId/tasks/$taskId"
										params={{
											projectId: projectId ?? "",
											taskId: String(task.id),
										}}
										className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
									>
										Open task
									</Link>
								) : null}
							</div>
							<p className="text-muted-foreground">
								{workTaskRef(work)}
								{task ? ` · ${sourceLabelOf(task)}` : ""}
							</p>
							<p className="text-[13px] leading-4.75 font-bold text-foreground">
								{work.task_title}
							</p>
							{task ? (
								<p className="flex items-center gap-1.5">
									<TaskStatusMark status={task.status} />
									<span className="text-muted-foreground">·</span>
									<PriorityLabel priority={task.priority} />
								</p>
							) : null}
						</CardContent>
					</Card>
					<Card className="gap-0 py-0">
						<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
							DETAILS
						</h2>
						<dl className="flex flex-col">
							{(
								[
									["Status", <StatusBadge key="s" status={status} />],
									["Branch", work.branch],
									["Worktree", work.worktree_path],
									["Agent", "Opencode CLI"],
									["Started", workStartedText(work)],
									[
										"Finished",
										live
											? "Not yet"
											: work.finished_at
												? formatStamp(work.finished_at)
												: "—",
									],
									["Duration", workDurationText(work)],
									["Exit", exitCode === null ? "None" : exitCode],
									["Attempt", `${attempt} of task`],
								] as const
							).map(([term, value]) => (
								<div
									key={term}
									className="flex items-center justify-between gap-3 border-b px-3.5 py-2.5 last:border-b-0"
								>
									<dt className="text-muted-foreground">{term}</dt>
									<dd className="text-foreground">{value}</dd>
								</div>
							))}
							<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
								<dt className="text-muted-foreground">Log</dt>
								<dd>
									<button
										type="button"
										onClick={() => void copyLogPath()}
										className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
									>
										Copy log path
									</button>
								</dd>
							</div>
						</dl>
					</Card>
				</div>
			</div>
		</div>
	);
}
