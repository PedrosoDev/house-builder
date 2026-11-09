import { describe, expect, it } from "vitest";
import { createFloor, createOpening, createWall } from "./factory";
import {
	arcFloorHit,
	canTeleport,
	moveWithCollision,
	PLAYER_RADIUS,
	snapTurn,
	spawnPoint,
} from "./vr-locomotion";

// Uma parede horizontal em y = 0, de x = 0 a x = 400 (espessura 20).
function floorWithWall() {
	const floor = createFloor();
	const wall = createWall({ x: 0, y: 0 }, { x: 400, y: 0 }, false, 20);
	floor.walls.push(wall);
	return { floor, wall };
}

describe("moveWithCollision (andar sem atravessar paredes)", () => {
	it("anda livre quando não há nada no caminho", () => {
		const { floor } = floorWithWall();
		const to = moveWithCollision(floor, { x: 200, y: 300 }, { x: 250, y: 320 });
		expect(to).toEqual({ x: 250, y: 320 });
	});

	it("para antes da face da parede em vez de atravessá-la", () => {
		const { floor } = floorWithWall();
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		// face da parede em y = 10; o jogador (raio) fica do lado de lá
		expect(to.y).toBeGreaterThanOrEqual(10 + PLAYER_RADIUS - 0.5);
	});

	it("desliza ao longo da parede quando o movimento é diagonal", () => {
		const { floor } = floorWithWall();
		const to = moveWithCollision(floor, { x: 100, y: 40 }, { x: 160, y: -20 });
		expect(to.x).toBeGreaterThan(130); // continuou andando em x
		expect(to.y).toBeGreaterThanOrEqual(10 + PLAYER_RADIUS - 0.5); // sem atravessar
	});

	it("não atravessa mesmo com um passo enorme (frame lento)", () => {
		const { floor } = floorWithWall();
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -900 },
		);
		expect(to.y).toBeGreaterThan(0);
	});

	it("passa por uma porta aberta", () => {
		const { floor, wall } = floorWithWall();
		const door = createOpening(wall, "door", 0.5); // 90 cm de vão em x = 200
		door.open = true;
		floor.openings.push(door);
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		expect(to.y).toBeCloseTo(-100, 5);
	});

	it("não passa pela janela (peitoril alto)", () => {
		const { floor, wall } = floorWithWall();
		floor.openings.push(createOpening(wall, "window", 0.5));
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		expect(to.y).toBeGreaterThan(0);
	});

	it("não passa ao lado da porta, só pelo vão", () => {
		const { floor, wall } = floorWithWall();
		const door = createOpening(wall, "door", 0.5);
		door.open = true;
		floor.openings.push(door);
		const to = moveWithCollision(
			floor,
			{ x: 300, y: 100 },
			{ x: 300, y: -100 },
		);
		expect(to.y).toBeGreaterThan(0);
	});

	it("porta fechada bloqueia, como uma parede", () => {
		const { floor, wall } = floorWithWall();
		floor.openings.push(createOpening(wall, "door", 0.5)); // open: false
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		expect(to.y).toBeGreaterThanOrEqual(10 + PLAYER_RADIUS - 0.5);
	});

	it("porta dupla também só passa aberta", () => {
		const { floor, wall } = floorWithWall();
		const door = createOpening(wall, "doubleDoor", 0.5);
		floor.openings.push(door);
		expect(
			moveWithCollision(floor, { x: 200, y: 100 }, { x: 200, y: -100 }).y,
		).toBeGreaterThan(0);
		door.open = true;
		expect(
			moveWithCollision(floor, { x: 200, y: 100 }, { x: 200, y: -100 }).y,
		).toBeCloseTo(-100, 5);
	});

	it("arco é um vão livre: passa sem abrir nada", () => {
		const { floor, wall } = floorWithWall();
		floor.openings.push(createOpening(wall, "arch", 0.5));
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		expect(to.y).toBeCloseTo(-100, 5);
	});

	it("porta de correr e garagem não têm animação de abrir: ficam livres", () => {
		for (const kind of ["slidingDoor", "garage"] as const) {
			const { floor, wall } = floorWithWall();
			floor.openings.push(createOpening(wall, kind, 0.5));
			const to = moveWithCollision(
				floor,
				{ x: 200, y: 100 },
				{ x: 200, y: -100 },
			);
			expect(to.y).toBeCloseTo(-100, 5);
		}
	});

	it("ignora paredes escondidas", () => {
		const { floor, wall } = floorWithWall();
		wall.hidden = true;
		const to = moveWithCollision(
			floor,
			{ x: 200, y: 100 },
			{ x: 200, y: -100 },
		);
		expect(to.y).toBeCloseTo(-100, 5);
	});
});

describe("canTeleport (o teleporte não atravessa paredes)", () => {
	it("permite teleportar no mesmo cômodo", () => {
		const { floor } = floorWithWall();
		expect(canTeleport(floor, { x: 100, y: 200 }, { x: 300, y: 250 })).toBe(
			true,
		);
	});

	it("bloqueia teleportar para o outro lado de uma parede", () => {
		const { floor } = floorWithWall();
		expect(canTeleport(floor, { x: 200, y: 100 }, { x: 200, y: -100 })).toBe(
			false,
		);
	});

	it("bloqueia teleportar para dentro da parede", () => {
		const { floor } = floorWithWall();
		expect(canTeleport(floor, { x: 200, y: 100 }, { x: 200, y: 3 })).toBe(
			false,
		);
	});

	it("permite teleportar através de uma porta aberta", () => {
		const { floor, wall } = floorWithWall();
		const door = createOpening(wall, "door", 0.5);
		door.open = true;
		floor.openings.push(door);
		expect(canTeleport(floor, { x: 200, y: 100 }, { x: 200, y: -100 })).toBe(
			true,
		);
	});

	it("bloqueia teleportar através de uma porta fechada", () => {
		const { floor, wall } = floorWithWall();
		floor.openings.push(createOpening(wall, "door", 0.5));
		expect(canTeleport(floor, { x: 200, y: 100 }, { x: 200, y: -100 })).toBe(
			false,
		);
	});
});

describe("arcFloorHit (arco do teleporte a partir do controle)", () => {
	it("apontando para baixo e à frente, acerta o piso à frente", () => {
		const hit = arcFloorHit(
			{ x: 0, y: 1.2, z: 0 },
			{ x: 0, y: -0.3, z: -1 },
			0,
		);
		expect(hit).not.toBeNull();
		expect(hit?.point.z).toBeLessThan(0); // à frente (−z)
		expect(Math.abs(hit?.point.x ?? 1)).toBeLessThan(1e-6);
	});

	it("o arco chega no piso (altura do ponto = altura do piso)", () => {
		const hit = arcFloorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 0, z: -1 }, 0.5);
		expect(hit).not.toBeNull();
		const last = hit?.path[hit.path.length - 1];
		expect(last?.y).toBeCloseTo(0.5, 5);
	});

	it("apontando para o céu, não há ponto de teleporte", () => {
		// a gravidade ainda traz o arco ao piso; mas muito vertical passa do alcance
		const hit = arcFloorHit({ x: 0, y: 1.2, z: 0 }, { x: 0, y: 1, z: 0 }, 0);
		expect(hit).toBeNull();
	});

	it("respeita o alcance máximo", () => {
		const hit = arcFloorHit(
			{ x: 0, y: 1.2, z: 0 },
			{ x: 0, y: 0.5, z: -1 },
			0,
			{
				maxRange: 3,
			},
		);
		expect(hit).toBeNull();
	});
});

describe("snapTurn (giro em passos)", () => {
	it("gira um passo para a direita e para a esquerda", () => {
		expect(snapTurn(0, 1, 30)).toBeCloseTo((-30 * Math.PI) / 180, 10);
		expect(snapTurn(0, -1, 30)).toBeCloseTo((30 * Math.PI) / 180, 10);
	});

	it("mantém o ângulo entre −π e π", () => {
		const y = snapTurn(Math.PI - 0.1, -1, 30);
		expect(y).toBeLessThanOrEqual(Math.PI);
		expect(y).toBeGreaterThanOrEqual(-Math.PI);
	});
});

describe("spawnPoint (onde o visitante nasce)", () => {
	it("nasce no centro do primeiro cômodo", () => {
		const floor = createFloor();
		floor.rooms.push({
			id: "r1",
			name: "Sala",
			type: "living",
			points: [
				{ x: 0, y: 0 },
				{ x: 400, y: 0 },
				{ x: 400, y: 200 },
				{ x: 0, y: 200 },
			],
			floor: { texture: null, color: "#fff", scale: 1, rotation: 0 },
			ceiling: true,
			floorOffset: 0,
		});
		expect(spawnPoint(floor)).toEqual({ x: 200, y: 100 });
	});

	it("sem cômodos, usa o centro das paredes", () => {
		const { floor } = floorWithWall();
		expect(spawnPoint(floor)).toEqual({ x: 200, y: 0 });
	});

	it("projeto vazio nasce na origem", () => {
		expect(spawnPoint(createFloor())).toEqual({ x: 0, y: 0 });
	});
});
