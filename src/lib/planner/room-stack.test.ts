import { describe, expect, it } from "vitest";
import { createRoom } from "./factory";
import { roomStackRanks } from "./room-stack";

const sq = (x: number, y: number, s: number) => [
	{ x, y },
	{ x: x + s, y },
	{ x: x + s, y: y + s },
	{ x, y: y + s },
];

describe("roomStackRanks (nested rooms must not z-fight in 3D)", () => {
	it("the bigger room is the bottom layer, a smaller one on top of it", () => {
		const big = createRoom(sq(0, 0, 500), "other", "Quarto");
		const small = createRoom(sq(0, 0, 150), "other", "Banheiro");
		const r = roomStackRanks([small, big]);
		expect(r.get(big.id)).toBe(0);
		expect(r.get(small.id)).toBe(1);
	});

	it("every room gets a distinct rank", () => {
		const a = createRoom(sq(0, 0, 500));
		const b = createRoom(sq(0, 0, 300));
		const c = createRoom(sq(0, 0, 100));
		const ranks = [...roomStackRanks([c, a, b]).values()].sort();
		expect(ranks).toEqual([0, 1, 2]);
	});

	it("equal areas keep the original order (stable)", () => {
		const a = createRoom(sq(0, 0, 200));
		const b = createRoom(sq(500, 0, 200));
		const r = roomStackRanks([a, b]);
		expect(r.get(a.id)).toBe(0);
		expect(r.get(b.id)).toBe(1);
	});

	it("no rooms, no ranks", () => {
		expect(roomStackRanks([]).size).toBe(0);
	});
});
