import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	root: "./gui",
	base: "./",
	server: {
		proxy: {
			"/api": "http://127.0.0.1:7770",
		},
	},
});
