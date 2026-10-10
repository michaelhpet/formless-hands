import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
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
						<span className="text-muted-foreground">linear · github</span>
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
					<form
						className="flex flex-col gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							const kind = String(data.get("kind") ?? available[0]);
							const config = String(data.get("config") ?? "").trim();
							if (!available.includes(kind)) {
								return;
							}
							onCreate({ kind, config: config || KIND_HINTS[kind] });
							event.currentTarget.reset();
							setOpen(false);
						}}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="new-source-kind">Kind</FieldLabel>
								<Select
									name="kind"
									defaultValue={available[0]}
									items={Object.fromEntries(
										available.map((kind) => [kind, kind]),
									)}
								>
									<SelectTrigger id="new-source-kind" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{available.map((kind) => (
											<SelectItem key={kind} value={kind}>
												{kind}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor="new-source-config">Config</FieldLabel>
								<Input
									id="new-source-config"
									name="config"
									placeholder="team = ENG"
									autoComplete="off"
								/>
							</Field>
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
				)}
			</DialogContent>
		</Dialog>
	);
}
