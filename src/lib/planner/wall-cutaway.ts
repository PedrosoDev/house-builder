import { wallAngle } from "./geometry";
import type { Point, Wall } from "./types";

/**
 * "The Sims" wall view: walls that stand between the camera and the room are lowered to a short stub, so the room can be
 * seen while the separation between rooms stays visible. "up" = all walls full height, "down" = all lowered, "cut" = the
 * walls facing the camera are lowered (recomputed as the camera orbits).
 */
export type WallMode = "up" | "cut" | "down";

/** Height (cm) of a lowered wall. */
export const CUT_HEIGHT = 50;

/** A wall counts as facing the camera when its normal is within 60° of the direction to the camera. */
const FACING_COS = 0.5;

export type Piece = {
	xa: number;
	xb: number;
	y0: number;
	ta: number;
	tb: number;
};
export type Profile = { top: (x: number) => number; knots: number[] };

/** Length (cm) of the slope that joins a stub to a full-height wall at a corner. */
export const RAMP_LENGTH = 80;

/**
 * Height of a wall along its length (x in cm from end A). A wall at `level` (0 = stub, 1 = full, animated in between) is a
 * plateau; at an end that meets a raised wall (`rampA`/`rampB` = that neighbour's level) the top slopes up to meet it, like
 * the cut-away walls of The Sims. The profile is the max of the plateau and the ramps, and exposes its break points.
 */
export function wallTopProfile(
	len: number,
	o: {
		low: number;
		full: number;
		level: number;
		rampA: number;
		rampB: number;
		ramp?: number;
	},
): Profile {
	const span = o.full - o.low;
	const plateau = o.low + span * o.level;
	const R = Math.min(o.ramp ?? RAMP_LENGTH, len / 2);
	const ramp = (d: number, k: number) =>
		k > 0 && d < R ? o.low + span * k * (1 - d / R) : Number.NEGATIVE_INFINITY;
	const top = (x: number) =>
		Math.max(plateau, ramp(x, o.rampA), ramp(len - x, o.rampB));
	const knots = [0, len];
	if (R > 0) {
		if (o.rampA > 0) {
			knots.push(R);
			const x = R * (1 - (plateau - o.low) / (span * o.rampA));
			if (x > 0 && x < R) knots.push(x);
		}
		if (o.rampB > 0) {
			knots.push(len - R);
			const x = R * (1 - (plateau - o.low) / (span * o.rampB));
			if (x > 0 && x < R) knots.push(len - x);
		}
	}
	return { top, knots };
}

type OpeningBox = { t: number; width: number; sill: number; height: number };

/**
 * The solid parts of a wall under a top profile, as boxes with a sloped top (`ta` at xa, `tb` at xb). Openings are gaps: a
 * hole when the wall covers them, a notch open to the top when the wall is lower than them, nothing when it is lower than the sill.
 */
export function wallPieces(
	len: number,
	openings: OpeningBox[],
	profile: Profile,
): Piece[] {
	const ops = openings.map((o) => ({
		x0: Math.max(0, o.t * len - o.width / 2),
		x1: Math.min(len, o.t * len + o.width / 2),
		y0: o.sill <= 0.5 ? 0 : o.sill,
		y1: o.sill + o.height,
	}));
	const levels = [...new Set(ops.flatMap((o) => [o.y0, o.y1]))];
	const base = [...profile.knots, ...ops.flatMap((o) => [o.x0, o.x1])]
		.filter((x) => x >= 0 && x <= len)
		.sort((a, b) => a - b);
	let xs = base.filter((x, i) => i === 0 || x - base[i - 1] > 0.01);
	// break points where the (linear) top crosses an opening edge height
	const extra: number[] = [];
	for (let i = 0; i + 1 < xs.length; i++) {
		const t0 = profile.top(xs[i]);
		const t1 = profile.top(xs[i + 1]);
		for (const lv of levels)
			if ((t0 - lv) * (t1 - lv) < 0)
				extra.push(xs[i] + ((xs[i + 1] - xs[i]) * (lv - t0)) / (t1 - t0));
	}
	xs = [...xs, ...extra].sort((a, b) => a - b);

	const pieces: Piece[] = [];
	for (let i = 0; i + 1 < xs.length; i++) {
		const xa = xs[i];
		const xb = xs[i + 1];
		if (xb - xa < 0.01) continue;
		const mid = (xa + xb) / 2;
		const here = ops
			.filter((o) => o.x0 <= mid && mid <= o.x1)
			.sort((a, b) => a.y0 - b.y0);
		const solids: [number, number][] = [];
		let y = 0;
		for (const o of here) {
			if (o.y0 > y) solids.push([y, o.y0]);
			y = Math.max(y, o.y1);
		}
		solids.push([y, Number.POSITIVE_INFINITY]);
		for (const [yb, yt] of solids) {
			const ta = Math.min(yt, profile.top(xa));
			const tb = Math.min(yt, profile.top(xb));
			if (ta <= yb + 0.01 && tb <= yb + 0.01) continue;
			pieces.push({
				xa,
				xb,
				y0: yb,
				ta: Math.max(ta, yb),
				tb: Math.max(tb, yb),
			});
		}
	}
	return pieces;
}

/**
 * For each wall, the highest level among the OTHER walls that meet it at each end (0 when the end is free): the size of the
 * slope that joins a stub to the raised wall next to it.
 */
export function endNeighbourLevels(
	walls: Wall[],
	levels: Map<string, number>,
): Map<string, { a: number; b: number }> {
	const out = new Map<string, { a: number; b: number }>();
	const at = (w: Wall, p: Point) =>
		walls.reduce((m, o) => {
			if (o.id === w.id) return m;
			const touches =
				Math.hypot(o.a.x - p.x, o.a.y - p.y) < 1 ||
				Math.hypot(o.b.x - p.x, o.b.y - p.y) < 1;
			return touches ? Math.max(m, levels.get(o.id) ?? 0) : m;
		}, 0);
	for (const w of walls) out.set(w.id, { a: at(w, w.a), b: at(w, w.b) });
	return out;
}

/** One animation step of a wall level toward its target (frame-rate independent ease-out). */
export function stepLevel(
	cur: number,
	target: number,
	dt: number,
	rate = 6,
): number {
	const next = target + (cur - target) * Math.exp(-rate * dt);
	return Math.abs(next - target) < 0.003 ? target : next;
}

/** Ids of the walls to draw lowered for a camera at `cam` looking at `target` (both in plan cm). */
export function wallsToLower(
	walls: Wall[],
	mode: WallMode,
	cam: Point,
	target: Point,
): Set<string> {
	if (mode === "up") return new Set();
	if (mode === "down") return new Set(walls.map((w) => w.id));
	const dx = cam.x - target.x;
	const dy = cam.y - target.y;
	const d = Math.hypot(dx, dy);
	if (d < 1) return new Set();
	const toCam = { x: dx / d, y: dy / d };
	const out = new Set<string>();
	for (const w of walls) {
		const cx = (w.a.x + w.b.x) / 2 - target.x;
		const cy = (w.a.y + w.b.y) / 2 - target.y;
		const inFront = cx * toCam.x + cy * toCam.y > 1;
		if (!inFront) continue;
		const a = wallAngle(w);
		const facing = Math.abs(-Math.sin(a) * toCam.x + Math.cos(a) * toCam.y);
		if (facing >= FACING_COS) out.add(w.id);
	}
	return out;
}
