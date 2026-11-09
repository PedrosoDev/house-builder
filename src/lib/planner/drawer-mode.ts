import { OPENING_PRESETS, type OpeningPreset } from "./catalog";
import type { ToolId } from "./types";

/** What the left drawer shows while it replaces the left panel. */
export type DrawerMode = "objects" | "doors" | "windows";

/**
 * The left drawer opens only while a mode with many options is active: the door and window tools show their presets, the
 * object tool (or the Objetos button) shows the whole catalog. With any other tool it is closed and the normal left panel
 * (name, floors, layers) is back.
 */
export function drawerMode(
	tool: ToolId,
	catalogOpen: boolean,
): DrawerMode | null {
	if (catalogOpen) return "objects";
	if (tool === "door") return "doors";
	if (tool === "window") return "windows";
	if (tool === "item") return "objects";
	return null;
}

export const drawerTitle = (m: DrawerMode) =>
	m === "doors" ? "Portas" : m === "windows" ? "Janelas" : "Objetos";

const plain = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

/** Door/window presets for a drawer mode (all of them in the objects catalog), filtered by the search text. */
export function openingPresetsFor(
	mode: DrawerMode,
	query: string,
): OpeningPreset[] {
	const q = plain(query.trim());
	return OPENING_PRESETS.filter((p) => {
		if (mode === "doors" && p.category !== "doors") return false;
		if (mode === "windows" && p.category !== "windows") return false;
		return !q || plain(p.name).includes(q);
	});
}
