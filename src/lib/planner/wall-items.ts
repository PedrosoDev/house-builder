import { dist, projectOnSegment, rectCorners } from "./geometry";
import type { Floor, Point } from "./types";

/** An item whose footprint is within this many cm of a wall face counts as attached to that wall. */
export const ATTACH_TOLERANCE = 15;

/** Points along the outline of a footprint (corners plus a sample every ~10 cm). */
const outline = (corners: Point[]): Point[] => {
	const pts: Point[] = [];
	for (let i = 0; i < corners.length; i++) {
		const a = corners[i];
		const b = corners[(i + 1) % corners.length];
		const n = Math.max(1, Math.ceil(dist(a, b) / 10));
		for (let k = 0; k < n; k++)
			pts.push({
				x: a.x + ((b.x - a.x) * k) / n,
				y: a.y + ((b.y - a.y) * k) / n,
			});
	}
	return pts;
};

/**
 * Items that are glued to / close to any of the given walls (within `tolerance` of the wall surface, alongside it).
 * Items grouped with an attached item come along too. They are carried with the wall when it is moved.
 */
export function itemsAttachedToWalls(
	floor: Floor,
	wallIds: Set<string>,
	tolerance = ATTACH_TOLERANCE,
): Set<string> {
	const out = new Set<string>();
	const walls = floor.walls.filter((w) => wallIds.has(w.id));
	if (walls.length === 0) return out;
	for (const it of floor.items) {
		const pts = outline(rectCorners(it.x, it.y, it.w, it.d, it.rotation));
		pts.push({ x: it.x, y: it.y });
		for (const w of walls) {
			const near = pts.some(
				(p) =>
					projectOnSegment(p, w.a, w.b).distance - w.thickness / 2 <= tolerance,
			);
			if (near) {
				out.add(it.id);
				break;
			}
		}
	}
	// a group moves as one: members far from the wall follow the ones that are attached
	const groups = new Set(
		floor.items.filter((i) => out.has(i.id) && i.groupId).map((i) => i.groupId),
	);
	for (const i of floor.items)
		if (i.groupId && groups.has(i.groupId)) out.add(i.id);
	return out;
}
