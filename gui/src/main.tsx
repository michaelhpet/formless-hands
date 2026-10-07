import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("missing #root element");
}
createRoot(root).render(
	<StrictMode>
		<ThemeProvider defaultTheme="system" storageKey="formless-hands-theme">
			<App />
		</ThemeProvider>
	</StrictMode>,
);
