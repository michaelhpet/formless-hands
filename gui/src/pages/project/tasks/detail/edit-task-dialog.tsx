import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod/mini";
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
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { fieldErrors } from "@/lib/form";
import { PRIORITY_LABELS, type Task } from "../tasks-data";

export interface EditTaskInput {
	title: string;
	priority: Task["priority"];
}

const prioritySchema = z.enum(["0", "1", "2", "3"]);

const editTaskSchema = z.object({
	title: z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", "Title is required"),
		),
	priority: prioritySchema,
});

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
	const form = useForm({
		defaultValues: { title, priority: String(priority) },
		validators: { onSubmit: editTaskSchema },
		onSubmit: ({ value }) => {
			onSave({
				title: value.title.trim(),
				priority: Number(value.priority) as Task["priority"],
			});
			setOpen(false);
		},
	});

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
						void form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="title">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="edit-task-title">Title</FieldLabel>
									<Input
										id="edit-task-title"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										autoComplete="off"
									/>
									<FieldError errors={fieldErrors(field.state.meta.errors)} />
								</Field>
							)}
						</form.Field>
						<form.Field name="priority">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="edit-task-priority">Priority</FieldLabel>
									<Select
										value={field.state.value}
										onValueChange={(value) => {
											if (value !== null) {
												field.handleChange(value);
											}
										}}
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
							)}
						</form.Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose
							render={
								<Button type="button" variant="outline">
									Cancel
								</Button>
							}
						/>
						<form.Subscribe selector={(state) => state.canSubmit}>
							{(canSubmit) => (
								<Button type="submit" disabled={!canSubmit}>
									Save changes
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
