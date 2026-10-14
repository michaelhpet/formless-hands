import { lastPollText } from "@/components/daemon-status";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import type { Source } from "@/lib/api/sources";
import type { Task as TaskRecord } from "@/lib/api/tasks";
import type { Work as WorkRecord } from "@/lib/api/works";

function Bars({
	values,
	barClassName,
}: {
	values: string[];
	barClassName: string;
}) {
	return (
		<div className="flex h-7 shrink-0 items-end gap-0.75" aria-hidden="true">
			{values.map((height) => (
				<div
					key={height}
					style={{ height }}
					className={`min-w-0 flex-1 ${barClassName}`}
				/>
			))}
		</div>
	);
}

function barHeights(counts: number[]): string[] {
	const max = Math.max(1, ...counts);
	return counts.map(
		(count) => `${Math.max(4, Math.round((count / max) * 28))}px`,
	);
}

export function StatCards({
	tasks,
	works,
	sources,
	projectCount,
	connectedCount,
}: {
	tasks: TaskRecord[];
	works: WorkRecord[];
	sources: Source[];
	projectCount: number;
	connectedCount: number;
}) {
	const ready = tasks.filter((task) => task.status === "triaged").length;
	const inReview = tasks.filter((task) => task.status === "in-review").length;
	const queued = tasks.filter((task) =>
		["open", "triaged", "needs-context", "blocked"].includes(task.status),
	).length;

	const running = works.filter((work) => work.finished_at === null).length;
	const finished = works.filter((work) => work.finished_at !== null);
	const succeeded = finished.filter((work) => work.exit_code === 0).length;
	const successRate =
		finished.length > 0 ? Math.round((succeeded / finished.length) * 100) : 0;

	const enabledSources = sources.filter((source) => source.enabled);
	const linearCount = enabledSources.filter(
		(source) => source.kind === "linear",
	).length;
	const githubCount = enabledSources.filter(
		(source) => source.kind === "github",
	).length;

	return (
		<div className="grid w-full grid-cols-2 gap-2.5 xl:grid-cols-4">
			<Card size="sm">
				<CardHeader>
					<CardDescription>PROJECTS</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{projectCount}</div>
					<Bars
						values={barHeights([
							connectedCount,
							projectCount - connectedCount,
							projectCount,
						])}
						barClassName="bg-primary last:bg-border"
					/>
					<p className="text-muted-foreground">{connectedCount} connected</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>TASKS QUEUED</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{queued}</div>
					<Bars
						values={barHeights([
							tasks.filter((task) => task.status === "open").length,
							ready,
							inReview,
							tasks.filter((task) => task.status === "blocked").length,
						])}
						barClassName="bg-chart-3 last:bg-border"
					/>
					<p className="text-muted-foreground">
						{ready} ready · {inReview} in-review
					</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>WORKS ACTIVE</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{running}</div>
					<div
						className="h-0.75 shrink-0 bg-border"
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
					<p className="text-muted-foreground">
						{works.length} total · {successRate}% success
					</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>SOURCES</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">
						{enabledSources.length}/{sources.length}
					</div>
					<div className="flex gap-1.5">
						<span className="text-success">Linear {linearCount}</span>
						<span className="text-muted-foreground">GitHub {githubCount}</span>
					</div>
					<p className="text-muted-foreground">
						{lastPollText(sources.map((source) => source.last_polled_at))}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
