import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewThread } from "./types";

export function ThreadBox({
	id,
	thread,
	replying,
	replyBody,
	onStartReply,
	onCancelReply,
	onReplyBody,
	onSubmitReply,
}: {
	id: string;
	thread: ReviewThread;
	replying: boolean;
	replyBody: string;
	onStartReply: () => void;
	onCancelReply: () => void;
	onReplyBody: (value: string) => void;
	onSubmitReply: () => void;
}) {
	const resolved = thread.state === "resolved";
	return (
		<div
			id={id}
			className={cn(
				"flex scroll-mt-4 flex-col gap-2 border-l-2 border-l-warning bg-card px-3.5 py-3",
				resolved && "opacity-70",
			)}
		>
			<div className="flex items-center justify-between">
				<span
					className={resolved ? "text-muted-foreground" : "text-foreground"}
				>
					{thread.author} · {thread.path}
				</span>
				<span className={resolved ? "text-success" : "text-warning"}>
					{resolved ? "Resolved" : "Open"}
				</span>
			</div>
			<p className="text-[13px] leading-4.75 text-foreground">{thread.body}</p>
			{thread.replies.map((reply) => (
				<div
					key={`${reply.author}-${reply.age}`}
					className="flex flex-col gap-1.5 border bg-background px-3 py-2.5"
				>
					<span className="text-muted-foreground">
						{reply.author} · {reply.age}
					</span>
					<p className="text-[13px] leading-4.75 text-foreground">
						{reply.body}
					</p>
				</div>
			))}
			{resolved ? (
				<span className="text-muted-foreground">{thread.age}</span>
			) : replying ? (
				<form
					className="flex flex-col gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						onSubmitReply();
					}}
				>
					<Textarea
						aria-label={`Reply to ${thread.author}`}
						placeholder="Reply…"
						value={replyBody}
						onChange={(event) => onReplyBody(event.target.value)}
					/>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onCancelReply}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={!replyBody.trim()}>
							Reply
						</Button>
					</div>
				</form>
			) : (
				<button
					type="button"
					onClick={onStartReply}
					className="border border-dashed px-3 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground"
				>
					Reply…
				</button>
			)}
		</div>
	);
}
