import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import "./index.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 10_000,
			refetchInterval: 30_000,
			retry: 1,
		},
	},
});

const root = document.getElementById("root");
if (!root) {
	throw new Error("missing #root element");
}
createRoot(root).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<ThemeProvider defaultTheme="system" storageKey="formless-hands-theme">
				<App />
			</ThemeProvider>
		</QueryClientProvider>
	</StrictMode>,
);
