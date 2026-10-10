import { cn } from "cn";

export function BrandLogo({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex items-center font-brand text-[22px] leading-none",
				className,
			)}
			role="img"
			aria-label="Formless Hands"
		>
			<span aria-hidden="true" className="text-foreground">
				f
			</span>
			<span aria-hidden="true" className="text-destructive">
				(
			</span>
			<span aria-hidden="true" className="text-foreground">
				h
			</span>
			<span aria-hidden="true" className="text-destructive">
				)
			</span>
		</span>
	);
}
