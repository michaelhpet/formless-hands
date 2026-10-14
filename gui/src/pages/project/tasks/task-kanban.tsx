import { useNavigate, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@/lib/api/tasks";
import { accentBorderClass, PriorityLabel } from "./task-utils";
import {
	columnForStatus,
	KANBAN_COLUMNS,
	type KanbanColumnKey,
	sourceLabelOf,
	taskDisplayId,
	taskMeta,
} from "./tasks-data";

const COUNT_STYLES: Record<KanbanColumnKey, string | undefined> = {
	"needs-triage": undefined,
	ready: undefined,
	"in-progress": "text-warning",
	completed: undefined,
	done: "text-success",
};

function TaskCard({ task }: { task: Task }) {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const done = task.status === "merged" || task.status === "closed";
	const openDetail = () => {
		navigate({
			to: "/$projectId/tasks/$taskId",
			params: { projectId: projectId ?? "", taskId: String(task.id) },
		});
	};
	return (
		<Card
			size="sm"
			tabIndex={0}
			role="link"
			aria-label={`${taskDisplayId(task)}: ${task.title}`}
			onClick={openDetail}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					openDetail();
				}
			}}
			className={cn(
				accentBorderClass(task.status),
				done && "opacity-70",
				"min-h-max shrink-0 cursor-pointer hover:border-ring",
			)}
		>
			<CardContent className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">
						{taskDisplayId(task)} · {sourceLabelOf(task)}
					</span>
					<PriorityLabel priority={task.priority} />
				</div>
				<p
					className={cn(
						"text-[13px] leading-4.5",
						done ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{task.title}
				</p>
				<span
					className={cn(
						task.status === "blocked" || task.status === "needs-context"
							? "text-destructive"
							: task.status === "merged"
								? "text-success"
								: "text-muted-foreground",
					)}
				>
					{taskMeta(task)}
				</span>
			</CardContent>
		</Card>
	);
}

export function TaskKanban({ tasks }: { tasks: Task[] }) {
	return (
		<div className="grid h-full w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
			{KANBAN_COLUMNS.map((column) => {
				const items = tasks.filter(
					(task) => columnForStatus(task.status) === column.key,
				);
				return (
					<section
						key={column.key}
						aria-label={column.title}
						className="flex min-h-0 flex-col gap-2"
					>
						<div className="flex shrink-0 items-center justify-between">
							<h3 className="tracking-wide text-muted-foreground">
								{column.title}
							</h3>
							<Badge variant="outline" className={COUNT_STYLES[column.key]}>
								{items.length}
							</Badge>
						</div>
						<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
							{items.length === 0 ? (
								<p className="text-muted-foreground">No tasks</p>
							) : null}
							{items.map((task) => (
								<TaskCard key={task.id} task={task} />
							))}
						</div>
					</section>
				);
			})}
		</div>
	);
}
