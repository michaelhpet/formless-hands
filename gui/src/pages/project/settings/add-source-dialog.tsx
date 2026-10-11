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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface NewSourceInput {
	kind: string;
	config: string;
}

const KIND_HINTS: Record<string, string> = {
	linear: "team = ENG",
	github: "repo = you/repo",
};

const KIND_LABELS: Record<string, string> = {
	linear: "Linear",
	github: "GitHub",
};

function kindLabel(kind: string): string {
	return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

const sourceSchema = z.object({
	kind: z.enum(["linear", "github"]),
	config: z.string(),
});

function SourceForm({
	kinds,
	onSubmit,
}: {
	kinds: string[];
	onSubmit: (input: NewSourceInput) => void;
}) {
	const form = useForm({
		defaultValues: { kind: kinds[0] ?? "linear", config: "" },
		validators: { onSubmit: sourceSchema },
		onSubmit: ({ value }) => {
			onSubmit({
				kind: value.kind,
				config: value.config.trim() || KIND_HINTS[value.kind],
			});
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
				<form.Field name="config">
					{(field) => (
						<Field>
							<FieldLabel htmlFor="new-source-config">Config</FieldLabel>
							<Input
								id="new-source-config"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="team = ENG"
								autoComplete="off"
							/>
						</Field>
					)}
				</form.Field>
			</FieldGroup>
			<DialogFooter>
				<DialogClose
					render={
						<Button type="button" variant="outline">
							Cancel
						</Button>
					}
				/>
				<Button type="submit">Add source</Button>
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
