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
import { fieldErrors } from "@/lib/form";

export interface NewProjectInput {
	repo: string;
}

const projectSchema = z.object({
	repo: z
		.string()
		.check(
			z.refine(
				(value: string) => value.trim() !== "",
				"Repository is required",
			),
		),
});

export function NewProjectDialog({
	onCreate,
}: {
	onCreate: (input: NewProjectInput) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { repo: "" },
		validators: { onSubmit: projectSchema },
		onSubmit: ({ value }) => {
			onCreate({ repo: value.repo.trim() });
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
						New Project
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Project</DialogTitle>
					<DialogDescription>
						Track a GitHub repository or a local checkout. Sources can be
						attached later.
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
						<form.Field name="repo">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="new-project-repo">
										GitHub URL or local path
									</FieldLabel>
									<Input
										id="new-project-repo"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										placeholder="git@github.com:acme/app.git or ~/Work/app"
										autoComplete="off"
									/>
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
									Create project
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
