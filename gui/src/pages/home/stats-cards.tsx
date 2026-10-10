import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";

function Bars({
	values,
	barClassName,
}: {
	values: string[];
	barClassName: string;
}) {
	return (
		<div className="flex h-7 shrink-0 items-end gap-0.75" aria-hidden="true">
			{values.map((height) => (
				<div
					key={height}
					style={{ height }}
					className={`min-w-0 flex-1 ${barClassName}`}
				/>
			))}
		</div>
	);
}

export function StatCards({ projectCount }: { projectCount: number }) {
	return (
		<div className="grid w-full grid-cols-2 gap-2.5 xl:grid-cols-4">
			<Card size="sm">
				<CardHeader>
					<CardDescription>PROJECTS</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">{projectCount}</div>
					<Bars
						values={["18px", "24px", "10px"]}
						barClassName="bg-primary last:bg-border"
					/>
					<p className="text-muted-foreground">2 connected</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>TASKS QUEUED</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">27</div>
					<Bars
						values={["12px", "20px", "28px", "8px"]}
						barClassName="bg-chart-3 last:bg-border"
					/>
					<p className="text-muted-foreground">8 ready · 4 in-review</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>WORKS ACTIVE</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">5</div>
					<div
						className="h-0.75 shrink-0 bg-border"
						role="progressbar"
						aria-valuenow={62}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label="Work success rate"
					>
						<div className="h-full w-[62%] bg-success" />
					</div>
					<p className="text-muted-foreground">128 total · 91% success</p>
				</CardContent>
			</Card>
			<Card size="sm">
				<CardHeader>
					<CardDescription>SOURCES</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-1">
					<div className="text-[26px] leading-8 font-bold">4/5</div>
					<div className="flex gap-1.5">
						<span className="text-success">Linear 3</span>
						<span className="text-muted-foreground">GitHub 1</span>
					</div>
					<p className="text-muted-foreground">Polled 30s ago</p>
				</CardContent>
			</Card>
		</div>
	);
}
