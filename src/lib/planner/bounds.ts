import type { Box } from "./camera";
import { lerp, rectCorners, wallQuad } from "./geometry";
import type { Floor, Point, SelectionRef, Wall } from "./types";

export type { Box };

export const boxOfPoints = (pts: Point[]): Box | null => {
	if (pts.length === 0) return null;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const p of pts) {
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
	}
	return { minX, minY, maxX, maxY };
};

export const unionBox = (a: Box | null, b: Box | null): Box | null => {
	if (!a) return b;
	if (!b) return a;
	return {
		minX: Math.min(a.minX, b.minX),
		minY: Math.min(a.minY, b.minY),
		maxX: Math.max(a.maxX, b.maxX),
		maxY: Math.max(a.maxY, b.maxY),
	};
};

/** Outline polygon of an entity in world space (used for selection / hover chrome). */
export function outlineOfRef(floor: Floor, ref: SelectionRef): Point[] | null {
	switch (ref.kind) {
		case "item": {
			const i = floor.items.find((x) => x.id === ref.id);
			return i ? rectCorners(i.x, i.y, i.w, i.d, i.rotation) : null;
		}
		case "stair": {
			const s = floor.stairs.find((x) => x.id === ref.id);
			return s ? rectCorners(s.x, s.y, s.width, s.length, s.rotation) : null;
		}
		case "room": {
			const r = floor.rooms.find((x) => x.id === ref.id);
			return r ? r.points : null;
		}
		case "wall": {
			const w = floor.walls.find((x) => x.id === ref.id);
			return w ? wallQuad(w) : null;
		}
		case "opening": {
			const o = floor.openings.find((x) => x.id === ref.id);
			const w = o && floor.walls.find((x) => x.id === o.wallId);
			if (!o || !w) return null;
			const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) || 1;
			const half = o.width / 2 / len;
			const s = lerp(w.a, w.b, o.t - half);
			const e = lerp(w.a, w.b, o.t + half);
			return wallQuad({ a: s, b: e, thickness: w.thickness });
		}
		case "ruler": {
			const r = floor.rulers.find((x) => x.id === ref.id);
			return r ? [r.a, r.b] : null;
		}
	}
}

export const boxOfRef = (floor: Floor, ref: SelectionRef): Box | null => {
	const o = outlineOfRef(floor, ref);
	return o ? boxOfPoints(o) : null;
};

export function boxOfRefs(floor: Floor, refs: SelectionRef[]): Box | null {
	let box: Box | null = null;
	for (const r of refs) box = unionBox(box, boxOfRef(floor, r));
	return box;
}

export function boxOfFloor(floor: Floor): Box | null {
	const pts: Point[] = [];
	for (const w of floor.walls) pts.push(w.a, w.b);
	for (const r of floor.rooms) pts.push(...r.points);
	for (const i of floor.items)
		pts.push(...rectCorners(i.x, i.y, i.w, i.d, i.rotation));
	for (const s of floor.stairs)
		pts.push(...rectCorners(s.x, s.y, s.width, s.length, s.rotation));
	return boxOfPoints(pts);
}

/**
 * What an object can snap to on a wall: its two FACES (centre line ± thickness/2) as zero-height boxes spanning the wall
 * (with the square end caps), so an item lands flush against the wall surface instead of on the centre line.
 * Diagonal walls only offer their end points, grown by the half thickness.
 */
export function wallFaceBoxes(w: Wall): Box[] {
	const h = w.thickness / 2;
	const minX = Math.min(w.a.x, w.b.x);
	const maxX = Math.max(w.a.x, w.b.x);
	const minY = Math.min(w.a.y, w.b.y);
	const maxY = Math.max(w.a.y, w.b.y);
	if (maxY - minY < 0.5) {
		const y = (w.a.y + w.b.y) / 2;
		return [y - h, y + h].map((fy) => ({
			minX: minX - h,
			maxX: maxX + h,
			minY: fy,
			maxY: fy,
		}));
	}
	if (maxX - minX < 0.5) {
		const x = (w.a.x + w.b.x) / 2;
		return [x - h, x + h].map((fx) => ({
			minX: fx,
			maxX: fx,
			minY: minY - h,
			maxY: maxY + h,
		}));
	}
	return [w.a, w.b].map((p) => ({
		minX: p.x - h,
		maxX: p.x + h,
		minY: p.y - h,
		maxY: p.y + h,
	}));
}
