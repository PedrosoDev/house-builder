import { describe, expect, it } from "vitest";
import {
	axisPairs,
	guidesForPoint,
	hitsToGuides,
	jointRefs,
	snapPointToAxes,
	snapShiftToAxes,
} from "./axis-stick";
import { createProject } from "./factory";
import { PlannerStore } from "./store";

/** A 5 m × 4.65 m room: walls top (0,3)-(500,3), right (500,3)-(500,468), bottom (500,468)-(0,468), left (0,468)-(0,3). */
const room = () => {
	const s = new PlannerStore(createProject());
	s.addRectangleRoom(0, 3, 500, 465);
	const f = s.floor;
	const by = (ax: number, ay: number, bx: number, by_: number) =>
		f.walls.find(
			(w) =>
				(w.a.x === ax && w.a.y === ay && w.b.x === bx && w.b.y === by_) ||
				(w.b.x === ax && w.b.y === ay && w.a.x === bx && w.a.y === by_),
		);
	return {
		f,
		top: by(0, 3, 500, 3),
		right: by(500, 3, 500, 468),
		bottom: by(500, 468, 0, 468),
		left: by(0, 468, 0, 3),
	};
};

describe("snapPointToAxes", () => {
	const refs = [{ x: 100, y: 100 }];

	it("sticks one axis when only that axis is close", () => {
		const r = snapPointToAxes({ x: 104, y: 250 }, refs, 8);
		expect(r.point).toEqual({ x: 100, y: 250 });
		expect([r.snappedX, r.snappedY]).toEqual([true, false]);
		const r2 = snapPointToAxes({ x: 250, y: 95 }, refs, 8);
		expect(r2.point).toEqual({ x: 250, y: 100 });
		expect([r2.snappedX, r2.snappedY]).toEqual([false, true]);
	});

	it("sticks both axes at once", () => {
		const r = snapPointToAxes({ x: 103, y: 98 }, refs, 8);
		expect(r.point).toEqual({ x: 100, y: 100 });
		expect([r.snappedX, r.snappedY]).toEqual([true, true]);
	});

	it("lets go beyond the threshold (the diagonal becomes reachable)", () => {
		const r = snapPointToAxes({ x: 109, y: 250 }, refs, 8);
		expect(r.point).toEqual({ x: 109, y: 250 });
		expect(r.snappedX).toBe(false);
	});

	it("picks the nearest reference per axis", () => {
		const r = snapPointToAxes(
			{ x: 56, y: 0 },
			[
				{ x: 50, y: 900 },
				{ x: 58, y: 900 },
			],
			8,
		);
		expect(r.point.x).toBe(58);
	});
});

describe("snapShiftToAxes (moving whole walls)", () => {
	// right-wall joint (500,3) with its far end (500,468): a horizontal shift of 0 keeps it vertical
	const pairs = [{ j: { x: 500, y: 3 }, f: { x: 500, y: 468 } }];

	it("sticks the shift so the neighbour stays exactly vertical", () => {
		const r = snapShiftToAxes(pairs, 4, 100, 8);
		expect(r.dx).toBe(0);
		expect(r.dy).toBe(100);
		expect([r.snappedX, r.snappedY]).toEqual([true, false]);
		expect(r.hits.some((h) => h.axis === "x" && h.pos === 500)).toBe(true);
	});

	it("lets the neighbour tilt once the shift goes past the threshold", () => {
		const r = snapShiftToAxes(pairs, 12, 100, 8);
		expect(r.dx).toBe(12);
		expect(r.snappedX).toBe(false);
		expect(r.hits).toHaveLength(0);
	});

	it("also sticks vertical shifts so a horizontal neighbour stays horizontal", () => {
		const r = snapShiftToAxes(
			[{ j: { x: 500, y: 468 }, f: { x: 0, y: 468 } }],
			120,
			-5,
			8,
		);
		expect([r.dx, r.dy]).toEqual([120, 0]);
		expect([r.snappedX, r.snappedY]).toEqual([false, true]);
	});

	it("does nothing without neighbours", () => {
		expect(snapShiftToAxes([], 4, 4, 8)).toMatchObject({
			dx: 4,
			dy: 4,
			snappedX: false,
			snappedY: false,
		});
	});
});

describe("axisPairs", () => {
	it("moving the top wall: both side walls are affected, with their far ends", () => {
		const { f, top } = room();
		expect(top).toBeTruthy();
		const pairs = axisPairs(f, new Set([top?.id ?? ""]));
		expect(pairs).toHaveLength(2);
		const fars = pairs.map((p) => `${p.f.x},${p.f.y}`).sort();
		expect(fars).toEqual(["0,468", "500,468"]);
		const joints = pairs.map((p) => `${p.j.x},${p.j.y}`).sort();
		expect(joints).toEqual(["0,3", "500,3"]);
	});

	it("moved walls are not side effects of each other", () => {
		const { f, top, right } = room();
		const pairs = axisPairs(f, new Set([top?.id ?? "", right?.id ?? ""]));
		const fars = pairs.map((p) => `${p.f.x},${p.f.y}`).sort();
		// left (far end 0,468) at joint (0,3) and bottom (far end 0,468) at joint (500,468)
		expect(fars).toEqual(["0,468", "0,468"]);
		expect(pairs.map((p) => `${p.j.x},${p.j.y}`).sort()).toEqual([
			"0,3",
			"500,468",
		]);
	});
});

describe("jointRefs (dragging one end of a wall)", () => {
	it("returns the wall's other end and the far ends of the walls attached at the joint", () => {
		const { f, top } = room();
		const refs = jointRefs(f, top?.id ?? "", "b"); // joint (500,3)
		const keys = refs.map((p) => `${p.x},${p.y}`).sort();
		expect(keys).toEqual(["0,3", "500,468"]);
	});

	it("a free end only has the other end as reference", () => {
		const s = new PlannerStore(createProject());
		s.addWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const w = s.floor.walls[0];
		expect(jointRefs(s.floor, w.id, "b")).toEqual([{ x: 0, y: 0 }]);
	});
});

describe("guides for the stuck axes", () => {
	it("hitsToGuides spans the moved joint and the far end", () => {
		expect(
			hitsToGuides([
				{
					axis: "x",
					pos: 500,
					from: { x: 500, y: 103 },
					to: { x: 500, y: 468 },
				},
			]),
		).toEqual([{ axis: "x", pos: 500, from: 103, to: 468 }]);
		expect(
			hitsToGuides([
				{ axis: "y", pos: 468, from: { x: 520, y: 468 }, to: { x: 0, y: 468 } },
			]),
		).toEqual([{ axis: "y", pos: 468, from: 0, to: 520 }]);
	});

	it("guidesForPoint draws a guide to every reference on a stuck axis", () => {
		const refs = [
			{ x: 100, y: 100 },
			{ x: 100, y: 400 },
			{ x: 300, y: 50 },
		];
		const g = guidesForPoint({ x: 100, y: 250 }, refs, true, false);
		expect(g).toHaveLength(2);
		expect(g.every((x) => x.axis === "x" && x.pos === 100)).toBe(true);
		expect(guidesForPoint({ x: 100, y: 250 }, refs, false, false)).toEqual([]);
	});
});
