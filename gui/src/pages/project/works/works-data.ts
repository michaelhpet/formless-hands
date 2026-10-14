import type { Work } from "@/lib/api/works";
import { formatStamp, parseUtcStamp } from "@/lib/datetime";

export type WorkStatus = "running" | "success" | "failed";

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

export function workStatusOf(
	work: Pick<Work, "finished_at" | "exit_code">,
): WorkStatus {
	if (work.finished_at === null) {
		return "running";
	}
	return work.exit_code === 0 ? "success" : "failed";
}

export function workTaskRef(
	work: Pick<Work, "task_id" | "task_external_id">,
): string {
	return work.task_external_id ?? `#${work.task_id}`;
}

export function workDurationMin(
	work: Pick<Work, "started_at" | "finished_at">,
): number {
	const start = parseUtcStamp(work.started_at).getTime();
	const end =
		work.finished_at === null
			? Date.now()
			: parseUtcStamp(work.finished_at).getTime();
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return 0;
	}
	return Math.max(0, Math.round((end - start) / 60000));
}

export function workDurationText(
	work: Pick<Work, "started_at" | "finished_at">,
): string {
	if (work.finished_at === null) {
		return "live";
	}
	return `${workDurationMin(work)}m`;
}

export function workStartedText(work: Pick<Work, "started_at">): string {
	return formatStamp(work.started_at);
}

export function workMeta(work: Work): string {
	return `${work.branch} · ${workStartedText(work)} · exit ${work.exit_code ?? "—"}`;
}

export function toggleSort(current: WorkSort, key: WorkSortKey): WorkSort {
	if (current === key) {
		return `-${key}` as WorkSort;
	}
	return key;
}

export function sortDirection(
	sort: WorkSort,
	key: WorkSortKey,
): "asc" | "desc" | null {
	if (sort === key) {
		return "desc";
	}
	if (sort === `-${key}`) {
		return "asc";
	}
	return null;
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

export function sortWorks(works: Work[], sort: WorkSort): Work[] {
	const descending = !sort.startsWith("-");
	const key = (descending ? sort : sort.slice(1)) as WorkSortKey;
	const direction = descending ? 1 : -1;
	return [...works].sort((a, b) => {
		switch (key) {
			case "exit":
				return (
					((b.exit_code ?? -1) - (a.exit_code ?? -1)) * direction || b.id - a.id
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
	const finished = works.filter((work) => work.finished_at !== null);
	const succeeded = finished.filter((work) => work.exit_code === 0).length;
	const failed = finished.filter(
		(work) => work.exit_code !== null && work.exit_code !== 0,
	).length;
	const avgMin =
		finished.length > 0
			? Math.round(
					finished.reduce((sum, work) => sum + workDurationMin(work), 0) /
						finished.length,
				)
			: 0;
	return {
		total: works.length,
		running: works.filter((work) => work.finished_at === null).length,
		successRate:
			finished.length > 0 ? Math.round((succeeded / finished.length) * 100) : 0,
		failed,
		avgDuration: `${avgMin}m`,
	};
}
