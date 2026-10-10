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

export function NewWorkDialog({
	onCreate,
}: {
	onCreate: (branch: string) => void;
}) {
	const [open, setOpen] = useState(false);

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
						const data = new FormData(event.currentTarget);
						const branch = String(data.get("branch") ?? "").trim();
						if (!branch) {
							return;
						}
						onCreate(branch);
						event.currentTarget.reset();
						setOpen(false);
					}}
				>
					<FieldGroup>
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
