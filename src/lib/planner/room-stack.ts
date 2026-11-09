import { polygonArea } from "./geometry";
import type { Room } from "./types";

/**
 * Vertical stacking rank of each room floor in 3D: the bigger room is the bottom layer (0) and nested, smaller rooms sit on
 * top of it, so overlapping floors never share the same height (that made them z-fight and flicker with stripes).
 */
export function roomStackRanks(rooms: Room[]): Map<string, number> {
	const order = rooms
		.map((r, i) => ({ r, i, area: polygonArea(r.points) }))
		.sort((a, b) => b.area - a.area || a.i - b.i);
	return new Map(order.map((e, rank) => [e.r.id, rank]));
}
