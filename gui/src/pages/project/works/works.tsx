import { IconPlayerPlay } from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function WorksPage() {
	const { projectId } = useParams({ strict: false });
	return (
		<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<IconPlayerPlay />
					</EmptyMedia>
					<EmptyTitle>Works</EmptyTitle>
					<EmptyDescription>
						Work history for {projectId ?? "this project"} will live here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
