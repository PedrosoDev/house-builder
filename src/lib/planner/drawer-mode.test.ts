import { describe, expect, it } from "vitest";
import { OPENING_PRESETS } from "./catalog";
import { drawerMode, drawerTitle, openingPresetsFor } from "./drawer-mode";
import type { ToolId } from "./types";

describe("drawerMode: the left drawer replaces the left panel only while a mode with many options is active", () => {
	it("the door, window and object tools open it, each with its own content", () => {
		expect(drawerMode("door", false)).toBe("doors");
		expect(drawerMode("window", false)).toBe("windows");
		expect(drawerMode("item", false)).toBe("objects");
	});

	it("the Objetos button opens the object catalog whatever the tool is", () => {
		expect(drawerMode("select", true)).toBe("objects");
		expect(drawerMode("door", true)).toBe("objects");
	});

	it("every other tool leaves the normal panel (name, floors, layers)", () => {
		const others: ToolId[] = [
			"select",
			"pan",
			"wall",
			"partition",
			"room",
			"roomRect",
			"stair",
			"ruler",
			"eraser",
		];
		for (const t of others) expect(drawerMode(t, false)).toBeNull();
	});

	it("has a Portuguese title for each mode", () => {
		expect(drawerTitle("objects")).toBe("Objetos");
		expect(drawerTitle("doors")).toBe("Portas");
		expect(drawerTitle("windows")).toBe("Janelas");
	});
});

describe("openingPresetsFor", () => {
	it("doors mode lists only door presets, windows mode only window presets", () => {
		const doors = openingPresetsFor("doors", "");
		const windows = openingPresetsFor("windows", "");
		expect(doors.length).toBeGreaterThan(0);
		expect(windows.length).toBeGreaterThan(0);
		expect(doors.every((p) => p.category === "doors")).toBe(true);
		expect(windows.every((p) => p.category === "windows")).toBe(true);
	});

	it("objects mode lists them all", () => {
		expect(openingPresetsFor("objects", "")).toHaveLength(
			OPENING_PRESETS.length,
		);
	});

	it("filters by name, ignoring case and accents", () => {
		const r = openingPresetsFor("objects", "CORRER");
		expect(r.length).toBeGreaterThan(0);
		expect(r.every((p) => /correr/i.test(p.name))).toBe(true);
		expect(openingPresetsFor("objects", "porta").length).toBeGreaterThan(0);
		expect(openingPresetsFor("objects", "xyz-inexistente")).toEqual([]);
	});
});
