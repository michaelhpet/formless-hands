import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { IconSearch } from "@tabler/icons-react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { cn } from "cn";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@/components/ui/combobox";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebounce } from "@/hooks/use-debounce";
import type { WorksSearch } from "@/router";
import { NewWorkDialog, type NewWorkInput } from "./new-work-dialog";
import {
	DEFAULT_SORT,
	INITIAL_WORKS,
	STATUS_FILTERS,
	STATUS_LABELS,
	sortWorks,
	summarizeWorks,
	type Work,
	type WorkStatusFilter,
} from "./works-data";
import { WorksTableView } from "./works-table-view";

function StatCard({
	label,
	value,
	sub,
	valueClassName,
}: {
	label: string;
	value: string;
	sub: string;
	valueClassName?: string;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-1">
				<div className={cn("text-[26px] leading-8 font-bold", valueClassName)}>
					{value}
				</div>
				<p className="text-muted-foreground">{sub}</p>
			</CardContent>
		</Card>
	);
}

export function WorksPage() {
	const [works, setWorks] = useState<Work[]>(INITIAL_WORKS);
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/works" });
	const query = search.q ?? "";
	const status: WorkStatusFilter = search.status ?? "all";
	const sort = search.sort ?? DEFAULT_SORT;
	const task = search.task ?? "all";

	const updateSearch = (patch: Partial<WorksSearch>) => {
		navigate({
			from: "/$projectId/works",
			search: (prev) => ({ ...prev, ...patch }),
			replace: true,
		});
	};
	const [draft, setQuery] = useDebounce(query, (value) =>
		updateSearch({ q: value || undefined, page: undefined }),
	);
	const setStatus = (value: WorkStatusFilter) => {
		updateSearch({
			status: value === "all" ? undefined : value,
			page: undefined,
		});
	};
	const setTask = (value: string) => {
		updateSearch({
			task: value === "all" ? undefined : value,
			page: undefined,
		});
	};

	const stats = summarizeWorks(works);
	const tasks = useMemo(
		() => [...new Map(works.map((work) => [work.taskRef, work])).values()],
		[works],
	);
	const taskItems = useMemo(
		() =>
			ComboboxPrimitive.createItems(tasks, {
				getValue: (work) => work.taskRef,
				getLabel: (work) => `${work.taskRef}: ${work.taskTitle}`,
			}),
		[tasks],
	);

	const visible = sortWorks(
		works.filter((work) => {
			if (status !== "all" && work.status !== status) {
				return false;
			}
			if (task !== "all" && work.taskRef !== task) {
				return false;
			}
			const q = query.trim().toLowerCase();
			if (!q) {
				return true;
			}
			return [work.branch, work.taskRef, work.taskTitle, work.worktree].some(
				(field) => field.toLowerCase().includes(q),
			);
		}),
		sort,
	);

	const createWork = (input: NewWorkInput) => {
		setWorks((prev) => [
			{
				id: prev.length > 0 ? Math.max(...prev.map((w) => w.id)) + 1 : 1,
				taskRef: input.taskRef,
				taskTitle: input.taskTitle,
				branch: input.branch,
				worktree: `~/${input.branch}`,
				started: "now",
				duration: "0m",
				durationMin: 0,
				exitCode: null,
				status: "running",
			},
			...prev,
		]);
	};

	const filtering = query.trim() !== "" || status !== "all" || task !== "all";
	const clearFilters = () => {
		updateSearch({
			q: undefined,
			status: undefined,
			task: undefined,
			page: undefined,
		});
	};

	return (
		<div className="flex w-full flex-1 flex-col gap-3 px-5 py-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-lg leading-5.5 font-bold">Works</h1>
					<p className="text-muted-foreground">
						{stats.total} works · {stats.running} running
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Combobox
						items={taskItems}
						value={task === "all" ? null : task}
						onValueChange={(value) => setTask(value ?? "all")}
					>
						<ComboboxInput
							placeholder="All tasks"
							aria-label="Filter by task"
							showClear
							className="w-64"
						/>
						<ComboboxContent className="min-w-72">
							<ComboboxEmpty>No tasks found.</ComboboxEmpty>
							<ComboboxList>
								{(work) => (
									<ComboboxItem key={work.taskRef} value={work.taskRef}>
										<span
											className="block min-w-0 max-w-64 truncate"
											title={`${work.taskRef}: ${work.taskTitle}`}
										>
											{work.taskRef}: {work.taskTitle}
										</span>
									</ComboboxItem>
								)}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
					<NewWorkDialog onCreate={createWork} />
				</div>
			</div>

			<div className="grid w-full grid-cols-2 gap-2.5 xl:grid-cols-5">
				<StatCard
					label="TOTAL WORKS"
					value={String(stats.total)}
					sub="This project"
				/>
				<StatCard
					label="RUNNING"
					value={String(stats.running)}
					sub="In worktrees now"
					valueClassName="text-warning"
				/>
				<StatCard
					label="SUCCESS"
					value={`${stats.successRate}%`}
					sub="Exit 0"
					valueClassName="text-success"
				/>
				<StatCard
					label="FAILED"
					value={String(stats.failed)}
					sub="Non-zero exit"
					valueClassName="text-destructive"
				/>
				<StatCard
					label="AVG DURATION"
					value={stats.avgDuration}
					sub="Per finished work"
				/>
			</div>

			<div className="flex gap-2">
				<InputGroup className="max-w-sm flex-1">
					<InputGroupAddon>
						<IconSearch />
					</InputGroupAddon>
					<InputGroupInput
						placeholder="Search branch, task, worktree..."
						aria-label="Search works"
						value={draft}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputGroup>
				<div className="ml-auto flex gap-2">
					<ToggleGroup
						variant="outline"
						size="default"
						spacing={0}
						value={[status]}
						onValueChange={(value) => {
							const next = value[0] as WorkStatusFilter | undefined;
							if (next) {
								setStatus(next);
							}
						}}
						aria-label="Filter by status"
					>
						{STATUS_FILTERS.map((option) => (
							<ToggleGroupItem key={option} value={option}>
								{STATUS_LABELS[option]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
			</div>

			{visible.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSearch />
						</EmptyMedia>
						<EmptyTitle>No works found</EmptyTitle>
						<EmptyDescription>
							{filtering
								? "No works match the current search or filters. Try a different search or filter."
								: "No works yet. Start the first work to see it here."}
						</EmptyDescription>
					</EmptyHeader>
					{filtering ? (
						<EmptyContent>
							<Button variant="outline" size="sm" onClick={clearFilters}>
								Clear filters
							</Button>
						</EmptyContent>
					) : null}
				</Empty>
			) : (
				<WorksTableView
					key={`${query}-${status}-${sort}-${task}`}
					works={visible}
				/>
			)}
		</div>
	);
}
