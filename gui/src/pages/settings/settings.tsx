import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod/mini";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { errorMessage, useErrorToast } from "@/hooks/use-error-toast";
import type { AppConfig } from "@/lib/api/settings";
import { useConfig, useSaveConfig } from "@/lib/api/settings";
import { fieldErrors } from "@/lib/form";

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
	workTimeoutSecs: string;
	port: string;
	mergeMode: string;
}

function fieldsFrom(config: AppConfig): SettingsFields {
	return {
		pollCron: config.service.poll_cron,
		watchCron: config.service.watch_cron,
		maxWorkers: config.service.max_concurrent_workers,
		workTimeoutSecs: String(config.service.work_timeout_secs),
		port: String(config.server.port),
		mergeMode: config.merge.mode,
	};
}

const portSchema = z
	.string()
	.check(
		z.minLength(1, "Port is required"),
		z.regex(/^\d+$/, "Port must be a number"),
	);

export function SettingsPage() {
	const configQuery = useConfig();
	const [reloadKey, setReloadKey] = useState(0);
	useErrorToast(configQuery.error, "Couldn't load config");

	const reload = () => {
		void configQuery.refetch().then(() => {
			setReloadKey((key) => key + 1);
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
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Button variant="outline" onClick={reload}>
							Reload
						</Button>
					</div>
				</div>
				{configQuery.isLoading ? (
					<p className="text-muted-foreground">Loading config…</p>
				) : null}
				{configQuery.data ? (
					<SettingsForm
						key={reloadKey}
						initial={fieldsFrom(configQuery.data)}
					/>
				) : null}
			</div>
		</AppLayout>
	);
}

const trimmedRequired = (label: string) =>
	z
		.string()
		.check(
			z.refine((value: string) => value.trim() !== "", `${label} is required`),
		);

const timeoutSchema = z.string().check(
	z.minLength(1, "Timeout is required"),
	z.regex(/^\d+$/, "Timeout must be a number"),
	z.refine(
		(value: string) => Number(value) >= 60 && Number(value) <= 86400,
		"Timeout must be 60-86400 seconds",
	),
);

const settingsSchema = z.object({
	pollCron: trimmedRequired("Poll schedule"),
	watchCron: trimmedRequired("Watch schedule"),
	maxWorkers: z.number().check(z.minimum(1), z.maximum(32)),
	workTimeoutSecs: timeoutSchema,
	port: portSchema,
	mergeMode: z.enum(["local", "pr"]),
});

function SettingsForm({ initial }: { initial: SettingsFields }) {
	const saveMutation = useSaveConfig();
	const [notice, setNotice] = useState<string | null>(null);
	const form = useForm({
		defaultValues: initial,
		validators: { onSubmit: settingsSchema },
		onSubmit: ({ value }) => {
			saveMutation.mutate(
				{
					service: {
						poll_cron: value.pollCron.trim(),
						watch_cron: value.watchCron.trim(),
						max_concurrent_workers: value.maxWorkers,
						work_timeout_secs: Number(value.workTimeoutSecs),
					},
					server: {
						port: Number(value.port),
					},
					merge: {
						mode: value.mergeMode,
					},
				},
				{
					onSuccess: () => {
						form.reset(value);
						setNotice("saved · takes effect after daemon restart");
					},
					onError: (error) => {
						setNotice(null);
						toast.add({
							type: "error",
							title: "Couldn't save config",
							description: errorMessage(error),
						});
					},
				},
			);
		},
	});

	return (
		<>
			{notice ? <p className="text-muted-foreground">· {notice}</p> : null}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
				className="flex w-full max-w-220 flex-col gap-3"
			>
				<Card className="gap-0 py-0">
					<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
						SERVICE · DAEMON LOOP
					</h2>
					<div className="flex flex-col divide-y divide-border">
						<SettingRow
							label="Poll schedule"
							hint="How often task sources are polled"
						>
							<form.Field name="pollCron">
								{(field) => (
									<Field>
										<Input
											aria-label="Poll schedule (cron)"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="h-8 w-40 bg-background text-right font-mono"
											spellCheck={false}
											autoComplete="off"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								)}
							</form.Field>
						</SettingRow>
						<SettingRow
							label="Watch schedule"
							hint="How often worktrees are watched"
						>
							<form.Field name="watchCron">
								{(field) => (
									<Field>
										<Input
											aria-label="Watch schedule (cron)"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											className="h-8 w-40 bg-background text-right font-mono"
											spellCheck={false}
											autoComplete="off"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								)}
							</form.Field>
						</SettingRow>
						<SettingRow
							label="Work timeout"
							hint="Agent run limit in seconds (60-86400)"
						>
							<form.Field name="workTimeoutSecs">
								{(field) => (
									<Field>
										<Input
											aria-label="Work timeout in seconds"
											value={field.state.value}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(
													event.target.value.replace(/[^0-9]/g, ""),
												)
											}
											className="h-8 w-40 bg-background text-right font-mono"
											autoComplete="off"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								)}
							</form.Field>
						</SettingRow>
						<SettingRow
							label="Max concurrent workers"
							hint="Agents working at the same time"
						>
							<form.Field name="maxWorkers">
								{(field) => (
									<div className="flex items-center border bg-background">
										<button
											type="button"
											aria-label="Decrease max workers"
											onClick={() =>
												field.handleChange(Math.max(1, field.state.value - 1))
											}
											disabled={field.state.value <= 1}
											className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
										>
											-
										</button>
										<span
											aria-live="polite"
											className="min-w-6 text-center text-[13px] text-foreground"
										>
											{field.state.value}
										</span>
										<button
											type="button"
											aria-label="Increase max workers"
											onClick={() =>
												field.handleChange(Math.min(8, field.state.value + 1))
											}
											disabled={field.state.value >= 8}
											className="px-3 py-1.5 text-muted-foreground hover:text-foreground disabled:opacity-40"
										>
											+
										</button>
									</div>
								)}
							</form.Field>
						</SettingRow>
					</div>
				</Card>

				<Card className="gap-0 py-0">
					<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
						MERGE · AFTER APPROVAL
					</h2>
					<div className="flex flex-col divide-y divide-border">
						<SettingRow
							label="Merge mode"
							hint="Local merge into the default branch, or prepare a GitHub PR for you to submit"
						>
							<form.Field name="mergeMode">
								{(field) => (
									<Select
										value={field.state.value}
										onValueChange={(value) => {
											if (value !== null) {
												field.handleChange(value);
											}
										}}
										items={{ local: "Local merge", pr: "GitHub PR" }}
									>
										<SelectTrigger aria-label="Merge mode" className="w-40">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="local">Local merge</SelectItem>
											<SelectItem value="pr">GitHub PR</SelectItem>
										</SelectContent>
									</Select>
								)}
							</form.Field>
						</SettingRow>
					</div>
				</Card>

				<Card className="gap-0 py-0">
					<h2 className="tracking-wide text-muted-foreground border-b px-3.5 pt-3 pb-2.5">
						SERVER · GUI + API
					</h2>
					<div className="flex flex-col divide-y divide-border">
						<SettingRow label="Port" hint="GUI + /api serves here">
							<form.Field name="port">
								{(field) => (
									<Field>
										<Input
											aria-label="Server port"
											value={field.state.value}
											inputMode="numeric"
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(
													event.target.value.replace(/[^0-9]/g, ""),
												)
											}
											className="h-8 w-40 bg-background text-right font-mono"
											autoComplete="off"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								)}
							</form.Field>
						</SettingRow>
						<SettingRow label="Status" hint="Local loopback only">
							<form.Subscribe selector={(state) => state.values.port}>
								{(port) => (
									<span className="text-success">
										Listening · 127.0.0.1:{port || "None"}
									</span>
								)}
							</form.Subscribe>
						</SettingRow>
					</div>
				</Card>

				<div className="flex justify-end">
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								disabled={!canSubmit || isSubmitting || saveMutation.isPending}
							>
								{saveMutation.isPending ? "Saving..." : "Save changes"}
							</Button>
						)}
					</form.Subscribe>
				</div>
			</form>
		</>
	);
}
