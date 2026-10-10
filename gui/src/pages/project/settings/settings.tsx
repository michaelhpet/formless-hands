import { IconSettings } from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function ProjectSettingsPage() {
	const { projectId } = useParams({ strict: false });
	return (
		<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<IconSettings />
					</EmptyMedia>
					<EmptyTitle>Project settings</EmptyTitle>
					<EmptyDescription>
						Settings for {projectId ?? "this project"} will live here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
