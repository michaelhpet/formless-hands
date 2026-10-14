import { RouterProvider } from "@tanstack/react-router";
import { Toaster } from "./components/ui/toast";
import { usePipelineEvents } from "./lib/api/events";
import { router, routerRemountKey } from "./router";
import "./index.css";

const LiveSubscription = () => {
	usePipelineEvents();
	return null;
};

export const App = () => {
	return (
		<>
			<LiveSubscription />
			<RouterProvider key={routerRemountKey()} router={router} />
			<Toaster />
		</>
	);
};
