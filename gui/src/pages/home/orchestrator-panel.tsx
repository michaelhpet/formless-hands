import { useState } from "react";
import { PromptInput } from "@/components/prompt-input";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Message,
	MessageContent,
	MessageFooter,
} from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
	id: number;
	role: "user" | "assistant";
	text: string;
	time?: string;
	actions?: string[];
}

const INITIAL_MESSAGES: ChatMessage[] = [
	{
		id: 1,
		role: "user",
		text: "Why did billing-worker fail to clone?",
		time: "10:31",
	},
	{
		id: 2,
		role: "assistant",
		text: "SSH key rejected by github.com — add your key or check ~/.ssh/config, then hit Retry. No sources attached yet.",
		actions: ["Retry clone", "Show logs"],
	},
	{
		id: 3,
		role: "user",
		text: "Add linear source to classroom-api",
	},
];

export function OrchestratorPanel() {
	const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
	const [draft, setDraft] = useState("");
	const [nextId, setNextId] = useState(INITIAL_MESSAGES.length + 1);

	const send = (text: string) => {
		const trimmed = text.trim();
		if (!trimmed) {
			return;
		}
		setMessages((prev) => [
			...prev,
			{ id: nextId, role: "user", text: trimmed },
		]);
		setNextId((id) => id + 1);
		setDraft("");
	};

	return (
		<aside className="flex w-full flex-col gap-3 lg:sticky lg:top-16 lg:h-[calc(100dvh-5rem)] lg:w-95 lg:shrink-0">
			<Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
				<CardContent className="flex h-full min-h-0 flex-col p-0">
					<ScrollArea className="h-full min-h-0">
						<div className="flex flex-col gap-2.5 px-4 py-4">
							{messages.map((message) =>
								message.role === "user" ? (
									<Message key={message.id} align="end">
										<MessageContent>
											<Bubble variant="muted" align="end">
												<BubbleContent>{message.text}</BubbleContent>
											</Bubble>
											{message.time ? (
												<MessageFooter>{message.time}</MessageFooter>
											) : null}
										</MessageContent>
									</Message>
								) : (
									<Message key={message.id} align="start">
										<MessageContent>
											<Bubble variant="outline">
												<BubbleContent>{message.text}</BubbleContent>
											</Bubble>
											{message.actions ? (
												<div className="flex gap-1.5">
													{message.actions.map((action) => (
														<Button key={action} variant="outline" size="xs">
															{action}
														</Button>
													))}
												</div>
											) : null}
										</MessageContent>
									</Message>
								),
							)}
						</div>
					</ScrollArea>
				</CardContent>
			</Card>

			<PromptInput
				value={draft}
				onChange={setDraft}
				onSubmit={send}
				placeholder="Ask orchestrator..."
				ariaLabel="Ask orchestrator"
				minRows={3}
				maxRows={10}
			/>
		</aside>
	);
}
