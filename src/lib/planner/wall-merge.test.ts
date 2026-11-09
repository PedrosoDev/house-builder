import { describe, expect, it } from "vitest";
import { createFloor, createOpening, createWall } from "./factory";
import { healAfterMove, mergeCollinearWalls } from "./topology";

const W = (ax: number, ay: number, bx: number, by: number, partition = false) =>
	createWall({ x: ax, y: ay }, { x: bx, y: by }, partition);

describe("mergeCollinearWalls (leftover split points disappear)", () => {
	it("merges two collinear walls that only meet each other", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 40), W(0, 40, 0, 110));
		expect(mergeCollinearWalls(f, [{ x: 0, y: 40 }])).toBe(1);
		expect(f.walls).toHaveLength(1);
		expect(f.walls[0].a).toEqual({ x: 0, y: 0 });
		expect(f.walls[0].b).toEqual({ x: 0, y: 110 });
	});

	it("keeps the T: a third wall at the joint prevents the merge", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 150), W(0, 150, 0, 400), W(0, 150, 270, 150, true));
		expect(mergeCollinearWalls(f, [{ x: 0, y: 150 }])).toBe(0);
		expect(f.walls).toHaveLength(3);
	});

	it("does not merge walls that are not collinear (a corner)", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 100), W(0, 100, 200, 100));
		expect(mergeCollinearWalls(f, [{ x: 0, y: 100 }])).toBe(0);
		expect(f.walls).toHaveLength(2);
	});

	it("does not merge walls with different thickness/type", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 100), W(0, 100, 0, 200, true));
		expect(mergeCollinearWalls(f, [{ x: 0, y: 100 }])).toBe(0);
	});

	it("only touches the given points (a deliberate split elsewhere stays)", () => {
		const f = createFloor("f");
		f.walls.push(
			W(0, 0, 0, 100),
			W(0, 100, 0, 200),
			W(300, 0, 300, 100),
			W(300, 100, 300, 200),
		);
		expect(mergeCollinearWalls(f, [{ x: 0, y: 100 }])).toBe(1);
		expect(f.walls).toHaveLength(3);
	});

	it("works when the second wall is drawn in the opposite direction", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 100), W(0, 250, 0, 100));
		expect(mergeCollinearWalls(f, [{ x: 0, y: 100 }])).toBe(1);
		expect(f.walls).toHaveLength(1);
		const w = f.walls[0];
		const ys = [w.a.y, w.b.y].sort((x, y) => x - y);
		expect(ys).toEqual([0, 250]);
	});

	it("merges a chain when every joint is given", () => {
		const f = createFloor("f");
		f.walls.push(W(0, 0, 0, 50), W(0, 50, 0, 100), W(0, 100, 0, 200));
		expect(
			mergeCollinearWalls(f, [
				{ x: 0, y: 50 },
				{ x: 0, y: 100 },
			]),
		).toBe(2);
		expect(f.walls).toHaveLength(1);
		expect(f.walls[0].b).toEqual({ x: 0, y: 200 });
	});

	it("keeps openings at the same place in the world", () => {
		const f = createFloor("f");
		const a = W(0, 0, 0, 100);
		const b = W(0, 100, 0, 300);
		f.walls.push(a, b);
		const door = createOpening(b, "door", 0.5); // world y = 200
		f.openings.push(door);
		const win = createOpening(a, "window", 0.5); // world y = 50
		f.openings.push(win);
		mergeCollinearWalls(f, [{ x: 0, y: 100 }]);
		const w = f.walls[0];
		expect(f.openings.every((o) => o.wallId === w.id)).toBe(true);
		const worldY = (id: string) => {
			const o = f.openings.find((x) => x.id === id);
			return w.a.y + (w.b.y - w.a.y) * (o?.t ?? 0);
		};
		expect(worldY(door.id)).toBeCloseTo(200, 3);
		expect(worldY(win.id)).toBeCloseTo(50, 3);
	});

	it("prefers to keep a wall id (e.g. the selected one)", () => {
		const f = createFloor("f");
		const a = W(0, 0, 0, 40);
		const b = W(0, 40, 0, 110);
		f.walls.push(a, b);
		mergeCollinearWalls(f, [{ x: 0, y: 40 }], new Set([b.id]));
		expect(f.walls.map((w) => w.id)).toEqual([b.id]);
	});
});

describe("healAfterMove (what the canvas calls when a drag ends)", () => {
	it("moving the partition away from a leftover split leaves one side wall, not an extra piece", () => {
		// the real project: left wall in pieces (-95..40) (40..110) (110..435) and the partition at y=110
		const f = createFloor("f");
		const top = W(-10, -95, -10, 40);
		const mid = W(-10, 40, -10, 110);
		const low = W(-10, 110, -10, 435);
		const part = W(-10, 110, 330, 110, true);
		f.walls.push(top, mid, low, part);
		const n = healAfterMove(f, new Set([part.id]), new Set([part.id]));
		expect(n).toBe(1);
		expect(f.walls).toHaveLength(3);
		const left = f.walls.find(
			(w) => (w.a.x === -10 && w.b.x === -10 && w.a.y === -95) || w.b.y === -95,
		);
		expect(left).toBeTruthy();
		expect(f.walls.some((w) => w.id === part.id)).toBe(true);
	});

	it("a normal T (side wall in two pieces around the partition) is left alone", () => {
		const f = createFloor("f");
		const part = W(0, 150, 270, 150, true);
		f.walls.push(W(0, 0, 0, 150), W(0, 150, 0, 400), part);
		expect(healAfterMove(f, new Set([part.id]), new Set([part.id]))).toBe(0);
		expect(f.walls).toHaveLength(3);
	});
});
