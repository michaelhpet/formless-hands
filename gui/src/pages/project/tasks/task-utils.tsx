import { cn } from "cn";
import { STATUS_LABELS, type TaskStatus } from "./tasks-data";

export function PriorityLabel({ priority }: { priority: number }) {
	if (priority >= 4) {
		return <span className="text-muted-foreground">–</span>;
	}
	return (
		<span
			className={cn(
				priority === 0 && "text-destructive",
				priority === 1 && "text-warning",
				priority === 2 && "text-foreground",
				priority === 3 && "text-muted-foreground",
			)}
		>
			P{priority}
		</span>
	);
}

const STATUS_MARK: Record<TaskStatus, { label: string; className: string }> = {
	open: { label: "Open", className: "text-muted-foreground" },
	triaged: { label: "Triaged", className: "text-foreground" },
	"in-progress": {
		label: "In progress",
		className: "text-warning",
	},
	completed: { label: "Completed", className: "text-foreground" },
	"in-review": {
		label: "In review",
		className: "text-foreground",
	},
	merged: { label: "Merged", className: "text-success" },
	closed: { label: "Closed", className: "text-muted-foreground" },
	blocked: { label: "Blocked", className: "text-destructive" },
	"needs-context": {
		label: "Needs context",
		className: "text-destructive",
	},
};

export function TaskStatusMark({ status }: { status: string }) {
	const mark = STATUS_MARK[status as TaskStatus] ?? {
		label: (STATUS_LABELS as Record<string, string>)[status] ?? status,
		className: "text-muted-foreground",
	};
	return <span className={mark.className}>{mark.label}</span>;
}

export function accentBorderClass(status: string): string | undefined {
	if (status === "blocked" || status === "needs-context") {
		return "border-l-2 border-l-destructive";
	}
	if (status === "in-progress") {
		return "border-l-2 border-l-warning";
	}
	return undefined;
}
