import { cn } from "cn";
import type { TaskStatus } from "./tasks-data";

export function PriorityLabel({ priority }: { priority: 0 | 1 | 2 | 3 }) {
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

const STATUS_MARK: Record<
	TaskStatus,
	{ glyph: string; label: string; className: string }
> = {
	open: { glyph: "○", label: "Open", className: "text-muted-foreground" },
	triaged: { glyph: "●", label: "Triaged", className: "text-foreground" },
	"in-progress": {
		glyph: "●",
		label: "In progress",
		className: "text-warning",
	},
	completed: { glyph: "●", label: "Completed", className: "text-foreground" },
	"in-review": {
		glyph: "●",
		label: "In review",
		className: "text-foreground",
	},
	merged: { glyph: "●", label: "Merged", className: "text-success" },
	closed: { glyph: "●", label: "Closed", className: "text-muted-foreground" },
	blocked: { glyph: "●", label: "Blocked", className: "text-destructive" },
	"needs-context": {
		glyph: "●",
		label: "Needs context",
		className: "text-destructive",
	},
};

export function TaskStatusMark({ status }: { status: TaskStatus }) {
	const mark = STATUS_MARK[status];
	return (
		<span className={cn("flex items-center gap-1.5", mark.className)}>
			{mark.glyph} {mark.label}
		</span>
	);
}

export function accentBorderClass(status: TaskStatus): string | undefined {
	if (status === "blocked" || status === "needs-context") {
		return "border-l-2 border-l-destructive";
	}
	if (status === "in-progress") {
		return "border-l-2 border-l-warning";
	}
	return undefined;
}
