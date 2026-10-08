import { IconSettings } from "@tabler/icons-react";
import { AppLayout } from "@/components/app-layout";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";

export function SettingsPage() {
	return (
		<AppLayout>
			<div className="flex w-full flex-1 items-center justify-center px-5 py-16">
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconSettings />
						</EmptyMedia>
						<EmptyTitle>Settings</EmptyTitle>
						<EmptyDescription>
							Daemon, SSH, and source defaults will live here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
		</AppLayout>
	);
}
