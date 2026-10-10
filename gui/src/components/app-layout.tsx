import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { BrandLogo } from "@/components/brand-logo";
import { DaemonStatus } from "@/components/daemon-status";

export function AppLayout({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className="flex min-h-screen flex-col bg-background font-mono text-xs antialiased">
			<header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background px-4">
				<nav className="flex items-center gap-5" aria-label="Primary">
					<Link to="/" aria-label="Formless Hands home">
						<BrandLogo />
					</Link>
					<Link
						to="/"
						activeProps={{ className: "text-foreground" }}
						inactiveProps={{
							className: "text-muted-foreground hover:text-foreground",
						}}
					>
						Projects
					</Link>
					<Link
						to="/settings"
						activeProps={{ className: "text-foreground" }}
						inactiveProps={{
							className: "text-muted-foreground hover:text-foreground",
						}}
					>
						Settings
					</Link>
				</nav>
				<DaemonStatus />
			</header>
			<main className={cn("flex w-full flex-1 flex-col", className)}>
				{children}
			</main>
		</div>
	);
}
