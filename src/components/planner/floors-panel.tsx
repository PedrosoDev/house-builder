import {
	ArrowDown,
	ArrowUp,
	Copy,
	Eye,
	EyeOff,
	Layers,
	Plus,
	Trash2,
} from "lucide-react";
import { Badge } from "#/components/ui/badge.tsx";
import { Button } from "#/components/ui/button.tsx";
import { ScrollArea } from "#/components/ui/scroll-area.tsx";
import { formatArea, polygonArea } from "#/lib/planner/geometry";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";
import { cn } from "#/lib/utils";

export function FloorsPanel({ store }: { store: PlannerStore }) {
	const project = usePlanner(store, (s) => s.project);
	const floors = [...project.floors].reverse();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b p-3">
				<div className="flex items-center gap-2 text-sm font-semibold">
					<Layers className="size-4" /> Pisos
				</div>
				<div className="flex gap-1">
					<Button size="xs" variant="outline" onClick={() => store.addFloor()}>
						<Plus /> Novo
					</Button>
					<Button
						size="xs"
						variant="outline"
						onClick={() => store.addFloor(project.currentFloorId)}
						title="Duplicar piso atual"
					>
						<Copy /> Duplicar
					</Button>
				</div>
			</div>
			<ScrollArea className="min-h-0 flex-1">
				<ul className="flex flex-col gap-2 p-3">
					{floors.map((f) => {
						const active = f.id === project.currentFloorId;
						const area = f.rooms.reduce((s, r) => s + polygonArea(r.points), 0);
						const index = project.floors.findIndex((x) => x.id === f.id);
						return (
							<li key={f.id}>
								<div
									className={cn(
										"flex items-center gap-2 rounded-lg border p-2.5 transition-colors",
										active ? "border-primary bg-primary/5" : "hover:bg-accent",
									)}
								>
									<button
										type="button"
										className="flex min-w-0 flex-1 flex-col items-start text-left"
										onClick={() => store.setCurrentFloor(f.id)}
									>
										<span className="flex w-full items-center gap-2 text-sm font-medium">
											<span className="truncate">{f.name}</span>
											{active && <Badge variant="secondary">atual</Badge>}
										</span>
										<span className="text-xs text-muted-foreground">
											{f.walls.length} paredes · {f.items.length} objetos ·{" "}
											{formatArea(area, project.units)}
										</span>
									</button>
									<div className="flex shrink-0 items-center">
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => store.moveFloor(f.id, 1)}
											disabled={index === project.floors.length - 1}
											aria-label="Subir piso"
										>
											<ArrowUp />
										</Button>
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => store.moveFloor(f.id, -1)}
											disabled={index === 0}
											aria-label="Descer piso"
										>
											<ArrowDown />
										</Button>
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => store.toggleFloorVisible(f.id)}
											aria-label={f.visible ? "Ocultar no 3D" : "Mostrar no 3D"}
										>
											{f.visible ? <Eye /> : <EyeOff />}
										</Button>
										<Button
											size="icon-xs"
											variant="ghost"
											onClick={() => store.deleteFloor(f.id)}
											disabled={project.floors.length <= 1}
											aria-label="Excluir piso"
										>
											<Trash2 />
										</Button>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
				<p className="px-3 pb-4 text-xs text-muted-foreground">
					O piso abaixo do atual aparece esmaecido na planta. Altere o
					pé-direito e o telhado no painel de propriedades.
				</p>
			</ScrollArea>
		</div>
	);
}
