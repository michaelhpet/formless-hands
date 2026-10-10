import { IconCopy, IconDotsVertical } from "@tabler/icons-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
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
	PaginationLink,
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
import { PriorityLabel, TaskStatusMark } from "./task-utils";
import { SOURCE_LABELS, type Task } from "./tasks-data";

const PAGE_SIZE = 10;

function TaskRowMenu({ task }: { task: Task }) {
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
						aria-label={`Actions for ${task.id}`}
					>
						<IconDotsVertical />
					</Button>
				}
			/>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem onClick={() => void copy(task.id)}>
						<IconCopy data-icon="inline-start" />
						Copy task id
					</DropdownMenuItem>
					{task.ref !== "None" ? (
						<DropdownMenuItem onClick={() => void copy(task.ref)}>
							<IconCopy data-icon="inline-start" />
							Copy branch / PR ref
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function TaskTableRow({ task }: { task: Task }) {
	const { projectId } = useParams({ strict: false });
	const navigate = useNavigate();
	const openDetail = () => {
		navigate({
			to: "/$projectId/tasks/$taskId",
			params: { projectId: projectId ?? "", taskId: task.id },
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
			<TableCell>
				<span className="flex flex-col gap-0.5">
					<span className="text-muted-foreground">{task.id}</span>
					<span className="text-[13px] text-foreground">{task.title}</span>
				</span>
			</TableCell>
			<TableCell>
				<TaskStatusMark status={task.status} />
			</TableCell>
			<TableCell>
				<span className="flex items-center gap-1.5 text-foreground">
					<span
						className="size-1.5 rounded-full bg-foreground"
						aria-hidden="true"
					/>
					{SOURCE_LABELS[task.source]}
				</span>
			</TableCell>
			<TableCell>
				<PriorityLabel priority={task.priority} />
			</TableCell>
			<TableCell className="text-muted-foreground">{task.ref}</TableCell>
			<TableCell className="text-muted-foreground">{task.age}</TableCell>
			<TableCell
				className="text-center"
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
			>
				<TaskRowMenu task={task} />
			</TableCell>
		</TableRow>
	);
}

export function TasksTableView({ tasks }: { tasks: Task[] }) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/$projectId/tasks" });
	const page = search.page ?? 1;

	const pageCount = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const start = (currentPage - 1) * PAGE_SIZE;
	const pageItems = tasks.slice(start, start + PAGE_SIZE);

	const goToPage = (next: number) => {
		const clamped = Math.min(Math.max(1, next), pageCount);
		navigate({
			from: "/$projectId/tasks",
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
							<TableHead className="text-muted-foreground">TASK</TableHead>
							<TableHead className="w-32 text-muted-foreground">
								STATUS
							</TableHead>
							<TableHead className="w-28 text-muted-foreground">
								SOURCE
							</TableHead>
							<TableHead className="w-16 text-muted-foreground">PRI</TableHead>
							<TableHead className="w-80 text-muted-foreground">
								PR / BRANCH
							</TableHead>
							<TableHead className="w-28 text-muted-foreground">AGE</TableHead>
							<TableHead aria-label="Row actions">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{pageItems.map((task) => (
							<TaskTableRow key={task.id} task={task} />
						))}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between gap-3">
				<p className="text-muted-foreground">
					{tasks.length === 0
						? "0 tasks"
						: `${start + 1} to ${start + pageItems.length} of ${tasks.length}`}
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
							{Array.from({ length: pageCount }, (_, index) => index + 1).map(
								(pageNumber) => (
									<PaginationItem key={pageNumber}>
										<PaginationLink
											href="#"
											isActive={currentPage === pageNumber}
											onClick={(event) => {
												event.preventDefault();
												goToPage(pageNumber);
											}}
										>
											{pageNumber}
										</PaginationLink>
									</PaginationItem>
								),
							)}
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
