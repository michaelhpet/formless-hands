import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import type { Project } from "@/lib/api/projects";
import type { Task as TaskRecord } from "@/lib/api/tasks";
import type { Work as WorkRecord } from "@/lib/api/works";
import { parseUtcStamp } from "@/lib/datetime";
import { ageText } from "../project/tasks/tasks-data";

function Bars({
	bars,
	barClassName,
}: {
	bars: { key: string; height: string }[];
	barClassName: string;
}) {
	return (
		<div className="flex h-7 shrink-0 items-end gap-0.75" aria-hidden="true">
			{bars.map((bar) => (
				<div
					key={bar.key}
					style={{ height: bar.height }}
					className={`min-w-0 flex-1 ${barClassName}`}
				/>
			))}
		</div>
	);
}

function toBars(
	entries: { key: string; count: number }[],
): { key: string; height: string }[] {
	const max = Math.max(1, ...entries.map((entry) => entry.count));
	return entries.map((entry) => ({
		key: entry.key,
		height: `${Math.max(4, Math.round((entry.count / max) * 28))}px`,
	}));
}

function startOfDay(date: Date): Date {
	const day = new Date(date);
	day.setHours(0, 0, 0, 0);
	return day;
}

const ACTIVITY_WINDOW_DAYS = 7;

function createdPerDay(
	stamps: string[],
	days: number,
): { key: string; count: number }[] {
	const dayMs = 86_400_000;
	const today = startOfDay(new Date()).getTime();
	const buckets = Array.from({ length: days }, (_, offset) => {
		const date = new Date(today - (days - 1 - offset) * dayMs);
		return { key: date.toISOString().slice(0, 10), count: 0 };
	});
	for (const stamp of stamps) {
		const time = parseUtcStamp(stamp).getTime();
		if (!Number.isFinite(time)) {
			continue;
		}
		const index =
			days -
			1 -
			Math.floor((today - startOfDay(new Date(time)).getTime()) / dayMs);
		if (index >= 0 && index < days) {
			buckets[index].count += 1;
		}
	}
	return buckets;
}

export function StatCards({
	projects,
	tasks,
	works,
	projectCount,
	connectedCount,
}: {
	projects: Project[];
	tasks: TaskRecord[];
	works: WorkRecord[];
	projectCount: number;
	connectedCount: number;
}) {
	const openTasks = tasks.filter(
		(task) => task.status !== "merged" && task.status !== "closed",
	);
	const ready = tasks.filter((task) => task.status === "triaged").length;
	const inReviewTasks = tasks.filter((task) => task.status === "in-review");
	const queued = tasks.filter((task) =>
		["open", "triaged", "needs-context", "blocked"].includes(task.status),
	).length;

	const running = works.filter((work) => work.finished_at === null).length;
	const finished = works.filter((work) => work.finished_at !== null);
	const succeeded = finished.filter((work) => work.exit_code === 0).length;
	const successRate =
		finished.length > 0 ? Math.round((succeeded / finished.length) * 100) : 0;

	const oldestWaiting =
		inReviewTasks.length > 0
			? inReviewTasks
					.map((task) => task.created_at)
					.sort()
					.at(0)
			: undefined;

	return (
		<div className="grid w-full grid-cols-2 gap-2.5 xl:grid-cols-4">
			<Card size="sm">
				<CardHeader>
					<CardDescription>PROJECTS</CardDescription>
				</CardHeader>
				<CardContent className="flex h-full flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{projectCount}</div>
					<Bars
						bars={toBars(
							projects.map((project) => ({
								key: `project-${project.id}`,
								count: openTasks.filter(
									(task) => task.project_id === project.id,
								).length,
							})),
						)}
						barClassName="bg-primary last:bg-border"
					/>
					<p className="mt-auto text-muted-foreground">
						{connectedCount} connected
					</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>TASKS QUEUED</CardDescription>
				</CardHeader>
				<CardContent className="flex h-full flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{queued}</div>
					<Bars
						bars={toBars(
							createdPerDay(
								tasks.map((task) => task.created_at),
								ACTIVITY_WINDOW_DAYS,
							),
						)}
						barClassName="bg-chart-3 last:bg-border"
					/>
					<p className="mt-auto text-muted-foreground">
						{ready} ready · {inReviewTasks.length} in-review
					</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>WORKS ACTIVE</CardDescription>
				</CardHeader>
				<CardContent className="flex h-full flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{running}</div>
					<div className="flex h-7 shrink-0 items-end">
						<div
							className="h-0.75 w-full bg-border"
							role="progressbar"
							aria-valuenow={successRate}
							aria-valuemin={0}
							aria-valuemax={100}
							aria-label="Work success rate"
						>
							<div
								className="h-full bg-success"
								style={{ width: `${successRate}%` }}
							/>
						</div>
					</div>
					<p className="mt-auto text-muted-foreground">
						{works.length} total · {successRate}% success
					</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>IN REVIEW</CardDescription>
				</CardHeader>
				<CardContent className="flex h-full flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">
						{inReviewTasks.length}
					</div>
					<Bars
						bars={toBars(
							projects.map((project) => ({
								key: `review-${project.id}`,
								count: inReviewTasks.filter(
									(task) => task.project_id === project.id,
								).length,
							})),
						)}
						barClassName="bg-warning last:bg-border"
					/>
					<p className="mt-auto text-muted-foreground">
						{inReviewTasks.length === 0
							? "Nothing waiting"
							: `Oldest waiting ${ageText(oldestWaiting ?? "")}`}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
