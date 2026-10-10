import { FileDiff } from "./diff-file";
import type { ReviewFile } from "./types";

export function DiffViewer({
	files,
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
	files: ReviewFile[];
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
		<div className="flex w-full flex-col gap-3">
			{files.map((file, fileIndex) => (
				<FileDiff
					key={file.path}
					file={file}
					fileIndex={fileIndex}
					replyingKey={replyingKey}
					replyBody={replyBody}
					notesClosed={notesClosed}
					reserveNotesSpace={reserveNotesSpace}
					onStartReply={onStartReply}
					onCancelReply={onCancelReply}
					onReplyBody={onReplyBody}
					onSubmitReply={onSubmitReply}
					onToggleNotes={onToggleNotes}
				/>
			))}
		</div>
	);
}
