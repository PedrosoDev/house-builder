import { describe, expect, it } from "vitest";
import {
	DOCK,
	dockActiveKey,
	entryActive,
	entryTool,
	OBJECTS_KEY,
} from "./dock-tools";
import type { ToolId } from "./types";

const entry = (id: string) => {
	const e = DOCK.find((x) => x.id === id);
	if (!e) throw new Error(`no dock entry ${id}`);
	return e;
};

describe("dock tools", () => {
	it("every tool of the editor is reachable from the dock, once", () => {
		const all: ToolId[] = DOCK.flatMap((e) => e.tools.map((t) => t.id));
		const expected: ToolId[] = [
			"select",
			"pan",
			"wall",
			"partition",
			"room",
			"roomRect",
			"door",
			"window",
			"stair",
			"ruler",
			"eraser",
		];
		expect([...all].sort()).toEqual([...expected].sort());
		expect(new Set(all).size).toBe(all.length);
	});

	it("walls and rooms are groups with variants; the rest are single tools", () => {
		expect(entry("wall").tools.map((t) => t.id)).toEqual(["wall", "partition"]);
		expect(entry("room").tools.map((t) => t.id)).toEqual(["roomRect", "room"]);
		for (const id of [
			"select",
			"pan",
			"door",
			"window",
			"stair",
			"ruler",
			"eraser",
		])
			expect(entry(id).tools).toHaveLength(1);
	});

	it("a group is active when any of its tools is the current tool", () => {
		expect(entryActive(entry("wall"), "partition")).toBe(true);
		expect(entryActive(entry("wall"), "wall")).toBe(true);
		expect(entryActive(entry("wall"), "door")).toBe(false);
		expect(entryActive(entry("select"), "select")).toBe(true);
	});

	it("clicking a group uses the last variant picked, else the first", () => {
		expect(entryTool(entry("wall"), {})).toBe("wall");
		expect(entryTool(entry("wall"), { wall: "partition" })).toBe("partition");
		expect(entryTool(entry("room"), {})).toBe("roomRect");
		expect(entryTool(entry("room"), { room: "room" })).toBe("room");
	});

	it("a remembered variant that is not in the group is ignored", () => {
		expect(entryTool(entry("wall"), { wall: "door" })).toBe("wall");
	});

	it("every tool has a Portuguese label", () => {
		for (const e of DOCK) {
			expect(e.label.length).toBeGreaterThan(2);
			for (const t of e.tools) expect(t.label.length).toBeGreaterThan(2);
		}
	});
});

describe("dockActiveKey (which dock tab is the selected one)", () => {
	it("is the entry that owns the current tool, group variants included", () => {
		expect(dockActiveKey("select", false)).toBe("select");
		expect(dockActiveKey("pan", false)).toBe("pan");
		expect(dockActiveKey("wall", false)).toBe("wall");
		expect(dockActiveKey("partition", false)).toBe("wall");
		expect(dockActiveKey("roomRect", false)).toBe("room");
		expect(dockActiveKey("room", false)).toBe("room");
		expect(dockActiveKey("door", false)).toBe("door");
		expect(dockActiveKey("window", false)).toBe("window");
		expect(dockActiveKey("stair", false)).toBe("stair");
		expect(dockActiveKey("ruler", false)).toBe("ruler");
		expect(dockActiveKey("eraser", false)).toBe("eraser");
	});

	it("the Objetos tab is selected while the object drawer is open or an object is being placed", () => {
		expect(dockActiveKey("select", true)).toBe(OBJECTS_KEY);
		expect(dockActiveKey("door", true)).toBe(OBJECTS_KEY);
		expect(dockActiveKey("item", false)).toBe(OBJECTS_KEY);
	});

	it("always gives exactly one active tab, and it exists in the dock", () => {
		const tools: ToolId[] = [
			"select",
			"pan",
			"wall",
			"partition",
			"room",
			"roomRect",
			"door",
			"window",
			"stair",
			"ruler",
			"eraser",
			"item",
		];
		const keys = new Set([...DOCK.map((e) => e.id), OBJECTS_KEY]);
		for (const t of tools)
			for (const o of [false, true])
				expect(keys.has(dockActiveKey(t, o))).toBe(true);
	});
});
