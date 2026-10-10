import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export function DaemonStatus({ className }: { className?: string }) {
	return (
		<Badge variant="outline" className={cn("gap-1.5", className)}>
			<span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
			Daemon rampant
		</Badge>
	);
}
