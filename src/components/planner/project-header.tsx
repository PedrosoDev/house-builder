import { Link } from "@tanstack/react-router";
import {
	ArrowLeft,
	Check,
	ChevronDown,
	Loader2,
	PanelLeftClose,
	Pencil,
	Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import { Input } from "#/components/ui/input.tsx";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";

const schema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Dê um nome ao projeto")
		.max(80, "Máximo 80 caracteres"),
});

/** Inline project-name editor (TanStack Form + shadcn Input). Enter saves, Esc cancels. */
function NameEdit({
	store,
	initial,
	onDone,
}: {
	store: PlannerStore;
	initial: string;
	onDone: () => void;
}) {
	const finished = useRef(false);
	const ref = useRef<HTMLInputElement>(null);
	const form = useAppForm({
		defaultValues: { name: initial },
		validators: { onChange: schema },
		onSubmit: ({ value }) => {
			finished.current = true;
			const next = value.name.trim();
			store.mutate((d) => {
				d.name = next;
			});
			onDone();
		},
	});
	useEffect(() => {
		ref.current?.focus();
		ref.current?.select();
	}, []);
	return (
		<form
			className="min-w-0 flex-1"
			onSubmit={(e) => {
				e.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name="name">
				{(field) => (
					<Input
						ref={ref}
						value={field.state.value}
						aria-label="Nome do projeto"
						aria-invalid={!field.state.meta.isValid}
						className="h-7 px-2 text-sm font-semibold"
						onChange={(e) => field.handleChange(e.target.value)}
						onBlur={() => {
							if (finished.current) return;
							if (field.state.meta.isValid) void form.handleSubmit();
							else onDone();
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								finished.current = true;
								onDone();
							}
							e.stopPropagation();
						}}
					/>
				)}
			</form.Field>
		</form>
	);
}

export function SaveState({
	dirty,
	saving,
	savedAt,
}: {
	dirty: boolean;
	saving: boolean;
	savedAt: string | null;
}) {
	if (saving) {
		return (
			<span className="flex items-center gap-1 text-xs text-muted-foreground">
				<Loader2 className="size-3 animate-spin" /> Salvando…
			</span>
		);
	}
	if (dirty)
		return (
			<span className="text-xs text-amber-600">Alterações não salvas</span>
		);
	if (savedAt) {
		return (
			<span className="flex items-center gap-1 text-xs text-muted-foreground">
				<Check className="size-3" /> Salvo automaticamente
			</span>
		);
	}
	return null;
}

/** Top of the left panel: back, project name (renamable), project menu, collapse button and the save state. */
export function ProjectHeader({
	store,
	saving,
	onCollapse,
	onImport,
}: {
	store: PlannerStore;
	saving: boolean;
	onCollapse: () => void;
	onImport: () => void;
}) {
	const name = usePlanner(store, (s) => s.project.name);
	const dirty = usePlanner(store, (s) => s.dirty);
	const savedAt = usePlanner(store, (s) => s.savedAt);
	const [editing, setEditing] = useState(false);

	return (
		<header className="px-3 pt-3 pb-2">
			<div className="flex items-center gap-1">
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					aria-label="Voltar aos projetos"
				>
					<Link to="/">
						<ArrowLeft />
					</Link>
				</Button>
				{editing ? (
					<NameEdit
						store={store}
						initial={name}
						onDone={() => setEditing(false)}
					/>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left hover:bg-muted"
								title="Menu do projeto"
							>
								<span className="truncate text-[15px] font-semibold">
									{name}
								</span>
								<ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-52">
							<DropdownMenuItem onSelect={() => setEditing(true)}>
								<Pencil /> Renomear projeto
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onImport}>
								<Upload /> Importar projeto…
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link to="/">
									<ArrowLeft /> Todos os projetos
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label="Recolher painel"
					title="Recolher painel"
					onClick={onCollapse}
				>
					<PanelLeftClose />
				</Button>
			</div>
			<div className="mt-0.5 pl-9 min-h-4">
				<SaveState dirty={dirty} saving={saving} savedAt={savedAt} />
			</div>
		</header>
	);
}
