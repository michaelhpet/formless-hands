import { useNavigate, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { accentBorderClass, PriorityLabel } from "./task-utils";
import {
	columnForStatus,
	KANBAN_COLUMNS,
	type KanbanColumnKey,
	SOURCE_LABELS,
	type Task,
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
			params: { projectId: projectId ?? "", taskId: task.id },
		});
	};
	return (
		<Card
			size="sm"
			tabIndex={0}
			role="link"
			aria-label={`${task.id}: ${task.title}`}
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
				"cursor-pointer hover:border-ring",
			)}
		>
			<CardContent className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground">
						{task.id} · {SOURCE_LABELS[task.source]}
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
					{task.meta}
				</span>
			</CardContent>
		</Card>
	);
}

export function TaskKanban({ tasks }: { tasks: Task[] }) {
	return (
		<div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
			{KANBAN_COLUMNS.map((column) => {
				const items = tasks.filter(
					(task) => columnForStatus(task.status) === column.key,
				);
				return (
					<section key={column.key} aria-label={column.title}>
						<div className="flex flex-col gap-2">
							<div className="flex items-center justify-between">
								<h3 className="tracking-wide text-muted-foreground">
									{column.title}
								</h3>
								<Badge variant="outline" className={COUNT_STYLES[column.key]}>
									{items.length}
								</Badge>
							</div>
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
