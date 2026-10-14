import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SOURCES_QUERY_KEY } from "./sources";
import { REVIEWS_QUERY_KEY, TASKS_QUERY_KEY } from "./tasks";
import { WORKS_QUERY_KEY } from "./works";

export interface PipelineEvent {
	seq: number;
	kind: string;
	project_id: number | null;
	task_id: number | null;
	work_id: number | null;
	message: string;
}

function parsePayload(raw: string): PipelineEvent | null {
	try {
		return JSON.parse(raw) as PipelineEvent;
	} catch {
		return null;
	}
}

export function usePipelineEvents() {
	const queryClient = useQueryClient();

	useEffect(() => {
		let source: EventSource | null = null;
		let retries = 0;
		let timer: ReturnType<typeof setTimeout> | null = null;
		let disposed = false;

		const invalidateFor = (event: PipelineEvent) => {
			switch (event.kind) {
				case "poll.finished":
					void queryClient.invalidateQueries({ queryKey: [SOURCES_QUERY_KEY] });
					void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
					break;
				case "triage.promoted":
				case "triage.finished":
					void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
					break;
				case "work.started":
				case "work.finished":
				case "work.blocked":
				case "work.timeout":
				case "work.correction":
					void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
					void queryClient.invalidateQueries({ queryKey: [WORKS_QUERY_KEY] });
					break;
				case "review.ready":
				case "review.decision":
					void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
					void queryClient.invalidateQueries({ queryKey: [REVIEWS_QUERY_KEY] });
					break;
				case "work.merged":
				case "work.pr_ready":
				case "watch.finished":
				case "tick.done":
					void queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
					void queryClient.invalidateQueries({ queryKey: [WORKS_QUERY_KEY] });
					void queryClient.invalidateQueries({ queryKey: [SOURCES_QUERY_KEY] });
					break;
				default:
					break;
			}
		};

		const connect = () => {
			if (disposed) {
				return;
			}
			source = new EventSource("/api/events");
			source.onmessage = (message) => {
				retries = 0;
				const event = parsePayload(message.data);
				if (event !== null) {
					invalidateFor(event);
				}
			};
			source.onerror = () => {
				source?.close();
				source = null;
				retries += 1;
				const delay = Math.min(1000 * 2 ** retries, 15000);
				timer = setTimeout(connect, delay);
			};
		};

		const onVisible = () => {
			if (document.visibilityState === "visible" && source === null) {
				connect();
			}
		};
		document.addEventListener("visibilitychange", onVisible);
		connect();

		return () => {
			disposed = true;
			document.removeEventListener("visibilitychange", onVisible);
			if (timer !== null) {
				clearTimeout(timer);
			}
			source?.close();
		};
	}, [queryClient]);
}
