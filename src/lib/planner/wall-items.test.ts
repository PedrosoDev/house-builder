import { describe, expect, it } from "vitest";
import { createFloor, createItem, createWall } from "./factory";
import type { Item } from "./types";
import { ATTACH_TOLERANCE, itemsAttachedToWalls } from "./wall-items";

// horizontal wall y=100, thickness 20 -> faces at y=90 and y=110
const setup = () => {
	const f = createFloor("f");
	const wall = createWall({ x: 0, y: 100 }, { x: 500, y: 100 });
	wall.thickness = 20;
	f.walls.push(wall);
	return { f, wall };
};
const put = (
	f: ReturnType<typeof createFloor>,
	x: number,
	y: number,
	rot = 0,
): Item => {
	const it = createItem("armchair", x, y, rot);
	if (!it) throw new Error("catalog");
	f.items.push(it);
	return it;
};
// armchair footprint is def.size[0] x def.size[2]; use its depth to sit flush
const depth = (it: Item) => it.d;

describe("itemsAttachedToWalls (what rides along when a wall is moved)", () => {
	it("an item flush against the face is attached", () => {
		const { f, wall } = setup();
		const probe = put(f, 250, 0);
		const it = put(f, 250, 110 + depth(probe) / 2); // touching the lower face
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(true);
	});

	it("an item a few cm from the face (still 'close') is attached", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const it = put(f, 250, 110 + ATTACH_TOLERANCE - 1 + depth(probe) / 2);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(true);
	});

	it("works on the other face too", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const it = put(f, 250, 90 - depth(probe) / 2);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(true);
	});

	it("an item farther than the tolerance is NOT attached", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const it = put(f, 250, 110 + ATTACH_TOLERANCE + 5 + depth(probe) / 2);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(false);
	});

	it("an item beside the end of the wall (not along it) is NOT attached", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const it = put(f, 700, 110 + depth(probe) / 2);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(false);
	});

	it("only the given walls count", () => {
		const { f } = setup();
		const other = createWall({ x: 0, y: 300 }, { x: 500, y: 300 });
		other.thickness = 20;
		f.walls.push(other);
		const probe = put(f, 0, 0);
		const it = put(f, 250, 310 + depth(probe) / 2);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([f.walls[0].id])).size).toBe(0);
		expect(itemsAttachedToWalls(f, new Set([other.id])).has(it.id)).toBe(true);
	});

	it("rotated items use their real footprint", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		// rotated 90°: its half-extent perpendicular to the wall is w/2 instead of d/2
		const it = put(f, 250, 110 + probe.w / 2, 90);
		f.items = [it];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(it.id)).toBe(true);
	});
});

describe("groups ride together", () => {
	it("a grouped item far from the wall goes along when another member is attached (rack + TV)", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const rack = put(f, 250, 110 + depth(probe) / 2); // flush
		const tv = put(f, 250, 110 + 16 + 40 + depth(probe) / 2); // ~56 cm away
		rack.groupId = "g1";
		tv.groupId = "g1";
		f.items = [rack, tv];
		const ride = itemsAttachedToWalls(f, new Set([wall.id]));
		expect(ride.has(rack.id)).toBe(true);
		expect(ride.has(tv.id)).toBe(true);
	});

	it("a far item that is NOT in the group stays", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const rack = put(f, 250, 110 + depth(probe) / 2);
		const lamp = put(f, 250, 300);
		rack.groupId = "g1";
		f.items = [rack, lamp];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).has(lamp.id)).toBe(
			false,
		);
	});

	it("a group with no member near the moved walls stays put", () => {
		const { f, wall } = setup();
		const a = put(f, 250, 400);
		const b = put(f, 300, 420);
		a.groupId = "g2";
		b.groupId = "g2";
		f.items = [a, b];
		expect(itemsAttachedToWalls(f, new Set([wall.id])).size).toBe(0);
	});

	it("members of different groups do not drag each other", () => {
		const { f, wall } = setup();
		const probe = put(f, 0, 0);
		const a = put(f, 250, 110 + depth(probe) / 2);
		const b = put(f, 250, 300);
		a.groupId = "g1";
		b.groupId = "g2";
		f.items = [a, b];
		const ride = itemsAttachedToWalls(f, new Set([wall.id]));
		expect(ride.has(a.id)).toBe(true);
		expect(ride.has(b.id)).toBe(false);
	});
});
