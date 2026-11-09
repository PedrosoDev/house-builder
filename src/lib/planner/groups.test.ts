import { describe, expect, it } from "vitest";
import { createProject } from "./factory";
import { buildLayerTree } from "./layer-tree";
import { PlannerStore } from "./store";

const three = () => {
	const s = new PlannerStore(createProject());
	const a = s.addItem("armchair", 0, 0) ?? "";
	const b = s.addItem("armchair", 100, 0) ?? "";
	const c = s.addItem("armchair", 200, 0) ?? "";
	return { s, a, b, c };
};
const sel = (...ids: string[]) =>
	ids.map((id) => ({ kind: "item" as const, id }));
const groupId = (s: PlannerStore, id: string) =>
	s.floor.items.find((i) => i.id === id)?.groupId;

describe("group commands used by the layers tree", () => {
	it("renameGroup stores a display name that the tree shows", () => {
		const { s, a, b } = three();
		s.select(sel(a, b));
		s.groupSelection();
		const gid = groupId(s, a) ?? "";
		s.renameGroup(gid, "Sala de TV");
		expect(s.floor.groupNames?.[gid]).toBe("Sala de TV");
		const items = buildLayerTree(s.floor).find((n) => n.id === "section:items");
		expect(items?.children?.some((n) => n.label === "Sala de TV")).toBe(true);
	});

	it("an empty name clears it (back to 'Grupo N')", () => {
		const { s, a, b } = three();
		s.select(sel(a, b));
		s.groupSelection();
		const gid = groupId(s, a) ?? "";
		s.renameGroup(gid, "X");
		s.renameGroup(gid, "  ");
		expect(s.floor.groupNames?.[gid]).toBeUndefined();
	});

	it("removeFromGroup takes only the chosen items out; the rest stay grouped", () => {
		const { s, a, b, c } = three();
		s.select(sel(a, b, c));
		s.groupSelection();
		s.removeFromGroup([c]);
		expect(groupId(s, c)).toBeNull();
		expect(groupId(s, a)).toBeTruthy();
		expect(groupId(s, a)).toBe(groupId(s, b));
	});

	it("a group left with one member is dissolved", () => {
		const { s, a, b } = three();
		s.select(sel(a, b));
		s.groupSelection();
		s.removeFromGroup([b]);
		expect(groupId(s, a)).toBeNull();
	});

	it("addToGroup puts items into an existing group", () => {
		const { s, a, b, c } = three();
		s.select(sel(a, b));
		s.groupSelection();
		const gid = groupId(s, a) ?? "";
		s.addToGroup([c], gid);
		expect(groupId(s, c)).toBe(gid);
	});

	it("deleting every member drops the group name", () => {
		const { s, a, b } = three();
		s.select(sel(a, b));
		s.groupSelection();
		const gid = groupId(s, a) ?? "";
		s.renameGroup(gid, "Temp");
		s.select(sel(a, b));
		s.deleteSelection();
		expect(s.floor.groupNames?.[gid]).toBeUndefined();
	});
});
