import {
	Download,
	Glasses,
	Grid3x3,
	Loader2,
	Maximize,
	MessageSquare,
	Redo2,
	Save,
	Settings2,
	Undo2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip.tsx";
import {
	exportPlanPng,
	exportPlanSvg,
	exportProjectJson,
	exportQuantitiesCsv,
	exportSnapshot3D,
} from "#/lib/planner/export";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";
import { cn } from "#/lib/utils";
import { VrDialog } from "./vr-dialog";

const card = "rounded-xl bg-card shadow-md ring-1 ring-black/5";

function IconBtn({
	label,
	children,
	...props
}: React.ComponentProps<typeof Button> & { label: string }) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={label} {...props}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

/** Top-right actions: undo/redo, fit, assistant, canvas options, export and save. */
export function TopActions({
	store,
	saving,
	onSave,
	assistantOpen,
	onToggleAssistant,
}: {
	store: PlannerStore;
	saving: boolean;
	onSave: () => void;
	assistantOpen: boolean;
	onToggleAssistant: () => void;
}) {
	const view = usePlanner(store, (s) => s.view);
	const canUndo = usePlanner(store, (s) => s.past.length > 0);
	const canRedo = usePlanner(store, (s) => s.future.length > 0);
	const snap = usePlanner(store, (s) => s.snap);
	const showGrid = usePlanner(store, (s) => s.showGrid);
	const showDimensions = usePlanner(store, (s) => s.showDimensions);
	const showRoomLabels = usePlanner(store, (s) => s.showRoomLabels);
	const smartGuides = usePlanner(store, (s) => s.smartGuides);
	const wheelZoom = usePlanner(store, (s) => s.wheelZoom);

	const [vrOpen, setVrOpen] = useState(false);

	const svgEl = () =>
		document.querySelector<SVGSVGElement>(".planner-canvas svg");

	return (
		<div className="absolute top-3 right-3 z-30 flex items-center gap-2">
			<div className={cn(card, "flex items-center p-0.5")}>
				<IconBtn
					label="Desfazer (Ctrl+Z)"
					disabled={!canUndo}
					onClick={() => store.undo()}
				>
					<Undo2 />
				</IconBtn>
				<IconBtn
					label="Refazer (Ctrl+Y)"
					disabled={!canRedo}
					onClick={() => store.redo()}
				>
					<Redo2 />
				</IconBtn>
				<IconBtn
					label="Enquadrar tudo (Shift+1)"
					onClick={() =>
						window.dispatchEvent(
							new Event(view === "3d" ? "planner:fit-3d" : "planner:fit"),
						)
					}
				>
					<Maximize />
				</IconBtn>
				<IconBtn
					label="Assistente"
					aria-pressed={assistantOpen}
					className={cn(assistantOpen && "bg-muted")}
					onClick={onToggleAssistant}
				>
					<MessageSquare />
				</IconBtn>
			</div>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn(card, "h-9 border-0")}
						aria-label="Opções"
					>
						<Settings2 /> <span className="max-2xl:hidden">Opções</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuLabel>Planta</DropdownMenuLabel>
					<DropdownMenuCheckboxItem
						checked={snap}
						onCheckedChange={(v) => store.setOption({ snap: Boolean(v) })}
					>
						Encaixe magnético
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={showGrid}
						onCheckedChange={(v) => store.setOption({ showGrid: Boolean(v) })}
					>
						<Grid3x3 /> Grade
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={showDimensions}
						onCheckedChange={(v) =>
							store.setOption({ showDimensions: Boolean(v) })
						}
					>
						Medidas das paredes
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={showRoomLabels}
						onCheckedChange={(v) =>
							store.setOption({ showRoomLabels: Boolean(v) })
						}
					>
						Nomes e áreas dos cômodos
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={smartGuides}
						onCheckedChange={(v) =>
							store.setOption({ smartGuides: Boolean(v) })
						}
					>
						Guias inteligentes
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={wheelZoom}
						onCheckedChange={(v) => store.setOption({ wheelZoom: Boolean(v) })}
					>
						Roda do mouse dá zoom
					</DropdownMenuCheckboxItem>
					<DropdownMenuSeparator />
					<DropdownMenuLabel>Passo da grade</DropdownMenuLabel>
					{[5, 10, 25, 50].map((g) => (
						<DropdownMenuItem
							key={g}
							onSelect={() => store.setOption({ grid: g })}
						>
							{g} cm
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="outline"
						size="sm"
						className={cn(card, "h-9 border-0")}
						aria-label="Exportar"
					>
						<Download /> <span className="max-2xl:hidden">Exportar</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					<DropdownMenuItem
						onSelect={() => exportProjectJson(store.getState().project)}
					>
						Projeto (.house.json)
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							svgEl() &&
							void exportPlanPng(
								svgEl() as SVGSVGElement,
								store.getState().project,
							)
						}
					>
						Planta 2D (PNG)
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() =>
							svgEl() &&
							exportPlanSvg(svgEl() as SVGSVGElement, store.getState().project)
						}
					>
						Planta 2D (SVG)
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={view === "2d"}
						onSelect={() => exportSnapshot3D()}
					>
						Imagem 3D (PNG)
					</DropdownMenuItem>
					<DropdownMenuItem
						onSelect={() => exportQuantitiesCsv(store.getState().project)}
					>
						Quantitativo (CSV)
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				variant="outline"
				size="sm"
				className={cn(card, "h-9 border-0")}
				aria-label="Ver no Meta Quest"
				onClick={() => {
					// o Quest lê a versão salva: garante que ela está em dia antes de mostrar o link
					onSave();
					setVrOpen(true);
				}}
			>
				<Glasses /> <span className="max-2xl:hidden">Ver em VR</span>
			</Button>
			<VrDialog
				projectId={store.getState().project.id}
				open={vrOpen}
				onOpenChange={setVrOpen}
			/>
			<Button
				size="sm"
				className="h-9 px-4 shadow-md"
				onClick={onSave}
				disabled={saving}
			>
				{saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar
			</Button>
		</div>
	);
}
