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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { fieldErrors } from "@/lib/form";
import { PRIORITY_OPTIONS } from "../tasks-data";

export interface EditTaskInput {
	priority: number;
}

const prioritySchema = z.enum(["0", "1", "2", "3", "4"]);

const editTaskSchema = z.object({
	priority: prioritySchema,
});

function clampPriority(priority: number): string {
	if (priority >= 4) {
		return "4";
	}
	if (priority <= 0) {
		return "0";
	}
	return String(Math.round(priority));
}

export function EditTaskDialog({
	priority,
	onSave,
}: {
	priority: number;
	onSave: (input: EditTaskInput) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { priority: clampPriority(priority) },
		validators: { onSubmit: editTaskSchema },
		onSubmit: ({ value }) => {
			onSave({ priority: Number(value.priority) });
			setOpen(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button variant="outline">Edit</Button>} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit Task</DialogTitle>
					<DialogDescription>Update the priority.</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<FieldGroup>
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
										items={Object.fromEntries(
											PRIORITY_OPTIONS.map((option) => [
												option.value,
												option.label,
											]),
										)}
									>
										<SelectTrigger id="edit-task-priority" className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{PRIORITY_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={fieldErrors(field.state.meta.errors)} />
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
