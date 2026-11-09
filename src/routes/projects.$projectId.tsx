import { createFileRoute, notFound } from "@tanstack/react-router";
import { Editor } from "#/components/planner/editor";
import { Button } from "#/components/ui/button.tsx";
import { getProject } from "#/lib/planner/projects.functions";

export const Route = createFileRoute("/projects/$projectId")({
	// The editor relies on canvas/WebGL, so it only renders in the browser.
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
			Abrindo projeto…
		</div>
	),
	component: ProjectPage,
});

function ProjectPage() {
	const project = Route.useLoaderData();
	return <Editor key={project.id} initial={project} />;
}
