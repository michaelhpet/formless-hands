import { IconPlus } from "@tabler/icons-react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import * as z from "zod/mini";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	useLinearLabels,
	useLinearProjects,
	useLinearTeams,
} from "@/lib/api/sources";
import { fieldErrors } from "@/lib/form";

export interface NewSourceInput {
	kind: string;
	team?: string;
	projectName?: string;
	projectSlugId?: string;
	label?: string;
	config?: string;
}

const NO_PROJECT = "__none";
const NO_LABEL = "__none";

const KIND_LABELS: Record<string, string> = {
	linear: "Linear",
	github: "GitHub",
};

function kindLabel(kind: string): string {
	return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

const sourceSchema = z
	.object({
		kind: z.enum(["linear", "github"]),
		config: z.string(),
		team: z.string(),
		project: z.string(),
		label: z.string(),
	})
	.check(
		z.refine((value) => value.kind !== "linear" || value.team.trim() !== "", {
			error: "Team is required for Linear sources",
			path: ["team"],
		}),
	);

function SourceForm({
	kinds,
	onSubmit,
}: {
	kinds: string[];
	onSubmit: (input: NewSourceInput) => void;
}) {
	const teamsQuery = useLinearTeams();
	const projectsQuery = useLinearProjects();
	const labelsQuery = useLinearLabels();
	const teams = teamsQuery.data ?? [];
	const projects = projectsQuery.data ?? [];
	const teamsError = teamsQuery.isError
		? teamsQuery.error instanceof Error
			? teamsQuery.error.message
			: "Couldn't load teams — is LINEAR_API_KEY set on the daemon?"
		: null;

	const form = useForm({
		defaultValues: {
			kind: kinds[0] ?? "linear",
			config: "",
			team: "",
			project: NO_PROJECT,
			label: NO_LABEL,
		},
		validators: { onSubmit: sourceSchema },
		onSubmit: ({ value }) => {
			if (value.kind === "linear") {
				const team = value.team.trim();
				if (team === "") {
					return;
				}
				const project = projects.find((item) => item.slug_id === value.project);
				onSubmit({
					kind: "linear",
					team,
					projectName: project?.name,
					projectSlugId: project?.slug_id,
					label:
						value.label !== NO_LABEL && value.label.trim() !== ""
							? value.label.trim()
							: undefined,
				});
				form.reset();
				return;
			}
			onSubmit({ kind: value.kind, config: value.config.trim() });
			form.reset();
		},
	});

	return (
		<form
			className="flex flex-col gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field name="kind">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="new-source-kind">Kind</FieldLabel>
							<Select
								value={field.state.value}
								onValueChange={(value) => {
									if (value !== null) {
										field.handleChange(value);
									}
								}}
								items={Object.fromEntries(
									kinds.map((kind) => [kind, kindLabel(kind)]),
								)}
							>
								<SelectTrigger id="new-source-kind" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{kinds.map((kind) => (
										<SelectItem key={kind} value={kind}>
											{kindLabel(kind)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
				</form.Field>
				<form.Subscribe selector={(state) => state.values.kind}>
					{(kind) =>
						kind === "linear" ? (
							<>
								<form.Field name="team">
									{(field) => (
										<Field>
											<FieldLabel htmlFor="new-source-team">Team</FieldLabel>
											<Select
												value={field.state.value}
												onValueChange={(value) => {
													if (value !== null) {
														field.handleChange(value);
													}
												}}
												items={Object.fromEntries(
													teams.map((item) => [
														item.key,
														`${item.name} (${item.key})`,
													]),
												)}
												disabled={teamsQuery.isLoading || teamsError !== null}
											>
												<SelectTrigger id="new-source-team" className="w-full">
													<SelectValue
														placeholder={
															teamsQuery.isLoading
																? "Loading teams…"
																: "Select a team"
														}
													/>
												</SelectTrigger>
												<SelectContent>
													{teams.map((item) => (
														<SelectItem key={item.key} value={item.key}>
															{item.name} ({item.key})
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FieldError
												errors={[
													...(teamsError ? [{ message: teamsError }] : []),
													...fieldErrors(field.state.meta.errors),
												]}
											/>
										</Field>
									)}
								</form.Field>
								<form.Subscribe selector={(state) => state.values.team}>
									{(team) =>
										team.trim() === "" ? null : (
											<>
												<form.Field name="project">
													{(field) => {
														const visibleProjects = projects.filter((project) =>
															project.teams.includes(team.trim()),
														);
														return (
															<Field>
																<FieldLabel htmlFor="new-source-project">
																	Project (optional)
																</FieldLabel>
																<Select
																	value={field.state.value}
																	onValueChange={(value) => {
																		if (value !== null) {
																			field.handleChange(value);
																		}
																	}}
																	items={{
																		[NO_PROJECT]: "No project (whole team)",
																		...Object.fromEntries(
																			visibleProjects.map((project) => [
																				project.slug_id,
																				project.name,
																			]),
																		),
																	}}
																	disabled={projectsQuery.isLoading}
																>
																	<SelectTrigger
																		id="new-source-project"
																		className="w-full"
																	>
																		<SelectValue placeholder="No project (whole team)" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value={NO_PROJECT}>
																			No project (whole team)
																		</SelectItem>
																		{visibleProjects.map((project) => (
																			<SelectItem
																				key={project.slug_id}
																				value={project.slug_id}
																			>
																				{project.name}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																{projectsQuery.isError ? (
																	<FieldError
																		errors={[
																			{
																				message:
																					"Couldn't load projects — you can still add a team-wide source.",
																			},
																		]}
																	/>
																) : null}
															</Field>
														);
													}}
												</form.Field>
												<form.Field name="label">
													{(field) => {
														const byName = new Map<
															string,
															{ name: string; team: string | null }
														>();
														for (const label of labelsQuery.data ?? []) {
															const current = byName.get(label.name);
															if (
																!current ||
																(current.team === null && label.team !== null)
															) {
																byName.set(label.name, label);
															}
														}
														const visibleLabels = [...byName.values()].filter(
															(label) =>
																label.team === null ||
																label.team === team.trim(),
														);
														return (
															<Field>
																<FieldLabel htmlFor="new-source-label">
																	Label (optional)
																</FieldLabel>
																<Select
																	value={field.state.value}
																	onValueChange={(value) => {
																		if (value !== null) {
																			field.handleChange(value);
																		}
																	}}
																	items={{
																		[NO_LABEL]: "No label",
																		...Object.fromEntries(
																			visibleLabels.map((label) => [
																				label.name,
																				label.team === null
																					? label.name
																					: `${label.name} (${label.team})`,
																			]),
																		),
																	}}
																	disabled={labelsQuery.isLoading}
																>
																	<SelectTrigger
																		id="new-source-label"
																		className="w-full"
																	>
																		<SelectValue placeholder="No label" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value={NO_LABEL}>
																			No label
																		</SelectItem>
																		{visibleLabels.map((label) => (
																			<SelectItem
																				key={label.name}
																				value={label.name}
																			>
																				{label.name}
																				{label.team === null
																					? ""
																					: ` (${label.team})`}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
																{labelsQuery.isError ? (
																	<FieldError
																		errors={[
																			{
																				message:
																					"Couldn't load labels — you can still add the source without one.",
																			},
																		]}
																	/>
																) : null}
															</Field>
														);
													}}
												</form.Field>
											</>
										)
									}
								</form.Subscribe>
							</>
						) : (
							<form.Field name="config">
								{(field) => (
									<Field>
										<FieldLabel htmlFor="new-source-config">Config</FieldLabel>
										<Input
											id="new-source-config"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
											}
											placeholder="repo = you/repo"
											autoComplete="off"
										/>
										<FieldError errors={fieldErrors(field.state.meta.errors)} />
									</Field>
								)}
							</form.Field>
						)
					}
				</form.Subscribe>
			</FieldGroup>
			<DialogFooter>
				<DialogClose
					render={
						<Button type="button" variant="outline">
							Cancel
						</Button>
					}
				/>
				<form.Subscribe selector={(state) => state.canSubmit}>
					{(canSubmit) => (
						<Button type="submit" disabled={!canSubmit}>
							Add source
						</Button>
					)}
				</form.Subscribe>
			</DialogFooter>
		</form>
	);
}

export function AddSourceDialog({
	existing,
	onCreate,
}: {
	existing: string[];
	onCreate: (input: NewSourceInput) => void;
}) {
	const [open, setOpen] = useState(false);
	const available = ["linear", "github"].filter(
		(kind) => !existing.includes(kind),
	);

	const submit = (input: NewSourceInput) => {
		onCreate(input);
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<button
						type="button"
						className="flex w-full cursor-pointer items-center gap-2 border border-dashed px-3.5 py-3 text-left hover:bg-muted/50"
						disabled={available.length === 0}
						aria-disabled={available.length === 0}
					>
						<span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
							<IconPlus className="size-4" />
							Add source
						</span>
						<span className="text-muted-foreground">Linear · GitHub</span>
					</button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add source</DialogTitle>
					<DialogDescription>
						Poll a new task source into this project.
					</DialogDescription>
				</DialogHeader>
				{available.length === 0 ? (
					<p className="text-muted-foreground">
						All source kinds are already added.
					</p>
				) : (
					<SourceForm
						key={available.join(",")}
						kinds={available}
						onSubmit={submit}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
