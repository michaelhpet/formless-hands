import { RouterProvider } from "@tanstack/react-router";
import { router, routerRemountKey } from "./router";
import "./index.css";

export const App = () => {
	return <RouterProvider key={routerRemountKey()} router={router} />;
};
