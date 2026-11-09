import { ChevronDown, Minus, Plus } from "lucide-react";
import { Button } from "#/components/ui/button.tsx";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import type { PlannerStore } from "#/lib/planner/store";
import { usePlanner } from "#/lib/planner/store";

type Props = {
	store: PlannerStore;
	zoom: number;
	onZoomStep: (dir: 1 | -1) => void;
	onZoomTo: (zoom: number) => void;
	onFit: () => void;
	onFitSelection: () => void;
	/** Position override (the pill sits at the bottom-left of the visible canvas). */
	style?: React.CSSProperties;
};

/** Figma-style zoom pill: − 62% ▾ + with a menu of zoom commands and canvas toggles. */
export function ZoomControls({
	store,
	zoom,
	onZoomStep,
	onZoomTo,
	onFit,
	onFitSelection,
	style,
}: Props) {
	const showGrid = usePlanner(store, (s) => s.showGrid);
	const smartGuides = usePlanner(store, (s) => s.smartGuides);
	const snap = usePlanner(store, (s) => s.snap);

	return (
		<div
			className="pointer-events-auto absolute bottom-3 flex items-center rounded-xl bg-background/90 shadow-sm ring-1 ring-border backdrop-blur"
			style={style}
			onPointerDown={(e) => e.stopPropagation()}
			onWheel={(e) => e.stopPropagation()}
		>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Diminuir zoom"
				onClick={() => onZoomStep(-1)}
			>
				<Minus />
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						className="w-[4.5rem] justify-between tabular-nums"
						aria-label="Menu de zoom"
					>
						{Math.round(zoom * 100)}%
						<ChevronDown className="size-3.5 opacity-60" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" side="top" className="w-60">
					<DropdownMenuItem onSelect={() => onZoomStep(1)}>
						Aproximar <DropdownMenuShortcut>Ctrl +</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onZoomStep(-1)}>
						Afastar <DropdownMenuShortcut>Ctrl −</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onFit}>
						Enquadrar tudo <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onFitSelection}>
						Enquadrar seleção <DropdownMenuShortcut>⇧2</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => onZoomTo(0.5)}>
						Zoom 50%
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onZoomTo(1)}>
						Zoom 100% <DropdownMenuShortcut>⇧0</DropdownMenuShortcut>
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => onZoomTo(2)}>
						Zoom 200%
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuCheckboxItem
						checked={showGrid}
						onCheckedChange={(v) => store.setOption({ showGrid: Boolean(v) })}
					>
						Grade
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={snap}
						onCheckedChange={(v) => store.setOption({ snap: Boolean(v) })}
					>
						Encaixar na grade
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={smartGuides}
						onCheckedChange={(v) =>
							store.setOption({ smartGuides: Boolean(v) })
						}
					>
						Guias inteligentes
					</DropdownMenuCheckboxItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="Aumentar zoom"
				onClick={() => onZoomStep(1)}
			>
				<Plus />
			</Button>
		</div>
	);
}
