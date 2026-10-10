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
import { PRIORITY_LABELS, type Task } from "../tasks-data";

export interface EditTaskInput {
	title: string;
	priority: Task["priority"];
}

export function EditTaskDialog({
	title,
	priority,
	onSave,
}: {
	title: string;
	priority: Task["priority"];
	onSave: (input: EditTaskInput) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline">Edit</Button>} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Task</DialogTitle>
					<DialogDescription>Update the title or priority.</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						const nextTitle = String(data.get("title") ?? "").trim();
						if (!nextTitle) {
							return;
						}
						const nextPriority = Number(data.get("priority"));
						onSave({
							title: nextTitle,
							priority: [0, 1, 2, 3].includes(nextPriority)
								? (nextPriority as Task["priority"])
								: priority,
						});
						setOpen(false);
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="edit-task-title">Title</FieldLabel>
							<Input
								id="edit-task-title"
								name="title"
								required
								defaultValue={title}
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="edit-task-priority">Priority</FieldLabel>
							<Select
								name="priority"
								defaultValue={String(priority)}
								items={PRIORITY_LABELS}
							>
								<SelectTrigger id="edit-task-priority" className="w-full">
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
					</FieldGroup>
					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline">
									Cancel
								</Button>
							}
						/>
						<Button type="submit">Save changes</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
