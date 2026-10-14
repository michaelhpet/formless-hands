import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";

function messageOf(error: unknown): string | null {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string" && error.trim() !== "") {
		return error;
	}
	return null;
}

export function errorMessage(error: unknown): string {
	return messageOf(error) ?? "unknown error";
}

export function useErrorToast(error: unknown, title: string) {
	const lastToasted = useRef<string | null>(null);
	useEffect(() => {
		if (!error) {
			return;
		}
		const message = messageOf(error);
		if (message === null || lastToasted.current === message) {
			return;
		}
		lastToasted.current = message;
		toast.add({ type: "error", title, description: message });
	}, [error, title]);
}
