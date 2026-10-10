import { useState } from "react";
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

export function FinishReviewMenu({
	openComments,
	onSubmit,
}: {
	openComments: number;
	onSubmit: (decision: ReviewDecision, message: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState("");

	const submit = (decision: ReviewDecision) => {
		onSubmit(decision, message);
		setMessage("");
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger render={<Button>Finish review</Button>} />
			<DropdownMenuContent align="end" style={{ width: 320 }}>
				<div className="flex flex-col gap-2 p-1">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Review summary</DropdownMenuLabel>
					</DropdownMenuGroup>
					<Textarea
						aria-label="Review summary message"
						placeholder="Leave a summary message..."
						value={message}
						onChange={(event) => setMessage(event.target.value)}
					/>
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
							onClick={() => submit("changes-requested")}
						>
							Request changes
						</Button>
						<Button size="sm" onClick={() => submit("approved")}>
							Approve
						</Button>
					</div>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
