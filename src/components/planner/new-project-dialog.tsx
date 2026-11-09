import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog.tsx";
import { FieldGroup, FieldLabel } from "#/components/ui/field.tsx";
import { saveProject } from "#/lib/planner/projects.functions";
import {
	buildTemplate,
	TEMPLATES,
	type TemplateId,
} from "#/lib/planner/templates";
import { cn } from "#/lib/utils";

const schema = z.object({
	name: z
		.string()
		.trim()
		.min(2, "O nome precisa de ao menos 2 caracteres")
		.max(120, "Máximo de 120 caracteres"),
	template: z.string(),
	units: z.enum(["metric", "imperial"]),
});

export function NewProjectDialog({
	initialTemplate,
	trigger,
}: {
	initialTemplate?: TemplateId;
	trigger?: React.ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();

	const form = useAppForm({
		defaultValues: {
			name: "Meu novo projeto",
			template: (initialTemplate ?? "empty") as string,
			units: "metric" as "metric" | "imperial",
		},
		validators: { onChange: schema },
		onSubmit: async ({ value }) => {
			const project = buildTemplate(
				value.template as TemplateId,
				value.name.trim(),
			);
			project.units = value.units;
			try {
				await saveProject({ data: { project } });
				setOpen(false);
				await navigate({
					to: "/projects/$projectId",
					params: { projectId: project.id },
				});
			} catch (e) {
				toast.error(
					`Não foi possível criar o projeto: ${e instanceof Error ? e.message : "erro"}`,
				);
			}
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (o) {
					form.reset({
						name: "Meu novo projeto",
						template: initialTemplate ?? "empty",
						units: "metric",
					});
				}
			}}
		>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button>
						<Plus /> Novo projeto
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Novo projeto</DialogTitle>
					<DialogDescription>
						Escolha um modelo para começar e dê um nome ao projeto.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-5"
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					<FieldGroup className="gap-5">
						<form.AppField name="name">
							{(f) => <f.TextField label="Nome do projeto" autoFocus />}
						</form.AppField>
						<form.AppField name="units">
							{(f) => (
								<f.SelectField
									label="Unidades"
									options={[
										{ value: "metric", label: "Métrico (m, cm)" },
										{ value: "imperial", label: "Imperial (ft, in)" },
									]}
								/>
							)}
						</form.AppField>
						<form.Field name="template">
							{(field) => (
								<div className="flex flex-col gap-2">
									<FieldLabel>Modelo inicial</FieldLabel>
									<div className="grid grid-cols-2 gap-2">
										{TEMPLATES.map((t) => (
											<button
												key={t.id}
												type="button"
												onClick={() => field.handleChange(t.id)}
												className={cn(
													"flex flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
													field.state.value === t.id &&
														"border-primary bg-primary/5 ring-1 ring-primary",
												)}
											>
												<span className="text-sm font-medium">{t.name}</span>
												<span className="text-xs text-muted-foreground">
													{t.description}
												</span>
												<span className="mt-1 text-xs text-muted-foreground">
													{t.area} · {t.floors}{" "}
													{t.floors > 1 ? "pisos" : "piso"}
												</span>
											</button>
										))}
									</div>
								</div>
							)}
						</form.Field>
					</FieldGroup>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<form.AppForm>
							<form.SubmitButton>Criar e abrir</form.SubmitButton>
						</form.AppForm>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
