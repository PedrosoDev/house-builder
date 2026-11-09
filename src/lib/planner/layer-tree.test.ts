import { describe, expect, it } from "vitest";
import {
	createFloor,
	createItem,
	createOpening,
	createRoom,
	createWall,
} from "./factory";
import {
	buildLayerTree,
	type LayerNode,
	nodeRefs,
	selectionState,
} from "./layer-tree";
import { reorderLayers } from "./layers";
import type { Floor, Item } from "./types";

const add = (
	f: Floor,
	catalogId: string,
	label: string,
	group: string | null = null,
): Item => {
	const it = createItem(catalogId, 0, 0);
	if (!it) throw new Error("catalog");
	it.label = label;
	it.groupId = group;
	f.items.push(it);
	return it;
};
const section = (tree: LayerNode[], name: string) =>
	tree.find((n) => n.id === `section:${name}`);
const labels = (n?: LayerNode) => (n?.children ?? []).map((c) => c.label);

describe("buildLayerTree", () => {
	it("an empty floor has no sections", () => {
		expect(buildLayerTree(createFloor("f"))).toEqual([]);
	});

	it("only non-empty sections appear", () => {
		const f = createFloor("f");
		add(f, "armchair", "Poltrona");
		const tree = buildLayerTree(f);
		expect(tree.map((n) => n.id)).toEqual(["section:items"]);
	});

	it("items are listed top-most first, like layers in Figma", () => {
		const f = createFloor("f");
		add(f, "armchair", "A");
		add(f, "armchair", "B");
		add(f, "armchair", "C");
		expect(labels(section(buildLayerTree(f), "items"))).toEqual([
			"C",
			"B",
			"A",
		]);
	});

	it("follows the stacking order: a rug (flat) is at the bottom of the list", () => {
		const f = createFloor("f");
		add(f, "rug", "Tapete");
		add(f, "armchair", "Poltrona");
		expect(labels(section(buildLayerTree(f), "items"))).toEqual([
			"Poltrona",
			"Tapete",
		]);
	});

	it("reordering layers changes the tree", () => {
		const f = createFloor("f");
		const a = add(f, "armchair", "A");
		add(f, "armchair", "B");
		reorderLayers(f.items, [a.id], "front");
		expect(labels(section(buildLayerTree(f), "items"))).toEqual(["A", "B"]);
	});

	it("items sharing a groupId become one group node with the members inside", () => {
		const f = createFloor("f");
		add(f, "armchair", "Rack", "g1");
		add(f, "armchair", "Solto");
		add(f, "armchair", "TV", "g1");
		const items = section(buildLayerTree(f), "items");
		expect(labels(items)).toEqual(["Grupo 1", "Solto"]);
		const g = items?.children?.[0];
		expect(g?.kind).toBe("group");
		expect(g?.id).toBe("group:g1");
		expect(labels(g)).toEqual(["TV", "Rack"]);
	});

	it("the group sits where its top-most member is", () => {
		const f = createFloor("f");
		add(f, "armchair", "A", "g1");
		add(f, "armchair", "Solto");
		add(f, "armchair", "B", "g1");
		expect(labels(section(buildLayerTree(f), "items"))).toEqual([
			"Grupo 1",
			"Solto",
		]);
		const f2 = createFloor("f2");
		add(f2, "armchair", "A", "g1");
		add(f2, "armchair", "B", "g1");
		add(f2, "armchair", "Solto");
		expect(labels(section(buildLayerTree(f2), "items"))).toEqual([
			"Solto",
			"Grupo 1",
		]);
	});

	it("a group with a single member is shown as a plain item", () => {
		const f = createFloor("f");
		add(f, "armchair", "Sozinho", "g9");
		const n = section(buildLayerTree(f), "items")?.children?.[0];
		expect(n?.kind).toBe("item");
	});

	it("uses the group name when there is one", () => {
		const f = createFloor("f");
		add(f, "armchair", "A", "g1");
		add(f, "armchair", "B", "g1");
		f.groupNames = { g1: "Sala de TV" };
		expect(labels(section(buildLayerTree(f), "items"))).toEqual(["Sala de TV"]);
	});

	it("walls, openings, rooms are in their own sections with refs", () => {
		const f = createFloor("f");
		const w = createWall({ x: 0, y: 0 }, { x: 340, y: 0 });
		f.walls.push(w);
		f.openings.push(createOpening(w, "door", 0.5));
		const tree = buildLayerTree(f);
		expect(tree.map((n) => n.id)).toEqual([
			"section:openings",
			"section:walls",
		]);
		expect(section(tree, "walls")?.children?.[0].ref).toEqual({
			kind: "wall",
			id: w.id,
		});
		expect(section(tree, "walls")?.children?.[0].label).toBe("Parede 3,40 m");
		expect(section(tree, "openings")?.children?.[0].label).toBe("Porta");
	});

	it("items carry their locked flag", () => {
		const f = createFloor("f");
		const a = add(f, "armchair", "A");
		a.locked = true;
		expect(section(buildLayerTree(f), "items")?.children?.[0].locked).toBe(
			true,
		);
	});
});

describe("nodeRefs / selectionState", () => {
	const mk = () => {
		const f = createFloor("f");
		const a = add(f, "armchair", "A", "g1");
		const b = add(f, "armchair", "B", "g1");
		const c = add(f, "armchair", "C");
		const items = section(buildLayerTree(f), "items") as LayerNode;
		const group = items?.children?.find((n) => n.kind === "group") as LayerNode;
		return { a, b, c, items, group };
	};
	const ref = (i: Item) => ({ kind: "item" as const, id: i.id });

	it("a group's refs are all its members; a section's refs are everything below", () => {
		const { a, b, c, items, group } = mk();
		expect(
			nodeRefs(group)
				.map((r) => r.id)
				.sort(),
		).toEqual([a.id, b.id].sort());
		expect(
			nodeRefs(items)
				.map((r) => r.id)
				.sort(),
		).toEqual([a.id, b.id, c.id].sort());
	});

	it("selection state: none / partial / all", () => {
		const { a, b, c, group } = mk();
		expect(selectionState(group, [])).toBe("none");
		expect(selectionState(group, [ref(a)])).toBe("partial");
		expect(selectionState(group, [ref(a), ref(b)])).toBe("all");
		expect(selectionState(group, [ref(c)])).toBe("none");
	});
});

describe("rooms contain their objects, doors and windows", () => {
	const sq = (x: number, y: number, s: number) => [
		{ x, y },
		{ x: x + s, y },
		{ x: x + s, y: y + s },
		{ x, y: y + s },
	];
	const place = (it: Item, x: number, y: number) => {
		it.x = x;
		it.y = y;
	};
	const room = (f: Floor, name: string, pts: { x: number; y: number }[]) => {
		const r = createRoom(pts, "other", name);
		f.rooms.push(r);
		return r;
	};
	const byLabel = (n: LayerNode | undefined) =>
		(n?.children ?? []).filter((c) => c.kind !== "section").map((c) => c.label);

	it("items inside a room are listed under it, the others stay in the unassigned section", () => {
		const f = createFloor("f");
		const r = room(f, "Sala", sq(0, 0, 400));
		const a = add(f, "armchair", "Dentro");
		const b = add(f, "armchair", "Fora");
		place(a, 100, 100);
		place(b, 900, 900);
		const tree = buildLayerTree(f);
		expect(tree[0].id).toBe(`room:${r.id}`);
		expect(byLabel(tree[0])).toEqual(["Dentro"]);
		expect(labels(section(tree, "items"))).toEqual(["Fora"]);
		expect(section(tree, "items")?.label).toBe("Fora dos cômodos");
	});

	it("a room node selects only the room, not everything inside", () => {
		const f = createFloor("f");
		const r = room(f, "Sala", sq(0, 0, 400));
		const a = add(f, "armchair", "Dentro");
		place(a, 100, 100);
		const node = buildLayerTree(f)[0];
		expect(nodeRefs(node)).toEqual([{ kind: "room", id: r.id }]);
	});

	it("nested rooms: the object goes to the smallest room that contains it", () => {
		const f = createFloor("f");
		room(f, "Quarto", sq(0, 0, 500));
		const bath = room(f, "Banheiro", sq(0, 0, 150));
		const a = add(f, "armchair", "Vaso");
		const b = add(f, "armchair", "Cama");
		place(a, 50, 50);
		place(b, 300, 300);
		const tree = buildLayerTree(f);
		const bathNode = tree.find((n) => n.id === `room:${bath.id}`);
		const quarto = tree.find((n) => n.label === "Quarto");
		expect(byLabel(bathNode)).toEqual(["Vaso"]);
		expect(byLabel(quarto)).toEqual(["Cama"]);
	});

	it("a group goes into the room of its top-most member, with all its members", () => {
		const f = createFloor("f");
		const r = room(f, "Sala", sq(0, 0, 400));
		const a = add(f, "armchair", "Rack", "g1");
		const b = add(f, "armchair", "TV", "g1");
		place(a, 100, 100);
		place(b, 120, 100);
		const node = buildLayerTree(f).find((n) => n.id === `room:${r.id}`);
		expect(byLabel(node)).toEqual(["Grupo 1"]);
		expect(labels(node?.children?.[0])).toEqual(["TV", "Rack"]);
	});

	it("doors and windows on the walls of a room are listed in that room", () => {
		const f = createFloor("f");
		const r = room(f, "Sala", sq(0, 0, 400));
		const wall = createWall({ x: 0, y: 0 }, { x: 400, y: 0 }); // top wall of the room
		const far = createWall({ x: 1000, y: 0 }, { x: 1400, y: 0 }); // belongs to nothing
		f.walls.push(wall, far);
		f.openings.push(
			createOpening(wall, "door", 0.5),
			createOpening(far, "window", 0.5),
		);
		const tree = buildLayerTree(f);
		const node = tree.find((n) => n.id === `room:${r.id}`);
		expect(byLabel(node)).toEqual(["Porta"]);
		expect(labels(section(tree, "openings"))).toEqual(["Janela"]);
	});

	it("stays out of the way when there are no rooms (old layout)", () => {
		const f = createFloor("f");
		add(f, "armchair", "A");
		const tree = buildLayerTree(f);
		expect(tree.map((n) => n.id)).toEqual(["section:items"]);
		expect(tree[0].label).toBe("Objetos");
	});

	it("rooms are no longer a flat section", () => {
		const f = createFloor("f");
		room(f, "Sala", sq(0, 0, 400));
		expect(buildLayerTree(f).some((n) => n.id === "section:rooms")).toBe(false);
	});
});

describe("walls inside rooms (shared walls appear in every room they belong to)", () => {
	const rect = (x0: number, y0: number, x1: number, y1: number) => [
		{ x: x0, y: y0 },
		{ x: x1, y: y0 },
		{ x: x1, y: y1 },
		{ x: x0, y: y1 },
	];
	const wall = (ax: number, ay: number, bx: number, by: number) => {
		const w = createWall({ x: ax, y: ay }, { x: bx, y: by });
		w.thickness = 20;
		return w;
	};
	const wallsOf = (tree: LayerNode[], roomId: string) =>
		tree
			.find((n) => n.id === `room:${roomId}`)
			?.children?.find((c) => c.id === `room:${roomId}/walls`);

	it("a wall along the room outline is in that room's 'Paredes' sub-folder, closed by default", () => {
		const f = createFloor("f");
		const r = createRoom(rect(10, 10, 390, 390), "other", "Sala");
		f.rooms.push(r);
		const top = wall(0, 0, 400, 0); // centre line 10 cm from the room edge (half thickness)
		f.walls.push(top);
		const folder = wallsOf(buildLayerTree(f), r.id);
		expect(folder?.kind).toBe("section");
		expect(folder?.collapsed).toBe(true);
		expect(folder?.children?.map((c) => c.ref?.id)).toEqual([top.id]);
		expect(folder?.children?.[0].id).toBe(`room:${r.id}/wall:${top.id}`);
	});

	it("a wall between two adjacent rooms appears in both, flagged as shared", () => {
		const f = createFloor("f");
		const a = createRoom(rect(10, 10, 190, 390), "other", "A");
		const b = createRoom(rect(210, 10, 390, 390), "other", "B");
		f.rooms.push(a, b);
		const mid = wall(200, 0, 200, 400);
		f.walls.push(mid);
		const tree = buildLayerTree(f);
		const inA = wallsOf(tree, a.id)?.children?.[0];
		const inB = wallsOf(tree, b.id)?.children?.[0];
		expect(inA?.ref?.id).toBe(mid.id);
		expect(inB?.ref?.id).toBe(mid.id);
		expect(inA?.shared).toBe(true);
		expect(inB?.shared).toBe(true);
		expect(inA?.id).not.toBe(inB?.id);
	});

	it("a wall used by one room only is not flagged as shared", () => {
		const f = createFloor("f");
		const r = createRoom(rect(10, 10, 390, 390), "other", "Sala");
		f.rooms.push(r);
		f.walls.push(wall(0, 0, 400, 0));
		expect(wallsOf(buildLayerTree(f), r.id)?.children?.[0].shared).toBeFalsy();
	});

	it("nested rooms: the inner room's walls are in the inner AND in the outer room", () => {
		const f = createFloor("f");
		const outer = createRoom(rect(10, 10, 490, 490), "other", "Quarto");
		const inner = createRoom(rect(10, 10, 160, 140), "other", "Banheiro");
		f.rooms.push(outer, inner);
		const bottom = wall(0, 150, 170, 150); // bathroom's lower wall, inside the bedroom
		f.walls.push(bottom);
		const tree = buildLayerTree(f);
		expect(wallsOf(tree, inner.id)?.children?.[0].ref?.id).toBe(bottom.id);
		expect(wallsOf(tree, outer.id)?.children?.[0].ref?.id).toBe(bottom.id);
	});

	it("a wall far from every room is listed in the loose-walls section", () => {
		const f = createFloor("f");
		const r = createRoom(rect(10, 10, 390, 390), "other", "Sala");
		f.rooms.push(r);
		const far = wall(1000, 0, 1400, 0);
		f.walls.push(far);
		const tree = buildLayerTree(f);
		expect(wallsOf(tree, r.id)).toBeUndefined();
		const loose = section(tree, "walls");
		expect(loose?.label).toBe("Paredes soltas");
		expect(loose?.children?.[0].ref?.id).toBe(far.id);
	});

	it("a perpendicular wall that only touches the room edge is not part of it", () => {
		const f = createFloor("f");
		const r = createRoom(rect(10, 10, 390, 390), "other", "Sala");
		f.rooms.push(r);
		f.walls.push(wall(200, -400, 200, 0)); // ends on the top edge, runs away from the room
		expect(wallsOf(buildLayerTree(f), r.id)).toBeUndefined();
	});

	it("without rooms the walls keep the plain 'Paredes' section", () => {
		const f = createFloor("f");
		f.walls.push(wall(0, 0, 400, 0));
		expect(section(buildLayerTree(f), "walls")?.label).toBe("Paredes");
	});

	it("both entries of a shared wall are highlighted when it is selected", () => {
		const f = createFloor("f");
		const a = createRoom(rect(10, 10, 190, 390), "other", "A");
		const b = createRoom(rect(210, 10, 390, 390), "other", "B");
		f.rooms.push(a, b);
		const mid = wall(200, 0, 200, 400);
		f.walls.push(mid);
		const tree = buildLayerTree(f);
		const sel = [{ kind: "wall" as const, id: mid.id }];
		const inA = wallsOf(tree, a.id)?.children?.[0] as LayerNode;
		const inB = wallsOf(tree, b.id)?.children?.[0] as LayerNode;
		expect(selectionState(inA, sel)).toBe("all");
		expect(selectionState(inB, sel)).toBe("all");
	});
});

describe("the walls folder comes first inside a room", () => {
	it("'Paredes' is the first child, before the objects and openings", () => {
		const f = createFloor("f");
		const pts = [
			{ x: 10, y: 10 },
			{ x: 390, y: 10 },
			{ x: 390, y: 390 },
			{ x: 10, y: 390 },
		];
		const r = createRoom(pts, "other", "Sala");
		f.rooms.push(r);
		const w = createWall({ x: 0, y: 0 }, { x: 400, y: 0 });
		w.thickness = 20;
		f.walls.push(w);
		f.openings.push(createOpening(w, "door", 0.5));
		const it = add(f, "armchair", "Poltrona");
		it.x = 100;
		it.y = 100;
		const node = buildLayerTree(f).find((n) => n.id === `room:${r.id}`);
		expect(node?.children?.map((c) => c.label)).toEqual([
			"Paredes",
			"Poltrona",
			"Porta",
		]);
	});
});
