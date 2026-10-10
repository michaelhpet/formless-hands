import { cn } from "cn";
import type { DiffLine } from "./types";

export const LINE_STYLES: Record<DiffLine["kind"], string> = {
	context: "text-muted-foreground",
	removed: "bg-destructive/10 text-destructive",
	added: "bg-success/10 text-success",
};

export function DiffLines({ lines }: { lines: DiffLine[] }) {
	return (
		<div className="flex min-w-0 flex-1 grow basis-0 flex-col">
			{lines.map((line) => (
				<div
					key={line.no}
					className={cn("flex font-mono", LINE_STYLES[line.kind])}
				>
					<span className="inline-block w-9 shrink-0 text-right text-[12px] leading-tight text-muted-foreground">
						{line.no}
					</span>
					<span className="inline-block pl-3">
						<span className="inline-block w-max whitespace-pre text-[12px] leading-tight">
							{line.text}
						</span>
					</span>
				</div>
			))}
		</div>
	);
}
