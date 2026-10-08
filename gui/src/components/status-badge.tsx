import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export type StatusKind =
	| "connected"
	| "error"
	| "running"
	| "success"
	| "failed"
	| "online";

const dotStyles: Record<StatusKind, string> = {
	connected: "bg-success",
	error: "bg-destructive",
	running: "bg-warning",
	success: "bg-success",
	failed: "bg-destructive",
	online: "bg-success",
};

const textStyles: Record<StatusKind, string> = {
	connected: "text-success",
	error: "text-destructive",
	running: "text-warning",
	success: "text-success",
	failed: "text-destructive",
	online: "text-success",
};

export function StatusBadge({
	status,
	className,
}: {
	status: StatusKind;
	className?: string;
}) {
	return (
		<Badge variant="outline" className={cn("gap-1.5", className)}>
			<span
				className={cn("size-1.5 rounded-full", dotStyles[status])}
				aria-hidden="true"
			/>
			<span className={textStyles[status]}>{status}</span>
		</Badge>
	);
}
