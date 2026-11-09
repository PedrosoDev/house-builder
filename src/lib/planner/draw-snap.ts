import { dist, projectOnSegment, snapAngle, snapValue } from "./geometry";
import type { Floor, Point, Wall } from "./types";

export type DrawSnapOpts = {
	zoom: number;
	grid: number;
	/** Grid/angle snapping on. Walls still attract when this is off. */
	snap: boolean;
	/** Ctrl/⌘ held: only wall end points still attract. */
	free: boolean;
	/** Start of the wall being drawn; enables angle snapping relative to it. */
	anchor?: Point;
};

/** Screen-pixel radius within which existing walls attract the pointer. */
export const DRAW_MAGNET_PX = 14;

/** Intersection of the ray anchor→dir with segment a→b, or null (parallel / behind / outside the segment). */
function rayHitsSegment(
	anchor: Point,
	dir: Point,
	a: Point,
	b: Point,
): Point | null {
	const sx = b.x - a.x;
	const sy = b.y - a.y;
	const denom = dir.x * sy - dir.y * sx;
	if (Math.abs(denom) < 1e-9) return null;
	const ax = a.x - anchor.x;
	const ay = a.y - anchor.y;
	const t = (ax * sy - ay * sx) / denom; // along the ray
	const u = (ax * dir.y - ay * dir.x) / denom; // along the segment
	if (t < 1e-6 || u < -1e-9 || u > 1 + 1e-9) return null;
	return { x: anchor.x + dir.x * t, y: anchor.y + dir.y * t };
}

/** Snaps the coordinate that runs ALONG an axis-aligned wall to the grid; diagonal walls are left as they are. */
function gridAlong(w: Wall, p: Point, grid: number): Point {
	if (Math.abs(w.b.y - w.a.y) < 1e-9)
		return { x: snapValue(p.x, grid), y: p.y };
	if (Math.abs(w.b.x - w.a.x) < 1e-9)
		return { x: p.x, y: snapValue(p.y, grid) };
	return p;
}

/**
 * Snap for the drawing tools (walls, rooms, rulers). Priority:
 *  1. an existing wall end point;
 *  2. the wall itself (T-junction): the point lands exactly on the wall's centre line, so the wall can be split there.
 *     While drawing with angle snapping, the point is where the angle-locked ray meets the wall;
 *  3. angle + grid snapping.
 */
export function snapDrawPoint(floor: Floor, p: Point, o: DrawSnapOpts): Point {
	const radius = DRAW_MAGNET_PX / o.zoom;

	let bestEnd: Point | null = null;
	let bestEndD = radius;
	for (const w of floor.walls) {
		for (const q of [w.a, w.b]) {
			const d = dist(p, q);
			if (d < bestEndD) {
				bestEnd = q;
				bestEndD = d;
			}
		}
	}
	if (bestEnd) return { ...bestEnd };
	if (o.free) return p;

	// the point the angle/grid snapping alone would pick (also fixes the ray direction)
	let ray: Point | null = null;
	let plain: Point = p;
	if (o.snap) {
		if (o.anchor) {
			const a = snapAngle(o.anchor, p, 15);
			const len = dist(o.anchor, a);
			const ang = Math.atan2(a.y - o.anchor.y, a.x - o.anchor.x);
			ray = { x: Math.cos(ang), y: Math.sin(ang) };
			const snappedLen = Math.round(len / o.grid) * o.grid;
			plain = {
				x: o.anchor.x + ray.x * snappedLen,
				y: o.anchor.y + ray.y * snappedLen,
			};
		} else plain = { x: snapValue(p.x, o.grid), y: snapValue(p.y, o.grid) };
	}

	// 2. wall segments
	let best: { point: Point; d: number } | null = null;
	for (const w of floor.walls) {
		if (w.hidden) continue;
		const pr = projectOnSegment(p, w.a, w.b);
		if (pr.distance > radius) continue;
		let cand: Point | null = null;
		if (o.anchor && ray) cand = rayHitsSegment(o.anchor, ray, w.a, w.b);
		if (cand && dist(cand, p) > radius) cand = null;
		if (!cand) cand = o.snap ? gridAlong(w, pr.point, o.grid) : pr.point;
		// keep the candidate on the wall (grid rounding must not push it past the wall end)
		const on = projectOnSegment(cand, w.a, w.b);
		const point = on.distance < 1e-6 ? cand : on.point;
		if (!best || pr.distance < best.d) best = { point, d: pr.distance };
	}
	if (best) return best.point;

	return plain;
}
