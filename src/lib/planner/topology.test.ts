import { describe, expect, it } from "vitest";
import { polygonArea } from "./geometry";
import { insetPolygon } from "./topology";

const rect = [
	{ x: 0, y: 0 },
	{ x: 180, y: 0 },
	{ x: 180, y: 130 },
	{ x: 0, y: 130 },
];

describe("insetPolygon", () => {
	it("shrinks a polygon wound one way", () => {
		const out = insetPolygon(rect, 10);
		expect(polygonArea(out)).toBeCloseTo(160 * 110, 3);
		expect(out[0]).toEqual({ x: 10, y: 10 });
	});

	it("shrinks it by the same amount when wound the other way", () => {
		const out = insetPolygon([...rect].reverse(), 10);
		expect(polygonArea(out)).toBeCloseTo(160 * 110, 3);
		expect(out.every((p) => p.x >= 10 - 1e-9 && p.x <= 170 + 1e-9)).toBe(true);
		expect(out.every((p) => p.y >= 10 - 1e-9 && p.y <= 120 + 1e-9)).toBe(true);
	});

	it("keeps an L-shaped polygon inside its outline", () => {
		const l = [
			{ x: 0, y: 0 },
			{ x: 200, y: 0 },
			{ x: 200, y: 100 },
			{ x: 100, y: 100 },
			{ x: 100, y: 200 },
			{ x: 0, y: 200 },
		];
		for (const poly of [l, [...l].reverse()]) {
			const out = insetPolygon(poly, 10);
			expect(polygonArea(out)).toBeLessThan(polygonArea(poly));
		}
	});
});
