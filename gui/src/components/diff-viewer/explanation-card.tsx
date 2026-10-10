import { IconSparkles } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentNote } from "./types";

export function ExplanationCard({ note }: { note: AgentNote }) {
	return (
		<Card className="border-l-2 border-l-warning py-3">
			<CardContent className="flex gap-2.5">
				<IconSparkles
					aria-hidden="true"
					className="size-4 shrink-0 text-warning"
				/>
				<span className="flex flex-col gap-1">
					<span className="tracking-wide text-muted-foreground">
						{note.scope}
					</span>
					<span className="text-[13px] leading-snug text-foreground">
						{note.body}
					</span>
					{note.source ? (
						<span className="text-muted-foreground">{note.source}</span>
					) : null}
				</span>
			</CardContent>
		</Card>
	);
}
