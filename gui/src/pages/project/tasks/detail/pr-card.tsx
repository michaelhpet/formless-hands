import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useProjects } from "@/lib/api/projects";
import { useConfig } from "@/lib/api/settings";
import { type Task, useReviews } from "@/lib/api/tasks";

function githubSlug(remote: string): string | null {
	const clean = remote.trim().replace(/\.git$/, "");
	const ssh = clean.match(/^git@github\.com:(.+)$/);
	if (ssh) {
		return ssh[1];
	}
	const https = clean.match(/^https:\/\/github\.com\/(.+)$/);
	if (https) {
		return https[1];
	}
	return null;
}

async function copy(text: string) {
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		return;
	}
}

export function PrCard({
	projectName,
	task,
}: {
	projectName: string | undefined;
	task: Task;
}) {
	const projectsQuery = useProjects();
	const configQuery = useConfig();
	const reviewsQuery = useReviews(task.id);
	const project = (projectsQuery.data ?? []).find(
		(item) => item.name === projectName,
	);
	const slug =
		project && task.branch !== "" ? githubSlug(project.remote_url) : null;
	const approved =
		configQuery.data?.merge.mode === "pr" &&
		slug !== null &&
		project !== undefined &&
		(reviewsQuery.data ?? []).some((review) => review.kind === "approved") &&
		!(reviewsQuery.data ?? []).some(
			(review) => review.kind === "changes-requested" && !review.resolved,
		);
	if (!approved || project === undefined || slug === null) {
		return null;
	}
	const url = `https://github.com/${slug}/compare/${project.default_branch}...${task.branch}?expand=1`;
	const description =
		task.body.trim() === "" ? task.title : `${task.title}\n\n${task.body}`;

	return (
		<Card>
			<CardContent className="flex flex-col gap-2.5">
				<div className="flex items-center justify-between gap-3">
					<span className="text-[13px] font-bold text-foreground">
						Pull request ready
					</span>
					<span className="text-muted-foreground">
						Submit it on GitHub — daemon will not opens PRs
					</span>
				</div>
				<p className="text-[13px] text-foreground">{task.title}</p>
				<p className="text-muted-foreground wrap-break-word">{description}</p>
				<p className="text-muted-foreground wrap-break-word">{url}</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => void copy(description)}
					>
						Copy description
					</Button>
					<Button variant="outline" size="sm" onClick={() => void copy(url)}>
						Copy link
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
