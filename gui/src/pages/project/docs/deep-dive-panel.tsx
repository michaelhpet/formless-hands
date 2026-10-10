import { IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocsFigure } from "./diagrams";
import type { DeepDive, FigureKind } from "./docs-data";

function DeepDiveFigure({
	figure,
	caption,
}: {
	figure: FigureKind;
	caption: string;
}) {
	return (
		<div className="flex flex-col gap-1">
			<DocsFigure kind={figure} />
			<p className="text-muted-foreground">{caption}</p>
		</div>
	);
}

export function DeepDivePanel({
	diveKey,
	projectId,
	deepDives,
	onClose,
	onNavigate,
}: {
	diveKey: string;
	projectId: string;
	deepDives: Record<string, DeepDive>;
	onClose: () => void;
	onNavigate: (key: string) => void;
}) {
	const dive = deepDives[diveKey];
	if (!dive) {
		return null;
	}
	return (
		<Card className="gap-3 p-3.5">
			<div className="flex items-center justify-between border-b pb-2.5">
				<h2 className="tracking-wide text-muted-foreground">{dive.title}</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label={`Close ${dive.title}`}
				>
					<IconX />
				</Button>
			</div>
			<p className="text-[15px] leading-5.5 font-bold text-foreground">
				{dive.lead}
			</p>
			{dive.blocks.map((block) =>
				block.kind === "figure" ? (
					<DeepDiveFigure
						key={`figure-${block.figure}`}
						figure={block.figure}
						caption={block.caption}
					/>
				) : (
					<div
						key={`prose-${block.heading ?? block.paragraphs[0].slice(0, 32)}`}
						className="flex flex-col gap-1.5"
					>
						{block.heading ? (
							<h3 className="tracking-wide text-muted-foreground">
								{block.heading}
							</h3>
						) : null}
						{block.paragraphs.map((paragraph) => (
							<p
								key={paragraph.slice(0, 32)}
								className="text-[13px] leading-5 text-foreground"
							>
								{paragraph}
							</p>
						))}
					</div>
				),
			)}
			<div className="flex flex-col gap-1.5">
				<p className="text-muted-foreground">Refs: {dive.refs}</p>
				<div className="flex flex-wrap gap-1.5">
					{dive.links.map((link) => (
						<button
							key={link.label}
							type="button"
							onClick={() => onNavigate(link.dive)}
							className="cursor-pointer border bg-background px-2.5 py-1 text-foreground hover:border-ring"
						>
							{link.label}
						</button>
					))}
					{dive.taskRef ? (
						<Link
							to="/$projectId/tasks/$taskId"
							params={{ projectId, taskId: dive.taskRef }}
							className="border bg-background px-2.5 py-1 text-foreground hover:border-ring"
						>
							{dive.taskRef}
						</Link>
					) : null}
					{dive.workId ? (
						<Link
							to="/$projectId/works/$workId"
							params={{ projectId, workId: String(dive.workId) }}
							className="border bg-background px-2.5 py-1 text-foreground hover:border-ring"
						>
							Work #{dive.workId}
						</Link>
					) : null}
					{dive.staticChips?.map((chip) => (
						<span
							key={chip}
							className="border bg-background px-2.5 py-1 text-muted-foreground"
						>
							{chip}
						</span>
					))}
				</div>
			</div>
		</Card>
	);
}
