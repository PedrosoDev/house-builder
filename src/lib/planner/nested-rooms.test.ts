import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type DrawSnapOpts, snapDrawPoint } from "./draw-snap";
import { createProject } from "./factory";
import { polygonArea } from "./geometry";
import { PlannerStore } from "./store";
import type { Point } from "./types";

/** A store holding one 5 m × 4.65 m room whose walls are off the 10 cm grid. */
const makeStore = () => {
	const s = new PlannerStore(createProject());
	s.addRectangleRoom(0, 3, 500, 465);
	return s;
};
const opts: Omit<DrawSnapOpts, "anchor"> = {
	zoom: 1,
	grid: 10,
	snap: true,
	free: false,
};

/** Draws one wall the way the canvas does: snap both ends (the second one relative to the first). */
const drawWall = (s: PlannerStore, a: Point, b: Point) => {
	const sa = snapDrawPoint(s.floor, a, opts);
	const sb = snapDrawPoint(s.floor, b, { ...opts, anchor: sa });
	s.addWall(sa, sb);
};

const roomAreas = (s: PlannerStore) =>
	s.floor.rooms
		.map((r) => Math.round(polygonArea(r.points)))
		.sort((x, y) => y - x);

describe("a room inside another room, closed with only two walls", () => {
	// Figure from the bug report: cut a 1.8 m × 1.4 m corner out of a bigger room.
	const wall1: [Point, Point] = [
		{ x: 1, y: 138 },
		{ x: 178, y: 141 },
	]; // left wall -> inside
	const wall2: [Point, Point] = [
		{ x: 180, y: 138 },
		{ x: 181, y: 2 },
	]; // inside -> top wall

	it("creates the inner room (and keeps the outer one)", () => {
		const s = makeStore();
		drawWall(s, ...wall1);
		assert.equal(
			s.floor.rooms.length,
			1,
			"one wall alone must not create a room",
		);
		drawWall(s, ...wall2);
		assert.equal(s.floor.rooms.length, 2);
		// inner: x 10..170, y 13..130  => 160 × 117 cm
		assert.ok(roomAreas(s).includes(18720), `areas: ${roomAreas(s)}`);
	});

	it("works in the opposite drawing order", () => {
		const s = makeStore();
		drawWall(s, ...wall2);
		drawWall(s, ...wall1);
		assert.equal(s.floor.rooms.length, 2);
		assert.ok(roomAreas(s).includes(18720));
	});

	it("splits the outer walls at the junctions so walls meet at end points", () => {
		const s = makeStore();
		drawWall(s, ...wall1);
		drawWall(s, ...wall2);
		assert.equal(s.floor.walls.length, 8); // 4 outer + 2 new + 2 splits
		const ends = (p: Point) =>
			s.floor.walls.filter(
				(w) =>
					(w.a.x === p.x && w.a.y === p.y) || (w.b.x === p.x && w.b.y === p.y),
			).length;
		assert.equal(ends({ x: 180, y: 3 }), 3); // top wall (2 pieces) + new vertical
		assert.equal(ends({ x: 0, y: 140 }), 3); // left wall (2 pieces) + new horizontal
	});

	it("does not create a second room when a wall only cuts across (no closed loop)", () => {
		const s = makeStore();
		drawWall(s, { x: 1, y: 138 }, { x: 499, y: 140 }); // wall from side to side: closes TWO loops
		assert.equal(s.floor.rooms.length >= 2, true);
	});
});

describe("walls that end a few cm short of another wall (inside its thickness)", () => {
	it("are attached to the wall centre line and split it", () => {
		const s = makeStore();
		// raw store call, no canvas snapping: x=180,y=0 is 3 cm away from the top wall centre line (y=3)
		s.addWall({ x: 180, y: 0 }, { x: 180, y: 140 });
		const top = s.floor.walls.filter((w) => w.a.y === 3 && w.b.y === 3);
		assert.equal(top.length, 2, "top wall must be split at the T-junction");
		const added = s.floor.walls.find((w) => w.a.x === 180 && w.b.x === 180);
		assert.ok(added);
		assert.equal(added.a.y, 3, "the new wall end must sit on the centre line");
	});
});
