import { IconArrowUp } from "@tabler/icons-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupTextarea } from "@/components/ui/input-group";

export interface PromptInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (value: string) => void;
	placeholder?: string;
	ariaLabel?: string;
	id?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	minRows?: number;
	maxRows?: number;
	className?: string;
}

export function PromptInput({
	value,
	onChange,
	onSubmit,
	placeholder = "Type a message...",
	ariaLabel = "Message input",
	id,
	disabled = false,
	autoFocus = false,
	minRows = 1,
	maxRows = 6,
	className,
}: PromptInputProps) {
	const submit = () => {
		if (disabled || value.trim() === "") {
			return;
		}
		onSubmit(value);
	};

	return (
		<InputGroup className={cn("h-auto items-end gap-2 p-2", className)}>
			<InputGroupTextarea
				id={id}
				rows={minRows}
				value={value}
				placeholder={placeholder}
				aria-label={ariaLabel}
				disabled={disabled}
				autoFocus={autoFocus}
				onChange={(event) => onChange(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
						event.preventDefault();
						submit();
					}
				}}
				style={{
					minHeight: `calc(${minRows}lh + 0.5rem)`,
					maxHeight: `calc(${maxRows}lh + 0.5rem)`,
				}}
				className="min-h-0 resize-none overflow-y-auto px-0 py-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
			/>
			<Button
				size="icon-sm"
				aria-label="Send message"
				disabled={disabled || value.trim() === ""}
				onClick={submit}
			>
				<IconArrowUp />
			</Button>
		</InputGroup>
	);
}
