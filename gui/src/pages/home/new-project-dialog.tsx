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

export interface NewProjectInput {
	name: string;
	remote: string;
	localPath: string;
}

export function NewProjectDialog({
	onCreate,
}: {
	onCreate: (input: NewProjectInput) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button>
						<IconPlus data-icon="inline-start" />
						New Project
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Project</DialogTitle>
					<DialogDescription>
						Track a local checkout. Sources can be attached later.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const data = new FormData(event.currentTarget);
						const name = String(data.get("name") ?? "").trim();
						if (!name) {
							return;
						}
						onCreate({
							name,
							remote: String(data.get("remote") ?? "").trim(),
							localPath: String(data.get("localPath") ?? "").trim(),
						});
						event.currentTarget.reset();
						setOpen(false);
					}}
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="new-project-name">Name</FieldLabel>
							<Input
								id="new-project-name"
								name="name"
								required
								placeholder="my-project"
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="new-project-remote">Remote</FieldLabel>
							<Input
								id="new-project-remote"
								name="remote"
								placeholder="git@github.com:acme/my-project.git"
								autoComplete="off"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="new-project-path">Local path</FieldLabel>
							<Input
								id="new-project-path"
								name="localPath"
								placeholder="~/Work/my-project"
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
						<Button type="submit">Create project</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
