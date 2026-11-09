import { createRoom, createWall, DEFAULT_WALL_THICKNESS } from "./factory";
import { dist, polygonArea, projectOnSegment } from "./geometry";
import type { Floor, Point, Room, RoomType, Wall } from "./types";

const key = (p: Point) => `${Math.round(p.x)}:${Math.round(p.y)}`;

/**
 * Splits any wall whose interior passes through `p` so that walls always meet at end points.
 * Opening positions are re-mapped onto the resulting halves.
 */
export function splitWallsAt(
	floor: Floor,
	p: Point,
	tolerance = 2,
	onlyWallId?: string,
) {
	for (const wall of [...floor.walls]) {
		if (onlyWallId && wall.id !== onlyWallId) continue;
		if (dist(wall.a, p) <= tolerance || dist(wall.b, p) <= tolerance) continue;
		const proj = projectOnSegment(p, wall.a, wall.b);
		if (proj.distance > tolerance) continue;
		const second = createWall({ ...p }, wall.b, wall.partition, wall.thickness);
		second.height = wall.height;
		second.left = { ...wall.left };
		second.right = { ...wall.right };
		wall.b = { ...p };
		const total = dist(wall.a, second.b) || 1;
		const splitT = dist(wall.a, p) / total;
		for (const o of floor.openings) {
			if (o.wallId !== wall.id) continue;
			if (o.t > splitT) {
				o.wallId = second.id;
				o.t = (o.t - splitT) / (1 - splitT);
			} else {
				o.t = o.t / splitT;
			}
		}
		floor.walls.push(second);
	}
}

/**
 * Moves `p` onto an existing wall when it lies within that wall's half thickness (at most 10 cm): onto its end point
 * if one is that close, else onto its centre line. Walls drawn "next to" another wall thereby really touch it.
 */
export function attachPoint(
	floor: Floor,
	p: Point,
	ignoreWallId?: string,
): Point {
	let end: { pt: Point; d: number } | null = null;
	let line: { pt: Point; d: number } | null = null;
	for (const w of floor.walls) {
		if (w.id === ignoreWallId || w.hidden) continue;
		const tol = Math.max(2, Math.min(w.thickness / 2, 10));
		for (const q of [w.a, w.b]) {
			const d = dist(p, q);
			if (d <= tol && (!end || d < end.d)) end = { pt: q, d };
		}
		const pr = projectOnSegment(p, w.a, w.b);
		if (pr.distance <= tol && (!line || pr.distance < line.d))
			line = { pt: pr.point, d: pr.distance };
	}
	if (end) return { ...end.pt };
	if (line) return { ...line.pt };
	return p;
}

const sameSegment = (w: Pick<Wall, "a" | "b">, a: Point, b: Point) =>
	(dist(w.a, a) < 1 && dist(w.b, b) < 1) ||
	(dist(w.a, b) < 1 && dist(w.b, a) < 1);

/**
 * Adds a rectangular room, reusing walls that already run along its edges: corners are attached to nearby walls,
 * walls are split where a corner touches them, and an edge that is already a wall is not drawn again.
 * This is what lets a room be drawn inside (or against) another room.
 */
export function addRectangleRoomShared(
	floor: Floor,
	x: number,
	y: number,
	w: number,
	d: number,
	type: RoomType = "other",
	opts: { partition?: boolean; name?: string } = {},
): Room {
	const corners = [
		{ x, y },
		{ x: x + w, y },
		{ x: x + w, y: y + d },
		{ x, y: y + d },
	].map((c) => attachPoint(floor, c));
	for (const c of corners) splitWallsAt(floor, c);
	for (let i = 0; i < 4; i++) {
		const a = corners[i];
		const b = corners[(i + 1) % 4];
		if (floor.walls.some((wl) => sameSegment(wl, a, b))) continue;
		floor.walls.push(createWall(a, b, opts.partition ?? false));
	}
	const room = createRoom(
		insetPolygon(corners, DEFAULT_WALL_THICKNESS / 2),
		type,
		opts.name,
	);
	floor.rooms.push(room);
	return room;
}

/** Shortest cycle through the given wall, or null. */
export function findCycleThrough(walls: Wall[], wall: Wall): Point[] | null {
	const adj = new Map<string, { to: string; id: string; p: Point }[]>();
	const nodes = new Map<string, Point>();
	const add = (a: Point, b: Point, id: string) => {
		const ka = key(a);
		const kb = key(b);
		nodes.set(ka, a);
		nodes.set(kb, b);
		if (!adj.has(ka)) adj.set(ka, []);
		if (!adj.has(kb)) adj.set(kb, []);
		adj.get(ka)?.push({ to: kb, id, p: b });
		adj.get(kb)?.push({ to: ka, id, p: a });
	};
	for (const w of walls) if (w.id !== wall.id && !w.hidden) add(w.a, w.b, w.id);
	const start = key(wall.b);
	const goal = key(wall.a);
	if (start === goal || !adj.has(start) || !adj.has(goal)) return null;
	const prev = new Map<string, string | null>([[start, null]]);
	const queue = [start];
	while (queue.length) {
		const cur = queue.shift() as string;
		if (cur === goal) break;
		for (const e of adj.get(cur) ?? []) {
			if (!prev.has(e.to)) {
				prev.set(e.to, cur);
				queue.push(e.to);
			}
		}
	}
	if (!prev.has(goal)) return null;
	const path: string[] = [];
	let c: string | null = goal;
	while (c) {
		path.push(c);
		c = prev.get(c) ?? null;
	}
	// path: goal ... start ; polygon = wall.a (goal) -> ... -> wall.b (start)
	const poly = path.map((k) => nodes.get(k) as Point);
	return poly.length >= 3 ? poly : null;
}

const sameLoop = (a: Point[], b: Point[]) => {
	if (a.length !== b.length) return false;
	const ka = new Set(a.map(key));
	return b.every((p) => ka.has(key(p)));
};

/** Offsets a polygon inwards by `amount` (simple miter offset for convex/concave polys). */
export function insetPolygon(poly: Point[], amount: number): Point[] {
	const n = poly.length;
	const area = signedArea(poly);
	const sign = area > 0 ? 1 : -1;
	const out: Point[] = [];
	for (let i = 0; i < n; i++) {
		const p0 = poly[(i - 1 + n) % n];
		const p1 = poly[i];
		const p2 = poly[(i + 1) % n];
		const n1 = norm(p0, p1, sign);
		const n2 = norm(p1, p2, sign);
		const bx = n1.x + n2.x;
		const by = n1.y + n2.y;
		const bl = Math.hypot(bx, by) || 1;
		const dot = (bx / bl) * n1.x + (by / bl) * n1.y;
		const k = amount / Math.max(dot, 0.3);
		out.push({ x: p1.x + (bx / bl) * k, y: p1.y + (by / bl) * k });
	}
	return out;
}

function signedArea(poly: Point[]) {
	let s = 0;
	for (let i = 0; i < poly.length; i++) {
		const p = poly[i];
		const q = poly[(i + 1) % poly.length];
		s += p.x * q.y - q.x * p.y;
	}
	return s / 2;
}

function norm(a: Point, b: Point, sign: number): Point {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const l = Math.hypot(dx, dy) || 1;
	// Left normal points inward for a positive shoelace area; reversing the winding flips both the edge and the sign,
	// so multiplying by `sign` keeps the offset inward for either winding.
	return { x: (-dy / l) * sign, y: (dx / l) * sign };
}

/**
 * After adding a wall: split touching walls, then create a room if a new closed loop appeared.
 * Returns the created room when one was found.
 */
export function afterWallAdded(floor: Floor, wall: Wall): Room | null {
	// A wall that ends inside another wall's thickness is meant to touch it: attach, then split there.
	wall.a = attachPoint(floor, wall.a, wall.id);
	wall.b = attachPoint(floor, wall.b, wall.id);
	splitWallsAt(floor, wall.a);
	splitWallsAt(floor, wall.b);
	// Also split the new wall where existing wall end points lie on it.
	for (const other of [...floor.walls]) {
		if (other.id === wall.id) continue;
		for (const pt of [other.a, other.b]) splitWallsAt(floor, pt, 2, wall.id);
	}
	const poly = findCycleThrough(floor.walls, wall);
	if (!poly) return null;
	const maxThickness = Math.max(...floor.walls.map((w) => w.thickness), 10);
	const inner = insetPolygon(poly, maxThickness / 2);
	const area = polygonArea(inner);
	if (area < 10000) return null;
	if (
		floor.rooms.some((r) =>
			sameLoop(
				r.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
				inner.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
			),
		)
	) {
		return null;
	}
	// skip if an existing room covers nearly the same footprint
	if (
		floor.rooms.some(
			(r) =>
				Math.abs(polygonArea(r.points) - area) / area < 0.05 &&
				overlaps(r.points, inner),
		)
	)
		return null;
	const room = createRoom(inner, "other");
	floor.rooms.push(room);
	return room;
}

function overlaps(a: Point[], b: Point[]) {
	const c = b.reduce(
		(s, p) => ({ x: s.x + p.x / b.length, y: s.y + p.y / b.length }),
		{ x: 0, y: 0 },
	);
	let inside = false;
	for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
		if (
			a[i].y > c.y !== a[j].y > c.y &&
			c.x < ((a[j].x - a[i].x) * (c.y - a[i].y)) / (a[j].y - a[i].y) + a[i].x
		)
			inside = !inside;
	}
	return inside;
}

const sameMat = (a: Wall["left"], b: Wall["left"]) =>
	JSON.stringify(a) === JSON.stringify(b);

/**
 * Merges walls that meet ONLY each other at one of `points`, are collinear (opposite sides of the point) and are alike
 * (thickness, type, height, materials). It heals the leftover split points that appear when a wall is moved away from a
 * T-junction, so the side wall just gets longer instead of staying in several pieces. Openings keep their world position.
 * `prefer` lists wall ids to keep (e.g. the selection). Returns how many merges happened.
 */
export function mergeCollinearWalls(
	floor: Floor,
	points: Point[],
	prefer: Set<string> = new Set(),
): number {
	let merged = 0;
	for (const p of points) {
		const here = floor.walls.filter(
			(w) => dist(w.a, p) < 1 || dist(w.b, p) < 1,
		);
		if (here.length !== 2) continue;
		let [keep, drop] = here;
		if (prefer.has(drop.id) && !prefer.has(keep.id))
			[keep, drop] = [drop, keep];
		const keepAtB = dist(keep.b, p) < 1;
		const dropAtA = dist(drop.a, p) < 1;
		const keepFar = keepAtB ? keep.a : keep.b;
		const dropFar = dropAtA ? drop.b : drop.a;
		const u = { x: keepFar.x - p.x, y: keepFar.y - p.y };
		const v = { x: dropFar.x - p.x, y: dropFar.y - p.y };
		const lu = Math.hypot(u.x, u.y);
		const lv = Math.hypot(v.x, v.y);
		if (lu < 1e-6 || lv < 1e-6) continue;
		const cross = (u.x * v.y - u.y * v.x) / (lu * lv);
		const dot = (u.x * v.x + u.y * v.y) / (lu * lv);
		if (Math.abs(cross) > 0.01 || dot > 0) continue;
		// same direction (a->b continues into a->b) or reversed
		const reversed = keepAtB !== dropAtA;
		const sameLeft = sameMat(keep.left, reversed ? drop.right : drop.left);
		const sameRight = sameMat(keep.right, reversed ? drop.left : drop.right);
		if (
			keep.thickness !== drop.thickness ||
			keep.partition !== drop.partition ||
			keep.height !== drop.height ||
			keep.hidden !== drop.hidden ||
			!sameLeft ||
			!sameRight
		)
			continue;

		// world position of every opening, before the geometry changes
		const at = (w: Wall, t: number) => ({
			x: w.a.x + (w.b.x - w.a.x) * t,
			y: w.a.y + (w.b.y - w.a.y) * t,
		});
		const ops = floor.openings
			.filter((o) => o.wallId === keep.id || o.wallId === drop.id)
			.map((o) => ({
				o,
				c: at(o.wallId === keep.id ? keep : drop, o.t),
				flipDir: o.wallId === drop.id && reversed,
			}));
		if (keepAtB) keep.b = { ...dropFar };
		else keep.a = { ...dropFar };
		const len = dist(keep.a, keep.b) || 1;
		for (const { o, c, flipDir } of ops) {
			o.wallId = keep.id;
			o.t = Math.min(1, Math.max(0, dist(keep.a, c) / len));
			if (flipDir) {
				o.mirror = !o.mirror;
				o.flip = !o.flip;
			}
		}
		floor.walls = floor.walls.filter((w) => w.id !== drop.id);
		merged++;
	}
	return merged;
}

/**
 * Called when a drag of walls ends: heals leftover split points around the walls that moved and the walls attached
 * to them (the end points of those walls are the candidate joints).
 */
export function healAfterMove(
	floor: Floor,
	wallIds: Set<string>,
	prefer: Set<string> = new Set(),
): number {
	const touched = new Set(wallIds);
	for (const w of floor.walls) {
		if (!wallIds.has(w.id)) continue;
		for (const o of floor.walls)
			if (
				dist(o.a, w.a) < 1 ||
				dist(o.a, w.b) < 1 ||
				dist(o.b, w.a) < 1 ||
				dist(o.b, w.b) < 1
			)
				touched.add(o.id);
	}
	const points = floor.walls
		.filter((w) => touched.has(w.id))
		.flatMap((w) => [{ ...w.a }, { ...w.b }]);
	return mergeCollinearWalls(floor, points, prefer);
}
