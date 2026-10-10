import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	PRIORITY_LABELS,
	SOURCE_LABELS,
	type Task,
	type TaskSourceKind,
} from "./tasks-data";

export interface NewTaskInput {
	title: string;
	source: TaskSourceKind;
	priority: Task["priority"];
}

export function NewTaskDialog({
	onCreate,
}: {
	onCreate: (input: NewTaskInput) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button>
						<IconPlus data-icon="inline-start" />
						New Task
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Task</DialogTitle>
					<DialogDescription>
						Manually queue a task. Polled source tasks appear automatically.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						const title = String(data.get("title") ?? "").trim();
						if (!title) {
							return;
						}
						onCreate({
							title,
							source:
								String(data.get("source") ?? "linear") === "github"
									? "github"
									: "linear",
							priority: [0, 1, 2, 3].includes(Number(data.get("priority")))
								? (Number(data.get("priority")) as Task["priority"])
								: 2,
						});
						event.currentTarget.reset();
						setOpen(false);
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="new-task-title">Title</FieldLabel>
							<Input
								id="new-task-title"
								name="title"
								required
								placeholder="What needs doing?"
								autoComplete="off"
							/>
						</Field>
						<div className="grid grid-cols-2 gap-4">
							<Field>
								<FieldLabel htmlFor="new-task-source">Source</FieldLabel>
								<Select
									name="source"
									defaultValue="linear"
									items={{
										linear: SOURCE_LABELS.linear,
										github: SOURCE_LABELS.github,
									}}
								>
									<SelectTrigger id="new-task-source" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="linear">
											{SOURCE_LABELS.linear}
										</SelectItem>
										<SelectItem value="github">
											{SOURCE_LABELS.github}
										</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor="new-task-priority">Priority</FieldLabel>
								<Select
									name="priority"
									defaultValue="2"
									items={PRIORITY_LABELS}
								>
									<SelectTrigger id="new-task-priority" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(PRIORITY_LABELS).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>
					</FieldGroup>
					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline">
									Cancel
								</Button>
							}
						/>
						<Button type="submit">Create task</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
