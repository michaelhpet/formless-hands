import { IconCheck } from "@tabler/icons-react";
import { TaskListRow } from "./task-list-row";
import { ATTENTION_STATUSES, sortTasks, type Task } from "./tasks-data";

export function AttentionView({ tasks }: { tasks: Task[] }) {
	const items = sortTasks(
		tasks.filter((task) => ATTENTION_STATUSES.includes(task.status)),
	);

	if (items.length === 0) {
		return (
			<div className="flex items-center gap-2.5 border border-l-2 border-l-success bg-card px-3.5 py-3">
				<span className="text-success">
					<IconCheck className="size-4" />
				</span>
				<p className="text-foreground">
					All clear — nothing needs a human right now.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			<p className="text-muted-foreground">
				{items.length} waiting on you · ordered by priority ↓
			</p>
			{items.map((task) => (
				<TaskListRow key={task.id} task={task} />
			))}
		</div>
	);
}
