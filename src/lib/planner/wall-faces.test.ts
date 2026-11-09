import { describe, expect, it } from "vitest";
import { wallFaceBoxes } from "./bounds";
import { createFloor, createWall } from "./factory";
import { snapTargets } from "./placement";
import { snapBoxMove } from "./snapping";

const wall = (ax: number, ay: number, bx: number, by: number, t = 20) => {
	const w = createWall({ x: ax, y: ay }, { x: bx, y: by });
	w.thickness = t;
	return w;
};

describe("wallFaceBoxes: the faces of a wall, not just its centre line", () => {
	it("a horizontal wall exposes its two faces at centre ± thickness/2", () => {
		const boxes = wallFaceBoxes(wall(0, 3, 500, 3, 20));
		const ys = boxes.map((b) => [b.minY, b.maxY]);
		expect(ys).toContainEqual([-7, -7]);
		expect(ys).toContainEqual([13, 13]);
		for (const b of boxes) {
			expect(b.minX).toBe(-10);
			expect(b.maxX).toBe(510);
		}
	});

	it("a vertical wall exposes two faces in x", () => {
		const boxes = wallFaceBoxes(wall(100, 0, 100, 400, 10));
		const xs = boxes.map((b) => [b.minX, b.maxX]);
		expect(xs).toContainEqual([95, 95]);
		expect(xs).toContainEqual([105, 105]);
	});

	it("never exposes the centre line (items must not snap into the wall)", () => {
		const boxes = wallFaceBoxes(wall(0, 3, 500, 3, 20));
		expect(boxes.every((b) => b.minY !== 3 && b.maxY !== 3)).toBe(true);
	});

	it("a diagonal wall still gives something to snap to (its ends, with thickness)", () => {
		expect(wallFaceBoxes(wall(0, 0, 300, 200)).length).toBeGreaterThan(0);
	});
});

describe("snapping an object to a wall that is NOT on the grid", () => {
	it("an object 3 cm from the face snaps flush against it", () => {
		const f = createFloor("f");
		f.walls.push(wall(0, 3, 500, 3, 20)); // lower face at y = 13
		const moving = { minX: 100, maxX: 200, minY: 16, maxY: 76 };
		const r = snapBoxMove(moving, snapTargets(f), 6);
		expect(r.snapY).toBe(true);
		expect(moving.minY + r.dy).toBeCloseTo(13, 6);
	});

	it("coming from the other side it stops at the opposite face", () => {
		const f = createFloor("f");
		f.walls.push(wall(0, 303, 500, 303, 20)); // upper face at y = 293
		const moving = { minX: 100, maxX: 200, minY: 230, maxY: 290 };
		const r = snapBoxMove(moving, snapTargets(f), 6);
		expect(moving.maxY + r.dy).toBeCloseTo(293, 6);
	});

	it("does not stick to the centre line of the wall", () => {
		const f = createFloor("f");
		f.walls.push(wall(0, 303, 500, 303, 20));
		// the box edge is 2 cm from the centre line but 8 from the face: it must NOT snap to 303
		const moving = { minX: 100, maxX: 200, minY: 301, maxY: 361 };
		const r = snapBoxMove(moving, snapTargets(f), 6);
		expect(moving.minY + r.dy).not.toBeCloseTo(303, 6);
	});
});
