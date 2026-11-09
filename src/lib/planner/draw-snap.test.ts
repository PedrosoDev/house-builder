import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { snapDrawPoint } from "./draw-snap";
import { addRectangleRoom, createFloor } from "./factory";
import { projectOnSegment } from "./geometry";
import type { Floor } from "./types";

/** Outer room whose walls are deliberately OFF the 10 cm grid (centre lines x=0/500, y=3/468). */
const outer = (): Floor => {
	const f = createFloor("t");
	addRectangleRoom(f, 0, 3, 500, 465);
	return f;
};
const base = { zoom: 1, grid: 10, snap: true, free: false };

const distToWalls = (f: Floor, p: { x: number; y: number }) =>
	Math.min(...f.walls.map((w) => projectOnSegment(p, w.a, w.b).distance));

describe("snapDrawPoint", () => {
	it("attracts to an existing wall end point", () => {
		const r = snapDrawPoint(outer(), { x: 504, y: 6 }, base);
		assert.deepEqual(r, { x: 500, y: 3 });
	});

	it("lands exactly on a wall centre line when the pointer is near the wall (T-junction), even off-grid", () => {
		const f = outer();
		const r = snapDrawPoint(f, { x: 183, y: 0 }, base);
		assert.ok(
			distToWalls(f, r) < 1e-9,
			`point ${JSON.stringify(r)} is not on a wall`,
		);
		assert.equal(r.y, 3);
		assert.equal(r.x, 180); // still grid-snapped along the wall
	});

	it("keeps the drawing angle: an orthogonal wall ends exactly where its ray meets the wall", () => {
		const f = outer();
		const r = snapDrawPoint(
			f,
			{ x: 182, y: 8 },
			{ ...base, anchor: { x: 180, y: 140 } },
		);
		assert.deepEqual(r, { x: 180, y: 3 });
	});

	it("prefers an end point over the wall segment", () => {
		const r = snapDrawPoint(outer(), { x: 2, y: 8 }, base);
		assert.deepEqual(r, { x: 0, y: 3 });
	});

	it("does not attract from far away (radius scales with zoom)", () => {
		const f = outer();
		assert.deepEqual(snapDrawPoint(f, { x: 250, y: 250 }, base), {
			x: 250,
			y: 250,
		});
		// 14px at zoom 0.5 = 28cm reach; 20cm away still attracts, at zoom 4 (3.5cm) it does not
		assert.equal(
			snapDrawPoint(f, { x: 180, y: 23 }, { ...base, zoom: 0.5 }).y,
			3,
		);
		assert.notEqual(
			snapDrawPoint(f, { x: 180, y: 23 }, { ...base, zoom: 4 }).y,
			3,
		);
	});

	it("grid/angle snapping still works away from walls", () => {
		const r = snapDrawPoint(
			outer(),
			{ x: 203, y: 204 },
			{ ...base, anchor: { x: 100, y: 200 } },
		);
		assert.deepEqual(r, { x: 200, y: 200 });
	});

	it("Ctrl (free) disables segment and grid snapping but not end points", () => {
		const f = outer();
		assert.deepEqual(
			snapDrawPoint(f, { x: 183, y: 0 }, { ...base, free: true }),
			{ x: 183, y: 0 },
		);
		assert.deepEqual(
			snapDrawPoint(f, { x: 504, y: 6 }, { ...base, free: true }),
			{ x: 500, y: 3 },
		);
	});
});
