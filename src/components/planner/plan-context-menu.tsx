import {
	ArrowDownToLine,
	ArrowUpToLine,
	ChevronDown,
	ChevronUp,
	ClipboardPaste,
	Copy,
	CopyPlus,
	FlipHorizontal2,
	Group,
	Lock,
	LockOpen,
	Maximize,
	RotateCw,
	Scissors,
	Trash2,
	Ungroup,
} from "lucide-react";
import {
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuShortcut,
} from "#/components/ui/context-menu.tsx";
import type { PlannerStore } from "#/lib/planner/store";
import { currentFloorOf, usePlanner } from "#/lib/planner/store";

/** Right-click menu for the 2D canvas; entries depend on what is selected. */
export function PlanContextMenuContent({
	store,
	onFitSelection,
}: {
	store: PlannerStore;
	onFitSelection: () => void;
}) {
	const selection = usePlanner(store, (s) => s.selection);
	const project = usePlanner(store, (s) => s.project);
	const clipboard = usePlanner(store, (s) => s.clipboard);
	const floor = currentFloorOf(project);

	const items = selection
		.filter((s) => s.kind === "item")
		.map((s) => floor.items.find((i) => i.id === s.id))
		.filter((i) => !!i);
	const hasSelection = selection.length > 0;
	const hasItems = items.length > 0;
	const anyLocked = items.some((i) => i?.locked);
	const anyGrouped = items.some((i) => i?.groupId);
	const oneWall = selection.length === 1 && selection[0].kind === "wall";
	const rotatable = selection.some(
		(s) => s.kind === "item" || s.kind === "stair",
	);
	const duplicable = selection.some(
		(s) => s.kind === "item" || s.kind === "room" || s.kind === "stair",
	);

	return (
		<ContextMenuContent className="w-56">
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.copySelection()}
			>
				<Copy /> Copiar <ContextMenuShortcut>Ctrl C</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={clipboard.length === 0}
				onSelect={() => store.paste()}
			>
				<ClipboardPaste /> Colar{" "}
				<ContextMenuShortcut>Ctrl V</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!duplicable}
				onSelect={() => store.duplicateSelection()}
			>
				<CopyPlus /> Duplicar <ContextMenuShortcut>Ctrl D</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem
				disabled={!rotatable}
				onSelect={() => store.rotateSelection(90)}
			>
				<RotateCw /> Girar 90°
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.flipSelection()}
			>
				<FlipHorizontal2 /> Espelhar
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!oneWall}
				onSelect={() => store.splitSelectedWall()}
			>
				<Scissors /> Dividir parede
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.reorderSelection("front")}
			>
				<ArrowUpToLine /> Trazer para frente{" "}
				<ContextMenuShortcut>⇧Ctrl ]</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.reorderSelection("forward")}
			>
				<ChevronUp /> Subir uma camada{" "}
				<ContextMenuShortcut>Ctrl ]</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.reorderSelection("backward")}
			>
				<ChevronDown /> Descer uma camada{" "}
				<ContextMenuShortcut>Ctrl [</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.reorderSelection("back")}
			>
				<ArrowDownToLine /> Enviar para trás{" "}
				<ContextMenuShortcut>⇧Ctrl [</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem
				disabled={items.length < 2}
				onSelect={() => store.groupSelection()}
			>
				<Group /> Agrupar <ContextMenuShortcut>Ctrl G</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!anyGrouped}
				onSelect={() => store.ungroupSelection()}
			>
				<Ungroup /> Desagrupar{" "}
				<ContextMenuShortcut>⇧Ctrl G</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				disabled={!hasItems}
				onSelect={() => store.lockSelection(!anyLocked)}
			>
				{anyLocked ? <LockOpen /> : <Lock />}
				{anyLocked ? "Destravar" : "Travar"}
			</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem onSelect={onFitSelection}>
				<Maximize /> {hasSelection ? "Enquadrar seleção" : "Enquadrar tudo"}
				<ContextMenuShortcut>{hasSelection ? "⇧2" : "⇧1"}</ContextMenuShortcut>
			</ContextMenuItem>
			<ContextMenuItem
				variant="destructive"
				disabled={!hasSelection}
				onSelect={() => store.deleteSelection()}
			>
				<Trash2 /> Excluir <ContextMenuShortcut>Del</ContextMenuShortcut>
			</ContextMenuItem>
		</ContextMenuContent>
	);
}
