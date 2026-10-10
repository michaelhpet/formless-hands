import {
	createRootRoute,
	createRoute,
	createRouter,
	Navigate,
	Outlet,
	useParams,
} from "@tanstack/react-router";
import { HomePage } from "./pages/home";
import {
	DocsPage,
	ProjectLayout,
	ProjectSettingsPage,
	TasksPage,
	WorksPage,
} from "./pages/project";
import { SettingsPage } from "./pages/settings";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsPage,
});

const projectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/project/$projectId",
	component: ProjectLayout,
});

function ProjectIndexRedirect() {
	const { projectId } = useParams({ strict: false });
	return (
		<Navigate
			to="/project/$projectId/tasks"
			params={{ projectId: projectId ?? "" }}
		/>
	);
}

const projectIndexRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/",
	component: ProjectIndexRedirect,
});

const tasksRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/tasks",
	component: TasksPage,
});

const worksRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/works",
	component: WorksPage,
});

const docsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/docs",
	component: DocsPage,
});

const projectSettingsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/settings",
	component: ProjectSettingsPage,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	settingsRoute,
	projectRoute.addChildren([
		projectIndexRoute,
		tasksRoute,
		worksRoute,
		docsRoute,
		projectSettingsRoute,
	]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const routerRemountKeys = new WeakMap<object, string>();

export function routerRemountKey(): string {
	let key = routerRemountKeys.get(router);
	if (!key) {
		key = Math.random().toString(36).slice(2);
		routerRemountKeys.set(router, key);
	}
	return key;
}
