import {
	IconArrowDown,
	IconArrowUp,
	IconCopy,
	IconDotsVertical,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ariaSort,
	DEFAULT_SORT,
	sortDirection,
	toggleSort,
	type Work,
	type WorkSortKey,
} from "./works-data";

const PAGE_SIZE = 10;

function WorkRowMenu({ work }: { work: Work }) {
	const copy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			return;
		}
	};
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={`Actions for work #${work.id}`}
					>
						<IconDotsVertical />
					</Button>
				}
			/>
			<DropdownMenuContent align="end" className="min-w-52">
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={() => void copy(work.branch)}>
						<IconCopy data-icon="inline-start" />
						Copy branch
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => void copy(work.worktree)}>
						<IconCopy data-icon="inline-start" />
						Copy worktree path
					</DropdownMenuItem>
					{work.exitCode !== null ? (
						<DropdownMenuItem onClick={() => void copy(String(work.exitCode))}>
							<IconCopy data-icon="inline-start" />
							Copy exit code
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function WorkTableRow({ work }: { work: Work }) {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const openDetail = () => {
		navigate({
			to: "/$projectId/works/$workId",
			params: { projectId: projectId ?? "", workId: String(work.id) },
		});
	};
	return (
		<TableRow
			tabIndex={0}
			className="cursor-pointer divide-x divide-border"
			onClick={openDetail}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					openDetail();
				}
			}}
		>
			<TableCell className="w-20 font-bold text-foreground">
				#{work.id}
			</TableCell>
			<TableCell>
				<span className="text-[13px] text-foreground">
					{work.taskRef}: {work.taskTitle}
				</span>
			</TableCell>
			<TableCell className="w-80 text-foreground">{work.branch}</TableCell>
			<TableCell className="w-36 text-muted-foreground">
				{work.started} · {work.duration}
			</TableCell>
			<TableCell className="w-24 text-foreground">
				{work.exitCode === null ? "None" : work.exitCode}
			</TableCell>
			<TableCell className="w-30">
				<StatusBadge status={work.status} />
			</TableCell>
			<TableCell
				className="w-14 text-center"
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				<WorkRowMenu work={work} />
			</TableCell>
		</TableRow>
	);
}

function SortButton({
	label,
	direction,
	onClick,
}: {
	label: string;
	direction: "asc" | "desc" | null;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`Sort by ${label.toLowerCase()}`}
			className="flex cursor-pointer items-center gap-1 uppercase hover:text-foreground"
		>
			{label}
			{direction === "desc" ? (
				<IconArrowDown aria-hidden="true" className="size-3.5" />
			) : direction === "asc" ? (
				<IconArrowUp aria-hidden="true" className="size-3.5" />
			) : null}
		</button>
	);
}

export function WorksTableView({ works }: { works: Work[] }) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/works" });
	const page = search.page ?? 1;
	const sort = search.sort ?? DEFAULT_SORT;

	const changeSort = (key: WorkSortKey) => {
		const next = toggleSort(sort, key);
		navigate({
			from: "/$projectId/works",
			search: (prev) => ({
				...prev,
				sort: next === DEFAULT_SORT ? undefined : next,
			}),
			replace: true,
		});
	};
	const pageCount = Math.max(1, Math.ceil(works.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const start = (currentPage - 1) * PAGE_SIZE;
	const pageItems = works.slice(start, start + PAGE_SIZE);

	const goToPage = (next: number) => {
		const clamped = Math.min(Math.max(1, next), pageCount);
		navigate({
			from: "/$projectId/works",
			search: (prev) => ({
				...prev,
				page: clamped === 1 ? undefined : clamped,
			}),
			replace: true,
		});
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="border">
				<Table>
					<TableHeader>
						<TableRow className="divide-x divide-border hover:bg-transparent">
							<TableHead
								className="w-20 text-muted-foreground"
								aria-sort={ariaSort(sort, "started")}
							>
								<SortButton
									label="Work"
									direction={sortDirection(sort, "started")}
									onClick={() => changeSort("started")}
								/>
							</TableHead>
							<TableHead className="text-muted-foreground">
								TASK / task_id
							</TableHead>
							<TableHead className="w-80 text-muted-foreground">
								BRANCH
							</TableHead>
							<TableHead
								className="w-36 text-muted-foreground"
								aria-sort={ariaSort(sort, "started")}
							>
								<SortButton
									label="Started"
									direction={sortDirection(sort, "started")}
									onClick={() => changeSort("started")}
								/>
							</TableHead>
							<TableHead
								className="w-24 text-muted-foreground"
								aria-sort={ariaSort(sort, "exit")}
							>
								<SortButton
									label="Exit"
									direction={sortDirection(sort, "exit")}
									onClick={() => changeSort("exit")}
								/>
							</TableHead>
							<TableHead className="w-30 text-muted-foreground">
								STATUS
							</TableHead>
							<TableHead className="w-14" aria-label="Row actions">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{pageItems.map((work) => (
							<WorkTableRow key={work.id} work={work} />
						))}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between gap-3">
				<p className="text-muted-foreground">
					{works.length === 0
						? "0 works"
						: `${start + 1} to ${start + pageItems.length} of ${works.length}`}
					{" · Logs stream with tail -f · click a row for work detail"}
				</p>
				{pageCount > 1 ? (
					<Pagination className="mx-0 w-auto">
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									text="Prev"
									href="#"
									aria-disabled={currentPage === 1}
									className={
										currentPage === 1
											? "pointer-events-none opacity-50"
											: undefined
									}
									onClick={(event) => {
										event.preventDefault();
										goToPage(currentPage - 1);
									}}
								/>
							</PaginationItem>
							<PaginationItem>
								<span className="px-2 text-foreground">
									{currentPage} / {pageCount}
								</span>
							</PaginationItem>
							<PaginationItem>
								<PaginationNext
									text="Next"
									href="#"
									aria-disabled={currentPage === pageCount}
									className={
										currentPage === pageCount
											? "pointer-events-none opacity-50"
											: undefined
									}
									onClick={(event) => {
										event.preventDefault();
										goToPage(currentPage + 1);
									}}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
				) : null}
			</div>
		</div>
	);
}
