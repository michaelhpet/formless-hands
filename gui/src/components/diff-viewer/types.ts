export type DiffKind = "context" | "removed" | "added";

export interface DiffLine {
	no: number;
	text: string;
	kind: DiffKind;
}

export interface ReviewReply {
	author: string;
	age: string;
	body: string;
}

export interface ReviewThread {
	author: string;
	path: string;
	state: "open" | "resolved";
	body: string;
	age: string;
	replies: ReviewReply[];
}

export interface AgentNote {
	scope: string;
	body: string;
	source?: string;
}

export interface DiffHunk {
	oldRange: string;
	newRange: string;
	header?: string;
	oldLines: DiffLine[];
	newLines: DiffLine[];
	thread?: ReviewThread;
	threadAfterNewLine?: number;
	agentNotes: AgentNote[];
}

export interface ReviewFile {
	path: string;
	stats: string;
	hunks: DiffHunk[];
}
