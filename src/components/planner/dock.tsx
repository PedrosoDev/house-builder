import {
	AppWindow,
	BrickWall,
	ChevronDown,
	DoorOpen,
	Eraser,
	Footprints,
	Hand,
	Minus,
	MousePointer2,
	Pentagon,
	RectangleHorizontal,
	Ruler,
	Sofa,
} from "lucide-react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
	DOCK,
	type DockEntry,
	dockActiveKey,
	entryActive,
	entryTool,
	OBJECTS_KEY,
} from "#/lib/planner/dock-tools";
import { type PlannerStore, usePlanner } from "#/lib/planner/store";
import type { ToolId } from "#/lib/planner/types";
import { cn } from "#/lib/utils";
import { useSlidingPill } from "./use-sliding-pill";

const ICON: Record<ToolId, React.ComponentType<{ className?: string }>> = {
	select: MousePointer2,
	pan: Hand,
	wall: BrickWall,
	partition: Minus,
	room: Pentagon,
	roomRect: RectangleHorizontal,
	door: DoorOpen,
	window: AppWindow,
	stair: Footprints,
	ruler: Ruler,
	eraser: Eraser,
	item: Sofa,
};

/**
 * Bottom dock working like tabs: the selected tool is a black pill that slides to the tool you pick (groups keep a small
 * menu with variants; "Objetos" is the last tab and opens the object drawer).
 */
export function Dock({
	store,
	catalogOpen,
	onToggleCatalog,
	onPickTool,
	insets,
}: {
	store: PlannerStore;
	catalogOpen: boolean;
	onToggleCatalog: () => void;
	/** Called after a tool is picked (the editor closes the Objetos drawer). */
	onPickTool: (id: ToolId) => void;
	/** Space taken by the floating side panels: the dock is centred in what is left. */
	insets: { left: number; right: number };
}) {
	const tool = usePlanner(store, (s) => s.tool);
	const [last, setLast] = useState<Partial<Record<string, ToolId>>>({});
	const activeKey = dockActiveKey(tool, catalogOpen);
	const { register, containerRef, pill, ready } = useSlidingPill(activeKey);

	const pick = (entry: DockEntry, id: ToolId) => {
		if (id === "door" || id === "window") store.setOpeningPreset(null, id);
		store.setTool(id);
		onPickTool(id);
		if (entry.tools.length > 1) setLast((l) => ({ ...l, [entry.id]: id }));
	};

	const tabClass = (on: boolean) =>
		cn(
			"relative z-10 flex flex-col items-center gap-1 rounded-xl px-1 pt-2 pb-1.5 text-[11px] leading-none transition-colors duration-200",
			on
				? "font-medium text-background"
				: "text-muted-foreground hover:text-foreground",
		);

	return (
		<nav
			ref={containerRef}
			aria-label="Ferramentas"
			className="absolute bottom-4 z-20 flex -translate-x-1/2 items-end gap-0.5 rounded-2xl bg-card p-1.5 shadow-xl ring-1 ring-black/5"
			style={{
				left: `calc(${insets.left}px + (100% - ${insets.left}px - ${insets.right}px) / 2)`,
			}}
		>
			{/* the black "selected" pill that slides between tabs */}
			{pill && (
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute z-0 rounded-xl bg-foreground shadow-md",
						ready &&
							"transition-[left,top,width,height] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]",
					)}
					style={pill}
				/>
			)}
			{DOCK.map((entry) => {
				const active = entryActive(entry, tool) && activeKey === entry.id;
				const current = entryActive(entry, tool)
					? tool
					: entryTool(entry, last);
				const Icon = ICON[current];
				const shown =
					entry.tools.find((t) => t.id === current) ?? entry.tools[0];
				const label = entry.tools.length > 1 ? shown.label : entry.label;
				return (
					<div key={entry.id} className="relative" ref={register(entry.id)}>
						<button
							type="button"
							aria-label={shown.label}
							aria-pressed={active}
							title={`${shown.label}${shown.key ? ` (${shown.key})` : ""}`}
							onClick={() => pick(entry, entryTool(entry, last))}
							className={cn(tabClass(active), "w-[3.75rem]")}
						>
							<Icon className="size-5" />
							<span className="max-w-full truncate">
								{label
									.replace("Cômodo retangular", "Cômodo")
									.replace("Cômodo (polígono)", "Polígono")}
							</span>
						</button>
						{entry.tools.length > 1 && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										aria-label={`Variantes de ${entry.label}`}
										className={cn(
											"absolute top-0.5 right-0.5 z-20 flex size-4 items-center justify-center rounded transition-colors duration-200",
											active
												? "text-background/70 hover:bg-background/20"
												: "text-muted-foreground hover:bg-muted",
										)}
									>
										<ChevronDown className="size-3" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent side="top" align="center" className="w-48">
									{entry.tools.map((t) => {
										const TIcon = ICON[t.id];
										return (
											<DropdownMenuItem
												key={t.id}
												onSelect={() => pick(entry, t.id)}
											>
												<TIcon /> {t.label}
												{t.key && (
													<DropdownMenuShortcut>{t.key}</DropdownMenuShortcut>
												)}
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				);
			})}
			<div className="mx-1.5 h-10 w-px self-center bg-border" />
			<div className="relative" ref={register(OBJECTS_KEY)}>
				<button
					type="button"
					aria-pressed={activeKey === OBJECTS_KEY}
					aria-label="Objetos"
					title="Catálogo de objetos"
					onClick={onToggleCatalog}
					className={cn(tabClass(activeKey === OBJECTS_KEY), "w-[4.6rem]")}
				>
					<Sofa className="size-5" />
					<span className="font-medium">Objetos</span>
				</button>
			</div>
		</nav>
	);
}
