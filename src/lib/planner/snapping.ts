import type { Box } from "./camera";
import type { Point } from "./types";

/** A smart guide. axis "x" is a vertical line at x = pos spanning y in [from, to]; axis "y" is horizontal. */
export type Guide = { axis: "x" | "y"; pos: number; from: number; to: number };

export type Measure = { a: Point; b: Point; value: number };

const xs = (b: Box) => [b.minX, (b.minX + b.maxX) / 2, b.maxX];
const ys = (b: Box) => [b.minY, (b.minY + b.maxY) / 2, b.maxY];

/**
 * Figma-style smart-guide snapping. Finds the nearest alignment (edge/centre against edge/centre) between the
 * moving box and any other box within `threshold` (world units), per axis, and reports the guide lines.
 */
export function snapBoxMove(box: Box, others: Box[], threshold: number) {
	let bestX: { d: number; abs: number } | null = null;
	let bestY: { d: number; abs: number } | null = null;
	for (const o of others) {
		for (const m of xs(box))
			for (const c of xs(o)) {
				const d = c - m;
				if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < bestX.abs))
					bestX = { d, abs: Math.abs(d) };
			}
		for (const m of ys(box))
			for (const c of ys(o)) {
				const d = c - m;
				if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < bestY.abs))
					bestY = { d, abs: Math.abs(d) };
			}
	}
	const dx = bestX?.d ?? 0;
	const dy = bestY?.d ?? 0;
	const moved: Box = {
		minX: box.minX + dx,
		maxX: box.maxX + dx,
		minY: box.minY + dy,
		maxY: box.maxY + dy,
	};
	const guides: Guide[] = [];
	const eps = 0.5;
	const add = (g: Guide) => {
		const same = guides.find(
			(x) => x.axis === g.axis && Math.abs(x.pos - g.pos) < eps,
		);
		if (same) {
			same.from = Math.min(same.from, g.from);
			same.to = Math.max(same.to, g.to);
		} else guides.push(g);
	};
	for (const o of others) {
		if (bestX) {
			for (const m of xs(moved))
				for (const c of xs(o))
					if (Math.abs(m - c) < eps)
						add({
							axis: "x",
							pos: c,
							from: Math.min(moved.minY, o.minY),
							to: Math.max(moved.maxY, o.maxY),
						});
		}
		if (bestY) {
			for (const m of ys(moved))
				for (const c of ys(o))
					if (Math.abs(m - c) < eps)
						add({
							axis: "y",
							pos: c,
							from: Math.min(moved.minX, o.minX),
							to: Math.max(moved.maxX, o.maxX),
						});
		}
	}
	return { dx, dy, snapX: !!bestX, snapY: !!bestY, guides };
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => {
	const lo = Math.max(a0, b0);
	const hi = Math.min(a1, b1);
	return hi > lo ? { lo, hi } : null;
};

/** Distances between two boxes (Alt-hover measurement): horizontal and vertical gaps. */
export function measureBetween(a: Box, b: Box): Measure[] {
	const out: Measure[] = [];
	const oy = overlap(a.minY, a.maxY, b.minY, b.maxY);
	const ox = overlap(a.minX, a.maxX, b.minX, b.maxX);
	const cy = oy ? (oy.lo + oy.hi) / 2 : (a.minY + a.maxY) / 2;
	const cx = ox ? (ox.lo + ox.hi) / 2 : (a.minX + a.maxX) / 2;
	const hx = (x0: number, x1: number, y: number) => {
		if (x1 - x0 > 0.5)
			out.push({ a: { x: x0, y }, b: { x: x1, y }, value: x1 - x0 });
	};
	const vy = (y0: number, y1: number, x: number) => {
		if (y1 - y0 > 0.5)
			out.push({ a: { x, y: y0 }, b: { x, y: y1 }, value: y1 - y0 });
	};
	if (b.minX >= a.maxX) hx(a.maxX, b.minX, cy);
	else if (a.minX >= b.maxX) hx(b.maxX, a.minX, cy);
	if (b.minY >= a.maxY) vy(a.maxY, b.minY, cx);
	else if (a.minY >= b.maxY) vy(b.maxY, a.minY, cx);
	// Containment: show the four margins from the inner box to the outer one.
	if (out.length === 0) {
		const inner =
			a.minX >= b.minX &&
			a.maxX <= b.maxX &&
			a.minY >= b.minY &&
			a.maxY <= b.maxY
				? a
				: b;
		const outer = inner === a ? b : a;
		const icx = (inner.minX + inner.maxX) / 2;
		const icy = (inner.minY + inner.maxY) / 2;
		hx(outer.minX, inner.minX, icy);
		hx(inner.maxX, outer.maxX, icy);
		vy(outer.minY, inner.minY, icx);
		vy(inner.maxY, outer.maxY, icx);
	}
	return out;
}
