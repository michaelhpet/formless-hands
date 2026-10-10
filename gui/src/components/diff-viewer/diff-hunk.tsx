import { IconSparkles } from "@tabler/icons-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DiffLines, LINE_STYLES } from "./diff-lines";
import { ThreadBox } from "./review-thread";
import type { DiffHunk } from "./types";

export function HunkDiff({
	hunk,
	threadKey,
	replying,
	replyBody,
	notesOpen,
	onStartReply,
	onCancelReply,
	onReplyBody,
	onSubmitReply,
	onToggleNotes,
}: {
	hunk: DiffHunk;
	threadKey: string;
	replying: boolean;
	replyBody: string;
	notesOpen: boolean;
	onStartReply: () => void;
	onCancelReply: () => void;
	onReplyBody: (value: string) => void;
	onSubmitReply: () => void;
	onToggleNotes: () => void;
}) {
	return (
		<Card className="min-w-0 gap-0 py-0">
			<div
				className={cn("relative flex", hunk.agentNotes.length > 0 && "pr-10")}
			>
				{hunk.agentNotes.length > 0 ? (
					<Button
						variant="ghost"
						size="icon-xs"
						aria-pressed={notesOpen}
						aria-label={notesOpen ? "Hide explanation" : "Show explanation"}
						title={notesOpen ? "Hide explanation" : "Show explanation"}
						onClick={onToggleNotes}
						className={cn(
							"absolute top-2 right-2",
							notesOpen ? "text-warning" : "text-muted-foreground",
						)}
					>
						<IconSparkles />
					</Button>
				) : null}
				<div className="min-w-0 grow basis-0 border-r">
					<DiffLines lines={hunk.oldLines} />
				</div>
				<div className="min-w-0 grow basis-0">
					{hunk.newLines.map((line) => (
						<div key={`wrap-${line.no}`}>
							<div className={cn("flex font-mono", LINE_STYLES[line.kind])}>
								<span className="inline-block w-9 shrink-0 text-right text-[12px] leading-tight text-muted-foreground">
									{line.no}
								</span>
								<span className="inline-block pl-3">
									<span className="inline-block w-max whitespace-pre text-[12px] leading-tight">
										{line.text}
									</span>
								</span>
							</div>
							{hunk.thread && hunk.threadAfterNewLine === line.no ? (
								<div className="p-3">
									<ThreadBox
										id={`thread-${threadKey}`}
										thread={hunk.thread}
										replying={replying}
										replyBody={replyBody}
										onStartReply={onStartReply}
										onCancelReply={onCancelReply}
										onReplyBody={onReplyBody}
										onSubmitReply={onSubmitReply}
									/>
								</div>
							) : null}
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}
