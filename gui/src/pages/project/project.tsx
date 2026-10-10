import { IconArrowLeft, IconSearch } from "@tabler/icons-react";
import {
	Link,
	Outlet,
	useCanGoBack,
	useNavigate,
	useParams,
	useRouter,
} from "@tanstack/react-router";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand-logo";
import { DaemonStatus } from "@/components/daemon-status";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { INITIAL_PROJECTS } from "@/pages/home";

const TABS = [
	{ to: "/$projectId/tasks", label: "Tasks" },
	{ to: "/$projectId/works", label: "Works" },
	{ to: "/$projectId/docs", label: "Docs" },
	{ to: "/$projectId/settings", label: "Settings" },
] as const;

export function ProjectLayout() {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const router = useRouter();
	const canGoBack = useCanGoBack();
	const project = INITIAL_PROJECTS.find((item) => item.id === projectId);

	const goBack = () => {
		if (canGoBack) {
			router.history.back();
		} else {
			navigate({ to: "/" });
		}
	};

	return (
		<div className="flex min-h-screen flex-col bg-background font-mono text-xs antialiased">
			<header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b bg-background px-4 py-2.5">
				<div className="flex min-w-0 items-center gap-5">
					<Link to="/" aria-label="Formless Hands home">
						<BrandLogo />
					</Link>
					<Select
						value={project?.id}
						onValueChange={(id) => {
							if (id) {
								navigate({
									to: "/$projectId/tasks",
									params: { projectId: id },
								});
							}
						}}
					>
						<SelectTrigger aria-label="Select project">
							<span
								className={cn(
									"size-1.5 rounded-full",
									project?.status === "error" ? "bg-destructive" : "bg-success",
								)}
								aria-hidden="true"
							/>
							<SelectValue placeholder="Select project" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>Projects</SelectLabel>
								{INITIAL_PROJECTS.map((item) => (
									<SelectItem key={item.id} value={item.id}>
										{item.name}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<nav className="flex items-center gap-5" aria-label="Project">
						<button
							type="button"
							onClick={goBack}
							aria-label="Go back"
							className="flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<IconArrowLeft className="size-4" />
						</button>
						{TABS.map((tab) => (
							<Link
								key={tab.to}
								to={tab.to}
								params={{ projectId: projectId ?? "" }}
								activeProps={{ className: "text-foreground" }}
								inactiveProps={{
									className: "text-muted-foreground hover:text-foreground",
								}}
								className="text-[13px]"
							>
								{tab.label}
							</Link>
						))}
					</nav>
				</div>
				<div className="flex items-center gap-2.5">
					<DaemonStatus />
				</div>
			</header>
			<main className="flex w-full flex-1 flex-col">
				{project ? (
					<Outlet />
				) : (
					<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<IconSearch />
								</EmptyMedia>
								<EmptyTitle>Project not found</EmptyTitle>
								<EmptyDescription>
									No project with id “{projectId}” is tracked.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					</div>
				)}
			</main>
		</div>
	);
}
