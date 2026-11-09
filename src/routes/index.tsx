import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
	Copy,
	Home,
	Layers,
	MoreVertical,
	Pencil,
	Trash2,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAppForm } from "#/components/form/form-hooks.tsx";
import { NewProjectDialog } from "#/components/planner/new-project-dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "#/components/ui/alert-dialog.tsx";
import { Button } from "#/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card.tsx";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import { FieldGroup } from "#/components/ui/field.tsx";
import { parseProjectJson } from "#/lib/planner/export";
import { uid } from "#/lib/planner/geometry";
import {
	deleteProject,
	getProject,
	listProjects,
	type ProjectSummary,
	renameProject,
	saveProject,
} from "#/lib/planner/projects.functions";
import { buildTemplate, TEMPLATES } from "#/lib/planner/templates";

export const Route = createFileRoute("/")({
	loader: () => listProjects(),
	component: Home_,
});

function Home_() {
	const projects = Route.useLoaderData();
	const router = useRouter();
	const fileRef = useRef<HTMLInputElement>(null);
	const [renaming, setRenaming] = useState<ProjectSummary | null>(null);
	const [deleting, setDeleting] = useState<ProjectSummary | null>(null);

	const refresh = () => router.invalidate();

	const duplicate = async (p: ProjectSummary) => {
		const doc = await getProject({ data: { id: p.id } });
		if (!doc) return;
		await saveProject({
			data: {
				project: { ...doc, id: uid("proj"), name: `${doc.name} (cópia)` },
				thumbnail: p.thumbnail,
			},
		});
		toast.success("Projeto duplicado");
		await refresh();
	};

	const onImport = async (file: File | undefined) => {
		if (!file) return;
		try {
			const parsed = parseProjectJson(await file.text());
			await saveProject({ data: { project: { ...parsed, id: uid("proj") } } });
			toast.success(`“${parsed.name}” importado`);
			await refresh();
		} catch (e) {
			toast.error(
				`Arquivo inválido: ${e instanceof Error ? e.message : "formato desconhecido"}`,
			);
		}
		if (fileRef.current) fileRef.current.value = "";
	};

	return (
		<div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-6 py-10">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
						<Home className="size-6" />
					</div>
					<div>
						<h1 className="text-2xl font-bold tracking-tight">House Builder</h1>
						<p className="text-sm text-muted-foreground">
							Projete plantas em 2D e visualize em 3D.
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => fileRef.current?.click()}>
						<Upload /> Importar
					</Button>
					<input
						ref={fileRef}
						type="file"
						accept=".json,application/json"
						className="hidden"
						onChange={(e) => void onImport(e.target.files?.[0])}
					/>
					<NewProjectDialog />
				</div>
			</header>

			<section aria-labelledby="templates">
				<h2 id="templates" className="mb-3 text-lg font-semibold">
					Comece por um modelo
				</h2>
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{TEMPLATES.map((t) => (
						<NewProjectDialog
							key={t.id}
							initialTemplate={t.id}
							trigger={
								<button
									type="button"
									className="group flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
								>
									<TemplateThumb id={t.id} />
									<span className="text-sm font-medium">{t.name}</span>
									<span className="text-xs text-muted-foreground">
										{t.area} · {t.floors} {t.floors > 1 ? "pisos" : "piso"}
									</span>
								</button>
							}
						/>
					))}
				</div>
			</section>

			<section aria-labelledby="projects">
				<h2 id="projects" className="mb-3 text-lg font-semibold">
					Meus projetos
				</h2>
				{projects.length === 0 ? (
					<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
						<Layers className="size-8 text-muted-foreground" />
						<p className="text-sm text-muted-foreground">
							Você ainda não tem projetos. Crie o primeiro a partir de um
							modelo.
						</p>
						<NewProjectDialog />
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{projects.map((p) => (
							<Card key={p.id} className="overflow-hidden pt-0">
								<Link
									to="/projects/$projectId"
									params={{ projectId: p.id }}
									className="block"
								>
									<div className="flex aspect-[16/10] items-center justify-center bg-muted">
										{p.thumbnail ? (
											<img
												src={p.thumbnail}
												alt={`Planta de ${p.name}`}
												className="size-full object-contain"
											/>
										) : (
											<Home className="size-10 text-muted-foreground/50" />
										)}
									</div>
								</Link>
								<CardHeader>
									<CardTitle className="truncate">{p.name}</CardTitle>
									<CardDescription>
										{p.floors} {p.floors > 1 ? "pisos" : "piso"} ·{" "}
										{p.area.toFixed(1)} m² · editado{" "}
										{new Date(p.updatedAt).toLocaleString("pt-BR", {
											dateStyle: "short",
											timeStyle: "short",
										})}
									</CardDescription>
								</CardHeader>
								<CardContent className="hidden" />
								<CardFooter className="gap-2">
									<Button asChild size="sm" className="flex-1">
										<Link
											to="/projects/$projectId"
											params={{ projectId: p.id }}
										>
											Abrir
										</Link>
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												size="icon"
												variant="outline"
												aria-label={`Ações de ${p.name}`}
											>
												<MoreVertical />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => setRenaming(p)}>
												<Pencil /> Renomear
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => void duplicate(p)}>
												<Copy /> Duplicar
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onSelect={() => setDeleting(p)}
											>
												<Trash2 /> Excluir
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</CardFooter>
							</Card>
						))}
					</div>
				)}
			</section>

			<RenameDialog
				project={renaming}
				onClose={() => setRenaming(null)}
				onDone={refresh}
			/>
			<AlertDialog
				open={!!deleting}
				onOpenChange={(o) => !o && setDeleting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir “{deleting?.name}”?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta ação não pode ser desfeita. Exporte o projeto antes se quiser
							guardar uma cópia.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={async () => {
								if (!deleting) return;
								await deleteProject({ data: { id: deleting.id } });
								toast.success("Projeto excluído");
								setDeleting(null);
								await refresh();
							}}
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function RenameDialog({
	project,
	onClose,
	onDone,
}: {
	project: ProjectSummary | null;
	onClose: () => void;
	onDone: () => unknown;
}) {
	const form = useAppForm({
		defaultValues: { name: project?.name ?? "" },
		validators: {
			onChange: z.object({
				name: z.string().trim().min(1, "Informe um nome").max(120),
			}),
		},
		onSubmit: async ({ value }) => {
			if (!project) return;
			await renameProject({
				data: { id: project.id, name: value.name.trim() },
			});
			onClose();
			await onDone();
		},
	});
	return (
		<Dialog
			open={!!project}
			onOpenChange={(o) => {
				if (!o) onClose();
				else form.reset({ name: project?.name ?? "" });
			}}
		>
			<DialogContent
				key={project?.id}
				onOpenAutoFocus={() => form.reset({ name: project?.name ?? "" })}
			>
				<DialogHeader>
					<DialogTitle>Renomear projeto</DialogTitle>
					<DialogDescription>
						O nome aparece na lista de projetos e nas exportações.
					</DialogDescription>
				</DialogHeader>
				<form
					className="flex flex-col gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						void form.handleSubmit();
					}}
				>
					<FieldGroup>
						<form.AppField name="name">
							{(f) => <f.TextField label="Nome" autoFocus />}
						</form.AppField>
					</FieldGroup>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancelar
						</Button>
						<form.AppForm>
							<form.SubmitButton>Salvar</form.SubmitButton>
						</form.AppForm>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** Tiny schematic preview of a template drawn from its walls. */
function TemplateThumb({ id }: { id: (typeof TEMPLATES)[number]["id"] }) {
	const p = buildTemplate(id);
	const f = p.floors[0];
	const xs = f.walls.flatMap((w) => [w.a.x, w.b.x]);
	const ys = f.walls.flatMap((w) => [w.a.y, w.b.y]);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	const w = Math.max(...xs) - minX;
	const h = Math.max(...ys) - minY;
	const pad = 40;
	return (
		<svg
			viewBox={`${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`}
			className="aspect-[4/3] w-full rounded-md bg-muted"
			aria-hidden
		>
			{f.rooms.map((r) => (
				<path
					key={r.id}
					d={`${r.points.map((q, i) => `${i ? "L" : "M"}${q.x} ${q.y}`).join(" ")}Z`}
					fill={r.floor.color}
					opacity={0.8}
				/>
			))}
			{f.walls.map((wl) => (
				<line
					key={wl.id}
					x1={wl.a.x}
					y1={wl.a.y}
					x2={wl.b.x}
					y2={wl.b.y}
					stroke="currentColor"
					strokeWidth={wl.partition ? 8 : 16}
					strokeLinecap="square"
					className="text-foreground/70"
				/>
			))}
		</svg>
	);
}
