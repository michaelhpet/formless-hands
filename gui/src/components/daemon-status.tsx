import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSources } from "@/lib/api/sources";
import { parseUtcStamp } from "@/lib/datetime";

export function lastPollText(stamps: (string | null)[]): string {
	const times = stamps
		.filter((stamp): stamp is string => stamp !== null && stamp !== "")
		.map((stamp) => parseUtcStamp(stamp).getTime())
		.filter((time) => Number.isFinite(time))
		.sort();
	if (times.length === 0) {
		return "Never polled";
	}
	const minutes = Math.max(
		0,
		Math.round((Date.now() - times[times.length - 1]) / 60000),
	);
	if (minutes < 1) {
		return "Last poll just now";
	}
	if (minutes < 60) {
		return `Last poll ${minutes}m ago`;
	}
	const hours = Math.round(minutes / 60);
	if (hours < 48) {
		return `Last poll ${hours}h ago`;
	}
	return `Last poll ${Math.round(hours / 24)}d ago`;
}

export function DaemonStatus({ className }: { className?: string }) {
	const sourcesQuery = useSources();
	const sources = sourcesQuery.data ?? [];
	const failing = sources.filter(
		(source) => source.last_error.trim() !== "",
	).length;
	const text = sourcesQuery.isLoading
		? "Loading…"
		: sourcesQuery.isError
			? "Couldn't reach daemon"
			: lastPollText(sources.map((s) => s.last_polled_at));
	const dot =
		sourcesQuery.isError || failing > 0 ? "bg-destructive" : "bg-success";
	const label =
		sourcesQuery.isError || failing > 0 ? "Daemon attention" : "Daemon rampant";

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Badge variant="outline" className={cn("gap-1.5", className)}>
						<span
							className={cn("size-1.5 rounded-full", dot)}
							aria-hidden="true"
						/>
						{label}
					</Badge>
				}
			/>
			<TooltipContent>
				{failing > 0 ? `${failing} source(s) failing · ` : null}
				{text}
			</TooltipContent>
		</Tooltip>
	);
}
