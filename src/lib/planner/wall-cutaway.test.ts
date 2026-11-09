import { describe, expect, it } from "vitest";
import { createWall } from "./factory";
import {
	endNeighbourLevels,
	stepLevel,
	wallPieces,
	wallsToLower,
	wallTopProfile,
} from "./wall-cutaway";

const op = (
	centre: number,
	width: number,
	sill: number,
	height: number,
	len: number,
) => ({
	t: centre / len,
	width,
	sill,
	height,
});

const area = (
	ps: { xa: number; xb: number; y0: number; ta: number; tb: number }[],
) =>
	ps.reduce(
		(a, p) => a + ((p.xb - p.xa) * (p.ta - p.y0 + (p.tb - p.y0))) / 2,
		0,
	);
const P = { low: 50, full: 270, level: 0, rampA: 0, rampB: 0, ramp: 80 };

describe("wallTopProfile (height of the wall along its length)", () => {
	it("level 1 is the full height everywhere, level 0 the stub", () => {
		const up = wallTopProfile(400, { ...P, level: 1 });
		const low = wallTopProfile(400, { ...P, level: 0 });
		for (const x of [0, 100, 399]) {
			expect(up.top(x)).toBeCloseTo(270, 6);
			expect(low.top(x)).toBeCloseTo(50, 6);
		}
	});

	it("an intermediate level is in between (smooth rise/fall animation)", () => {
		expect(wallTopProfile(400, { ...P, level: 0.5 }).top(200)).toBeCloseTo(
			160,
			6,
		);
	});

	it("a full-height neighbour at end A slopes the stub up to the full height at the joint", () => {
		const pr = wallTopProfile(400, { ...P, rampA: 1 });
		expect(pr.top(0)).toBeCloseTo(270, 6);
		expect(pr.top(40)).toBeCloseTo(160, 6); // halfway along the ramp
		expect(pr.top(80)).toBeCloseTo(50, 6);
		expect(pr.top(300)).toBeCloseTo(50, 6);
	});

	it("the ramp at end B mirrors the one at end A", () => {
		const pr = wallTopProfile(400, { ...P, rampB: 1 });
		expect(pr.top(400)).toBeCloseTo(270, 6);
		expect(pr.top(360)).toBeCloseTo(160, 6);
		expect(pr.top(100)).toBeCloseTo(50, 6);
	});

	it("a neighbour that is only halfway up gives a half-height ramp (smooth)", () => {
		expect(wallTopProfile(400, { ...P, rampA: 0.5 }).top(0)).toBeCloseTo(
			160,
			6,
		);
	});

	it("never goes below the plateau (the ramp is a max, not a replacement)", () => {
		const pr = wallTopProfile(400, { ...P, level: 0.8, rampA: 1 });
		expect(pr.top(300)).toBeCloseTo(50 + 220 * 0.8, 6);
		expect(pr.top(0)).toBeCloseTo(270, 6);
	});

	it("the ramp never exceeds half of a short wall", () => {
		const pr = wallTopProfile(100, { ...P, rampA: 1, rampB: 1 });
		expect(pr.top(50)).toBeCloseTo(50, 6);
	});
});

describe("wallPieces (solid parts of the wall under that profile)", () => {
	const flat = (len: number, h: number) =>
		wallTopProfile(len, { ...P, low: h, full: h, level: 1 });

	it("a plain wall is one box", () => {
		expect(wallPieces(400, [], flat(400, 50))).toEqual([
			{ xa: 0, xb: 400, y0: 0, ta: 50, tb: 50 },
		]);
	});

	it("a door leaves a gap in the stub", () => {
		const ps = wallPieces(400, [op(200, 90, 0, 210, 400)], flat(400, 50));
		expect(ps.map((p) => [p.xa, p.xb])).toEqual([
			[0, 155],
			[245, 400],
		]);
		expect(area(ps)).toBeCloseTo((400 - 90) * 50, 6);
	});

	it("a window above the stub does not matter; below the top it is a hole", () => {
		const stub = wallPieces(400, [op(200, 100, 90, 120, 400)], flat(400, 50));
		expect(area(stub)).toBeCloseTo(400 * 50, 6);
		const full = wallPieces(400, [op(200, 100, 90, 120, 400)], flat(400, 270));
		expect(area(full)).toBeCloseTo(400 * 270 - 100 * 120, 6);
	});

	it("a window in a wall that is only partly raised is cut open at the top", () => {
		// wall top at 100: window sill 40..160 -> solid: below the sill (40) and the sides, nothing above
		const ps = wallPieces(400, [op(200, 100, 40, 120, 400)], flat(400, 100));
		expect(area(ps)).toBeCloseTo(400 * 100 - 100 * (100 - 40), 6);
	});

	it("the ramp makes sloped tops that follow the profile", () => {
		const pr = wallTopProfile(400, { ...P, rampA: 1 });
		const ps = wallPieces(400, [], pr);
		expect(area(ps)).toBeCloseTo((80 * (270 + 50)) / 2 + 320 * 50, 4);
		expect(ps[0].ta).toBeCloseTo(270, 6);
	});

	it("a door under a ramp keeps the area right (knots at the crossings)", () => {
		const pr = wallTopProfile(400, { ...P, rampA: 1 });
		const door = op(40, 60, 0, 210, 400); // x 10..70, inside the ramp
		const ps = wallPieces(400, [door], pr);
		// the door removes the part of the wall under the profile within x 10..70
		const under = (x: number) => Math.min(pr.top(x), 210);
		let removed = 0;
		for (let k = 0; k < 6000; k++)
			removed += under(10 + (k + 0.5) * 0.01) * 0.01;
		expect(area(ps)).toBeCloseTo((80 * (270 + 50)) / 2 + 320 * 50 - removed, 0);
	});
});

describe("endNeighbourLevels (which ends meet a raised wall)", () => {
	const a = createWall({ x: 0, y: 0 }, { x: 400, y: 0 });
	const b = createWall({ x: 400, y: 0 }, { x: 400, y: 300 });
	const c = createWall({ x: 400, y: 300 }, { x: 0, y: 300 });

	it("takes the highest level among the other walls at each end", () => {
		const lv = new Map([
			[a.id, 0],
			[b.id, 1],
			[c.id, 0],
		]);
		const r = endNeighbourLevels([a, b, c], lv);
		expect(r.get(a.id)).toEqual({ a: 0, b: 1 });
		expect(r.get(c.id)).toEqual({ a: 1, b: 0 });
	});

	it("a free end has no neighbour, so no ramp", () => {
		const lv = new Map([
			[a.id, 0],
			[b.id, 1],
			[c.id, 1],
		]);
		expect(endNeighbourLevels([a, b, c], lv).get(a.id)?.a).toBe(0);
	});

	it("follows animated levels continuously", () => {
		const lv = new Map([
			[a.id, 0],
			[b.id, 0.4],
			[c.id, 0],
		]);
		expect(endNeighbourLevels([a, b, c], lv).get(a.id)?.b).toBeCloseTo(0.4, 6);
	});
});

describe("stepLevel (smooth appear/disappear)", () => {
	it("moves toward the target without overshooting", () => {
		const a = stepLevel(1, 0, 0.05);
		expect(a).toBeLessThan(1);
		expect(a).toBeGreaterThan(0);
		const b = stepLevel(0, 1, 0.05);
		expect(b).toBeGreaterThan(0);
		expect(b).toBeLessThan(1);
	});

	it("reaches the target in finite time and then stays", () => {
		let v = 1;
		for (let i = 0; i < 60; i++) v = stepLevel(v, 0, 1 / 60);
		expect(v).toBe(0);
		expect(stepLevel(0, 0, 0.1)).toBe(0);
	});

	it("is frame-rate independent (two half steps ≈ one full step)", () => {
		const one = stepLevel(1, 0, 0.1);
		const two = stepLevel(stepLevel(1, 0, 0.05), 0, 0.05);
		expect(two).toBeCloseTo(one, 6);
	});
});

describe("wallsToLower (which walls hide the room from the camera)", () => {
	// a 500x400 room centred on (250, 200); horizontal walls top (y=0) and bottom (y=400), vertical left/right
	const top = createWall({ x: 0, y: 0 }, { x: 500, y: 0 });
	const right = createWall({ x: 500, y: 0 }, { x: 500, y: 400 });
	const bottom = createWall({ x: 500, y: 400 }, { x: 0, y: 400 });
	const left = createWall({ x: 0, y: 400 }, { x: 0, y: 0 });
	const walls = [top, right, bottom, left];
	const target = { x: 250, y: 200 };

	it("'up' lowers nothing, 'down' lowers everything", () => {
		expect(wallsToLower(walls, "up", { x: 250, y: 2000 }, target).size).toBe(0);
		expect(wallsToLower(walls, "down", { x: 250, y: 2000 }, target).size).toBe(
			4,
		);
	});

	it("camera in front (south): only the front wall is lowered, the sides and the back stay", () => {
		const low = wallsToLower(walls, "cut", { x: 250, y: 2000 }, target);
		expect([...low]).toEqual([bottom.id]);
	});

	it("camera at the south-east corner: both walls facing it are lowered, the far two stay", () => {
		const low = wallsToLower(walls, "cut", { x: 2000, y: 2000 }, target);
		expect([...low].sort()).toEqual([bottom.id, right.id].sort());
	});

	it("camera from the north lowers the top wall instead", () => {
		const low = wallsToLower(walls, "cut", { x: 250, y: -2000 }, target);
		expect([...low]).toEqual([top.id]);
	});

	it("camera from the west lowers the left wall", () => {
		const low = wallsToLower(walls, "cut", { x: -2000, y: 200 }, target);
		expect([...low]).toEqual([left.id]);
	});

	it("walls behind the target never get lowered, even when facing the camera head-on", () => {
		const low = wallsToLower(walls, "cut", { x: 250, y: 2000 }, target);
		expect(low.has(top.id)).toBe(false);
	});

	it("a partition in front of the target is lowered too (keeps the room separation visible, low)", () => {
		const part = createWall({ x: 0, y: 300 }, { x: 500, y: 300 }, true);
		const low = wallsToLower(
			[...walls, part],
			"cut",
			{ x: 250, y: 2000 },
			target,
		);
		expect(low.has(part.id)).toBe(true);
	});

	it("camera exactly above the target (no horizontal direction) lowers nothing", () => {
		expect(wallsToLower(walls, "cut", target, target).size).toBe(0);
	});
});
