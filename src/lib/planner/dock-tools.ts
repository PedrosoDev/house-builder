import type { ToolId } from "./types";

export type DockTool = { id: ToolId; label: string; key: string };
/** A dock button: one tool, or a group whose variants live in a small menu (the last one used is the click action). */
export type DockEntry = { id: string; label: string; tools: DockTool[] };

export const DOCK: DockEntry[] = [
	{
		id: "select",
		label: "Seleção",
		tools: [{ id: "select", label: "Selecionar", key: "V" }],
	},
	{
		id: "pan",
		label: "Mover",
		tools: [{ id: "pan", label: "Mover vista", key: "H" }],
	},
	{
		id: "wall",
		label: "Parede",
		tools: [
			{ id: "wall", label: "Parede", key: "W" },
			{ id: "partition", label: "Divisória", key: "P" },
		],
	},
	{
		id: "room",
		label: "Cômodo",
		tools: [
			{ id: "roomRect", label: "Cômodo retangular", key: "" },
			{ id: "room", label: "Cômodo (polígono)", key: "O" },
		],
	},
	{
		id: "door",
		label: "Porta",
		tools: [{ id: "door", label: "Porta", key: "D" }],
	},
	{
		id: "window",
		label: "Janela",
		tools: [{ id: "window", label: "Janela", key: "N" }],
	},
	{
		id: "stair",
		label: "Escada",
		tools: [{ id: "stair", label: "Escada", key: "" }],
	},
	{
		id: "ruler",
		label: "Medir",
		tools: [{ id: "ruler", label: "Régua", key: "M" }],
	},
	{
		id: "eraser",
		label: "Borracha",
		tools: [{ id: "eraser", label: "Borracha", key: "E" }],
	},
];

export const entryActive = (e: DockEntry, tool: ToolId) =>
	e.tools.some((t) => t.id === tool);

/** Tool a click on the dock button activates: the last variant used in the group, else its first. */
export function entryTool(
	e: DockEntry,
	last: Partial<Record<string, ToolId>>,
): ToolId {
	const remembered = last[e.id];
	return e.tools.find((t) => t.id === remembered)?.id ?? e.tools[0].id;
}

/** Key of the "Objetos" tab (the other tabs use their `DockEntry.id`). */
export const OBJECTS_KEY = "objects";

/**
 * The selected dock tab: the entry that owns the current tool (group variants included), or "Objetos" while the object
 * drawer is open or an object is being placed. Exactly one tab is selected.
 */
export function dockActiveKey(tool: ToolId, objectsOpen: boolean): string {
	if (objectsOpen || tool === "item") return OBJECTS_KEY;
	return DOCK.find((e) => entryActive(e, tool))?.id ?? DOCK[0].id;
}
