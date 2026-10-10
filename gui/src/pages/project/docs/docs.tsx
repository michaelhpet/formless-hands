import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DocsSearch } from "@/router";
import { DeepDivePanel } from "./deep-dive-panel";
import { DocsFigure } from "./diagrams";
import {
	type AdrCard,
	type DocsSection,
	getProjectDocs,
	type HotspotRow,
} from "./docs-data";

function Section({
	title,
	active,
	onToggle,
	children,
}: {
	title: string;
	active: boolean;
	onToggle: (() => void) | null;
	children: React.ReactNode;
}) {
	return (
		<Card className={cn("gap-0 py-0", active && "border-l-2 border-l-warning")}>
			<div className="flex items-center justify-between border-b px-3.5 pt-3 pb-2.5">
				<h2 className="tracking-wide text-muted-foreground">{title}</h2>
				{onToggle ? (
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
				) : null}
			</div>
			{children}
		</Card>
	);
}

function HotspotList({ rows }: { rows: HotspotRow[] }) {
	return (
		<div className="flex flex-col px-3.5 pb-3.5">
			{rows.map((row) => (
				<div
					key={row.file}
					className="flex justify-between border-b py-2 last:border-b-0"
				>
					<span className="text-foreground">{row.file}</span>
					<span className={row.hot ? "text-warning" : "text-muted-foreground"}>
						{row.stat}
					</span>
				</div>
			))}
		</div>
	);
}

function AdrList({ cards, footer }: { cards: AdrCard[]; footer?: string }) {
	return (
		<div className="flex flex-col gap-2.5 p-3.5">
			{cards.map((card) => (
				<div
					key={card.title}
					className={cn(
						"flex flex-col gap-1.5 border-l-2 bg-background px-3 py-2.5",
						card.state === "accepted" ? "border-l-success" : "border-l-warning",
					)}
				>
					<div className="flex items-center justify-between">
						<span className="text-foreground">{card.title}</span>
						<span
							className={
								card.state === "accepted" ? "text-success" : "text-warning"
							}
						>
							{card.state === "accepted" ? "Accepted" : "Proposed"}
						</span>
					</div>
					<p className="text-[12px] leading-4.5 text-foreground">{card.body}</p>
					<p className="text-muted-foreground">{card.from}</p>
				</div>
			))}
			{footer ? <p className="text-muted-foreground">{footer}</p> : null}
		</div>
	);
}

function SectionBody({ section }: { section: DocsSection }) {
	return (
		<>
			{section.description ? (
				<div className="flex flex-col gap-1 px-3.5 pt-3 pb-1">
					<p className="text-[13px] leading-5 text-foreground">
						{section.description}
					</p>
					{section.refs ? (
						<p className="text-muted-foreground">Refs → {section.refs}</p>
					) : null}
				</div>
			) : null}
			{section.figure ? (
				<div className="p-3.5">
					<DocsFigure kind={section.figure} />
				</div>
			) : null}
			{section.hotspots ? <HotspotList rows={section.hotspots} /> : null}
			{section.adrs ? (
				<AdrList cards={section.adrs} footer={section.footer} />
			) : null}
		</>
	);
}

export function DocsPage() {
	const { projectId } = useParams({ strict: false });
	const docs = getProjectDocs(projectId ?? "");
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/docs" });
	const [regenerating, setRegenerating] = useState(false);
	const [freshness, setFreshness] = useState(
		"Generated Oct 10 · from live repo",
	);
	const panelRef = useRef<HTMLDivElement>(null);

	const deepDive = search.deepdive ?? null;

	const updateSearch = (patch: Partial<DocsSearch>) => {
		navigate({
			from: "/$projectId/docs",
			search: (prev) => ({ ...prev, ...patch }),
			replace: true,
		});
	};
	const setDeepDive = (value: string | null) => {
		updateSearch({ deepdive: value ?? undefined });
	};

	const regenerate = () => {
		setRegenerating(true);
		window.setTimeout(() => {
			setRegenerating(false);
			setFreshness("Generated just now · from live repo");
		}, 1200);
	};

	const scrollToPanel = () => {
		panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	const openDive = (key: string) => {
		if (key !== deepDive) {
			setDeepDive(key);
			scrollToPanel();
		}
	};

	const toggleDive = (key: string) => {
		if (deepDive === key) {
			setDeepDive(null);
		} else {
			setDeepDive(key);
			scrollToPanel();
		}
	};

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex w-full items-start gap-3 max-xl:flex-col">
				<div className="flex w-full flex-col gap-3 xl:w-3xl xl:shrink-0">
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
							{docs.overview.lead}
						</p>
						<p className="text-[13px] leading-5.25 text-foreground">
							{docs.overview.body}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-muted-foreground">Scenarios →</span>
							{docs.overview.scenarios.map((scenario) => (
								<span
									key={scenario}
									className="border bg-background px-2.5 py-1"
								>
									{scenario}
								</span>
							))}
						</div>
						<p className="text-muted-foreground">Refs → {docs.overview.refs}</p>
					</div>

					{docs.sections.map((section) => (
						<Section
							key={section.key}
							title={section.title}
							active={deepDive === section.deepDiveKey}
							onToggle={
								section.deepDiveKey
									? () => toggleDive(section.deepDiveKey as string)
									: null
							}
						>
							<SectionBody section={section} />
						</Section>
					))}
				</div>

				{deepDive && docs.deepDives[deepDive] ? (
					<div
						ref={panelRef}
						className="w-full min-w-0 flex-1 scroll-mt-16 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto"
					>
						<DeepDivePanel
							diveKey={deepDive}
							projectId={projectId ?? ""}
							deepDives={docs.deepDives}
							onClose={() => setDeepDive(null)}
							onNavigate={openDive}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
