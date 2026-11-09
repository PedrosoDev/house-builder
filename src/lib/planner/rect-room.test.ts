import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { createProject } from "./factory";
import { polygonArea, projectOnSegment, wallLength } from "./geometry";
import { PlannerStore } from "./store";
import type { Wall } from "./types";

const makeStore = () => {
	const s = new PlannerStore(createProject());
	s.addRectangleRoom(0, 3, 500, 465);
	return s;
};

/** True when two walls lie on the same line and share a stretch longer than 1 cm. */
const overlap = (a: Wall, b: Wall) => {
	const near = (p: { x: number; y: number }, w: Wall) =>
		projectOnSegment(p, w.a, w.b).distance < 1;
	if (!(near(a.a, b) && near(a.b, b)) && !(near(b.a, a) && near(b.b, a))) {
		// not fully collinear-contained; check partial collinear overlap
		const colinear = [a.a, a.b].every((p) => {
			const l = wallLength(b) || 1;
			const cross =
				Math.abs(
					(b.b.x - b.a.x) * (p.y - b.a.y) - (b.b.y - b.a.y) * (p.x - b.a.x),
				) / l;
			return cross < 1;
		});
		if (!colinear) return false;
	}
	const ux = b.b.x - b.a.x;
	const uy = b.b.y - b.a.y;
	const l2 = ux * ux + uy * uy || 1;
	const t = (p: { x: number; y: number }) =>
		((p.x - b.a.x) * ux + (p.y - b.a.y) * uy) / l2;
	const [a0, a1] = [t(a.a), t(a.b)].sort((x, y) => x - y);
	const lo = Math.max(a0, 0);
	const hi = Math.min(a1, 1);
	return (hi - lo) * Math.sqrt(l2) > 1;
};
const overlappingPairs = (walls: Wall[]) => {
	const out: [Wall, Wall][] = [];
	for (let i = 0; i < walls.length; i++)
		for (let j = i + 1; j < walls.length; j++)
			if (overlap(walls[i], walls[j])) out.push([walls[i], walls[j]]);
	return out;
};

describe("rectangular room drawn inside an existing room", () => {
	it("floating inside: adds its own 4 walls and a room", () => {
		const s = makeStore();
		s.addRectangleRoom(100, 100, 150, 120);
		assert.equal(s.floor.walls.length, 8);
		assert.equal(s.floor.rooms.length, 2);
		assert.equal(overlappingPairs(s.floor.walls).length, 0);
	});

	it("in a corner: reuses the outer walls and only adds the 2 missing ones", () => {
		const s = makeStore();
		s.addRectangleRoom(0, 3, 180, 130); // touches the top-left corner of the outer room
		// 4 outer (2 of them split at the new corners) + 2 new
		assert.equal(s.floor.walls.length, 8);
		assert.equal(s.floor.rooms.length, 2);
		const areas = s.floor.rooms.map((r) => Math.round(polygonArea(r.points)));
		assert.ok(areas.includes(17600), `areas: ${areas}`); // inset 10: 160 × 110
		const top = s.floor.walls.filter((w) => w.a.y === 3 && w.b.y === 3);
		assert.equal(
			top.length,
			2,
			"outer top wall must be split at the new corner",
		);
	});

	it("against one wall: reuses that wall and adds the other 3", () => {
		const s = makeStore();
		s.addRectangleRoom(100, 3, 150, 120); // top edge lies on the outer top wall
		assert.equal(s.floor.rooms.length, 2);
		// outer: 4 + 2 splits on the top wall; new: left, right, bottom
		assert.equal(s.floor.walls.length, 9);
	});

	it("never leaves overlapping (coincident) walls", () => {
		for (const [x, y, w, d] of [
			[0, 3, 180, 130],
			[100, 3, 150, 120],
			[320, 338, 180, 130], // bottom-right corner
		] as const) {
			const s = makeStore();
			s.addRectangleRoom(x, y, w, d);
			assert.deepEqual(
				overlappingPairs(s.floor.walls).length,
				0,
				`rect ${x},${y},${w},${d} left overlapping walls`,
			);
		}
	});

	it("heals corners that land a few cm off the outer wall centre line", () => {
		const s = makeStore();
		s.addRectangleRoom(0, 0, 180, 133); // y=0 is 3 cm above the top wall centre line (y=3)
		assert.equal(overlappingPairs(s.floor.walls).length, 0);
		assert.equal(s.floor.rooms.length, 2);
	});
});
