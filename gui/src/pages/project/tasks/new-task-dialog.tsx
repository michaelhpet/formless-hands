import { IconPlus } from "@tabler/icons-react";
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
import { PRIORITY_OPTIONS } from "./tasks-data";

export interface NewTaskInput {
	title: string;
	priority: number;
}

const prioritySchema = z.enum(["0", "1", "2", "3", "4"]);

const taskSchema = z.object({
	title: z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", "Title is required"),
		),
	priority: prioritySchema,
});

export function NewTaskDialog({
	onCreate,
}: {
	onCreate: (input: NewTaskInput) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { title: "", priority: "2" },
		validators: { onSubmit: taskSchema },
		onSubmit: ({ value }) => {
			onCreate({
				title: value.title.trim(),
				priority: Number(value.priority),
			});
			form.reset();
			setOpen(false);
		},
	});

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
						void form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.Field name="title">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="new-task-title">Title</FieldLabel>
									<Input
										id="new-task-title"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										placeholder="What needs doing?"
										autoComplete="off"
									/>
									<FieldError errors={fieldErrors(field.state.meta.errors)} />
								</Field>
							)}
						</form.Field>
						<form.Field name="priority">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="new-task-priority">Priority</FieldLabel>
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
										<SelectTrigger id="new-task-priority" className="w-full">
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
									Create task
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
