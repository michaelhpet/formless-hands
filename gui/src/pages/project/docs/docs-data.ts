export type FigureKind = "components" | "runtime" | "er" | "health";

export interface HotspotRow {
	file: string;
	stat: string;
	hot: boolean;
}

export interface AdrCard {
	title: string;
	state: "accepted" | "proposed";
	body: string;
	from: string;
}

export interface DocsSection {
	key: string;
	title: string;
	description: string;
	refs: string;
	figure: FigureKind | null;
	hotspots?: HotspotRow[];
	adrs?: AdrCard[];
	footer?: string;
	deepDiveKey?: string;
}

export interface DocsOverview {
	lead: string;
	body: string;
	scenarios: string[];
	refs: string;
}

export type DeepDiveBlock =
	| { kind: "prose"; heading?: string; paragraphs: string[] }
	| { kind: "figure"; figure: FigureKind; caption: string };

export interface DeepDiveLink {
	label: string;
	dive: string;
}

export interface DeepDive {
	key: string;
	title: string;
	lead: string;
	blocks: DeepDiveBlock[];
	refs: string;
	links: DeepDiveLink[];
	staticChips?: string[];
	taskRef?: string;
	workId?: number;
}

export interface ProjectDocs {
	overview: DocsOverview;
	sections: DocsSection[];
	deepDives: Record<string, DeepDive>;
}

const FORMLESS_HANDS_DOCS: ProjectDocs = {
	overview: {
		lead: "formless-hands turns Linear and GitHub issues into merged code with almost no human typing.",
		body: "A daemon polls task sources on a cron, triages what it finds, and hands work to opencode agents running in isolated git worktrees. Every attempt is a recorded work with a transcript; reviews gate the merge. The GUI and API are served by the same binary over SQLite — one file holds projects, sources, tasks, works, and reviews.",
		scenarios: [
			"Issue → merged PR",
			"Blocked → human note → retry",
			"New source → first poll",
		],
		refs: "core/src/main.rs · core/src/db.rs · gui/src/router.tsx",
	},
	sections: [
		{
			key: "components",
			title: "COMPONENTS · FLOWCHART",
			description:
				"Five pieces, one binary. The daemon owns the loop; the GUI is a thin view over the same SQLite file the daemon writes. Node size follows lines of code — the daemon node dominates because the loop, worker, and review logic all live in core. A red halo would mark a dependency cycle; there are none.",
			refs: "core/src/main.rs · core/src/poller.rs · core/src/ipc.rs · gui/src/router.tsx · Cargo.toml",
			figure: "components",
			deepDiveKey: "components",
		},
		{
			key: "data-model",
			title: "DATA MODEL · ER DIAGRAM",
			description:
				"The whole system is five tables. Everything hangs off tasks: sources feed them, works execute them, reviews discuss them. Foreign keys enforce ownership — a work or review cannot exist without its task. Counts are live; the schema is the contract agents code against.",
			refs: "core/src/db.rs (DDL + migrate) · core/src/models.rs (Task · TaskSource · Project)",
			figure: "er",
			deepDiveKey: "data-model",
		},
		{
			key: "runtime",
			title: "RUNTIME · SEQUENCE · EXEMPLAR WORK #128",
			description:
				"One issue's journey through the loop, with real timestamps from work #128. The dotted return from the forge is the only async edge — review comments arrive on their own schedule and can send a work back. Green path to closed is the common case; red here cost one extra attempt.",
			refs: "core/src/main.rs · core/src/worker.rs · core/src/poller.rs · core/src/watcher.rs · work #128 transcript",
			figure: "runtime",
			deepDiveKey: "runtime",
		},
		{
			key: "health",
			title: "HEALTH · LEAD TIME + HOTSPOTS",
			description:
				"Lead time is falling as backoff fixes land — Thursday's median is a quarter of Tuesday's. Anything in the top-right of churn × complexity (currently poller.rs) gets mandatory human review before merge, no matter how green the tests are.",
			refs: "git log · works.started_at / finished_at · rust-code-analysis",
			figure: "health",
			hotspots: [
				{ file: "src/poller.rs", stat: "14 works · complexity 18", hot: true },
				{ file: "core/src/db.rs", stat: "6 works · complexity 9", hot: false },
				{
					file: "gui/src/pages/project",
					stat: "11 works · complexity 6",
					hot: false,
				},
			],
			deepDiveKey: "health",
		},
		{
			key: "decisions",
			title: "DECISIONS · ADRS · 2 THIS WEEK",
			description: "",
			refs: "",
			figure: null,
			adrs: [
				{
					title: "ADR-041 · backoff state lives in task metadata",
					state: "accepted",
					body: "Survives repolls and worker restarts; alternative (in-memory delay) lost state on every crash. Touches poller · db.",
					from: "From work #128 · LIN-142",
				},
				{
					title: "ADR-040 · single refresh helper in auth.rs",
					state: "proposed",
					body: "One path for token refresh removes the inline retry that caused the loop. Awaiting human sign-off.",
					from: "From work #121 · LIN-142",
				},
			],
			footer:
				"Full text lives with the work transcript — these are the approved summaries",
			deepDiveKey: "decisions",
		},
	],
	deepDives: {
		components: {
			key: "components",
			title: "COMPONENTS · DEEP-DIVE",
			lead: "Five pieces, one binary. The daemon owns the loop; the GUI is a thin view over the same SQLite file the daemon writes.",
			blocks: [
				{
					kind: "prose",
					heading: "THE PIECES",
					paragraphs: [
						"The GUI is 38 Vite + TypeScript files and nothing else — no business logic, just a view. It talks to three axum routes on :7770, and both are served by the core binary. The daemon itself is 11 modules under main.rs: poller, triage, worker, review, merge. Every attempt runs through the opencode CLI in its own worktree, and task sources — Linear and GitHub — are polled hourly.",
						"Under it all, one SQLite file in WAL mode holds projects, sources, tasks, works, and reviews. The GUI never touches the network for data; it reads the same rows the daemon writes.",
					],
				},
				{
					kind: "figure",
					figure: "components",
					caption:
						"Fig. 1 — five pieces, one binary · node size follows lines of code",
				},
				{
					kind: "prose",
					heading: "WHERE THE CODE LIVES",
					paragraphs: [
						"The daemon's 11 modules live under core/src/main.rs: the poller that watches sources, triage that orders the queue, the worker that runs attempts, and the review gate before merge. Persistence and migration sit in core/src/db.rs; the daemon speaks to the outside world through core/src/ipc.rs.",
						"The GUI is 38 files under gui/src — routing in router.tsx, one page per project tab. It never imports core; the only shared language is the database schema.",
					],
				},
				{
					kind: "prose",
					heading: "THE SINGLE-FILE CONTRACT",
					paragraphs: [
						"SQLite in WAL mode is the integration point, not an implementation detail. The daemon writes projects, sources, tasks, works, and reviews; the GUI reads the same rows. The schema in db.rs is the contract every agent codes against — change a table and both sides move.",
						"One binary serves the GUI and the API on local loopback :7770. No remote hosting, no multi-user sync: the architecture assumes a single operator and their worktrees, and spends its complexity budget on the loop instead.",
					],
				},
				{
					kind: "prose",
					heading: "POLL, WATCH, AND CURSORS",
					paragraphs: [
						"Two cron schedules drive the daemon: the poller asks Linear and GitHub for new work hourly, and the watcher sweeps worktrees every two minutes for finished attempts. Each source keeps its own cursor — Linear team ENG at 08f3, the GitHub repo at 91bd — so a restart resumes the feed instead of refetching the world.",
						"Sources toggle per project, and a dead source is loud: the project row carries the error inline, SSH key rejected and all, with nothing attached until it is fixed. Backoff state rides in task metadata for the same reason cursors do — memory forgets, rows do not.",
					],
				},
				{
					kind: "prose",
					heading: "WORKTREES AND TRANSCRIPTS",
					paragraphs: [
						"Every attempt gets an isolated worktree — wt-auth-fix for work #128 — so the main checkout never sees half-finished code. The agent is the opencode CLI, and everything it does lands in a transcript: reads, edits, test runs, failures. The GUI tails the same log file the daemon wrote; log_path is a first-class column, not an afterthought.",
						"Attempts are cheap and numbered. Work #128 was the second try at LIN-142; #121 failed first on the 401 that taught the backoff lesson. Exit codes decide the row color — 0 green, anything else red — and a running work shows a live tail with no exit at all.",
					],
				},
				{
					kind: "prose",
					heading: "FAILURE SHAPES",
					paragraphs: [
						"Each piece fails in its own way and says so inline. A project that cannot clone carries the SSH error on its row. A task whose token refresh loops gets marked blocked with the provider error attached. A work that exits nonzero keeps its transcript for the postmortem.",
						"Review is the last gate: PR #412 came back with two comments and changes wanted, and the work went around again instead of merging red. Nothing in the loop promotes itself — human sign-off is the only merge path that counts.",
					],
				},
				{
					kind: "prose",
					heading: "ONE BINARY, NO CYCLES",
					paragraphs: [
						"Node size follows lines of code, which is why the daemon node dominates: the loop, the worker, and the review logic all live in core. A red halo would mark a dependency cycle; there are none. The arrows all point one way — interface to daemon to store, with the CLI spawned outward and sources polled inward.",
					],
				},
			],
			refs: "core/src/main.rs · core/src/poller.rs · core/src/ipc.rs · gui/src/router.tsx · Cargo.toml",
			links: [
				{ label: "Runtime →", dive: "runtime" },
				{ label: "Data model →", dive: "data-model" },
			],
			staticChips: ["11 modules · main.rs"],
		},
		"data-model": {
			key: "data-model",
			title: "DATA MODEL · DEEP-DIVE",
			lead: "Five tables, one owner. Everything hangs off tasks — sources feed them, works execute them, reviews discuss them.",
			blocks: [
				{
					kind: "prose",
					heading: "THE FIVE TABLES",
					paragraphs: [
						"Projects own task sources; sources feed tasks; works and review comments both carry task_id back to their task. Counts on the diagram are live row counts, not schema limits.",
						"Status fans out the widest: nine task values from open to merged, plus priority 0–3 that decides claim order. Works stay narrow — branch, worktree, timestamps, exit code, log path.",
					],
				},
				{
					kind: "figure",
					figure: "er",
					caption: "Fig. 2 — five tables · tasks own the graph",
				},
				{
					kind: "prose",
					heading: "OWNERSHIP IS THE SCHEMA",
					paragraphs: [
						"Foreign keys enforce what the daemon assumes: a work or review cannot exist without its task. Delete cascades never strand an attempt without the issue it was trying to close.",
						"Migrations are additive with defaults — backoff state landed without touching existing rows — so the daemon and the GUI can move at different speeds.",
					],
				},
			],
			refs: "core/src/db.rs (DDL + migrate) · core/src/models.rs (Task · TaskSource · Project)",
			links: [
				{ label: "Runtime →", dive: "runtime" },
				{ label: "Components →", dive: "components" },
			],
		},
		runtime: {
			key: "runtime",
			title: "RUNTIME · DEEP-DIVE · WORK #128",
			lead: "The runtime is one daemon loop — poll, triage, work, review, merge — running inside the same binary that serves this page. What follows traces a single issue, LIN-142, through the full loop using the real transcript of work #128.",
			blocks: [
				{
					kind: "prose",
					heading: "THE LOOP",
					paragraphs: [
						"Every hour the poller asks Linear and GitHub what is new. At 10:23 it emitted nine open tasks; triage ordered them by priority, P0 first, and claimed LIN-142 — a tight auth-refresh loop flooding the poller logs. The claim created work #128: an isolated worktree at wt-auth-fix with its own transcript, so the main checkout never sees half-finished code.",
						"The worker reads, edits, and tests inside the worktree. By 10:31 it had opened PR #412 — and here the loop turns asynchronous. The forge answers on its own schedule: two review comments sent the work back for changes before it merged and closed. Nothing passes review without approval; that gate is the whole point.",
					],
				},
				{
					kind: "figure",
					figure: "runtime",
					caption:
						"Fig. 1 — one issue through the loop · timestamps from work #128",
				},
				{
					kind: "prose",
					heading: "STATE, BACKOFF AND RETRY",
					paragraphs: [
						"Backoff state lives in task metadata, not in memory. Two columns on tasks — backoff_until and backoff_count — added additively with defaults, so existing rows migrate untouched. The next run resumes the delay instead of starting cold: no more than one refresh per minute per source.",
						"The triage queue leans on a status index, so list_tasks stops scanning on large DBs. Claims stay P0-first; a blocked task waits for a human note, then retries from where it stalled.",
					],
				},
				{
					kind: "prose",
					heading: "ONE PATH FOR TOKEN REFRESH",
					paragraphs: [
						"Auth refresh had two paths: the canonical refresh and an inline retry in auth.rs that fired immediately on failure — the mechanism of the loop. Work #121 collapsed them into refresh_once(), replacing retry_inline(). Proposed in ADR-040, awaiting human sign-off.",
					],
				},
				{
					kind: "prose",
					paragraphs: [
						"The dotted return from the forge is the only async edge — review comments arrive on their own schedule and can send a work back.",
						"Attempt 1 died on a 401: refresh token expired, worker exited before writing backoff state. Fixed per ADR-041, covered by backoff_resets_across_polls.",
					],
				},
			],
			refs: "core/src/main.rs · core/src/worker.rs · core/src/poller.rs · core/src/watcher.rs",
			links: [
				{ label: "ADR-041 Accepted", dive: "decisions" },
				{ label: "ADR-040 Proposed", dive: "decisions" },
			],
			taskRef: "LIN-142",
			workId: 128,
		},
		health: {
			key: "health",
			title: "HEALTH · DEEP-DIVE",
			lead: "Lead time is falling as backoff fixes land — Thursday's median is a quarter of Tuesday's.",
			blocks: [
				{
					kind: "prose",
					heading: "LEAD TIME",
					paragraphs: [
						"Average work lead time dropped from 48 minutes Tuesday to 12 minutes Thursday as the poller backoff fixes landed. The chart reads straight from works.started_at and finished_at — no separate metrics pipeline.",
						"Anything that pushes the median back up gets investigated before new features: speed is the daemon's side effect, not its goal.",
					],
				},
				{
					kind: "figure",
					figure: "health",
					caption: "Fig. 3 — avg lead time by day · hotspot below",
				},
				{
					kind: "prose",
					heading: "HOTSPOTS",
					paragraphs: [
						"Churn × complexity decides what needs human eyes: src/poller.rs at 14 works and complexity 18 currently tops the list, so it gets mandatory review before merge no matter how green the tests are.",
						"core/src/db.rs and the GUI project pages trail well behind — 6 and 11 works at single-digit complexity — and merge on green.",
					],
				},
			],
			refs: "git log · works.started_at / finished_at · rust-code-analysis",
			links: [
				{ label: "Runtime →", dive: "runtime" },
				{ label: "Decisions →", dive: "decisions" },
			],
		},
		decisions: {
			key: "decisions",
			title: "DECISIONS · DEEP-DIVE",
			lead: "Two architectural decisions this week, both forged in work transcripts and summarized here.",
			blocks: [
				{
					kind: "prose",
					heading: "ADR-041 · ACCEPTED",
					paragraphs: [
						"Backoff state lives in task metadata. Survives repolls and worker restarts; the alternative — in-memory delay — lost state on every crash. Touches poller · db. From work #128 · LIN-142.",
					],
				},
				{
					kind: "prose",
					heading: "ADR-040 · PROPOSED",
					paragraphs: [
						"Single refresh helper in auth.rs. One path for token refresh removes the inline retry that caused the loop. Awaiting human sign-off. From work #121 · LIN-142.",
					],
				},
				{
					kind: "prose",
					heading: "HOW ADRS WORK",
					paragraphs: [
						"Summaries live here; full text lives with the work transcript that produced them. Accepted means merged into the loop, proposed means awaiting a human.",
					],
				},
			],
			refs: "work transcripts · task notes",
			links: [
				{ label: "Runtime →", dive: "runtime" },
				{ label: "Components →", dive: "components" },
			],
		},
	},
};

export function getProjectDocs(_projectId: string): ProjectDocs {
	return FORMLESS_HANDS_DOCS;
}
