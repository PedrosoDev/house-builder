import { describe, expect, it } from "vitest";
import { createItem, createProject } from "./factory";
import { isFlat, type LayerOp, renderOrder, reorderLayers } from "./layers";
import { PlannerStore } from "./store";
import type { Item } from "./types";

const mk = (catalogId: string, label: string): Item => {
	const it = createItem(catalogId, 0, 0);
	if (!it) throw new Error(`unknown catalog id ${catalogId}`);
	it.label = label;
	return it;
};
const names = (items: Item[]) => renderOrder(items).map((i) => i.label);

describe("default stacking: things lying on the floor go below furniture", () => {
	it("a rug is flat, a bed is not", () => {
		expect(isFlat(mk("rug", "r"))).toBe(true);
		expect(isFlat(mk("armchair", "s"))).toBe(false);
	});

	it("a rug added AFTER the furniture still renders underneath it", () => {
		const items = [mk("armchair", "armchair"), mk("rug", "rug")];
		expect(names(items)).toEqual(["rug", "armchair"]);
	});

	it("keeps the creation order inside each tier", () => {
		const items = [
			mk("armchair", "a"),
			mk("rug", "r1"),
			mk("armchair", "b"),
			mk("rug", "r2"),
		];
		expect(names(items)).toEqual(["r1", "r2", "a", "b"]);
	});

	it("does not mutate the input array", () => {
		const items = [mk("armchair", "armchair"), mk("rug", "rug")];
		renderOrder(items);
		expect(items.map((i) => i.label)).toEqual(["armchair", "rug"]);
	});
});

describe("reorderLayers", () => {
	const base = () => [
		mk("armchair", "A"),
		mk("armchair", "B"),
		mk("armchair", "C"),
		mk("armchair", "D"),
	];
	const run = (labels: string[], op: LayerOp, pick: string[]) => {
		const items = base().filter((i) => labels.includes(i.label));
		const ids = items.filter((i) => pick.includes(i.label)).map((i) => i.id);
		reorderLayers(items, ids, op);
		return names(items);
	};

	it("forward moves one step up", () => {
		expect(run(["A", "B", "C", "D"], "forward", ["B"])).toEqual([
			"A",
			"C",
			"B",
			"D",
		]);
	});
	it("backward moves one step down", () => {
		expect(run(["A", "B", "C", "D"], "backward", ["C"])).toEqual([
			"A",
			"C",
			"B",
			"D",
		]);
	});
	it("front / back go to the extremes", () => {
		expect(run(["A", "B", "C", "D"], "front", ["B"])).toEqual([
			"A",
			"C",
			"D",
			"B",
		]);
		expect(run(["A", "B", "C", "D"], "back", ["C"])).toEqual([
			"C",
			"A",
			"B",
			"D",
		]);
	});
	it("already at the limit: nothing changes", () => {
		expect(run(["A", "B", "C", "D"], "forward", ["D"])).toEqual([
			"A",
			"B",
			"C",
			"D",
		]);
		expect(run(["A", "B", "C", "D"], "backward", ["A"])).toEqual([
			"A",
			"B",
			"C",
			"D",
		]);
	});
	it("a multi-selection moves as a block and keeps its relative order", () => {
		expect(run(["A", "B", "C", "D"], "front", ["A", "C"])).toEqual([
			"B",
			"D",
			"A",
			"C",
		]);
		expect(run(["A", "B", "C", "D"], "forward", ["A", "B"])).toEqual([
			"C",
			"A",
			"B",
			"D",
		]);
	});
	it("a rug can be deliberately raised above furniture", () => {
		const items = [mk("rug", "rug"), mk("armchair", "armchair")];
		reorderLayers(items, [items[0].id], "front");
		expect(names(items)).toEqual(["armchair", "rug"]);
	});
	it("rugs can be reordered among themselves", () => {
		const items = [mk("rug", "r1"), mk("rug", "r2")];
		reorderLayers(items, [items[1].id], "back");
		expect(names(items)).toEqual(["r2", "r1"]);
	});
});

describe("store layer commands", () => {
	it("reorders the selected item, in 1 undo step", () => {
		const s = new PlannerStore(createProject());
		const a = s.addItem("armchair", 0, 0);
		const b = s.addItem("armchair", 50, 0);
		s.select([{ kind: "item", id: a ?? "" }]);
		s.reorderSelection("front");
		const order = renderOrder(s.floor.items).map((i) => i.id);
		expect(order).toEqual([b, a]);
		s.undo();
		expect(renderOrder(s.floor.items).map((i) => i.id)).toEqual([a, b]);
	});
});
