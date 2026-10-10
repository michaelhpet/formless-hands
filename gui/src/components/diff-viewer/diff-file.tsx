import { cn } from "cn";
import { Card } from "@/components/ui/card";
import { HunkDiff } from "./diff-hunk";
import { ExplanationCard } from "./explanation-card";
import type { ReviewFile } from "./types";

export function FileDiff({
	file,
	fileIndex,
	replyingKey,
	replyBody,
	notesClosed,
	reserveNotesSpace,
	onStartReply,
	onCancelReply,
	onReplyBody,
	onSubmitReply,
	onToggleNotes,
}: {
	file: ReviewFile;
	fileIndex: number;
	replyingKey: string | null;
	replyBody: string;
	notesClosed: ReadonlySet<string>;
	reserveNotesSpace: boolean;
	onStartReply: (key: string) => void;
	onCancelReply: () => void;
	onReplyBody: (value: string) => void;
	onSubmitReply: (key: string) => void;
	onToggleNotes: (key: string) => void;
}) {
	return (
		<div className="flex w-full flex-col -space-y-px">
			{file.hunks.map((hunk, hunkIndex) => {
				const threadKey = `${fileIndex}:${hunkIndex}`;
				const notesOpen =
					hunk.agentNotes.length > 0 && !notesClosed.has(threadKey);
				const twoColumns = notesOpen || reserveNotesSpace;
				return (
					<div
						key={`${hunk.oldRange}-${hunk.newRange}`}
						className={cn(
							"grid w-full items-start gap-x-3 max-xl:grid-cols-1",
							twoColumns
								? "xl:grid-cols-[minmax(0,1fr)_18.75rem]"
								: "xl:grid-cols-1",
						)}
					>
						{hunkIndex === 0 ? (
							<>
								<Card className="gap-0 py-0">
									<div className="flex items-center justify-between px-3.5 py-2.5">
										<span className="text-[13px] font-bold text-foreground">
											{file.path}
										</span>
										<span className="text-muted-foreground">{file.stats}</span>
									</div>
								</Card>
								{twoColumns ? <div aria-hidden="true" /> : null}
							</>
						) : null}
						{hunk.header ? (
							<>
								<Card className="gap-0 py-0">
									<div className="bg-background px-3.5 py-2 text-muted-foreground">
										{hunk.header}
									</div>
								</Card>
								{twoColumns ? <div aria-hidden="true" /> : null}
							</>
						) : null}
						<HunkDiff
							hunk={hunk}
							threadKey={threadKey}
							replying={replyingKey === threadKey}
							replyBody={replyBody}
							notesOpen={notesOpen}
							onStartReply={() => onStartReply(threadKey)}
							onCancelReply={onCancelReply}
							onReplyBody={onReplyBody}
							onSubmitReply={() => onSubmitReply(threadKey)}
							onToggleNotes={() => onToggleNotes(threadKey)}
						/>
						{notesOpen ? (
							<div className="mt-2 flex w-full shrink-0 flex-col gap-3 xl:w-75">
								{hunk.agentNotes.map((note) => (
									<ExplanationCard key={note.scope} note={note} />
								))}
							</div>
						) : reserveNotesSpace ? (
							<div
								aria-hidden="true"
								className="mt-2 w-full shrink-0 xl:w-75"
							/>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
