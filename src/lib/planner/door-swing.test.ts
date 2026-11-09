import { describe, expect, it } from "vitest";
import {
	createFloor,
	createOpening,
	createProject,
	createWall,
} from "./factory";
import { snapOpening } from "./placement";
import { PlannerStore } from "./store";

const o = { zoom: 1, grid: 10, snap: true, smartGuides: true, free: false };

/** Wall normal is (-sin a, cos a): for a wall running +x it points to +y. mirror=false swings toward that normal. */
describe("door swing follows the side of the wall the pointer is on", () => {
	const horizontal = () => {
		const f = createFloor("h");
		f.walls.push(createWall({ x: 0, y: 0 }, { x: 600, y: 0 }));
		return f;
	};

	it("pointer on the normal side -> swings that way (no mirror)", () => {
		const r = snapOpening(horizontal(), { x: 300, y: 20 }, 90, o);
		expect(r?.mirror).toBe(false);
	});

	it("pointer on the other side -> swings the other way (mirror)", () => {
		const r = snapOpening(horizontal(), { x: 300, y: -20 }, 90, o);
		expect(r?.mirror).toBe(true);
	});

	it("works on a vertical wall too (normal of a wall running +y points to -x)", () => {
		const f = createFloor("v");
		f.walls.push(createWall({ x: 0, y: 0 }, { x: 0, y: 600 }));
		expect(snapOpening(f, { x: -20, y: 300 }, 90, o)?.mirror).toBe(false);
		expect(snapOpening(f, { x: 20, y: 300 }, 90, o)?.mirror).toBe(true);
	});

	it("depends on the wall direction, not on screen position", () => {
		const f = createFloor("r");
		f.walls.push(createWall({ x: 600, y: 0 }, { x: 0, y: 0 })); // same line, reversed
		expect(snapOpening(f, { x: 300, y: 20 }, 90, o)?.mirror).toBe(true);
		expect(snapOpening(f, { x: 300, y: -20 }, 90, o)?.mirror).toBe(false);
	});

	it("pointer right on the wall centre line keeps the default (no flicker)", () => {
		expect(snapOpening(horizontal(), { x: 300, y: 0 }, 90, o)?.mirror).toBe(
			false,
		);
		expect(snapOpening(horizontal(), { x: 300, y: 0.3 }, 90, o)?.mirror).toBe(
			false,
		);
		expect(snapOpening(horizontal(), { x: 300, y: -0.3 }, 90, o)?.mirror).toBe(
			false,
		);
	});
});

describe("creating an opening with a swing side", () => {
	it("createOpening accepts mirror and defaults to false", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 600, y: 0 });
		expect(createOpening(w, "door", 0.5).mirror).toBe(false);
		expect(createOpening(w, "door", 0.5, { mirror: true }).mirror).toBe(true);
	});

	it("store.addOpening stores the chosen side", () => {
		const s = new PlannerStore(createProject());
		s.addWall({ x: 0, y: 0 }, { x: 600, y: 0 });
		const wall = s.floor.walls[0];
		const id = s.addOpening(wall.id, "door", 0.5, { width: 90, mirror: true });
		const created = s.floor.openings.find((x) => x.id === id);
		expect(created?.mirror).toBe(true);
		expect(created?.width).toBe(90);
	});
});
