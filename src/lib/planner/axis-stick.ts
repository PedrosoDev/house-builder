import { dist } from "./geometry";
import type { Guide } from "./snapping";
import type { Floor, Point } from "./types";

/**
 * "Diagonals are hard to get": while a wall is being moved, the walls it drags along (side effects) and the wall's own
 * end points stick to the horizontal/vertical axes, and only let go once the pointer has moved a little past them.
 * Pure helpers; the canvas feeds them a pixel-based threshold (converted to cm by the zoom).
 */

export type AxisHit = { axis: "x" | "y"; pos: number; from: Point; to: Point };

/** Sticks `p` to the x / y of the nearest reference point on each axis within `threshold`. */
export function snapPointToAxes(
	p: Point,
	refs: Point[],
	threshold: number,
): { point: Point; snappedX: boolean; snappedY: boolean } {
	let bx: number | null = null;
	let by: number | null = null;
	for (const r of refs) {
		if (
			Math.abs(p.x - r.x) <= threshold &&
			(bx === null || Math.abs(p.x - r.x) < Math.abs(p.x - bx))
		)
			bx = r.x;
		if (
			Math.abs(p.y - r.y) <= threshold &&
			(by === null || Math.abs(p.y - r.y) < Math.abs(p.y - by))
		)
			by = r.y;
	}
	return {
		point: { x: bx ?? p.x, y: by ?? p.y },
		snappedX: bx !== null,
		snappedY: by !== null,
	};
}

/** A joint that is being shifted (`j`) and the fixed far end (`f`) of a neighbouring wall attached to it. */
export type ShiftPair = { j: Point; f: Point };

/**
 * Sticks a translation (dx, dy) so that neighbours whose end point moves with the joint stay exactly vertical
 * (dx = f.x − j.x) or horizontal (dy = f.y − j.y) when the shift is within `threshold` of doing so.
 */
export function snapShiftToAxes(
	pairs: ShiftPair[],
	dx: number,
	dy: number,
	threshold: number,
): {
	dx: number;
	dy: number;
	snappedX: boolean;
	snappedY: boolean;
	hits: AxisHit[];
} {
	let tx: number | null = null;
	let ty: number | null = null;
	for (const { j, f } of pairs) {
		const cx = f.x - j.x;
		const cy = f.y - j.y;
		if (
			Math.abs(dx - cx) <= threshold &&
			(tx === null || Math.abs(dx - cx) < Math.abs(dx - tx))
		)
			tx = cx;
		if (
			Math.abs(dy - cy) <= threshold &&
			(ty === null || Math.abs(dy - cy) < Math.abs(dy - ty))
		)
			ty = cy;
	}
	const ndx = tx ?? dx;
	const ndy = ty ?? dy;
	const hits: AxisHit[] = [];
	for (const { j, f } of pairs) {
		const moved = { x: j.x + ndx, y: j.y + ndy };
		if (tx !== null && Math.abs(f.x - j.x - tx) < 0.5)
			hits.push({ axis: "x", pos: f.x, from: moved, to: f });
		if (ty !== null && Math.abs(f.y - j.y - ty) < 0.5)
			hits.push({ axis: "y", pos: f.y, from: moved, to: f });
	}
	return {
		dx: ndx,
		dy: ndy,
		snappedX: tx !== null,
		snappedY: ty !== null,
		hits,
	};
}

/**
 * Joints of the walls being moved and the far ends of the walls that are NOT being moved but are attached to them
 * (their angle changes as a side effect of the move).
 */
export function axisPairs(
	floor: Floor,
	movedWallIds: Set<string>,
): ShiftPair[] {
	const moved = floor.walls.filter((w) => movedWallIds.has(w.id));
	const movedPts = moved.flatMap((w) => [w.a, w.b]);
	const isMoved = (p: Point) => movedPts.some((m) => dist(m, p) < 1);
	const pairs: ShiftPair[] = [];
	const seen = new Set<string>();
	for (const w of moved) {
		for (const joint of [w.a, w.b]) {
			for (const o of floor.walls) {
				if (movedWallIds.has(o.id)) continue;
				const touchesA = dist(o.a, joint) < 1;
				const touchesB = dist(o.b, joint) < 1;
				if (!touchesA && !touchesB) continue;
				const far = touchesA ? o.b : o.a;
				if (isMoved(far)) continue;
				const key = `${Math.round(joint.x)},${Math.round(joint.y)}|${Math.round(far.x)},${Math.round(far.y)}`;
				if (seen.has(key)) continue;
				seen.add(key);
				pairs.push({ j: { ...joint }, f: { ...far } });
			}
		}
	}
	return pairs;
}

/**
 * Reference points for dragging one end of a wall: its other end (keeps the wall itself axis-aligned) and the far end of
 * every other wall attached at the dragged joint (keeps those side-effect walls axis-aligned).
 */
export function jointRefs(
	floor: Floor,
	wallId: string,
	end: "a" | "b",
): Point[] {
	const w = floor.walls.find((x) => x.id === wallId);
	if (!w) return [];
	const joint = w[end];
	const refs: Point[] = [{ ...(end === "a" ? w.b : w.a) }];
	for (const o of floor.walls) {
		if (o.id === w.id) continue;
		if (dist(o.a, joint) < 1) refs.push({ ...o.b });
		else if (dist(o.b, joint) < 1) refs.push({ ...o.a });
	}
	return refs;
}

/** Converts shift hits into the overlay guide lines (spanning the shifted joint and the far end). */
export function hitsToGuides(hits: AxisHit[]): Guide[] {
	return hits.map((h) =>
		h.axis === "x"
			? {
					axis: "x",
					pos: h.pos,
					from: Math.min(h.from.y, h.to.y),
					to: Math.max(h.from.y, h.to.y),
				}
			: {
					axis: "y",
					pos: h.pos,
					from: Math.min(h.from.x, h.to.x),
					to: Math.max(h.from.x, h.to.x),
				},
	);
}

/** Guide lines from a stuck point to every reference that shares its (stuck) x and/or y. */
export function guidesForPoint(
	p: Point,
	refs: Point[],
	snappedX: boolean,
	snappedY: boolean,
): Guide[] {
	const out: Guide[] = [];
	for (const r of refs) {
		if (snappedX && Math.abs(r.x - p.x) < 0.5)
			out.push({
				axis: "x",
				pos: p.x,
				from: Math.min(p.y, r.y),
				to: Math.max(p.y, r.y),
			});
		if (snappedY && Math.abs(r.y - p.y) < 0.5)
			out.push({
				axis: "y",
				pos: p.y,
				from: Math.min(p.x, r.x),
				to: Math.max(p.x, r.x),
			});
	}
	return out;
}
