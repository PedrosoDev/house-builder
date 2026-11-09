import type { ViewMode } from "./types";

/** Position of a view section in % of the screen width, and whether it is shown in the current mode. */
export type SectionRect = { left: number; width: number; show: boolean };

/**
 * Where the 2D plan and the 3D view sit for each mode. A section that is not shown keeps the half it has in the split view,
 * so it slides in from / out to there while it fades (the editor keeps it mounted for the length of the transition).
 */
export function viewLayout(view: ViewMode): {
	plan: SectionRect;
	three: SectionRect;
} {
	switch (view) {
		case "2d":
			return {
				plan: { left: 0, width: 100, show: true },
				three: { left: 50, width: 50, show: false },
			};
		case "3d":
			return {
				plan: { left: 0, width: 50, show: false },
				three: { left: 0, width: 100, show: true },
			};
		default:
			return {
				plan: { left: 0, width: 50, show: true },
				three: { left: 50, width: 50, show: true },
			};
	}
}

/** How the 3D view opens: ceiling and roof hidden (so the rooms show), orbit camera, automatic wall cut-away. */
export const DEFAULT_VIEW3D = {
	cutaway: true,
	camera: "orbit" as "orbit" | "walk",
	wallMode: "cut" as "up" | "cut" | "down",
};
