import {
	addRectangleRoom,
	createFloor,
	createItem,
	createOpening,
	createProject,
	createWall,
} from "./factory";
import { lerp } from "./geometry";
import { makeMaterial } from "./materials";
import type { Floor, Project, RoomType } from "./types";

export type TemplateId = "empty" | "studio" | "apartment" | "house" | "cabin";

export type TemplateInfo = {
	id: TemplateId;
	name: string;
	description: string;
	area: string;
	floors: number;
};

export const TEMPLATES: TemplateInfo[] = [
	{
		id: "empty",
		name: "Cômodo vazio",
		description: "Comece do zero com um único cômodo.",
		area: "16 m²",
		floors: 1,
	},
	{
		id: "studio",
		name: "Studio",
		description: "Ambiente integrado com cozinha, cama e banheiro.",
		area: "32 m²",
		floors: 1,
	},
	{
		id: "apartment",
		name: "Apartamento aconchegante",
		description: "Dois quartos, sala, cozinha e banheiro.",
		area: "68 m²",
		floors: 1,
	},
	{
		id: "house",
		name: "Casa de dois andares",
		description: "Térreo social e andar com quartos.",
		area: "140 m²",
		floors: 2,
	},
	{
		id: "cabin",
		name: "Casa de madeira",
		description: "Cabana com varanda e telhado de duas águas.",
		area: "54 m²",
		floors: 1,
	},
];

function wallOf(
	f: Floor,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	partition = false,
) {
	const w = createWall({ x: x1, y: y1 }, { x: x2, y: y2 }, partition);
	f.walls.push(w);
	return w;
}

function door(
	f: Floor,
	wall: ReturnType<typeof wallOf>,
	t: number,
	kind: "door" | "doubleDoor" | "slidingDoor" | "arch" = "door",
) {
	f.openings.push(createOpening(wall, kind, t));
}
function win(
	f: Floor,
	wall: ReturnType<typeof wallOf>,
	t: number,
	width = 100,
) {
	f.openings.push(createOpening(wall, "window", t, { width }));
}

function room(
	f: Floor,
	x: number,
	y: number,
	w: number,
	d: number,
	type: RoomType,
	name?: string,
) {
	// walls already exist; only add room polygon (inset by half wall thickness)
	const inset = 10;
	const r = addRoomOnly(
		f,
		x + inset,
		y + inset,
		w - inset * 2,
		d - inset * 2,
		type,
		name,
	);
	return r;
}

function addRoomOnly(
	f: Floor,
	x: number,
	y: number,
	w: number,
	d: number,
	type: RoomType,
	name?: string,
) {
	const tmp: Floor = {
		...f,
		walls: [],
		rooms: [],
		openings: [],
		items: [],
		rulers: [],
		stairs: [],
	};
	const r = addRectangleRoom(tmp, x - 10, y - 10, w + 20, d + 20, type, {
		name,
	});
	r.points = [
		{ x, y },
		{ x: x + w, y },
		{ x: x + w, y: y + d },
		{ x, y: y + d },
	];
	f.rooms.push(r);
	return r;
}

function furnish(f: Floor, list: [string, number, number, number?][]) {
	for (const [id, x, y, rot] of list) {
		const it = createItem(id, x, y, rot ?? 0);
		if (it) f.items.push(it);
	}
}

function box(f: Floor, x: number, y: number, w: number, d: number) {
	const n = wallOf(f, x, y, x + w, y);
	const e = wallOf(f, x + w, y, x + w, y + d);
	const s = wallOf(f, x + w, y + d, x, y + d);
	const ww = wallOf(f, x, y + d, x, y);
	return { n, e, s, w: ww };
}

export function buildTemplate(id: TemplateId, name?: string): Project {
	const p = createProject(
		name ?? TEMPLATES.find((t) => t.id === id)?.name ?? "Novo projeto",
	);
	const f = p.floors[0];
	switch (id) {
		case "empty": {
			const b = box(f, 0, 0, 400, 400);
			room(f, 0, 0, 400, 400, "living", "Cômodo");
			door(f, b.s, 0.25);
			win(f, b.n, 0.5);
			break;
		}
		case "studio": {
			const b = box(f, 0, 0, 800, 400);
			wallOf(f, 600, 0, 600, 180, true);
			wallOf(f, 600, 280, 600, 400, true);
			wallOf(f, 600, 180, 800, 180, true);
			room(f, 0, 0, 600, 400, "studio", "Studio");
			room(f, 600, 0, 200, 180, "bathroom", "Banheiro");
			room(f, 600, 180, 200, 220, "kitchen", "Cozinha");
			door(f, b.s, 0.35);
			win(f, b.n, 0.25, 140);
			win(f, b.n, 0.62, 100);
			furnish(f, [
				["bed-double", 110, 130],
				["nightstand", 20, 60, 0],
				["sofa-2", 300, 320, 180],
				["coffee-table", 300, 230],
				["tv-stand", 300, 30],
				["toilet", 650, 40, 0],
				["basin", 740, 30, 0],
				["shower", 745, 125, 0],
				["kitchen-counter", 740, 290, 270],
				["fridge", 640, 360, 180],
			]);
			break;
		}
		case "apartment": {
			const b = box(f, 0, 0, 900, 760);
			// partitions
			wallOf(f, 0, 380, 360, 380, true);
			wallOf(f, 360, 380, 360, 760, true);
			wallOf(f, 360, 380, 900, 380, true);
			wallOf(f, 600, 380, 600, 760, true);
			wallOf(f, 360, 0, 360, 380, true);
			room(f, 0, 0, 360, 380, "bedroom", "Quarto principal");
			room(f, 0, 380, 360, 380, "bedroom", "Quarto 2");
			room(f, 360, 0, 540, 380, "living", "Sala de estar");
			room(f, 360, 380, 240, 380, "kitchen", "Cozinha");
			room(f, 600, 380, 300, 380, "bathroom", "Banheiro");
			win(f, b.n, 0.2, 140);
			win(f, b.n, 0.7, 180);
			win(f, b.w, 0.8, 120);
			win(f, b.s, 0.15, 120);
			win(f, b.e, 0.2, 140);
			door(f, b.e, 0.7);
			furnish(f, [
				["bed-double", 130, 140],
				["wardrobe", 330, 80, 90],
				["bed-single", 70, 580],
				["desk", 260, 690, 180],
				["sofa-3", 630, 330, 180],
				["coffee-table", 630, 230],
				["tv-stand", 630, 30],
				["dining-table", 520, 130, 90],
				["rug", 630, 230],
				["fridge", 400, 410, 0],
				["kitchen-counter", 480, 720, 180],
				["stove", 560, 405, 0],
				["bathtub", 780, 420, 0],
				["toilet", 650, 740, 180],
				["basin", 840, 730, 180],
				["plant-pot", 880, 50],
			]);
			break;
		}
		case "house": {
			const g = f;
			g.name = "Térreo";
			const b = box(g, 0, 0, 1000, 800);
			wallOf(g, 500, 0, 500, 500, true);
			wallOf(g, 0, 500, 1000, 500, true);
			wallOf(g, 700, 500, 700, 800, true);
			room(g, 0, 0, 500, 500, "living", "Sala de estar");
			room(g, 500, 0, 500, 500, "kitchen", "Cozinha e jantar");
			room(g, 0, 500, 700, 300, "hall", "Hall");
			room(g, 700, 500, 300, 300, "toilet", "Lavabo");
			win(g, b.n, 0.25, 180);
			win(g, b.n, 0.75, 180);
			win(g, b.e, 0.3, 140);
			win(g, b.w, 0.3, 140);
			door(g, b.s, 0.3, "doubleDoor");
			furnish(g, [
				["sofa-3", 150, 400, 180],
				["armchair", 60, 250, 90],
				["coffee-table", 160, 280],
				["rug", 160, 280],
				["tv-stand", 160, 30],
				["dining-table", 760, 150],
				["chair", 700, 150, 90],
				["chair", 820, 150, 270],
				["kitchen-counter", 950, 340, 270],
				["fridge", 940, 40, 0],
				["toilet", 800, 540, 0],
				["basin", 920, 540, 0],
			]);
			g.stairs.push({
				id: "stair_demo",
				x: 300,
				y: 660,
				rotation: 0,
				width: 100,
				length: 280,
				steps: 14,
				kind: "straight",
				color: "#c19a6b",
			});
			g.roof.kind = "none";
			const up = createFloor("Andar 1");
			up.height = 270;
			p.floors.push(up);
			const ub = box(up, 0, 0, 1000, 800);
			wallOf(up, 0, 400, 1000, 400, true);
			wallOf(up, 400, 0, 400, 400, true);
			wallOf(up, 700, 400, 700, 800, true);
			room(up, 0, 0, 400, 400, "bedroom", "Suíte");
			room(up, 400, 0, 600, 400, "bedroom", "Quarto 2");
			room(up, 0, 400, 700, 400, "office", "Escritório");
			room(up, 700, 400, 300, 400, "bathroom", "Banheiro");
			win(up, ub.n, 0.2, 140);
			win(up, ub.n, 0.65, 140);
			win(up, ub.w, 0.75, 140);
			win(up, ub.s, 0.4, 180);
			furnish(up, [
				["bed-double", 200, 140],
				["wardrobe", 380, 120, 90],
				["bed-single", 700, 120],
				["desk", 300, 740, 180],
				["office-chair", 300, 680],
				["bookshelf", 40, 600, 90],
				["bathtub", 840, 450],
				["toilet", 760, 760, 180],
			]);
			up.roof = {
				...up.roof,
				kind: "gable",
				pitch: 28,
				overhang: 50,
				material: makeMaterial("#a34a2f", "roof"),
			};
			p.currentFloorId = g.id;
			void lerp;
			break;
		}
		case "cabin": {
			const b = box(f, 0, 0, 800, 600);
			wallOf(f, 500, 0, 500, 300, true);
			wallOf(f, 500, 300, 800, 300, true);
			for (const w of f.walls) {
				w.left = makeMaterial("#b98a5e", "wood");
				w.right = makeMaterial("#b98a5e", "wood");
			}
			room(f, 0, 0, 500, 600, "living", "Sala");
			room(f, 500, 0, 300, 300, "bedroom", "Quarto");
			room(f, 500, 300, 300, 300, "bathroom", "Banheiro");
			win(f, b.n, 0.3, 140);
			win(f, b.e, 0.2, 100);
			win(f, b.w, 0.5, 140);
			door(f, b.s, 0.3);
			furnish(f, [
				["sofa-3", 160, 80, 0],
				["fireplace", 40, 300, 90],
				["dining-table", 250, 480],
				["bed-double", 650, 120],
				["toilet", 560, 560, 180],
				["shower", 750, 560],
				["tree-pine", -150, 100],
				["tree-round", -150, 450],
			]);
			f.roof = {
				...f.roof,
				kind: "gable",
				pitch: 32,
				overhang: 60,
				material: makeMaterial("#7a5c3e", "roof"),
			};
			break;
		}
	}
	return p;
}
