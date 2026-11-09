import { dist, wallLength } from "./geometry";
import { shiftJoint } from "./joints";
import type { Floor, Point, Wall } from "./types";

/** Shortest wall length the editor accepts (cm). */
export const MIN_WALL_LENGTH = 10;

const attachedAt = (floor: Floor, wall: Wall, p: Point) =>
	floor.walls.some(
		(o) => o.id !== wall.id && (dist(o.a, p) < 1 || dist(o.b, p) < 1),
	);

/**
 * Sets a wall's length (cm) along its own direction. Returns false (changing nothing) for an invalid length.
 *
 * Which end moves: the free one when only one end touches another wall, otherwise the end point `b`.
 * Connected walls follow: a neighbour perpendicular to this wall slides as a whole (so rectangles stay rectangular and
 * the opposite wall is stretched), any other neighbour only has its end point moved. Rooms and openings are carried
 * along; an opening keeps its distance from the end that stays fixed.
 */
export function setWallLength(
	floor: Floor,
	wallId: string,
	newLength: number,
): boolean {
	if (!Number.isFinite(newLength) || newLength < MIN_WALL_LENGTH) return false;
	const wall = floor.walls.find((w) => w.id === wallId);
	if (!wall) return false;
	const len = wallLength(wall);
	if (len < 1e-6) return false;
	if (Math.abs(newLength - len) < 1e-9) return true;

	const u = { x: (wall.b.x - wall.a.x) / len, y: (wall.b.y - wall.a.y) / len };
	const moveA =
		attachedAt(floor, wall, wall.b) && !attachedAt(floor, wall, wall.a);
	const delta = newLength - len;
	const v = moveA
		? { x: -u.x * delta, y: -u.y * delta }
		: { x: u.x * delta, y: u.y * delta };

	const before = new Map(
		floor.walls.map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]),
	);

	const visited = new Set<string>();
	const shiftAt = (p: Point) => {
		const key = `${Math.round(p.x)}:${Math.round(p.y)}`;
		if (visited.has(key)) return;
		visited.add(key);
		const neighbours = floor.walls
			.filter((o) => o.id !== wall.id && (dist(o.a, p) < 1 || dist(o.b, p) < 1))
			.map((o) => ({
				far: dist(o.a, p) < 1 ? { ...o.b } : { ...o.a },
				cos: Math.abs(
					((o.b.x - o.a.x) * u.x + (o.b.y - o.a.y) * u.y) /
						(wallLength(o) || 1),
				),
			}));
		shiftJoint(floor, { ...p }, v.x, v.y);
		for (const n of neighbours) if (n.cos < 0.02) shiftAt(n.far);
	};
	shiftAt(moveA ? wall.a : wall.b);

	// openings keep their distance from the end of their wall that did not move
	for (const w of floor.walls) {
		const was = before.get(w.id);
		if (!was) continue;
		const len0 = dist(was.a, was.b);
		const len1 = wallLength(w);
		const aMoved = dist(was.a, w.a) > 1e-6;
		const bMoved = dist(was.b, w.b) > 1e-6;
		if (!aMoved && !bMoved) continue;
		for (const o of floor.openings) {
			if (o.wallId !== w.id) continue;
			let t = o.t;
			if (aMoved && !bMoved) t = 1 - (1 - o.t) * (len0 / len1);
			else if (bMoved && !aMoved) t = o.t * (len0 / len1);
			const half = o.width / 2 / len1;
			o.t = half * 2 >= 1 ? 0.5 : Math.min(Math.max(t, half), 1 - half);
		}
	}
	return true;
}
