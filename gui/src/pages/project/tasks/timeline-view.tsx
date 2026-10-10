import { TaskListRow } from "./task-list-row";
import { groupTasksByAge, type Task } from "./tasks-data";

export function TimelineView({ tasks }: { tasks: Task[] }) {
	const groups = groupTasksByAge(tasks);
	return (
		<div className="flex flex-col gap-4">
			{groups.map((group) => (
				<section
					key={group.key}
					aria-label={group.title}
					className="flex flex-col gap-2"
				>
					<h3 className="tracking-wide text-muted-foreground">
						{group.title} · {group.tasks.length}
					</h3>
					{group.tasks.map((task) => (
						<TaskListRow key={task.id} task={task} />
					))}
				</section>
			))}
		</div>
	);
}
