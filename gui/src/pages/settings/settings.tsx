import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AppConfig } from "@/lib/api/settings";
import { useConfig, useSaveConfig } from "@/lib/api/settings";

function SettingRow({
	label,
	hint,
	children,
}: {
	label: string;
	hint: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4 px-3.5 py-3">
			<div className="flex flex-col gap-0.5">
				<span className="text-[13px] text-foreground">{label}</span>
				<span className="text-muted-foreground">{hint}</span>
			</div>
			{children}
		</div>
	);
}

interface SettingsFields {
	pollCron: string;
	watchCron: string;
	maxWorkers: number;
	port: string;
}

function fieldsFrom(config: AppConfig): SettingsFields {
	return {
		pollCron: config.service.poll_cron,
		watchCron: config.service.watch_cron,
		maxWorkers: config.service.max_concurrent_workers,
		port: String(config.server.port),
	};
}

export function SettingsPage() {
	const configQuery = useConfig();
	const saveMutation = useSaveConfig();
	const initialized = useRef(false);
	const [pollCron, setPollCron] = useState("");
	const [watchCron, setWatchCron] = useState("");
	const [maxWorkers, setMaxWorkers] = useState(1);
	const [port, setPort] = useState("");
	const [baseline, setBaseline] = useState<SettingsFields>({
		pollCron: "",
		watchCron: "",
		maxWorkers: 1,
		port: "",
	});
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		if (!initialized.current && configQuery.data) {
			initialized.current = true;
			const fields = fieldsFrom(configQuery.data);
			setPollCron(fields.pollCron);
			setWatchCron(fields.watchCron);
			setMaxWorkers(fields.maxWorkers);
			setPort(fields.port);
			setBaseline(fields);
		}
	}, [configQuery.data]);

	const dirty =
		pollCron !== baseline.pollCron ||
		watchCron !== baseline.watchCron ||
		maxWorkers !== baseline.maxWorkers ||
		port !== baseline.port;

	const save = () => {
		saveMutation.mutate(
			{
				service: {
					poll_cron: pollCron.trim(),
					watch_cron: watchCron.trim(),
					max_concurrent_workers: maxWorkers,
				},
				server: {
					port: Number(port),
				},
			},
			{
				onSuccess: () => {
					setBaseline({ pollCron, watchCron, maxWorkers, port });
					setNotice("saved · takes effect after daemon restart");
				},
				onError: (error) => {
					setNotice(error instanceof Error ? error.message : "save failed");
				},
			},
		);
	};

	const reload = () => {
		void configQuery.refetch().then(({ data }) => {
			if (data) {
				const fields = fieldsFrom(data);
				setPollCron(fields.pollCron);
				setWatchCron(fields.watchCron);
				setMaxWorkers(fields.maxWorkers);
				setPort(fields.port);
				setBaseline(fields);
			}
		});
	};

	return (
		<AppLayout>
			<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h1 className="text-xl leading-6.5 font-bold">Settings</h1>
						<p className="text-muted-foreground">
							~/.config/formless-hands/config.toml
							{notice ? ` · ${notice}` : ""}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button variant="outline" onClick={reload}>
							Reload
						</Button>
						<Button onClick={save} disabled={!dirty || saveMutation.isPending}>
							{saveMutation.isPending ? "Saving..." : "Save changes"}
						</Button>
					</div>
				</div>
				{configQuery.isLoading ? (
					<p className="text-muted-foreground">Loading config…</p>
				) : null}
				{configQuery.isError ? (
					<p className="text-destructive">
						Couldn't load config:{" "}
						{configQuery.error instanceof Error
							? configQuery.error.message
							: "unknown error"}
					</p>
				) : null}

				<div className="flex w-full max-w-220 flex-col gap-3">
					<Card className="gap-0 py-0">
						<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
							SERVICE · DAEMON LOOP
						</h2>
						<div className="flex flex-col divide-y divide-border">
							<SettingRow
								label="Poll schedule"
								hint="How often task sources are polled"
							>
								<Input
									aria-label="Poll schedule (cron)"
									value={pollCron}
									onChange={(event) => setPollCron(event.target.value)}
									className="h-8 w-40 bg-background text-right font-mono"
									spellCheck={false}
									autoComplete="off"
								/>
							</SettingRow>
							<SettingRow
								label="Watch schedule"
								hint="How often worktrees are watched"
							>
								<Input
									aria-label="Watch schedule (cron)"
									value={watchCron}
									onChange={(event) => setWatchCron(event.target.value)}
									className="h-8 w-40 bg-background text-right font-mono"
									spellCheck={false}
									autoComplete="off"
								/>
							</SettingRow>
							<SettingRow
								label="Max concurrent workers"
								hint="Agents working at the same time"
							>
								<div className="flex items-center border bg-background">
									<button
										type="button"
										aria-label="Decrease max workers"
										onClick={() =>
											setMaxWorkers((prev) => Math.max(1, prev - 1))
										}
										disabled={maxWorkers <= 1}
										className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
									>
										-
									</button>
									<span
										aria-live="polite"
										className="min-w-6 text-center text-[13px] text-foreground"
									>
										{maxWorkers}
									</span>
									<button
										type="button"
										aria-label="Increase max workers"
										onClick={() =>
											setMaxWorkers((prev) => Math.min(8, prev + 1))
										}
										disabled={maxWorkers >= 8}
										className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
									>
										+
									</button>
								</div>
							</SettingRow>
						</div>
					</Card>

					<Card className="gap-0 py-0">
						<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
							SERVER · GUI + API
						</h2>
						<div className="flex flex-col divide-y divide-border">
							<SettingRow label="Port" hint="GUI + /api serves here">
								<Input
									aria-label="Server port"
									value={port}
									inputMode="numeric"
									onChange={(event) =>
										setPort(event.target.value.replace(/[^0-9]/g, ""))
									}
									className="h-8 w-40 bg-background text-right font-mono"
									autoComplete="off"
								/>
							</SettingRow>
							<SettingRow label="Status" hint="Local loopback only">
								<span className="text-success">
									Listening · 127.0.0.1:{port || "None"}
								</span>
							</SettingRow>
						</div>
					</Card>
				</div>
			</div>
		</AppLayout>
	);
}
