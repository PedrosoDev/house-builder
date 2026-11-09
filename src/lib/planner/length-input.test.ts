import { describe, expect, it } from "vitest";
import { formatLengthInput, parseLength } from "./length-input";

describe("parseLength (metric)", () => {
	it.each([
		["4,5", 450],
		["4.5", 450],
		["450cm", 450],
		["4.5m", 450],
		["4.5 m", 450],
		["  50 cm ", 50],
		["0,25m", 25],
	])("%j -> %d cm", (text, cm) => {
		expect(parseLength(text, "metric")).toBeCloseTo(cm, 6);
	});

	it.each(["", "abc", "-3", "0", "4..5", "m", "1e3x"])("rejects %j", (text) => {
		expect(parseLength(text, "metric")).toBeNull();
	});
});

describe("parseLength (imperial)", () => {
	it.each([
		["12", 365.76],
		["12ft", 365.76],
		["12'6\"", 381],
		['6"', 15.24],
		["12' 6\"", 381],
	])("%j -> %d cm", (text, cm) => {
		expect(parseLength(text, "imperial")).toBeCloseTo(cm, 6);
	});
});

describe("formatLengthInput", () => {
	it("uses meters for 1 m and above, centimetres below", () => {
		expect(formatLengthInput(450, "metric")).toBe("4.50m");
		expect(formatLengthInput(50, "metric")).toBe("50cm");
	});

	it("round-trips through parseLength", () => {
		for (const cm of [50, 99, 100, 123, 450, 1234]) {
			expect(
				parseLength(formatLengthInput(cm, "metric"), "metric"),
			).toBeCloseTo(cm, 0);
		}
		for (const cm of [30.48, 381, 600]) {
			expect(
				parseLength(formatLengthInput(cm, "imperial"), "imperial") ?? 0,
			).toBeCloseTo(cm, -1);
		}
	});
});
