import { describe, expect, it } from "vitest";
import type { ViewMode } from "./types";
import { DEFAULT_VIEW3D, viewLayout } from "./view-layout";

describe("viewLayout (where the 2D and the 3D sections sit, in %, so switching can slide/fade)", () => {
	it("2D: the plan fills the screen and the 3D is not shown", () => {
		const l = viewLayout("2d");
		expect(l.plan).toEqual({ left: 0, width: 100, show: true });
		expect(l.three.show).toBe(false);
	});

	it("3D: the 3D fills the screen and the plan is not shown", () => {
		const l = viewLayout("3d");
		expect(l.three).toEqual({ left: 0, width: 100, show: true });
		expect(l.plan.show).toBe(false);
	});

	it("2D + 3D: two halves, side by side, both shown", () => {
		const l = viewLayout("split");
		expect(l.plan).toEqual({ left: 0, width: 50, show: true });
		expect(l.three).toEqual({ left: 50, width: 50, show: true });
	});

	it("a hidden section keeps the half it has in the split view, so it enters/leaves from there", () => {
		expect(viewLayout("2d").three).toMatchObject({ left: 50, width: 50 });
		expect(viewLayout("3d").plan).toMatchObject({ left: 0, width: 50 });
	});

	it("at least one section is always shown and never outside the screen", () => {
		for (const v of ["2d", "split", "3d"] as ViewMode[]) {
			const l = viewLayout(v);
			expect(l.plan.show || l.three.show).toBe(true);
			for (const s of [l.plan, l.three]) {
				expect(s.left).toBeGreaterThanOrEqual(0);
				expect(s.left + s.width).toBeLessThanOrEqual(100);
			}
		}
	});
});

describe("DEFAULT_VIEW3D (how the 3D view opens)", () => {
	it("hides the ceiling and the roof by default, so the rooms can be seen", () => {
		expect(DEFAULT_VIEW3D.cutaway).toBe(true);
	});

	it("keeps the orbit camera and the automatic wall cut-away", () => {
		expect(DEFAULT_VIEW3D.camera).toBe("orbit");
		expect(DEFAULT_VIEW3D.wallMode).toBe("cut");
	});
});
