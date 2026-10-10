import { IconSearch } from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useEffect, useState } from "react";
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
import { PriorityLabel, TaskStatusMark } from "../../tasks/task-utils";
import { SOURCE_LABELS } from "../../tasks/tasks-data";
import { INITIAL_WORKS, type WorkStatus } from "../works-data";
import { getWorkDetail, type TranscriptTone } from "./work-detail-data";

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
	lines: { time: string; text: string; tone: TranscriptTone }[];
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
	const work = INITIAL_WORKS.find((item) => item.id === Number(workId));
	const [detail, setDetail] = useState(() =>
		work ? getWorkDetail(work, INITIAL_WORKS) : null,
	);
	const [live, setLive] = useState(work?.status === "running");

	useEffect(() => {
		setDetail(work ? getWorkDetail(work, INITIAL_WORKS) : null);
		setLive(work?.status === "running");
	}, [work]);

	if (!work || !detail) {
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

	const status: WorkStatus = live
		? "running"
		: detail.exitCode === 0
			? "success"
			: "failed";

	const cancel = () => {
		setDetail((prev) =>
			prev ? { ...prev, status: "failed", exitCode: 130 } : prev,
		);
		setLive(false);
	};

	const retry = () => {
		setDetail((prev) =>
			prev
				? {
						...prev,
						status: "running",
						exitCode: null,
						transcript: [
							...prev.transcript,
							{
								time: "now",
								text: `retry queued on ${prev.branch} · attempt ${prev.attempt + 1}`,
								tone: "accent" as const,
							},
						],
					}
				: prev,
		);
		setLive(true);
	};

	const copyLogPath = async () => {
		try {
			await navigator.clipboard.writeText(detail.logFile);
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
						`#${detail.id}`,
					]}
				/>
				<div className="flex items-start justify-between gap-3 max-lg:flex-col">
					<div className="flex min-w-0 flex-col gap-1">
						<h1 className="text-xl leading-6.5 font-bold">
							#{detail.id} — {detail.taskTitle}
						</h1>
						<p className="text-muted-foreground">
							Started {detail.started} · {detail.agent}
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
						logFile={detail.logFile}
						lines={detail.transcript}
						live={live}
						exitCode={detail.exitCode}
					/>
				</div>
				<div className="flex w-85 shrink-0 flex-col gap-3 max-xl:w-full">
					<Card>
						<CardContent className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<h2 className="tracking-wide text-muted-foreground">TASK</h2>
								{detail.task ? (
									<Link
										to="/$projectId/tasks/$taskId"
										params={{
											projectId: projectId ?? "",
											taskId: detail.task.id,
										}}
										className="text-muted-foreground hover:text-foreground hover:underline hover:underline-offset-4"
									>
										Open task
									</Link>
								) : null}
							</div>
							<p className="text-muted-foreground">
								{detail.taskRef}
								{detail.task ? ` · ${SOURCE_LABELS[detail.task.source]}` : ""}
							</p>
							<p className="text-[13px] leading-4.75 font-bold text-foreground">
								{detail.taskTitle}
							</p>
							{detail.task ? (
								<p className="flex items-center gap-1.5">
									<TaskStatusMark status={detail.task.status} />
									<span className="text-muted-foreground">·</span>
									<PriorityLabel priority={detail.task.priority} />
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
									["Branch", detail.branch],
									["Worktree", detail.worktree],
									["Agent", detail.agent],
									["Started", `${detail.started} · ${detail.duration} ago`],
									["Finished", live ? "Not yet" : detail.started],
									["Duration", detail.duration],
									["Exit", detail.exitCode === null ? "None" : detail.exitCode],
									["Attempt", `${detail.attempt} of task`],
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
										Download {detail.logFile}
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
