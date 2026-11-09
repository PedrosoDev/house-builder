import { describe, expect, it } from "vitest";
import { itemById } from "./catalog";
import { createFloor, createItem, createOpening, createWall } from "./factory";
import { placeItem, snapOpening } from "./placement";

const o = { zoom: 0.5, grid: 10, snap: true, smartGuides: true, free: false };

const floorWithWalls = () => {
	const f = createFloor("t");
	const top = createWall({ x: 0, y: 0 }, { x: 600, y: 0 }); // 6 m horizontal
	const right = createWall({ x: 600, y: 0 }, { x: 600, y: 400 }); // 4 m vertical
	f.walls.push(top, right);
	return { f, top, right };
};

describe("snapOpening (doors/windows glue to walls)", () => {
	it("glues to a wall from far away (44px magnet = 88cm at zoom .5)", () => {
		const { f, top } = floorWithWalls();
		const a = snapOpening(f, { x: 237, y: 70 }, 100, o);
		expect(a?.wall.id).toBe(top.id);
	});

	it("returns null when no wall is within reach", () => {
		const { f } = floorWithWalls();
		expect(snapOpening(f, { x: 300, y: 300 }, 100, o)).toBeNull();
	});

	it("snaps to the wall centre, and flush to either end", () => {
		const { f } = floorWithWalls();
		const c = snapOpening(f, { x: 303, y: 10 }, 100, o);
		expect(c?.snap).toBe("center");
		expect(c?.t).toBeCloseTo(0.5, 9);
		const e = snapOpening(f, { x: 55, y: 10 }, 100, o);
		expect(e?.snap).toBe("start");
		expect((e?.t ?? 0) * 600).toBeCloseTo(50, 9);
	});

	it("reports the distance to the far wall end only (gap 0 on the flush side)", () => {
		const { f } = floorWithWalls();
		const e = snapOpening(f, { x: 55, y: 10 }, 100, o);
		expect(e?.gaps).toHaveLength(1);
		expect(e?.gaps[0].value).toBeCloseTo(500, 9);
	});

	it("Ctrl (free) disables snapping", () => {
		const { f } = floorWithWalls();
		expect(
			snapOpening(f, { x: 303, y: 10 }, 100, { ...o, free: true })?.snap,
		).toBeNull();
	});

	it("sticks to the previous wall (hysteresis) and otherwise takes the nearest", () => {
		const g = createFloor("g");
		const w1 = createWall({ x: 0, y: 0 }, { x: 600, y: 0 });
		const w2 = createWall({ x: 0, y: 60 }, { x: 600, y: 60 });
		g.walls.push(w1, w2);
		const p = { x: 300, y: 28 };
		expect(snapOpening(g, p, 100, { ...o, zoom: 1 })?.wall.id).toBe(w1.id);
		expect(
			snapOpening(g, p, 100, { ...o, zoom: 1, preferWallId: w2.id })?.wall.id,
		).toBe(w2.id);
	});

	it("goes flush against a neighbouring opening on the same wall", () => {
		const { f, top } = floorWithWalls();
		f.openings.push(createOpening(top, "window", 0.25, { width: 100 })); // centre 150, edge 200
		const n = snapOpening(f, { x: 245, y: 10 }, 100, o);
		expect(n?.snap).toBe("neighbor");
		expect((n?.t ?? 0) * 600).toBeCloseTo(250, 9);
	});
});

describe("placeItem", () => {
	it("rests against a wall, back to the wall", () => {
		const { f, top } = floorWithWalls();
		const def = itemById("bed-double");
		expect(def).toBeTruthy();
		if (!def) return;
		const r = placeItem(f, def, { x: 250, y: 120 }, 0, o);
		expect(r.wall?.id).toBe(top.id);
		expect(r.rotation % 360).toBeCloseTo(0, 6);
		expect(r.y).toBeCloseTo(top.thickness / 2 + def.size[2] / 2, 6);
	});

	it("faces away from a vertical wall", () => {
		const { f } = floorWithWalls();
		const def = itemById("bed-double");
		if (!def) throw new Error("catalog item missing");
		const r = placeItem(f, def, { x: 520, y: 200 }, 0, o);
		expect(r.wall).not.toBeNull();
		expect([90, 270]).toContain(Math.round((r.rotation + 360) % 360));
	});

	it("grid-snaps when floating", () => {
		const def = itemById("bed-double");
		if (!def) throw new Error("catalog item missing");
		const r = placeItem(createFloor("e"), def, { x: 233, y: 117 }, 0, o);
		expect([r.x, r.y]).toEqual([230, 120]);
	});

	it("aligns centres with another item and reports a guide", () => {
		const f = createFloor("x");
		const other = createItem("sofa-3", 400, 300);
		const def = itemById("sofa-3");
		if (!other || !def) throw new Error("catalog item missing");
		f.items.push(other);
		const r = placeItem(f, def, { x: 405, y: 600 }, 0, o);
		expect(r.x).toBeCloseTo(400, 6);
		expect(r.guides.length).toBeGreaterThan(0);
	});
});
