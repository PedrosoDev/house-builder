import { describe, expect, it } from "vitest";
import { createOpening, createProject, createWall } from "./factory";
import { polygonArea, wallLength } from "./geometry";
import { PlannerStore } from "./store";
import type { Floor } from "./types";
import { setWallLength } from "./wall-resize";

const floorWith = (...walls: ReturnType<typeof createWall>[]): Floor => {
	const f = createProject().floors[0];
	f.walls.push(...walls);
	return f;
};

describe("setWallLength", () => {
	it("lengthens a lone wall, keeping the start fixed", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const f = floorWith(w);
		expect(setWallLength(f, w.id, 450)).toBe(true);
		expect(w.a).toEqual({ x: 0, y: 0 });
		expect(w.b.x).toBeCloseTo(450, 9);
		expect(w.b.y).toBeCloseTo(0, 9);
	});

	it("shortens along the wall direction, also for diagonal walls", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 400 }); // length 500
		const f = floorWith(w);
		setWallLength(f, w.id, 250);
		expect(wallLength(w)).toBeCloseTo(250, 9);
		expect(w.b.x / w.b.y).toBeCloseTo(300 / 400, 9);
	});

	it("moves the free end when only the other end is attached to another wall", () => {
		const w1 = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const w2 = createWall({ x: 0, y: 0 }, { x: 0, y: 200 }); // attached at w1.a
		const f = floorWith(w1, w2);
		setWallLength(f, w1.id, 400);
		expect(w1.a).toEqual({ x: 0, y: 0 });
		expect(w1.b.x).toBeCloseTo(400, 9);
		expect(w2.b).toEqual({ x: 0, y: 200 });

		// mirror: attached at b -> the free end a moves, b stays
		const w3 = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const w4 = createWall({ x: 300, y: 0 }, { x: 300, y: 200 });
		const g = floorWith(w3, w4);
		setWallLength(g, w3.id, 400);
		expect(w3.b).toEqual({ x: 300, y: 0 });
		expect(w3.a.x).toBeCloseTo(-100, 9);
	});

	it("keeps a rectangle rectangular: the perpendicular wall slides, the opposite wall follows", () => {
		const s = new PlannerStore(createProject());
		s.addRectangleRoom(0, 3, 500, 465);
		const top = s.floor.walls.find((w) => w.a.y === 3 && w.b.y === 3);
		expect(top).toBeTruthy();
		if (!top) return;
		const before = polygonArea(s.floor.rooms[0].points);
		s.setWallLength(top.id, 600);
		const f = s.floor;
		const right = f.walls.find((w) => w.a.x === 600 && w.b.x === 600);
		expect(right, "right wall slid to x=600").toBeTruthy();
		expect(right && wallLength(right)).toBeCloseTo(465, 9);
		const bottom = f.walls.find((w) => w.a.y === 468 && w.b.y === 468);
		expect(bottom && wallLength(bottom)).toBeCloseTo(600, 9);
		const left = f.walls.find((w) => w.a.x === 0 && w.b.x === 0);
		expect(left && wallLength(left)).toBeCloseTo(465, 9);
		// the room grows with the walls (480x445 -> 580x445)
		expect(polygonArea(f.rooms[0].points)).toBeCloseTo(before + 100 * 445, 3);
	});

	it("does not slide a neighbour that is not perpendicular (only its end point follows)", () => {
		const w1 = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const diag = createWall({ x: 300, y: 0 }, { x: 400, y: 200 });
		const side = createWall({ x: 0, y: 0 }, { x: 0, y: 200 }); // both ends attached -> b moves
		const f = floorWith(w1, diag, side);
		setWallLength(f, w1.id, 400);
		expect(diag.a).toEqual({ x: 400, y: 0 });
		expect(diag.b).toEqual({ x: 400, y: 200 });
	});

	it("keeps openings at the same distance from the fixed end", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const f = floorWith(w);
		const o = createOpening(w, "window", 100 / 300, { width: 80 });
		f.openings.push(o);
		setWallLength(f, w.id, 500);
		expect(o.t * 500).toBeCloseTo(100, 6);
		setWallLength(f, w.id, 200);
		expect(o.t * 200).toBeCloseTo(100, 6);
	});

	it("keeps an opening inside the wall when the wall gets shorter than its position", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const f = floorWith(w);
		const o = createOpening(w, "window", 250 / 300, { width: 80 });
		f.openings.push(o);
		setWallLength(f, w.id, 150);
		expect(o.t).toBeLessThanOrEqual(1 - 40 / 150 + 1e-9);
		expect(o.t).toBeGreaterThanOrEqual(40 / 150 - 1e-9);
	});

	it.each([
		0,
		-50,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		5,
	])("rejects an invalid length (%s)", (len) => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const f = floorWith(w);
		expect(setWallLength(f, w.id, len)).toBe(false);
		expect(w.b).toEqual({ x: 300, y: 0 });
	});

	it("returns false for an unknown wall", () => {
		expect(setWallLength(floorWith(), "nope", 100)).toBe(false);
	});
});

describe("PlannerStore.setWallLength", () => {
	it("is a single undo step", () => {
		const s = new PlannerStore(createProject());
		s.addWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const id = s.floor.walls[0].id;
		const undoDepth = s.getState().past.length;
		s.setWallLength(id, 450);
		expect(s.floor.walls[0].b.x).toBeCloseTo(450, 9);
		expect(s.getState().past.length).toBe(undoDepth + 1);
		s.undo();
		expect(s.floor.walls[0].b.x).toBeCloseTo(300, 9);
	});

	it("does not touch the history for an invalid length", () => {
		const s = new PlannerStore(createProject());
		s.addWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const depth = s.getState().past.length;
		s.setWallLength(s.floor.walls[0].id, -1);
		expect(s.getState().past.length).toBe(depth);
	});
});
