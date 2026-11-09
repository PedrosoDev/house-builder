import {
	ArrowDown,
	ArrowUp,
	Copy,
	Eye,
	EyeOff,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import { formatArea, polygonArea } from "#/lib/planner/geometry";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";
import { cn } from "#/lib/utils";

/** Compact floors list for the left panel (Figma's "Pages" section): pick, show/hide, duplicate, reorder, delete. */
export function FloorsList({ store }: { store: PlannerStore }) {
	const project = usePlanner(store, (s) => s.project);
	const floors = [...project.floors].reverse();

	return (
		<section aria-label="Pisos" className="px-3 pt-3 pb-2">
			<div className="mb-1.5 flex items-center justify-between pl-1">
				<h2 className="text-sm font-semibold">Pisos</h2>
				<Button
					size="icon-xs"
					variant="ghost"
					aria-label="Novo piso"
					title="Novo piso"
					onClick={() => store.addFloor()}
				>
					<Plus />
				</Button>
			</div>
			<ul className="flex max-h-36 flex-col gap-0.5 overflow-y-auto">
				{floors.map((f) => {
					const active = f.id === project.currentFloorId;
					const area = f.rooms.reduce((s, r) => s + polygonArea(r.points), 0);
					const index = project.floors.findIndex((x) => x.id === f.id);
					return (
						<li key={f.id}>
							<div
								className={cn(
									"group flex items-center gap-1 rounded-lg pr-1 text-sm",
									active ? "bg-muted font-semibold" : "hover:bg-muted/60",
								)}
							>
								<button
									type="button"
									className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left"
									aria-current={active ? "true" : undefined}
									onClick={() => store.setCurrentFloor(f.id)}
								>
									<span className="truncate">{f.name}</span>
									<span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">
										{f.rooms.length === 0
											? "vazio"
											: formatArea(area, project.units)}
									</span>
								</button>
								<Button
									size="icon-xs"
									variant="ghost"
									className={cn(!f.visible && "text-muted-foreground")}
									aria-label={f.visible ? "Ocultar no 3D" : "Mostrar no 3D"}
									title={f.visible ? "Ocultar no 3D" : "Mostrar no 3D"}
									onClick={() => store.toggleFloorVisible(f.id)}
								>
									{f.visible ? <Eye /> : <EyeOff />}
								</Button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											size="icon-xs"
											variant="ghost"
											className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
											aria-label={`Ações do ${f.name}`}
										>
											<MoreHorizontal />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-44">
										<DropdownMenuItem onSelect={() => store.addFloor(f.id)}>
											<Copy /> Duplicar piso
										</DropdownMenuItem>
										<DropdownMenuItem
											disabled={index === project.floors.length - 1}
											onSelect={() => store.moveFloor(f.id, 1)}
										>
											<ArrowUp /> Subir piso
										</DropdownMenuItem>
										<DropdownMenuItem
											disabled={index === 0}
											onSelect={() => store.moveFloor(f.id, -1)}
										>
											<ArrowDown /> Descer piso
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											variant="destructive"
											disabled={project.floors.length <= 1}
											onSelect={() => store.deleteFloor(f.id)}
										>
											<Trash2 /> Excluir piso
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
