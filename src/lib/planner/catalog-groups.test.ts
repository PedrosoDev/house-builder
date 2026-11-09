import { describe, expect, it } from "vitest";
import { CATEGORIES, searchCatalog } from "./catalog";
import {
	activeSectionIndex,
	type CatalogGroup,
	flattenGroups,
	groupCatalog,
	sectionsOf,
} from "./catalog-groups";

const all = () => flattenGroups(groupCatalog(""));
const ids = (g: CatalogGroup[]) => g.map((x) => x.id);

describe("groupCatalog (objects grouped by category, as a tree)", () => {
	it("every catalog item appears exactly once, in its own category", () => {
		const items = all().flatMap((g) =>
			g.items.map((i) => ({ item: i.id, group: g.id, cat: i.category })),
		);
		expect(items.length).toBe(searchCatalog("", null).length);
		expect(new Set(items.map((x) => x.item)).size).toBe(items.length);
		for (const x of items) expect(x.group).toBe(x.cat);
	});

	it("the count of a group is its own items plus everything below it", () => {
		const check = (g: CatalogGroup): number => {
			const total =
				g.items.length + g.children.reduce((s, c) => s + check(c), 0);
			expect(g.count).toBe(total);
			return total;
		};
		for (const r of groupCatalog("")) check(r);
	});

	it("roots come in catalog order and only groups with objects exist", () => {
		const roots = groupCatalog("");
		const order = CATEGORIES.filter((c) => c.parent === null).map((c) => c.id);
		expect(ids(roots)).toEqual(order.filter((id) => ids(roots).includes(id)));
		for (const g of all()) expect(g.count).toBeGreaterThan(0);
	});

	it("sub-groups hang under their category parent", () => {
		for (const g of all())
			for (const c of g.children) {
				expect(CATEGORIES.find((x) => x.id === c.id)?.parent).toBe(g.id);
			}
	});

	it("a search keeps only the matching objects and the groups on the way to them", () => {
		const r = groupCatalog("cama");
		const items = flattenGroups(r).flatMap((g) => g.items);
		expect(items.length).toBeGreaterThan(0);
		expect(
			items.every((i) => /cama/i.test(`${i.name} ${i.tags.join(" ")} ${i.id}`)),
		).toBe(true);
		expect(r.length).toBeLessThan(groupCatalog("").length + 1);
		for (const g of flattenGroups(r)) expect(g.count).toBeGreaterThan(0);
	});

	it("a search with no result gives no groups", () => {
		expect(groupCatalog("xyz-nao-existe")).toEqual([]);
	});

	it("is not affected by accents or case in the search", () => {
		expect(
			flattenGroups(groupCatalog("POLTRONA")).flatMap((g) => g.items).length,
		).toBeGreaterThan(0);
	});

	it("has no door/window group (those have their own drawers)", () => {
		const names = all().map((g) => g.id);
		expect(names).not.toContain("doors");
		expect(names).not.toContain("windows");
	});
});

describe("sectionsOf (the flat list of sections shown under the category carousel)", () => {
	const sections = () => sectionsOf(groupCatalog(""));

	it("has one section per category that has objects, each object in exactly one", () => {
		const s = sections();
		const items = s.flatMap((x) => x.items.map((i) => i.id));
		expect(items.length).toBe(searchCatalog("", null).length);
		expect(new Set(items).size).toBe(items.length);
		for (const x of s) expect(x.items.length).toBeGreaterThan(0);
	});

	it("keeps the catalog order (parents' objects before their sub-categories')", () => {
		const s = sections().map((x) => x.id);
		const order = flattenGroups(groupCatalog(""))
			.filter((g) => g.items.length > 0)
			.map((g) => g.id);
		expect(s).toEqual(order);
	});

	it("each section carries the names of its ancestors for the sticky title", () => {
		const assentos = sections().find((x) => x.id === "seating");
		expect(assentos?.name).toBe("Assentos");
		expect(assentos?.path).toEqual(["Interior", "Mobília"]);
		const colunas = sections().find((x) => x.id === "columns");
		expect(colunas?.path).toEqual(["Construção"]);
	});

	it("a search leaves only the sections with matches", () => {
		const s = sectionsOf(groupCatalog("cama"));
		expect(s.length).toBeGreaterThan(0);
		expect(s.length).toBeLessThan(sections().length);
		expect(s.every((x) => x.items.length > 0)).toBe(true);
	});

	it("no sections for an empty result", () => {
		expect(sectionsOf(groupCatalog("xyz-nao-existe"))).toEqual([]);
	});
});

describe("activeSectionIndex (scroll-spy: which section's title is at the top)", () => {
	const tops = [0, 300, 700, 1200];

	it("is the last section whose top has reached the scroll position", () => {
		expect(activeSectionIndex(tops, 0)).toBe(0);
		expect(activeSectionIndex(tops, 299)).toBe(1); // within the margin of the next title
		expect(activeSectionIndex(tops, 100)).toBe(0);
		expect(activeSectionIndex(tops, 300)).toBe(1);
		expect(activeSectionIndex(tops, 750)).toBe(2);
		expect(activeSectionIndex(tops, 5000)).toBe(3);
	});

	it("the margin makes a title count slightly before it touches the top", () => {
		expect(activeSectionIndex(tops, 290, 20)).toBe(1);
		expect(activeSectionIndex(tops, 270, 20)).toBe(0);
	});

	it("no sections: -1; before the first title: the first section", () => {
		expect(activeSectionIndex([], 100)).toBe(-1);
		expect(activeSectionIndex([50, 400], 0)).toBe(0);
	});
});
