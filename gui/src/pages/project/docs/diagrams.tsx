const PANEL_STYLE = {
	backgroundColor: "var(--color-background)",
	borderWidth: "1px",
	borderStyle: "solid",
	borderColor: "var(--color-border)",
} as const;

export function ComponentsDiagram() {
	return (
		<svg
			viewBox="0 0 1032 250"
			width="100%"
			fontFamily="JetBrains Mono, monospace"
			height="250"
			xmlns="http://www.w3.org/2000/svg"
			style={PANEL_STYLE}
			role="img"
			aria-label="Components flowchart: GUI and API feed the core daemon, which owns SQLite, spawns opencode agents, and polls Linear and GitHub sources"
		>
			<defs>
				<marker
					id="docs-components-arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path
						d="M 0 1 L 9 5 L 0 9"
						fill="none"
						stroke="#A1A1AA"
						strokeWidth="1.5"
					/>
				</marker>
			</defs>
			<rect
				x="20"
				y="95"
				width="150"
				height="60"
				rx="6"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="95" y="120" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				gui
			</text>
			<text x="95" y="138" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				Vite + TS · 38 files
			</text>
			<rect
				x="210"
				y="95"
				width="140"
				height="60"
				rx="6"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="280" y="120" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				/api · axum
			</text>
			<text x="280" y="138" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				3 routes · :7770
			</text>
			<rect
				x="390"
				y="70"
				width="200"
				height="110"
				rx="6"
				fill="#141414"
				stroke="#FACC15"
			/>
			<text x="490" y="108" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				core · daemon
			</text>
			<text x="490" y="126" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				poll → triage → work
			</text>
			<text x="490" y="142" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				→ review → merge
			</text>
			<text x="490" y="160" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				11 modules · main.rs
			</text>
			<rect
				x="630"
				y="95"
				width="150"
				height="60"
				rx="6"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="705" y="120" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				SQLite
			</text>
			<text x="705" y="138" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				5 tables · WAL
			</text>
			<rect
				x="820"
				y="30"
				width="192"
				height="60"
				rx="6"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="916" y="55" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				opencode CLI
			</text>
			<text x="916" y="73" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				worktree per work
			</text>
			<rect
				x="820"
				y="160"
				width="192"
				height="60"
				rx="6"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="916" y="185" textAnchor="middle" fontSize="12" fill="#FAFAFA">
				linear · github
			</text>
			<text x="916" y="203" textAnchor="middle" fontSize="10" fill="#A1A1AA">
				task sources
			</text>
			<line
				x1="170"
				y1="125"
				x2="206"
				y2="125"
				markerEnd="url(#docs-components-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<line
				x1="350"
				y1="125"
				x2="386"
				y2="125"
				markerEnd="url(#docs-components-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<line
				x1="590"
				y1="125"
				x2="626"
				y2="125"
				markerEnd="url(#docs-components-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<line
				x1="590"
				y1="70"
				x2="850"
				y2="60"
				markerEnd="url(#docs-components-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<line
				x1="850"
				y1="190"
				x2="590"
				y2="155"
				markerEnd="url(#docs-components-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
				strokeDasharray="5 4"
			/>
			<text x="700" y="52" fontSize="10" fill="#A1A1AA">
				spawns
			</text>
			<text x="700" y="172" fontSize="10" fill="#A1A1AA">
				polls hourly
			</text>
		</svg>
	);
}

export function ErDiagram() {
	return (
		<svg
			viewBox="0 0 1032 330"
			width="100%"
			fontFamily="JetBrains Mono, monospace"
			height="330"
			xmlns="http://www.w3.org/2000/svg"
			style={PANEL_STYLE}
			role="img"
			aria-label="Entity-relationship diagram: projects own task sources, sources feed tasks, works and reviews hang off tasks"
		>
			<defs>
				<marker
					id="docs-er-arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path
						d="M 0 1 L 9 5 L 0 9"
						fill="none"
						stroke="#A1A1AA"
						strokeWidth="1.5"
					/>
				</marker>
			</defs>
			<g>
				<rect
					x="20"
					y="20"
					width="300"
					height="111"
					fill="#141414"
					stroke="#262626"
				/>
				<rect x="20" y="20" width="300" height="26" fill="#1A1A1A" />
				<text x="32" y="37" fontSize="11" fill="#FAFAFA">
					PROJECTS · 6
				</text>
				<text x="32" y="62" fontSize="11" fill="#FAFAFA">
					id ∗PK
				</text>
				<text x="32" y="79" fontSize="11" fill="#A1A1AA">
					name · remote_url
				</text>
				<text x="32" y="96" fontSize="11" fill="#A1A1AA">
					local_path · branch
				</text>
				<text x="32" y="113" fontSize="11" fill="#A1A1AA">
					status · status_detail
				</text>
			</g>
			<g>
				<rect
					x="356"
					y="20"
					width="300"
					height="111"
					fill="#141414"
					stroke="#262626"
				/>
				<rect x="356" y="20" width="300" height="26" fill="#1A1A1A" />
				<text x="368" y="37" fontSize="11" fill="#FAFAFA">
					TASK_SOURCES · 4
				</text>
				<text x="368" y="62" fontSize="11" fill="#FAFAFA">
					id ∗PK
				</text>
				<text x="368" y="79" fontSize="11" fill="#A1A1AA">
					kind · linear|github
				</text>
				<text x="368" y="96" fontSize="11" fill="#A1A1AA">
					enabled · cursor
				</text>
				<text x="368" y="113" fontSize="11" fill="#A1A1AA">
					last_polled_at
				</text>
			</g>
			<g>
				<rect
					x="692"
					y="20"
					width="320"
					height="128"
					fill="#141414"
					stroke="#FACC15"
				/>
				<rect x="692" y="20" width="320" height="26" fill="#1A1A1A" />
				<text x="704" y="37" fontSize="11" fill="#FAFAFA">
					TASKS · 27
				</text>
				<text x="704" y="62" fontSize="11" fill="#FAFAFA">
					id ∗PK
				</text>
				<text x="704" y="79" fontSize="11" fill="#A1A1AA">
					external_id · LIN-142
				</text>
				<text x="704" y="96" fontSize="11" fill="#A1A1AA">
					status · 9 values
				</text>
				<text x="704" y="113" fontSize="11" fill="#A1A1AA">
					priority · labels[]
				</text>
				<text x="704" y="130" fontSize="11" fill="#A1A1AA">
					pr_number · branch
				</text>
			</g>
			<g>
				<rect
					x="356"
					y="190"
					width="300"
					height="110"
					fill="#141414"
					stroke="#262626"
				/>
				<rect x="356" y="190" width="300" height="26" fill="#1A1A1A" />
				<text x="368" y="207" fontSize="11" fill="#FAFAFA">
					WORKS · 128
				</text>
				<text x="368" y="232" fontSize="11" fill="#FAFAFA">
					id ∗PK
				</text>
				<text x="368" y="249" fontSize="11" fill="#22C55E">
					task_id → tasks
				</text>
				<text x="368" y="266" fontSize="11" fill="#A1A1AA">
					branch · exit_code
				</text>
				<text x="368" y="283" fontSize="11" fill="#A1A1AA">
					log_path · worktree
				</text>
			</g>
			<g>
				<rect
					x="692"
					y="190"
					width="320"
					height="93"
					fill="#141414"
					stroke="#262626"
				/>
				<rect x="692" y="190" width="320" height="26" fill="#1A1A1A" />
				<text x="704" y="207" fontSize="11" fill="#FAFAFA">
					REVIEW_COMMENTS · 3
				</text>
				<text x="704" y="232" fontSize="11" fill="#FAFAFA">
					id ∗PK
				</text>
				<text x="704" y="249" fontSize="11" fill="#22C55E">
					task_id → tasks
				</text>
				<text x="704" y="266" fontSize="11" fill="#A1A1AA">
					author · resolved
				</text>
			</g>
			<line
				x1="320"
				y1="70"
				x2="352"
				y2="70"
				markerEnd="url(#docs-er-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<text x="322" y="62" fontSize="10" fill="#A1A1AA">
				1:*
			</text>
			<line
				x1="656"
				y1="70"
				x2="688"
				y2="70"
				markerEnd="url(#docs-er-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<text x="658" y="62" fontSize="10" fill="#A1A1AA">
				1:*
			</text>
			<line
				x1="170"
				y1="131"
				x2="430"
				y2="186"
				markerEnd="url(#docs-er-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<text x="280" y="168" fontSize="10" fill="#A1A1AA">
				1:*
			</text>
			<line
				x1="800"
				y1="148"
				x2="800"
				y2="186"
				markerEnd="url(#docs-er-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
			/>
			<text x="806" y="170" fontSize="10" fill="#A1A1AA">
				1:*
			</text>
			<line
				x1="852"
				y1="148"
				x2="700"
				y2="240"
				markerEnd="url(#docs-er-arrow)"
				stroke="#A1A1AA"
				strokeWidth="1.5"
				strokeDasharray="5 4"
			/>
		</svg>
	);
}

export function RuntimeDiagram() {
	return (
		<svg
			viewBox="0 0 1032 330"
			width="100%"
			fontFamily="JetBrains Mono, monospace"
			height="330"
			xmlns="http://www.w3.org/2000/svg"
			style={PANEL_STYLE}
			role="img"
			aria-label="Runtime sequence for exemplar work 128: poller to triage to worker to forge, with review feedback and merge"
		>
			<defs>
				<marker
					id="docs-runtime-arrow"
					viewBox="0 0 10 10"
					refX="9"
					refY="5"
					markerWidth="7"
					markerHeight="7"
					orient="auto-start-reverse"
				>
					<path d="M 0 1 L 9 5 L 0 9" fill="#FAFAFA" stroke="none" />
				</marker>
			</defs>
			<rect
				x="30"
				y="16"
				width="130"
				height="34"
				rx="4"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="95" y="37" textAnchor="middle" fontSize="11" fill="#FAFAFA">
				poller
			</text>
			<rect
				x="300"
				y="16"
				width="130"
				height="34"
				rx="4"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="365" y="37" textAnchor="middle" fontSize="11" fill="#FAFAFA">
				triage
			</text>
			<rect
				x="570"
				y="16"
				width="130"
				height="34"
				rx="4"
				fill="#141414"
				stroke="#FACC15"
			/>
			<text x="635" y="37" textAnchor="middle" fontSize="11" fill="#FAFAFA">
				worker
			</text>
			<rect
				x="840"
				y="16"
				width="150"
				height="34"
				rx="4"
				fill="#141414"
				stroke="#262626"
			/>
			<text x="915" y="37" textAnchor="middle" fontSize="11" fill="#FAFAFA">
				forge · github
			</text>
			<line
				x1="95"
				y1="50"
				x2="95"
				y2="300"
				stroke="#444444"
				strokeDasharray="5 4"
			/>
			<line
				x1="365"
				y1="50"
				x2="365"
				y2="300"
				stroke="#444444"
				strokeDasharray="5 4"
			/>
			<line
				x1="635"
				y1="50"
				x2="635"
				y2="300"
				stroke="#444444"
				strokeDasharray="5 4"
			/>
			<line
				x1="915"
				y1="50"
				x2="915"
				y2="300"
				stroke="#444444"
				strokeDasharray="5 4"
			/>
			<line
				x1="95"
				y1="80"
				x2="361"
				y2="80"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#FAFAFA"
				strokeWidth="1.5"
			/>
			<text x="100" y="72" fontSize="10" fill="#A1A1AA">
				9 open tasks · 10:23
			</text>
			<line
				x1="365"
				y1="120"
				x2="631"
				y2="120"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#FAFAFA"
				strokeWidth="1.5"
			/>
			<text x="370" y="112" fontSize="10" fill="#A1A1AA">
				claim LIN-142 · P0 first
			</text>
			<rect
				x="635"
				y="140"
				width="150"
				height="30"
				fill="none"
				stroke="#FACC15"
				strokeWidth="1.5"
			/>
			<line
				x1="635"
				y1="155"
				x2="785"
				y2="155"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#FACC15"
				strokeWidth="1.5"
			/>
			<text x="640" y="151" fontSize="10" fill="#FACC15">
				worktree + transcript
			</text>
			<line
				x1="635"
				y1="200"
				x2="911"
				y2="200"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#FAFAFA"
				strokeWidth="1.5"
			/>
			<text x="640" y="192" fontSize="10" fill="#A1A1AA">
				PR #412 · 10:31
			</text>
			<line
				x1="915"
				y1="235"
				x2="639"
				y2="235"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#F87171"
				strokeWidth="1.5"
			/>
			<text x="700" y="227" fontSize="10" fill="#F87171">
				2 comments · changes wanted
			</text>
			<line
				x1="635"
				y1="270"
				x2="369"
				y2="270"
				markerEnd="url(#docs-runtime-arrow)"
				stroke="#22C55E"
				strokeWidth="1.5"
			/>
			<text x="420" y="262" fontSize="10" fill="#22C55E">
				merged → closed
			</text>
		</svg>
	);
}

export function HealthDiagram() {
	return (
		<svg
			viewBox="0 0 1032 170"
			width="100%"
			fontFamily="JetBrains Mono, monospace"
			height="170"
			xmlns="http://www.w3.org/2000/svg"
			style={PANEL_STYLE}
			role="img"
			aria-label="Average work lead time per day, falling from 48 minutes Tuesday to 12 minutes Thursday, with poller.rs flagged as hotspot"
		>
			<text x="20" y="24" fontSize="10" fill="#A1A1AA">
				avg work lead time · min
			</text>
			<g>
				<rect x="20" y="40" width="180" height="18" fill="#00598A" />
				<text x="206" y="54" fontSize="10" fill="#A1A1AA">
					Mon · 34m
				</text>
				<rect x="20" y="64" width="250" height="18" fill="#00598A" />
				<text x="276" y="78" fontSize="10" fill="#A1A1AA">
					Tue · 48m
				</text>
				<rect x="20" y="88" width="140" height="18" fill="#00598A" />
				<text x="166" y="102" fontSize="10" fill="#A1A1AA">
					Wed · 26m
				</text>
				<rect x="20" y="112" width="95" height="18" fill="#22C55E" />
				<text x="121" y="126" fontSize="10" fill="#A1A1AA">
					Thu · 12m ↓
				</text>
			</g>
			<line x1="20" y1="142" x2="1012" y2="142" stroke="#262626" />
			<text x="20" y="160" fontSize="10" fill="#FACC15">
				hotspot · src/poller.rs — 14 churn × high complexity
			</text>
		</svg>
	);
}
