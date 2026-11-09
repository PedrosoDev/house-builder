import { describe, expect, it } from "vitest";
import { createProject } from "./factory";
import { PlannerStore } from "./store";

describe("PlannerStore defaults", () => {
	it("opens in the 2D view", () => {
		const s = new PlannerStore(createProject());
		expect(s.getState().view).toBe("2d");
	});

	it("keeps the chosen view when another project is loaded", () => {
		const s = new PlannerStore(createProject());
		s.setView("3d");
		s.load(createProject());
		expect(s.getState().view).toBe("3d");
	});
});

describe("no rulers around the canvas", () => {
	it("the store has no ruler option (removed: they clashed with the floating panels)", () => {
		const s = new PlannerStore(createProject());
		expect("showRulers" in s.getState()).toBe(false);
	});
});
