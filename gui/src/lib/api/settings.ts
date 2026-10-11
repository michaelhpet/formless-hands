import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "./config";

export const CONFIG_QUERY_KEY = "config";

export interface AppConfig {
	service: {
		poll_cron: string;
		watch_cron: string;
		max_concurrent_workers: number;
	};
	server: {
		port: number;
	};
}

function getConfig(): Promise<AppConfig> {
	return request<AppConfig>("/api/config");
}

export function useConfig() {
	return useQuery({
		queryKey: [CONFIG_QUERY_KEY],
		queryFn: getConfig,
	});
}

function saveConfig(config: AppConfig): Promise<unknown> {
	return request("/api/config", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config),
	});
}

export function useSaveConfig() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: saveConfig,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: [CONFIG_QUERY_KEY] });
		},
	});
}
