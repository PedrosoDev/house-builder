import { dist } from "./geometry";
import type { Floor, Point } from "./types";

/** Moves every wall end point (and nearby room corner) that sits at `from` by (dx, dy). */
export function shiftJoint(f: Floor, from: Point, dx: number, dy: number) {
	for (const w of f.walls) {
		for (const key of ["a", "b"] as const) {
			const pt = w[key];
			if (dist(pt, from) < 1) {
				pt.x += dx;
				pt.y += dy;
			}
		}
	}
	// keep rooms attached: their inset corners sit close to the wall joint
	for (const r of f.rooms) {
		for (const pt of r.points) {
			if (dist(pt, from) < 25) {
				pt.x += dx;
				pt.y += dy;
			}
		}
	}
}

/** Moves a single wall joint (shared end points) to a new position. */
export function moveJoint(f: Floor, from: Point, to: Point) {
	shiftJoint(f, { ...from }, to.x - from.x, to.y - from.y);
}
