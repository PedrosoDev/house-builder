import { describe, expect, it } from "vitest";
import { createWall } from "./factory";
import { labelBox, planCentroid, wallLabelAnchor } from "./wall-label";

const cam = { x: 0, y: 0, zoom: 1 };

describe("wallLabelAnchor", () => {
	it("sits outside the plan: above a top wall, below a bottom wall", () => {
		const top = createWall({ x: 0, y: 0 }, { x: 300, y: 0 }); // thickness 20
		const bottom = createWall({ x: 0, y: 200 }, { x: 300, y: 200 });
		const centroid = { x: 150, y: 100 };
		const t = wallLabelAnchor(top, cam, centroid);
		const b = wallLabelAnchor(bottom, cam, centroid);
		expect(t.x).toBeCloseTo(150, 6);
		expect(t.y).toBeCloseTo(-20, 6); // half thickness (10) + 10px gap, away from the centroid
		expect(b.y).toBeCloseTo(220, 6);
	});

	it("applies the camera", () => {
		const w = createWall({ x: 0, y: 0 }, { x: 300, y: 0 });
		const a = wallLabelAnchor(
			w,
			{ x: 100, y: 50, zoom: 2 },
			{ x: 150, y: 100 },
		);
		expect(a.x).toBeCloseTo(150 * 2 + 100, 6);
		expect(a.y).toBeCloseTo(50 - (10 * 2 + 10), 6);
	});

	it("keeps text upright: rotation is always within [-90, 90]", () => {
		const centroid = { x: 150, y: 100 };
		const cases: [number, number, number][] = [
			[300, 0, 0],
			[-300, 0, 0],
			[0, 300, 90],
			[0, -300, -90],
			[-200, 200, -45],
			[-200, -200, 45],
		];
		for (const [dx, dy, expected] of cases) {
			const w = createWall({ x: 150, y: 100 }, { x: 150 + dx, y: 100 + dy });
			const deg = wallLabelAnchor(w, cam, centroid).deg;
			expect(Math.abs(deg)).toBeLessThanOrEqual(90 + 1e-9);
			expect(deg).toBeCloseTo(expected, 6);
		}
	});
});

describe("labelBox", () => {
	it("grows with the text and has a fixed height", () => {
		expect(labelBox("5.00 m").h).toBe(18);
		expect(labelBox("12.50 m").w).toBeGreaterThan(labelBox("5 m").w);
		expect(labelBox("5 m").w).toBeGreaterThan(0);
	});
});

describe("planCentroid", () => {
	it("averages the wall end points; an empty plan is the origin", () => {
		const walls = [
			createWall({ x: 0, y: 0 }, { x: 400, y: 0 }),
			createWall({ x: 400, y: 0 }, { x: 400, y: 200 }),
		];
		expect(planCentroid(walls)).toEqual({ x: 800 / 4 + 100, y: 50 });
		expect(planCentroid([])).toEqual({ x: 0, y: 0 });
	});
});
