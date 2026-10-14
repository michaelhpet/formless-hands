import { useNavigate, useParams } from "@tanstack/react-router";
import type { Task } from "@/lib/api/tasks";
import { PriorityLabel, TaskStatusMark } from "./task-utils";
import { ageText, sourceLabelOf, taskDisplayId, taskMeta } from "./tasks-data";

export function TaskListRow({ task }: { task: Task }) {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const openDetail = () => {
		navigate({
			to: "/$projectId/tasks/$taskId",
			params: { projectId: projectId ?? "", taskId: String(task.id) },
		});
	};
	return (
		<button
			type="button"
			aria-label={`${taskDisplayId(task)}: ${task.title}`}
			onClick={openDetail}
			className="flex w-full cursor-pointer items-center gap-3 border bg-card px-3.5 py-2.5 text-left hover:border-ring"
		>
			<span className="w-28 shrink-0">
				<TaskStatusMark status={task.status} />
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate text-[13px] text-foreground">
					{taskDisplayId(task)} · {task.title}
				</span>
				<span className="truncate text-muted-foreground">
					{sourceLabelOf(task)} · {taskMeta(task)}
				</span>
			</span>
			<PriorityLabel priority={task.priority} />
			<span className="w-14 shrink-0 text-right text-muted-foreground">
				{ageText(task.created_at)}
			</span>
			<span className="shrink-0 text-muted-foreground">Open</span>
		</button>
	);
}
