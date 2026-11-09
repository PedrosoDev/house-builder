import { describe, expect, it } from "vitest";
import {
	fitBox,
	gridSteps,
	interpretWheel,
	nextZoomStep,
	toScreen,
	toWorldPoint,
	zoomAt,
} from "./camera";
import { measureBetween, snapBoxMove } from "./snapping";

const wheel = (o: Partial<Parameters<typeof interpretWheel>[0]>) =>
	interpretWheel(
		{
			deltaX: 0,
			deltaY: 0,
			deltaMode: 0,
			ctrlKey: false,
			metaKey: false,
			shiftKey: false,
			...o,
		},
		800,
		false,
	);

describe("camera", () => {
	it("zoomAt keeps the point under the cursor fixed", () => {
		const cam = { x: 100, y: 50, zoom: 0.5 };
		const z = zoomAt(cam, 1, 300, 200);
		const before = toWorldPoint(cam, { x: 300, y: 200 });
		const after = toWorldPoint(z, { x: 300, y: 200 });
		expect(after.x).toBeCloseTo(before.x, 9);
		expect(after.y).toBeCloseTo(before.y, 9);
	});

	it("clamps zoom", () => {
		const cam = { x: 0, y: 0, zoom: 1 };
		expect(zoomAt(cam, 1000, 0, 0).zoom).toBe(16);
		expect(zoomAt(cam, 0, 0, 0).zoom).toBe(0.02);
	});

	it("plain wheel pans; Ctrl+wheel and pinch zoom; Shift+wheel pans sideways", () => {
		expect(wheel({ deltaY: 100 }).kind).toBe("pan");
		expect(
			(wheel({ deltaY: 100, ctrlKey: true }) as { factor: number }).factor,
		).toBeLessThan(1);
		expect(
			(wheel({ deltaY: -3, ctrlKey: true }) as { factor: number }).factor,
		).toBeGreaterThan(1);
		expect((wheel({ deltaY: 40, shiftKey: true }) as { dx: number }).dx).toBe(
			-40,
		);
	});

	it("steps through zoom stops", () => {
		expect(nextZoomStep(0.5, 1)).toBe(0.75);
		expect(nextZoomStep(0.5, -1)).toBe(0.35);
	});

	it("fitBox centres the content", () => {
		const cam = fitBox(
			{ minX: 0, minY: 0, maxX: 1000, maxY: 800 },
			{ w: 800, h: 600 },
			{ padding: 50 },
		);
		const c = toScreen(cam, { x: 500, y: 400 });
		expect(c.x).toBeCloseTo(400, 6);
		expect(c.y).toBeCloseTo(300, 6);
	});

	it("grid minor step is a fifth of the major", () => {
		const s = gridSteps(0.5);
		expect(s.minor).toBe(s.major / 5);
	});
});

describe("smart guides", () => {
	const target = { minX: 100, maxX: 400, minY: 200, maxY: 300 };

	it("aligns a moving box to a nearby edge and reports the guide", () => {
		const r = snapBoxMove(
			{ minX: 103, maxX: 203, minY: 0, maxY: 50 },
			[target],
			6,
		);
		expect(r.snapX).toBe(true);
		expect(r.dx).toBeCloseTo(-3, 9);
		expect(r.snapY).toBe(false);
		expect(r.guides.some((g) => g.axis === "x" && g.pos === 100)).toBe(true);
	});

	it("does not snap beyond the threshold", () => {
		expect(
			snapBoxMove({ minX: 120, maxX: 220, minY: 0, maxY: 50 }, [target], 6)
				.snapX,
		).toBe(false);
	});

	it("measures the gap between two boxes", () => {
		const m = measureBetween(
			{ minX: 0, maxX: 100, minY: 0, maxY: 100 },
			{ minX: 160, maxX: 260, minY: 20, maxY: 80 },
		);
		expect(m).toHaveLength(1);
		expect(m[0].value).toBeCloseTo(60, 9);
	});
});

describe("fitBox with insets (floating panels cover part of the canvas)", () => {
	const box = { minX: 0, minY: 0, maxX: 400, maxY: 300 };
	const size = { w: 1200, h: 800 };

	it("without insets nothing changes", () => {
		const a = fitBox(box, size, { padding: 40 });
		const b = fitBox(box, size, {
			padding: 40,
			insets: { left: 0, right: 0, top: 0, bottom: 0 },
		});
		expect(b).toEqual(a);
	});

	it("centres the box in the visible area, not in the whole canvas", () => {
		const insets = { left: 300, right: 0, top: 0, bottom: 0 };
		const cam = fitBox(box, size, { padding: 40, insets });
		const centre = toScreen(cam, { x: 200, y: 150 });
		expect(centre.x).toBeCloseTo(300 + (1200 - 300) / 2, 6);
		expect(centre.y).toBeCloseTo(400, 6);
	});

	it("fits inside the visible area (smaller zoom when panels take space)", () => {
		const open = fitBox(box, size, { padding: 40, maxZoom: 10 });
		const narrow = fitBox(box, size, {
			padding: 40,
			maxZoom: 10,
			insets: { left: 400, right: 400, top: 0, bottom: 0 },
		});
		expect(narrow.zoom).toBeLessThan(open.zoom);
		const tl = toScreen(narrow, { x: 0, y: 0 });
		const br = toScreen(narrow, { x: 400, y: 300 });
		expect(tl.x).toBeGreaterThanOrEqual(400 + 40 - 0.001);
		expect(br.x).toBeLessThanOrEqual(1200 - 400 - 40 + 0.001);
	});

	it("top and bottom insets move the box vertically", () => {
		const cam = fitBox(box, size, {
			padding: 20,
			insets: { left: 0, right: 0, top: 100, bottom: 0 },
		});
		expect(toScreen(cam, { x: 200, y: 150 }).y).toBeCloseTo(
			100 + (800 - 100) / 2,
			6,
		);
	});
});
