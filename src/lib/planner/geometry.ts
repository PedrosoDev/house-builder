import type { Opening, Point, Wall } from "./types";

export const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export const lerp = (a: Point, b: Point, t: number): Point => ({
	x: a.x + (b.x - a.x) * t,
	y: a.y + (b.y - a.y) * t,
});

export const snapValue = (v: number, step: number) =>
	Math.round(v / step) * step;

export const snapPoint = (p: Point, step: number): Point => ({
	x: snapValue(p.x, step),
	y: snapValue(p.y, step),
});

export const wallLength = (w: Pick<Wall, "a" | "b">) => dist(w.a, w.b);

export const wallAngle = (w: Pick<Wall, "a" | "b">) =>
	Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);

/** Closest point on segment ab to p, with parameter t in 0..1. */
export function projectOnSegment(p: Point, a: Point, b: Point) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t =
		len2 === 0
			? 0
			: Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
	const point = { x: a.x + dx * t, y: a.y + dy * t };
	return { point, t, distance: dist(p, point) };
}

export function polygonArea(points: Point[]) {
	let s = 0;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const q = points[(i + 1) % points.length];
		s += p.x * q.y - q.x * p.y;
	}
	return Math.abs(s) / 2;
}

export function polygonPerimeter(points: Point[]) {
	let s = 0;
	for (let i = 0; i < points.length; i++)
		s += dist(points[i], points[(i + 1) % points.length]);
	return s;
}

export function polygonCentroid(points: Point[]): Point {
	if (points.length === 0) return { x: 0, y: 0 };
	let a = 0;
	let cx = 0;
	let cy = 0;
	for (let i = 0; i < points.length; i++) {
		const p = points[i];
		const q = points[(i + 1) % points.length];
		const f = p.x * q.y - q.x * p.y;
		a += f;
		cx += (p.x + q.x) * f;
		cy += (p.y + q.y) * f;
	}
	if (Math.abs(a) < 1e-6) {
		const n = points.length;
		return {
			x: points.reduce((s, p) => s + p.x, 0) / n,
			y: points.reduce((s, p) => s + p.y, 0) / n,
		};
	}
	return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function pointInPolygon(p: Point, poly: Point[]) {
	let inside = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const xi = poly[i].x;
		const yi = poly[i].y;
		const xj = poly[j].x;
		const yj = poly[j].y;
		if (
			yi > p.y !== yj > p.y &&
			p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi
		)
			inside = !inside;
	}
	return inside;
}

export function rotatePoint(p: Point, origin: Point, deg: number): Point {
	const r = (deg * Math.PI) / 180;
	const c = Math.cos(r);
	const s = Math.sin(r);
	const dx = p.x - origin.x;
	const dy = p.y - origin.y;
	return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** Corners of a rotated rectangle centred on (x, y). */
export function rectCorners(
	x: number,
	y: number,
	w: number,
	d: number,
	rotation: number,
): Point[] {
	const hw = w / 2;
	const hd = d / 2;
	const c = { x, y };
	return [
		{ x: x - hw, y: y - hd },
		{ x: x + hw, y: y - hd },
		{ x: x + hw, y: y + hd },
		{ x: x - hw, y: y + hd },
	].map((p) => rotatePoint(p, c, rotation));
}

/** Four corners of a wall footprint as a quad. */
export function wallQuad(w: Pick<Wall, "a" | "b" | "thickness">): Point[] {
	const ang = wallAngle(w);
	const nx = -Math.sin(ang) * (w.thickness / 2);
	const ny = Math.cos(ang) * (w.thickness / 2);
	return [
		{ x: w.a.x + nx, y: w.a.y + ny },
		{ x: w.b.x + nx, y: w.b.y + ny },
		{ x: w.b.x - nx, y: w.b.y - ny },
		{ x: w.a.x - nx, y: w.a.y - ny },
	];
}

export function openingSegment(
	w: Pick<Wall, "a" | "b">,
	o: Pick<Opening, "t" | "width">,
) {
	const len = wallLength(w);
	const half = o.width / 2 / (len || 1);
	return {
		start: lerp(w.a, w.b, Math.max(0, o.t - half)),
		end: lerp(w.a, w.b, Math.min(1, o.t + half)),
	};
}

export function boundsOf(points: Point[]) {
	if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of points) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	return { minX, minY, maxX, maxY };
}

/** Snap to 15-degree increments relative to an anchor. */
export function snapAngle(anchor: Point, p: Point, stepDeg = 15): Point {
	const len = dist(anchor, p);
	const ang = Math.atan2(p.y - anchor.y, p.x - anchor.x);
	const step = (stepDeg * Math.PI) / 180;
	const snapped = Math.round(ang / step) * step;
	return {
		x: anchor.x + Math.cos(snapped) * len,
		y: anchor.y + Math.sin(snapped) * len,
	};
}

let counter = 0;
export function uid(prefix = "id") {
	counter++;
	return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

// ---- unit formatting ----

export function formatLength(cm: number, units: "metric" | "imperial") {
	if (units === "imperial") {
		const totalIn = cm / 2.54;
		const ft = Math.floor(totalIn / 12);
		const inch = Math.round(totalIn - ft * 12);
		return inch === 12 ? `${ft + 1}'0"` : `${ft}'${inch}"`;
	}
	return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${Math.round(cm)} cm`;
}

export function formatArea(cm2: number, units: "metric" | "imperial") {
	if (units === "imperial") return `${(cm2 / 929.0304).toFixed(1)} ft²`;
	return `${(cm2 / 10000).toFixed(2)} m²`;
}
