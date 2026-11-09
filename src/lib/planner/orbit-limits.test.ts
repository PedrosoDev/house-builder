import { describe, expect, it } from "vitest";
import { orbitLimits } from "./orbit-limits";

describe("orbitLimits (how far the 3D wheel may zoom)", () => {
	it("never lets the camera get closer than ~1 m (it used to dive into the model)", () => {
		expect(orbitLimits(5).min).toBeGreaterThanOrEqual(0.8);
		expect(orbitLimits(5).min).toBeLessThanOrEqual(1.5);
	});

	it("the far limit grows with the size of the house", () => {
		expect(orbitLimits(30).max).toBeGreaterThan(orbitLimits(5).max);
	});

	it("always leaves a usable range, even for a tiny or empty plan", () => {
		for (const s of [0, 1, 3, 50, 500]) {
			const r = orbitLimits(s);
			expect(r.max).toBeGreaterThan(r.min * 5);
		}
	});

	it("a normal house can still be seen whole", () => {
		// the default framing puts the camera ~1.5x the house size away
		expect(orbitLimits(10).max).toBeGreaterThan(10 * 3);
	});

	it("stays inside the fog / far plane of the scene (far plane is 400 m)", () => {
		expect(orbitLimits(500).max).toBeLessThan(300);
	});
});
