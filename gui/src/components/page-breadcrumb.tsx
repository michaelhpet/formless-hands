import { Fragment, type ReactElement, type ReactNode } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "./ui/breadcrumb";

export function PageBreadcrumb({
	items,
}: {
	items: [...links: ReactElement[], current: ReactNode];
}) {
	const links = items.slice(0, -1) as ReactElement[];
	const current = items[items.length - 1];
	return (
		<Breadcrumb>
			<BreadcrumbList>
				{links.map((link) => (
					<Fragment key={link.key}>
						<BreadcrumbItem>
							<BreadcrumbLink render={link} />
						</BreadcrumbItem>
						<BreadcrumbSeparator />
					</Fragment>
				))}
				<BreadcrumbItem key="current">
					<BreadcrumbPage>{current}</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
