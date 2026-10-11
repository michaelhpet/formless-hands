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

const workSchema = z.object({
	branch: z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", "Branch is required"),
		),
});

export function NewWorkDialog({
	onCreate,
}: {
	onCreate: (branch: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { branch: "" },
		validators: { onSubmit: workSchema },
		onSubmit: ({ value }) => {
			onCreate(value.branch.trim());
			form.reset();
			setOpen(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button>New Work</Button>} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New Work</DialogTitle>
					<DialogDescription>
						Start a work attempt on a fresh branch.
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
						<form.Field name="branch">
							{(field) => (
								<Field>
									<FieldLabel htmlFor="new-work-branch">Branch</FieldLabel>
									<Input
										id="new-work-branch"
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										placeholder="wt-short-description"
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
									Start work
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
