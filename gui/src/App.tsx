import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./index.css";

export const App = () => {
	return <RouterProvider router={router} />;
};
