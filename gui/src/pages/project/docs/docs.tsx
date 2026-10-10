import { IconFileText } from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function DocsPage() {
	const { projectId } = useParams({ strict: false });
	return (
		<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<IconFileText />
					</EmptyMedia>
					<EmptyTitle>Docs</EmptyTitle>
					<EmptyDescription>
						Documentation for {projectId ?? "this project"} will live here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
