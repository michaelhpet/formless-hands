import { format } from "date-fns";

export function parseUtcStamp(stamp: string): Date {
	return new Date(`${stamp.replace(" ", "T")}Z`);
}

export function formatStamp(stamp: string): string {
	const date = parseUtcStamp(stamp);
	if (Number.isNaN(date.getTime())) {
		return stamp;
	}
	return format(date, "MMM d, HH:mm");
}
