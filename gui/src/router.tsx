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
	TaskDetailPage,
	TaskReviewPage,
	TasksPage,
	WorkDetailPage,
	WorksPage,
} from "./pages/project";
import type { TaskStatus } from "./pages/project/tasks/tasks-data";
import type { WorkSort, WorkStatus } from "./pages/project/works/works-data";

export interface ProjectsSearch {
	q?: string;
	status?: "connected" | "error";
	page?: number;
}

export interface TasksSearch {
	q?: string;
	source?: "linear" | "github";
	status?: TaskStatus;
	view?: "kanban" | "table";
	page?: number;
}

export interface WorksSearch {
	q?: string;
	status?: WorkStatus;
	sort?: WorkSort;
	worktree?: string;
	page?: number;
}

function parseText(value: unknown): string | undefined {
	return typeof value === "string" && value !== "" ? value : undefined;
}

function parsePage(value: unknown): number | undefined {
	const n =
		typeof value === "number"
			? value
			: typeof value === "string" && value !== ""
				? Number(value)
				: Number.NaN;
	return Number.isInteger(n) && n >= 1 ? n : undefined;
}

const TASK_STATUSES: TaskStatus[] = [
	"open",
	"triaged",
	"in-progress",
	"completed",
	"in-review",
	"blocked",
	"needs-context",
	"merged",
	"closed",
];

const WORK_STATUSES: WorkStatus[] = ["running", "success", "failed"];
const WORK_SORTS: WorkSort[] = ["started", "duration", "exit"];

import { SettingsPage } from "./pages/settings";

const rootRoute = createRootRoute({
	component: () => <Outlet />,
});

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
	validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
		q: parseText(search.q),
		status:
			search.status === "connected" || search.status === "error"
				? search.status
				: undefined,
		page: parsePage(search.page),
	}),
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsPage,
});

const projectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/$projectId",
	component: ProjectLayout,
});

function ProjectIndexRedirect() {
	const { projectId } = useParams({ strict: false });
	return (
		<Navigate
			to="/$projectId/tasks"
			params={{ projectId: projectId ?? "" }}
			replace
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
	validateSearch: (search: Record<string, unknown>): TasksSearch => ({
		q: parseText(search.q),
		source:
			search.source === "linear" || search.source === "github"
				? search.source
				: undefined,
		status:
			typeof search.status === "string" &&
			(TASK_STATUSES as string[]).includes(search.status)
				? (search.status as TaskStatus)
				: undefined,
		view:
			search.view === "kanban" || search.view === "table"
				? search.view
				: undefined,
		page: parsePage(search.page),
	}),
});

const taskDetailRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/tasks/$taskId",
	component: TaskDetailPage,
});

const taskReviewRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/tasks/$taskId/review",
	component: TaskReviewPage,
});

const worksRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/works",
	component: WorksPage,
	validateSearch: (search: Record<string, unknown>): WorksSearch => ({
		q: parseText(search.q),
		status:
			typeof search.status === "string" &&
			(WORK_STATUSES as string[]).includes(search.status)
				? (search.status as WorkStatus)
				: undefined,
		sort:
			typeof search.sort === "string" &&
			(WORK_SORTS as string[]).includes(search.sort)
				? (search.sort as WorkSort)
				: undefined,
		worktree: parseText(search.worktree),
		page: parsePage(search.page),
	}),
});

const workDetailRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: "/works/$workId",
	component: WorkDetailPage,
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
		taskDetailRoute,
		taskReviewRoute,
		worksRoute,
		workDetailRoute,
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
