import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod/mini";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

export type ReviewDecision = "approved" | "changes-requested";

const reviewSchema = z.object({
	decision: z.enum(["approved", "changes-requested"]),
	message: z.string(),
});

export function FinishReviewMenu({
	openComments,
	onSubmit,
}: {
	openComments: number;
	onSubmit: (decision: ReviewDecision, message: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const form = useForm({
		defaultValues: { decision: "", message: "" },
		validators: { onSubmit: reviewSchema },
		onSubmit: ({ value }) => {
			onSubmit(value.decision as ReviewDecision, value.message);
			form.reset();
			setOpen(false);
		},
	});

	const submitAs = (decision: ReviewDecision) => {
		form.setFieldValue("decision", decision);
		void form.handleSubmit();
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger render={<Button>Finish review</Button>} />
			<DropdownMenuContent align="end" style={{ width: 320 }}>
				<div className="flex flex-col gap-2 p-1">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Review summary</DropdownMenuLabel>
					</DropdownMenuGroup>
					<form.Field name="message">
						{(field) => (
							<Textarea
								aria-label="Review summary message"
								placeholder="Leave a summary message..."
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
						)}
					</form.Field>
					{openComments === 0 ? (
						<p className="text-muted-foreground">
							Requesting changes requires at least one open comment.
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={openComments === 0}
							onClick={() => submitAs("changes-requested")}
						>
							Request changes
						</Button>
						<Button size="sm" onClick={() => submitAs("approved")}>
							Approve
						</Button>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
