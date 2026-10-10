import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PriorityLabel, TaskStatusMark } from "../task-utils";
import { SOURCE_LABELS } from "../tasks-data";
import type { TaskDetail, WorkStatus } from "./task-detail-data";

const WORK_DOT: Record<WorkStatus, string> = {
	running: "text-warning",
	failed: "text-destructive",
	success: "text-success",
	queued: "text-muted-foreground",
};

const WORK_LABEL: Record<WorkStatus, string> = {
	running: "Running",
	failed: "Failed",
	success: "Success",
	queued: "Queued",
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

export function TaskDetailSidebar({
	projectId,
	detail,
}: {
	projectId: string;
	detail: TaskDetail;
}) {
	return (
		<aside className="flex w-full shrink-0 flex-col gap-3 xl:w-85">
			{detail.lastError ? (
				<Card className="border-l-2 border-l-destructive">
					<CardContent className="flex flex-col gap-1.5">
						<span className="tracking-wide text-destructive">
							LAST ERROR · ATTEMPT {detail.lastError.attempt}
						</span>
						<p>{detail.lastError.text}</p>
					</CardContent>
				</Card>
			) : null}

			<Card className="gap-0 py-0">
				<div className="flex items-center justify-between border-b px-3.5 py-3">
					<span className="tracking-wide text-muted-foreground">
						WORKS · {detail.works.length}
					</span>
					<Link
						to="/$projectId/works"
						params={{ projectId }}
						className="text-muted-foreground hover:text-foreground"
					>
						View all →
					</Link>
				</div>
				{detail.works.length === 0 ? (
					<p className="px-3.5 py-3 text-muted-foreground">No works yet.</p>
				) : (
					detail.works.slice(0, 2).map((work, index, shown) => (
						<div key={work.id}>
							<div className="flex flex-col gap-0.5 px-3.5 py-2.5">
								<div className="flex items-center justify-between">
									<span>#{work.id}</span>
									<span
										className={cn(
											"flex items-center gap-1.5",
											WORK_DOT[work.status],
										)}
									>
										● {WORK_LABEL[work.status]}
									</span>
								</div>
								<span className="text-muted-foreground">{work.meta}</span>
							</div>
							{index < shown.length - 1 ? <Separator /> : null}
						</div>
					))
				)}
			</Card>

			<Card className="gap-0 py-0">
				<SectionTitle>DETAILS</SectionTitle>
				<DetailRow label="Status">
					<TaskStatusMark status={detail.status} />
				</DetailRow>
				<DetailRow label="Priority">
					<PriorityLabel priority={detail.priority} />
				</DetailRow>
				<DetailRow label="Source">
					<span className="flex items-center gap-1.5 text-foreground">
						<span
							className="size-1.5 rounded-full bg-foreground"
							aria-hidden="true"
						/>
						{SOURCE_LABELS[detail.source]} ↗
					</span>
				</DetailRow>
				<DetailRow label="Branch">
					<span className="text-foreground">{detail.branch}</span>
				</DetailRow>
				<DetailRow label="Worktree">
					<span className="text-muted-foreground">{detail.worktree}</span>
				</DetailRow>
				<DetailRow label="PR">
					<span className="text-muted-foreground">{detail.pr}</span>
				</DetailRow>
				<DetailRow label="Labels">
					<span className="text-foreground">{detail.labels}</span>
				</DetailRow>
				<DetailRow label="Attempts">
					<span className="text-foreground">{detail.attempts}</span>
				</DetailRow>
				<DetailRow label="Locked">
					<span className="text-muted-foreground">{detail.locked}</span>
				</DetailRow>
				<DetailRow label="Created">
					<span className="text-muted-foreground">{detail.created}</span>
				</DetailRow>
				<DetailRow label="Updated" last>
					<span className="text-muted-foreground">{detail.updated}</span>
				</DetailRow>
			</Card>

			<Card>
				<CardHeader>
					<span className="tracking-wide text-muted-foreground">ACTIVITY</span>
				</CardHeader>
				<CardContent className="flex flex-col gap-2.5">
					{detail.activity.map((item) => (
						<div
							key={`${item.text}-${item.sub}`}
							className="flex flex-col gap-0.5"
						>
							<span className="text-foreground">● {item.text}</span>
							<span className="text-muted-foreground">{item.sub}</span>
						</div>
					))}
				</CardContent>
			</Card>
		</aside>
	);
}
