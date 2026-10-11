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

const sourceSchema = z.enum(["linear", "github"]);
const prioritySchema = z.enum(["0", "1", "2", "3"]);

const taskSchema = z.object({
	title: z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", "Title is required"),
		),
	source: sourceSchema,
	priority: prioritySchema,
});

export function NewTaskDialog({
	onCreate,
}: {
	onCreate: (input: NewTaskInput) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { title: "", source: "linear", priority: "2" },
		validators: { onSubmit: taskSchema },
		onSubmit: ({ value }) => {
			onCreate({
				title: value.title.trim(),
				source: value.source as TaskSourceKind,
				priority: Number(value.priority) as Task["priority"],
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
						<div className="grid grid-cols-2 gap-4">
							<form.Field name="source">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="new-task-source">Source</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) => {
												if (value !== null) {
													field.handleChange(value);
												}
											}}
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
								)}
							</form.Field>
							<form.Field name="priority">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="new-task-priority">
											Priority
										</FieldLabel>
										<Select
											value={field.state.value}
											onValueChange={(value) => {
												if (value !== null) {
													field.handleChange(value);
												}
											}}
											items={PRIORITY_LABELS}
										>
											<SelectTrigger id="new-task-priority" className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(PRIORITY_LABELS).map(
													([value, label]) => (
														<SelectItem key={value} value={value}>
															{label}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
									</Field>
								)}
							</form.Field>
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
