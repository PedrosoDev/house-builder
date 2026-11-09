import { boxOfPoints, boxOfRef, wallFaceBoxes } from "./bounds";
import type { Box } from "./camera";
import type { CatalogItem } from "./catalog";
import {
	lerp,
	projectOnSegment,
	rectCorners,
	snapValue,
	wallAngle,
	wallLength,
} from "./geometry";
import { type Guide, type Measure, snapBoxMove } from "./snapping";
import type { Floor, Point, Wall } from "./types";

/**
 * Placement while adding things (Figma-style): the preview is already "live" before the click — it magnetises to walls,
 * snaps to alignments with other objects and reports guides/distances, exactly like an object that is being moved.
 */

/** How far (screen px) a wall pulls the preview toward it. */
export const WALL_MAGNET_PX = 44;
/** Threshold (screen px) for alignment snaps. */
export const ALIGN_SNAP_PX = 10;

export type PlacementOpts = {
	zoom: number;
	grid: number;
	snap: boolean;
	smartGuides: boolean;
	/** Ctrl/⌘ held: no snapping at all. */
	free: boolean;
	/** Wall used by the previous frame; it wins ties so the preview does not flicker between walls. */
	preferWallId?: string | null;
};

/** Boxes an object can align to: items, stairs, rooms and wall faces. */
export function snapTargets(floor: Floor): Box[] {
	const out: Box[] = [];
	for (const i of floor.items) {
		const b = boxOfRef(floor, { kind: "item", id: i.id });
		if (b) out.push(b);
	}
	for (const s of floor.stairs) {
		const b = boxOfRef(floor, { kind: "stair", id: s.id });
		if (b) out.push(b);
	}
	for (const r of floor.rooms) {
		const b = boxOfPoints(r.points);
		if (b) out.push(b);
	}
	for (const w of floor.walls) out.push(...wallFaceBoxes(w));
	return out;
}

const norm360 = (d: number) => ((d % 360) + 360) % 360;

// ------------------------------------------------------------------ items

export type ItemPlacement = {
	x: number;
	y: number;
	rotation: number;
	/** Wall the item is flush against, if any. */
	wall: Wall | null;
	guides: Guide[];
};

export function placeItem(
	floor: Floor,
	def: CatalogItem,
	p: Point,
	rotation: number,
	o: PlacementOpts,
): ItemPlacement {
	const [w, , d] = def.size;
	let x = p.x;
	let y = p.y;
	let rot = rotation;
	let wall: Wall | null = null;
	let lock: "x" | "y" | "both" | null = null;

	if (!def.outdoor) {
		const magnet = WALL_MAGNET_PX / o.zoom;
		let best: {
			wall: Wall;
			score: number;
			point: Point;
			t: number;
			side: number;
			nx: number;
			ny: number;
		} | null = null;
		for (const wl of floor.walls) {
			if (wl.hidden) continue;
			const pr = projectOnSegment(p, wl.a, wl.b);
			const reach = wl.thickness / 2 + (def.wallMounted ? 20 : d / 2) + magnet;
			if (pr.distance > reach) continue;
			const ang = wallAngle(wl);
			const nx = -Math.sin(ang);
			const ny = Math.cos(ang);
			const side =
				(p.x - pr.point.x) * nx + (p.y - pr.point.y) * ny >= 0 ? 1 : -1;
			const score = pr.distance * (wl.id === o.preferWallId ? 0.7 : 1);
			if (!best || score < best.score)
				best = { wall: wl, score, point: pr.point, t: pr.t, side, nx, ny };
		}
		if (best) {
			wall = best.wall;
			const len = wallLength(wall) || 1;
			const fx = best.nx * best.side;
			const fy = best.ny * best.side;
			rot = norm360((Math.atan2(fy, fx) * 180) / Math.PI - 90);
			// position along the wall: snap to centre / flush with either end, else grid
			let s = best.t * len;
			if (!o.free) {
				const thr = ALIGN_SNAP_PX / o.zoom;
				const targets = [len / 2, w / 2, len - w / 2];
				const hit = targets.find((t) => Math.abs(s - t) <= thr);
				if (hit !== undefined) s = hit;
				else if (o.snap) s = Math.round(s / o.grid) * o.grid;
			}
			s = Math.min(
				Math.max(s, Math.min(w / 2, len / 2)),
				Math.max(len - w / 2, len / 2),
			);
			const base = lerp(wall.a, wall.b, s / len);
			const off = wall.thickness / 2 + d / 2;
			x = base.x + fx * off;
			y = base.y + fy * off;
			const dx = Math.abs(wall.b.x - wall.a.x);
			const dy = Math.abs(wall.b.y - wall.a.y);
			// keep the item flush: never slide it away from an axis-aligned wall
			lock = dy < 1e-6 ? "y" : dx < 1e-6 ? "x" : "both";
		}
	}

	let guides: Guide[] = [];
	let snappedX = false;
	let snappedY = false;
	if (!o.free && o.smartGuides && lock !== "both") {
		const box = boxOfPoints(rectCorners(x, y, w, d, rot));
		if (box) {
			const r = snapBoxMove(box, snapTargets(floor), 6 / o.zoom);
			if (r.snapX && lock !== "x") {
				x += r.dx;
				snappedX = true;
			}
			if (r.snapY && lock !== "y") {
				y += r.dy;
				snappedY = true;
			}
			if (snappedX || snappedY) guides = r.guides;
		}
	}
	if (!wall && !o.free && o.snap) {
		if (!snappedX) x = snapValue(x, o.grid);
		if (!snappedY) y = snapValue(y, o.grid);
	}
	return { x, y, rotation: rot, wall, guides };
}

// --------------------------------------------------------------- openings

export type OpeningSnapKind =
	| "start"
	| "end"
	| "center"
	| "neighbor"
	| "align"
	| "grid";

export type OpeningPlacement = {
	wall: Wall;
	/** Centre of the opening along the wall, 0..1. */
	t: number;
	/** Door swing: true when the pointer is on the side opposite to the wall normal (-sin a, cos a). */
	mirror: boolean;
	snap: OpeningSnapKind | null;
	/** Distances from the opening to whatever bounds it on each side (wall end or neighbouring opening). */
	gaps: Measure[];
	guides: Guide[];
};

/**
 * Glues a door/window to the best wall near `p`. The pull is generous (WALL_MAGNET_PX), sticky for the wall used on the
 * previous frame, and the position along the wall snaps to: flush with either end, wall centre, flush against a
 * neighbouring opening, or aligned with an opening on another wall.
 */
export function snapOpening(
	floor: Floor,
	p: Point,
	width: number,
	o: PlacementOpts & { excludeId?: string },
): OpeningPlacement | null {
	const magnet = WALL_MAGNET_PX / o.zoom;
	let best: { wall: Wall; score: number; t: number; side: number } | null =
		null;
	for (const w of floor.walls) {
		if (w.hidden) continue;
		const len = wallLength(w);
		if (len < width + 2) continue; // too short to host it
		const pr = projectOnSegment(p, w.a, w.b);
		const reach =
			w.thickness / 2 + magnet * (w.id === o.preferWallId ? 1.5 : 1);
		if (pr.distance > reach) continue;
		const score = pr.distance * (w.id === o.preferWallId ? 0.7 : 1);
		if (!best || score < best.score) {
			// signed distance of the pointer from the wall along its normal (-sin a, cos a)
			const ang = wallAngle(w);
			const side =
				(p.x - pr.point.x) * -Math.sin(ang) +
				(p.y - pr.point.y) * Math.cos(ang);
			best = { wall: w, score, t: pr.t, side };
		}
	}
	if (!best) return null;

	const wall = best.wall;
	const len = wallLength(wall);
	const half = width / 2;
	const clamp = (cm: number) => Math.min(Math.max(cm, half), len - half);
	let cm = clamp(best.t * len);
	let snap: OpeningSnapKind | null = null;
	let alignWorld: Point | null = null;

	const others = floor.openings.filter((x) => x.id !== o.excludeId);
	if (!o.free) {
		const thr = ALIGN_SNAP_PX / o.zoom;
		const targets: { cm: number; kind: OpeningSnapKind; world?: Point }[] = [
			{ cm: half, kind: "start" },
			{ cm: len - half, kind: "end" },
			{ cm: len / 2, kind: "center" },
		];
		for (const x of others) {
			const ow = floor.walls.find((w) => w.id === x.wallId);
			if (!ow) continue;
			if (ow.id === wall.id) {
				const c2 = x.t * len;
				targets.push(
					{ cm: c2 - x.width / 2 - half, kind: "neighbor" },
					{ cm: c2 + x.width / 2 + half, kind: "neighbor" },
				);
			} else {
				const wc = lerp(ow.a, ow.b, x.t);
				const pr = projectOnSegment(wc, wall.a, wall.b);
				targets.push({ cm: pr.t * len, kind: "align", world: wc });
			}
		}
		let bestT: { cm: number; kind: OpeningSnapKind; world?: Point } | null =
			null;
		for (const t of targets) {
			if (t.cm < half - 0.01 || t.cm > len - half + 0.01) continue;
			const dd = Math.abs(cm - t.cm);
			if (dd <= thr && (!bestT || dd < Math.abs(cm - bestT.cm))) bestT = t;
		}
		if (bestT) {
			cm = clamp(bestT.cm);
			snap = bestT.kind;
			alignWorld = bestT.world ?? null;
		} else if (o.snap) {
			cm = clamp(Math.round(cm / 5) * 5);
			snap = "grid";
		}
	} else if (o.snap === false) {
		cm = clamp(cm);
	}

	// distances to the nearest bound on each side
	let left = 0;
	let right = len;
	for (const x of others) {
		if (x.wallId !== wall.id) continue;
		const c2 = x.t * len;
		const e0 = c2 - x.width / 2;
		const e1 = c2 + x.width / 2;
		if (e1 <= cm - half + 0.5) left = Math.max(left, e1);
		if (e0 >= cm + half - 0.5) right = Math.min(right, e0);
	}
	const at = (s: number) => lerp(wall.a, wall.b, s / len);
	const gaps: Measure[] = [];
	const gl = cm - half - left;
	const gr = right - (cm + half);
	if (gl > 0.5) gaps.push({ a: at(left), b: at(cm - half), value: gl });
	if (gr > 0.5) gaps.push({ a: at(cm + half), b: at(right), value: gr });

	const guides: Guide[] = [];
	if (snap === "align" && alignWorld) {
		const c = at(cm);
		const horizontal = Math.abs(wall.b.y - wall.a.y) < 1e-6;
		const vertical = Math.abs(wall.b.x - wall.a.x) < 1e-6;
		if (horizontal)
			guides.push({
				axis: "x",
				pos: c.x,
				from: Math.min(c.y, alignWorld.y),
				to: Math.max(c.y, alignWorld.y),
			});
		else if (vertical)
			guides.push({
				axis: "y",
				pos: c.y,
				from: Math.min(c.x, alignWorld.x),
				to: Math.max(c.x, alignWorld.x),
			});
	}
	// a small dead zone keeps the swing stable while the pointer is right on the wall
	return { wall, t: cm / len, mirror: best.side < -0.5, snap, gaps, guides };
}
