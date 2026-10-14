import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
	type Task,
	useCreateDependency,
	useDeleteDependency,
	useDependencies,
} from "@/lib/api/tasks";
import type { Work } from "@/lib/api/works";
import { formatStamp } from "@/lib/datetime";
import { workMeta, workStatusOf } from "../../works/works-data";
import { PriorityLabel, TaskStatusMark } from "../task-utils";
import { parseLabels, sourceLabelOf, taskDisplayId } from "../tasks-data";

const WORK_DOT: Record<string, string> = {
	running: "text-warning",
	failed: "text-destructive",
	success: "text-success",
};

const WORK_LABEL: Record<string, string> = {
	running: "Running",
	failed: "Failed",
	success: "Success",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
	return (
		<CardHeader className="border-b py-3">
			<span className="tracking-wide text-muted-foreground">{children}</span>
		</CardHeader>
	);
}

function DetailRow({
	label,
	children,
	last,
}: {
	label: string;
	children: React.ReactNode;
	last?: boolean;
}) {
	return (
		<>
			<div className="flex items-center justify-between px-3.5 py-2">
				<span className="text-muted-foreground">{label}</span>
				<span className="text-right">{children}</span>
			</div>
			{last ? null : <Separator />}
		</>
	);
}

function DependenciesSection({
	taskId,
	projectName,
}: {
	taskId: number | undefined;
	projectName: string;
}) {
	const depsQuery = useDependencies(taskId);
	const createMutation = useCreateDependency();
	const deleteMutation = useDeleteDependency();
	const [input, setInput] = useState("");

	const add = () => {
		const dependsOn = Number(input.trim());
		if (
			taskId === undefined ||
			!Number.isInteger(dependsOn) ||
			createMutation.isPending
		) {
			return;
		}
		createMutation.mutate(
			{ taskId, dependsOn, project: projectName },
			{ onSuccess: () => setInput("") },
		);
	};

	const deps = depsQuery.data ?? [];

	return (
		<Card className="gap-0 py-0">
			<div className="flex items-center justify-between border-b px-3.5 py-3">
				<span className="tracking-wide text-muted-foreground">
					DEPENDS ON · {deps.length}
				</span>
			</div>
			{depsQuery.isLoading ? (
				<p className="px-3.5 py-3 text-muted-foreground">Loading…</p>
			) : deps.length === 0 ? (
				<p className="px-3.5 py-3 text-muted-foreground">No dependencies.</p>
			) : (
				deps.map((dep, index) => (
					<div key={dep.id}>
						<div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
							<span className="min-w-0">
								<span className="text-foreground">
									#{dep.id} · {dep.title}
								</span>
								<span className="text-muted-foreground"> · {dep.status}</span>
							</span>
							<Button
								variant="ghost"
								size="xs"
								disabled={taskId === undefined || deleteMutation.isPending}
								onClick={() =>
									taskId !== undefined &&
									deleteMutation.mutate({ taskId, dep: dep.id })
								}
							>
								Remove
							</Button>
						</div>
						{index < deps.length - 1 ? <Separator /> : null}
					</div>
				))
			)}
			<form
				className="flex gap-2 border-t px-3.5 py-2.5"
				onSubmit={(event) => {
					event.preventDefault();
					add();
				}}
			>
				<Input
					placeholder="Task #"
					aria-label="Depends on task id"
					inputMode="numeric"
					value={input}
					onChange={(event) => setInput(event.target.value)}
					className="h-7"
				/>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					disabled={!input.trim()}
				>
					Add
				</Button>
			</form>
		</Card>
	);
}

export function TaskDetailSidebar({
	projectId,
	task,
	works,
}: {
	projectId: string;
	task: Task;
	works: Work[];
}) {
	const labels = parseLabels(task.labels);
	const latestWork = works[0];
	const activity = [
		...works.slice(0, 5).map((work) => ({
			text: `Work #${work.id} ${workStatusOf(work)}`,
			sub: workMeta(work),
		})),
		{
			text: `Polled from ${sourceLabelOf(task)}`,
			sub: `${formatStamp(task.created_at)} · ${taskDisplayId(task)}`,
		},
	];

	return (
		<aside className="flex w-full shrink-0 flex-col gap-3 xl:w-85">
			{task.last_error.trim() !== "" ? (
				<Card className="border-l-2 border-l-destructive">
					<CardContent className="flex flex-col gap-1.5">
						<span className="tracking-wide text-destructive">
							LAST ERROR · ATTEMPT {task.attempts}
						</span>
						<p>{task.last_error}</p>
					</CardContent>
				</Card>
			) : null}

			<Card className="gap-0 py-0">
				<div className="flex items-center justify-between border-b px-3.5 py-3">
					<span className="tracking-wide text-muted-foreground">
						WORKS · {works.length}
					</span>
					<Link
						to="/$projectId/works"
						params={{ projectId }}
						search={{ task: String(task.id) }}
						className="text-muted-foreground hover:text-foreground"
					>
						View all
					</Link>
				</div>
				{works.length === 0 ? (
					<p className="px-3.5 py-3 text-muted-foreground">No works yet.</p>
				) : (
					works.slice(0, 2).map((work, index, shown) => (
						<div key={work.id}>
							<div className="flex flex-col gap-0.5 px-3.5 py-2.5">
								<div className="flex items-center justify-between">
									<span>#{work.id}</span>
									<span className={cn(WORK_DOT[workStatusOf(work)])}>
										{WORK_LABEL[workStatusOf(work)]}
									</span>
								</div>
								<span className="text-muted-foreground">{workMeta(work)}</span>
							</div>
							{index < shown.length - 1 ? <Separator /> : null}
						</div>
					))
				)}
			</Card>

			<Card className="gap-0 py-0">
				<SectionTitle>DETAILS</SectionTitle>
				<DetailRow label="Status">
					<TaskStatusMark status={task.status} />
				</DetailRow>
				<DetailRow label="Priority">
					<PriorityLabel priority={task.priority} />
				</DetailRow>
				<DetailRow label="Source">
					<span className="flex items-center gap-1.5 text-foreground">
						<span
							className="size-1.5 rounded-full bg-foreground"
							aria-hidden="true"
						/>
						{sourceLabelOf(task)}
					</span>
				</DetailRow>
				<DetailRow label="Branch">
					<span className="text-foreground">
						{task.branch === "" ? "None" : task.branch}
					</span>
				</DetailRow>
				<DetailRow label="Worktree">
					<span className="text-muted-foreground">
						{latestWork ? latestWork.worktree_path : "None"}
					</span>
				</DetailRow>
				<DetailRow label="PR">
					<span className="text-muted-foreground">
						{task.pr_number !== null ? `PR #${task.pr_number}` : "None"}
					</span>
				</DetailRow>
				<DetailRow label="Labels">
					<span className="text-foreground">
						{labels.length > 0 ? labels.join(", ") : "None"}
					</span>
				</DetailRow>
				<DetailRow label="Attempts">
					<span className="text-foreground">{task.attempts}</span>
				</DetailRow>
				<DetailRow label="Created">
					<span className="text-muted-foreground">
						{formatStamp(task.created_at)}
					</span>
				</DetailRow>
				<DetailRow label="Updated" last>
					<span className="text-muted-foreground">
						{formatStamp(task.updated_at)}
					</span>
				</DetailRow>
			</Card>

			<DependenciesSection taskId={task.id} projectName={projectId} />

			<Card>
				<CardHeader>
					<span className="tracking-wide text-muted-foreground">ACTIVITY</span>
				</CardHeader>
				<CardContent className="flex flex-col gap-2.5">
					{activity.map((item) => (
						<div
							key={`${item.text}-${item.sub}`}
							className="flex flex-col gap-0.5"
						>
							<span className="text-foreground">{item.text}</span>
							<span className="text-muted-foreground">{item.sub}</span>
						</div>
					))}
				</CardContent>
			</Card>
		</aside>
	);
}
