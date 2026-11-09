import { Bot, SendHorizontal, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Button } from "#/components/ui/button.tsx";
import { ScrollArea } from "#/components/ui/scroll-area.tsx";
import { ASSISTANT_EXAMPLES, runAssistant } from "#/lib/planner/assistant";
import type { PlannerStore } from "#/lib/planner/store";
import { cn } from "#/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };

const schema = z.object({
	message: z.string().trim().min(1, "Digite um comando"),
});

export function AssistantPanel({ store }: { store: PlannerStore }) {
	const [messages, setMessages] = useState<Msg[]>([
		{
			role: "assistant",
			text: "Olá! Eu aplico comandos simples direto no projeto. Experimente um dos exemplos abaixo.",
		},
	]);
	const endRef = useRef<HTMLDivElement>(null);

	const send = (text: string) => {
		const reply = runAssistant(store, text);
		setMessages((m) => [
			...m,
			{ role: "user", text },
			{ role: "assistant", text: reply },
		]);
	};

	const form = useAppForm({
		defaultValues: { message: "" },
		validators: { onSubmit: schema },
		onSubmit: ({ value, formApi }) => {
			send(value.message);
			formApi.reset();
		},
	});

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	return (
		<div className="flex h-full flex-col">
			<ScrollArea className="min-h-0 flex-1">
				<div className="flex flex-col gap-3 p-3">
					{messages.map((m, i) => (
						<div
							key={i}
							className={cn(
								"flex gap-2",
								m.role === "user" && "flex-row-reverse",
							)}
						>
							<div
								className={cn(
									"flex size-7 shrink-0 items-center justify-center rounded-full",
									m.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-muted",
								)}
							>
								{m.role === "user" ? (
									<User className="size-4" />
								) : (
									<Bot className="size-4" />
								)}
							</div>
							<div
								className={cn(
									"max-w-[85%] rounded-lg px-3 py-2 text-sm",
									m.role === "user"
										? "bg-primary text-primary-foreground"
										: "bg-muted",
								)}
							>
								{m.text}
							</div>
						</div>
					))}
					<div ref={endRef} />
				</div>
			</ScrollArea>
			<div className="flex flex-wrap gap-1.5 border-t px-3 pt-3">
				{ASSISTANT_EXAMPLES.map((ex) => (
					<Button key={ex} size="xs" variant="outline" onClick={() => send(ex)}>
						{ex}
					</Button>
				))}
			</div>
			<form
				className="flex items-start gap-2 p-3"
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
			>
				<form.AppField name="message">
					{(f) => (
						<f.TextField
							label="Comando"
							className="flex-1"
							placeholder="Ex.: adicione uma cama de casal"
						/>
					)}
				</form.AppField>
				<form.AppForm>
					<form.SubmitButton className="mt-[1.65rem]">
						<SendHorizontal /> <span className="sr-only">Enviar</span>
					</form.SubmitButton>
				</form.AppForm>
			</form>
		</div>
	);
}
