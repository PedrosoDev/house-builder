import type { PlannerStore } from "#/lib/planner/store";
import { FloorsList } from "./floors-list";
import { LayersPanel } from "./layers-panel";
import { ProjectHeader } from "./project-header";

/** Floating left panel (like Figma's): project name, floors, then the layers tree. */
export function LeftPanel({
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
	return (
		<aside
			aria-label="Projeto, pisos e camadas"
			className="absolute top-3 bottom-3 left-3 z-20 flex w-72 animate-in flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-lg ring-1 ring-black/5 duration-300 fade-in-0 slide-in-from-left-6"
		>
			<ProjectHeader
				store={store}
				saving={saving}
				onCollapse={onCollapse}
				onImport={onImport}
			/>
			<div className="h-px bg-border" />
			<FloorsList store={store} />
			<div className="h-px bg-border" />
			<div className="min-h-0 flex-1">
				<LayersPanel store={store} />
			</div>
		</aside>
	);
}
