import { createFileRoute, notFound } from "@tanstack/react-router";
import { VrView } from "#/components/planner/vr-view";
import { Button } from "#/components/ui/button.tsx";
import { getProject } from "#/lib/planner/projects.functions";

// Visita em realidade virtual (somente leitura), pensada para abrir no navegador do Meta Quest.
export const Route = createFileRoute("/vr/$projectId")({
	// WebGL/WebXR só existem no navegador.
	ssr: false,
	loader: async ({ params }) => {
		const project = await getProject({ data: { id: params.projectId } });
		if (!project) throw notFound();
		return project;
	},
	notFoundComponent: () => (
		<div className="flex h-dvh flex-col items-center justify-center gap-3">
			<p className="text-lg font-semibold">Projeto não encontrado</p>
			<Button asChild>
				<a href="/">Voltar aos projetos</a>
			</Button>
		</div>
	),
	pendingComponent: () => (
		<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
			Carregando a casa…
		</div>
	),
	component: VrPage,
});

function VrPage() {
	const project = Route.useLoaderData();
	return <VrView key={project.id} project={project} />;
}
