export type WorkStatus = "running" | "success" | "failed";

export interface Work {
	id: number;
	taskRef: string;
	taskTitle: string;
	branch: string;
	worktree: string;
	started: string;
	duration: string;
	durationMin: number;
	exitCode: number | null;
	status: WorkStatus;
}

export type WorkStatusFilter = "all" | WorkStatus;

export type WorkSortKey = "started" | "exit";

export type WorkSort = "started" | "-started" | "exit" | "-exit";

export const DEFAULT_SORT: WorkSort = "started";

export const STATUS_FILTERS: WorkStatusFilter[] = [
	"all",
	"running",
	"success",
	"failed",
];

export const STATUS_LABELS: Record<WorkStatusFilter, string> = {
	all: "All",
	running: "Running",
	success: "Success",
	failed: "Failed",
};

export function toggleSort(current: WorkSort, key: WorkSortKey): WorkSort {
	if (current === key) {
		return `-${key}` as WorkSort;
	}
	return key;
}

export function sortIndicator(sort: WorkSort, key: WorkSortKey): string {
	const ascending = sort === `-${key}`;
	if (sort !== key && !ascending) {
		return "";
	}
	if (key === "exit") {
		return ascending ? "Lowest" : "Highest";
	}
	return ascending ? "Oldest" : "Newest";
}

export function ariaSort(
	sort: WorkSort,
	key: WorkSortKey,
): "ascending" | "descending" | "none" {
	if (sort === key) {
		return "descending";
	}
	if (sort === `-${key}`) {
		return "ascending";
	}
	return "none";
}

export const INITIAL_WORKS: Work[] = [
	{
		id: 128,
		taskRef: "LIN-142",
		taskTitle: "Fix auth refresh loop",
		branch: "wt-auth-fix",
		worktree: "~/wt-auth-fix",
		started: "10:24",
		duration: "12m",
		durationMin: 12,
		exitCode: null,
		status: "running",
	},
	{
		id: 127,
		taskRef: "GH-881",
		taskTitle: "Implement task table for GUI",
		branch: "wt-gui-table",
		worktree: "~/wt-gui-table",
		started: "09:12",
		duration: "28m",
		durationMin: 28,
		exitCode: 0,
		status: "success",
	},
	{
		id: 126,
		taskRef: "LIN-139",
		taskTitle: "Add backoff to source poller",
		branch: "wt-poll",
		worktree: "~/wt-poll",
		started: "Oct 12",
		duration: "4m",
		durationMin: 4,
		exitCode: 1,
		status: "failed",
	},
	{
		id: 125,
		taskRef: "GH-870",
		taskTitle: "Update CLI help text",
		branch: "wt-docs",
		worktree: "~/wt-docs",
		started: "Oct 11",
		duration: "9m",
		durationMin: 9,
		exitCode: 0,
		status: "success",
	},
	{
		id: 124,
		taskRef: "LIN-144",
		taskTitle: "Migrate daemon state file",
		branch: "wt-state",
		worktree: "~/wt-state",
		started: "Oct 11",
		duration: "31m",
		durationMin: 31,
		exitCode: 1,
		status: "failed",
	},
	{
		id: 123,
		taskRef: "GH-895",
		taskTitle: "Document source config schema",
		branch: "wt-src-docs",
		worktree: "~/wt-src-docs",
		started: "Oct 10",
		duration: "6m",
		durationMin: 6,
		exitCode: 0,
		status: "success",
	},
	{
		id: 122,
		taskRef: "LIN-138",
		taskTitle: "Cache poller cursor per source",
		branch: "wt-cursor",
		worktree: "~/wt-cursor",
		started: "Oct 10",
		duration: "17m",
		durationMin: 17,
		exitCode: 0,
		status: "success",
	},
	{
		id: 121,
		taskRef: "LIN-142",
		taskTitle: "Fix auth refresh loop",
		branch: "wt-auth-fix",
		worktree: "~/wt-auth-fix",
		started: "Oct 09",
		duration: "22m",
		durationMin: 22,
		exitCode: 1,
		status: "failed",
	},
	{
		id: 120,
		taskRef: "GH-893",
		taskTitle: "Add empty states for docs tab",
		branch: "wt-empty",
		worktree: "~/wt-empty",
		started: "Oct 09",
		duration: "11m",
		durationMin: 11,
		exitCode: 0,
		status: "success",
	},
	{
		id: 119,
		taskRef: "GH-865",
		taskTitle: "Fix watcher debounce interval",
		branch: "wt-debounce",
		worktree: "~/wt-debounce",
		started: "Oct 08",
		duration: "8m",
		durationMin: 8,
		exitCode: 0,
		status: "success",
	},
];

export function sortWorks(works: Work[], sort: WorkSort): Work[] {
	const descending = !sort.startsWith("-");
	const key = (descending ? sort : sort.slice(1)) as WorkSortKey;
	const direction = descending ? 1 : -1;
	return [...works].sort((a, b) => {
		switch (key) {
			case "exit":
				return (
					((b.exitCode ?? -1) - (a.exitCode ?? -1)) * direction || b.id - a.id
				);
			default:
				return (b.id - a.id) * direction;
		}
	});
}

export interface WorkStats {
	total: number;
	running: number;
	successRate: number;
	failed: number;
	avgDuration: string;
}

export function summarizeWorks(works: Work[]): WorkStats {
	const finished = works.filter((work) => work.status !== "running");
	const succeeded = finished.filter((work) => work.exitCode === 0).length;
	const failed = finished.filter(
		(work) => work.exitCode !== null && work.exitCode !== 0,
	).length;
	const avgMin =
		finished.length > 0
			? Math.round(
					finished.reduce((sum, work) => sum + work.durationMin, 0) /
						finished.length,
				)
			: 0;
	return {
		total: works.length,
		running: works.filter((work) => work.status === "running").length,
		successRate:
			finished.length > 0 ? Math.round((succeeded / finished.length) * 100) : 0,
		failed,
		avgDuration: `${avgMin}m`,
	};
}
