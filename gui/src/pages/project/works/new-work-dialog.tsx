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

export interface NewWorkInput {
	taskRef: string;
	taskTitle: string;
	branch: string;
}

export function NewWorkDialog({
	onCreate,
}: {
	onCreate: (input: NewWorkInput) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button>
						<IconPlus data-icon="inline-start" />
						New Work
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Work</DialogTitle>
					<DialogDescription>
						Start a work attempt on a task in an isolated worktree.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						const task = String(data.get("task") ?? "").trim();
						const branch = String(data.get("branch") ?? "").trim();
						if (!task || !branch) {
							return;
						}
						const separator = task.indexOf(":");
						onCreate({
							taskRef: separator > 0 ? task.slice(0, separator).trim() : task,
							taskTitle:
								separator > 0 ? task.slice(separator + 1).trim() : task,
							branch,
						});
						event.currentTarget.reset();
						setOpen(false);
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="new-work-task">Task</FieldLabel>
							<Input
								id="new-work-task"
								name="task"
								required
								placeholder="LIN-142: Fix auth refresh loop"
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="new-work-branch">Branch</FieldLabel>
							<Input
								id="new-work-branch"
								name="branch"
								required
								placeholder="wt-short-description"
								autoComplete="off"
							/>
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
						<Button type="submit">Start work</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
