import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSources } from "@/lib/api/sources";
import { parseUtcStamp } from "@/lib/datetime";

function lastPollText(stamps: (string | null)[]): string {
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
	const text = sourcesQuery.isLoading
		? "Loading…"
		: lastPollText((sourcesQuery.data ?? []).map((s) => s.last_polled_at));

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Badge variant="outline" className={cn("gap-1.5", className)}>
						<span
							className="size-1.5 rounded-full bg-success"
							aria-hidden="true"
						/>
						Daemon rampant
					</Badge>
				}
			/>
			<TooltipContent>{text}</TooltipContent>
		</Tooltip>
	);
}
