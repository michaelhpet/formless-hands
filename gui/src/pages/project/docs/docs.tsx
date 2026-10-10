import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type DeepDiveKey, DeepDivePanel } from "./deep-dive-panel";
import {
	ComponentsDiagram,
	ErDiagram,
	HealthDiagram,
	RuntimeDiagram,
} from "./diagrams";

function Section({
	title,
	active,
	onToggle,
	children,
}: {
	title: string;
	active: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}) {
	return (
		<Card className={cn("gap-0 py-0", active && "border-l-2 border-l-warning")}>
			<div className="flex items-center justify-between border-b px-3.5 pt-3 pb-2.5">
				<h2 className="tracking-wide text-muted-foreground">{title}</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onToggle}
					aria-expanded={active}
					aria-label={
						active ? `Close ${title} deep dive` : `Open ${title} deep dive`
					}
				>
					{active ? <IconArrowLeft /> : <IconArrowRight />}
				</Button>
			</div>
			{children}
		</Card>
	);
}

function SectionBody({
	description,
	refs,
	children,
}: {
	description: string;
	refs: string;
	children?: React.ReactNode;
}) {
	return (
		<>
			<div className="flex flex-col gap-1 px-3.5 pt-3 pb-1">
				<p className="text-[13px] leading-5 text-foreground">{description}</p>
				<p className="text-muted-foreground">Refs → {refs}</p>
			</div>
			{children ? <div className="p-3.5">{children}</div> : null}
		</>
	);
}

export function DocsPage() {
	const { projectId } = useParams({ strict: false });
	const [regenerating, setRegenerating] = useState(false);
	const [freshness, setFreshness] = useState(
		"Generated Oct 10 · from live repo",
	);
	const [deepDive, setDeepDive] = useState<DeepDiveKey | null>("components");
	const panelRef = useRef<HTMLDivElement>(null);

	const regenerate = () => {
		setRegenerating(true);
		window.setTimeout(() => {
			setRegenerating(false);
			setFreshness("Generated just now · from live repo");
		}, 1200);
	};

	const openDive = (key: DeepDiveKey) => {
		setDeepDive(key);
		if (key !== deepDive) {
			panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	const toggleDive = (key: DeepDiveKey) => {
		if (deepDive === key) {
			setDeepDive(null);
		} else {
			openDive(key);
		}
	};

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex w-full items-start gap-3 max-xl:flex-col">
				<div className="flex w-full min-w-0 max-w-3xl flex-1 flex-col gap-3">
					<div className="flex w-full flex-col gap-2.5 px-0.5 py-1">
						<div className="flex items-center justify-between px-0.5 py-1">
							<h1 className="tracking-wide text-muted-foreground">OVERVIEW</h1>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">{freshness}</span>
								<Button
									variant="outline"
									size="sm"
									onClick={regenerate}
									disabled={regenerating}
								>
									{regenerating ? "Regenerating…" : "Regenerate"}
								</Button>
							</div>
						</div>
						<p className="text-[15px] leading-5.5 font-bold text-foreground">
							formless-hands turns Linear and GitHub issues into merged code
							with almost no human typing.
						</p>
						<p className="text-[13px] leading-5.25 text-foreground">
							A daemon polls task sources on a cron, triages what it finds, and
							hands work to opencode agents running in isolated git worktrees.
							Every attempt is a recorded work with a transcript; reviews gate
							the merge. The GUI and API are served by the same binary over
							SQLite — one file holds projects, sources, tasks, works, and
							reviews.
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground">Scenarios →</span>
							{[
								"Issue → merged PR",
								"Blocked → human note → retry",
								"New source → first poll",
							].map((scenario) => (
								<span
									key={scenario}
									className="border bg-background px-2.5 py-1"
								>
									{scenario}
								</span>
							))}
						</div>
						<p className="text-muted-foreground">
							Refs → core/src/main.rs · core/src/db.rs · gui/src/router.tsx
						</p>
					</div>

					<Section
						title="COMPONENTS · FLOWCHART"
						active={deepDive === "components"}
						onToggle={() => toggleDive("components")}
					>
						<SectionBody
							description="Five pieces, one binary. The daemon owns the loop; the GUI is a thin view over the same SQLite file the daemon writes. Node size follows lines of code — the daemon node dominates because the loop, worker, and review logic all live in core. A red halo would mark a dependency cycle; there are none."
							refs="core/src/main.rs · core/src/poller.rs · core/src/ipc.rs · gui/src/router.tsx · Cargo.toml"
						>
							<ComponentsDiagram />
						</SectionBody>
					</Section>

					<Section
						title="DATA MODEL · ER DIAGRAM"
						active={deepDive === "data-model"}
						onToggle={() => toggleDive("data-model")}
					>
						<SectionBody
							description="The whole system is five tables. Everything hangs off tasks: sources feed them, works execute them, reviews discuss them. Foreign keys enforce ownership — a work or review cannot exist without its task. Counts are live; the schema is the contract agents code against."
							refs="core/src/db.rs (DDL + migrate) · core/src/models.rs (Task · TaskSource · Project)"
						>
							<ErDiagram />
						</SectionBody>
					</Section>

					<Section
						title="RUNTIME · SEQUENCE · EXEMPLAR WORK #128"
						active={deepDive === "runtime"}
						onToggle={() => toggleDive("runtime")}
					>
						<SectionBody
							description="One issue's journey through the loop, with real timestamps from work #128. The dotted return from the forge is the only async edge — review comments arrive on their own schedule and can send a work back. Green path to closed is the common case; red here cost one extra attempt."
							refs="core/src/main.rs · core/src/worker.rs · core/src/poller.rs · core/src/watcher.rs · work #128 transcript"
						>
							<RuntimeDiagram />
						</SectionBody>
					</Section>

					<Section
						title="HEALTH · LEAD TIME + HOTSPOTS"
						active={deepDive === "health"}
						onToggle={() => toggleDive("health")}
					>
						<SectionBody
							description="Lead time is falling as backoff fixes land — Thursday's median is a quarter of Tuesday's. Anything in the top-right of churn × complexity (currently poller.rs) gets mandatory human review before merge, no matter how green the tests are."
							refs="git log · works.started_at / finished_at · rust-code-analysis"
						>
							<HealthDiagram />
						</SectionBody>
						<div className="flex flex-col px-3.5 pb-3.5">
							{[
								{
									file: "src/poller.rs",
									stat: "14 works · complexity 18",
									hot: true,
								},
								{
									file: "core/src/db.rs",
									stat: "6 works · complexity 9",
									hot: false,
								},
								{
									file: "gui/src/pages/project",
									stat: "11 works · complexity 6",
									hot: false,
								},
							].map((row) => (
								<div
									key={row.file}
									className="flex justify-between border-b py-2 last:border-b-0"
								>
									<span className="text-foreground">{row.file}</span>
									<span
										className={
											row.hot ? "text-warning" : "text-muted-foreground"
										}
									>
										{row.stat}
									</span>
								</div>
							))}
						</div>
					</Section>

					<Section
						title="DECISIONS · ADRS · 2 THIS WEEK"
						active={deepDive === "decisions"}
						onToggle={() => toggleDive("decisions")}
					>
						<div className="flex flex-col gap-2.5 p-3.5">
							<div className="flex flex-col gap-1.5 border-l-2 border-l-success bg-background px-3 py-2.5">
								<div className="flex items-center justify-between">
									<span className="text-foreground">
										ADR-041 · backoff state lives in task metadata
									</span>
									<span className="text-success">Accepted</span>
								</div>
								<p className="text-[12px] leading-4.5 text-foreground">
									Survives repolls and worker restarts; alternative (in-memory
									delay) lost state on every crash. Touches poller · db.
								</p>
								<p className="text-muted-foreground">
									From work #128 · LIN-142
								</p>
							</div>
							<div className="flex flex-col gap-1.5 border-l-2 border-l-warning bg-background px-3 py-2.5">
								<div className="flex items-center justify-between">
									<span className="text-foreground">
										ADR-040 · single refresh helper in auth.rs
									</span>
									<span className="text-warning">Proposed</span>
								</div>
								<p className="text-[12px] leading-4.5 text-foreground">
									One path for token refresh removes the inline retry that
									caused the loop. Awaiting human sign-off.
								</p>
								<p className="text-muted-foreground">
									From work #121 · LIN-142
								</p>
							</div>
							<p className="text-muted-foreground">
								Full text lives with the work transcript — these are the
								approved summaries
							</p>
						</div>
					</Section>
				</div>

				{deepDive ? (
					<div
						ref={panelRef}
						className="w-full shrink-0 scroll-mt-16 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:w-[46%] xl:overflow-y-auto"
					>
						<DeepDivePanel
							diveKey={deepDive}
							projectId={projectId ?? ""}
							onClose={() => setDeepDive(null)}
							onNavigate={openDive}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
