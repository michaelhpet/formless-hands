import { useNavigate, useParams } from "@tanstack/react-router";
import { PriorityLabel, TaskStatusMark } from "./task-utils";
import { SOURCE_LABELS, type Task } from "./tasks-data";

export function TaskListRow({ task }: { task: Task }) {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const openDetail = () => {
		navigate({
			to: "/$projectId/tasks/$taskId",
			params: { projectId: projectId ?? "", taskId: task.id },
		});
	};
	return (
		<button
			type="button"
			aria-label={`${task.id}: ${task.title}`}
			onClick={openDetail}
			className="flex w-full cursor-pointer items-center gap-3 border bg-card px-3.5 py-2.5 text-left hover:border-ring"
		>
			<span className="w-28 shrink-0">
				<TaskStatusMark status={task.status} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate text-[13px] text-foreground">
					{task.id} · {task.title}
				</span>
				<span className="truncate text-muted-foreground">
					{SOURCE_LABELS[task.source]} · {task.meta}
				</span>
			</span>
			<PriorityLabel priority={task.priority} />
			<span className="w-14 shrink-0 text-right text-muted-foreground">
				{task.age}
			</span>
			<span className="shrink-0 text-muted-foreground">Open</span>
		</button>
	);
}
