import type { OpeningKind } from "./types";

/**
 * Parametric catalog. Items are assembled from simple primitives so they render
 * in both the 2D plan (top view) and the 3D view without external model files.
 * Part coordinates are fractions of the item footprint: x/z in [-0.5, 0.5], y in [0, 1] of the height.
 */
export type Part = {
	t: "box" | "cyl" | "sphere" | "cone";
	/** centre x, base y, centre z (fractions) */
	p: [number, number, number];
	/** size fractions: width, height, depth */
	s: [number, number, number];
	c?: "main" | "accent" | string;
};

export type CatalogItem = {
	id: string;
	name: string;
	category: string;
	/** footprint and height in cm */
	size: [number, number, number];
	color: string;
	accent: string;
	parts: Part[];
	tags: string[];
	elevation?: number;
	/** Items snapped to walls when dragged near them. */
	wallMounted?: boolean;
	/** Exterior items cast no 2D room constraints. */
	outdoor?: boolean;
};

export type CatalogCategory = {
	id: string;
	name: string;
	icon: string;
	parent: string | null;
};

export const CATEGORIES: CatalogCategory[] = [
	{ id: "construction", name: "Construção", icon: "BrickWall", parent: null },
	{ id: "windows", name: "Janelas", icon: "AppWindow", parent: "construction" },
	{ id: "doors", name: "Portas", icon: "DoorOpen", parent: "construction" },
	{ id: "stairs", name: "Escadas", icon: "Footprints", parent: "construction" },
	{ id: "columns", name: "Colunas", icon: "Columns3", parent: "construction" },
	{ id: "fences", name: "Cercas", icon: "Fence", parent: "construction" },
	{ id: "interior", name: "Interior", icon: "Sofa", parent: null },
	{ id: "furniture", name: "Mobília", icon: "Armchair", parent: "interior" },
	{ id: "seating", name: "Assentos", icon: "Armchair", parent: "furniture" },
	{ id: "tables", name: "Mesas", icon: "Table", parent: "furniture" },
	{ id: "beds", name: "Camas", icon: "BedDouble", parent: "furniture" },
	{
		id: "storage",
		name: "Armazenamento",
		icon: "Archive",
		parent: "furniture",
	},
	{
		id: "appliances",
		name: "Eletrodomésticos",
		icon: "Refrigerator",
		parent: "interior",
	},
	{ id: "bathroom", name: "Banheiro", icon: "Bath", parent: "interior" },
	{ id: "decor", name: "Decoração", icon: "Flower2", parent: "interior" },
	{ id: "lighting", name: "Iluminação", icon: "Lamp", parent: "interior" },
	{ id: "exterior", name: "Exterior", icon: "Trees", parent: null },
	{
		id: "plants",
		name: "Árvores e plantas",
		icon: "Trees",
		parent: "exterior",
	},
	{
		id: "patio",
		name: "Mobiliário de jardim",
		icon: "Umbrella",
		parent: "exterior",
	},
	{ id: "pool", name: "Piscina e lazer", icon: "Waves", parent: "exterior" },
	{ id: "garage", name: "Garagem", icon: "Car", parent: "exterior" },
];

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id);
export const childCategories = (parent: string | null) =>
	CATEGORIES.filter((c) => c.parent === parent);

/** All descendant category ids including itself. */
export function categoryTree(id: string): string[] {
	const out = [id];
	for (const c of CATEGORIES)
		if (c.parent === id) out.push(...categoryTree(c.id));
	return out;
}

const box = (p: Part["p"], s: Part["s"], c?: Part["c"]): Part => ({
	t: "box",
	p,
	s,
	c,
});
const cyl = (p: Part["p"], s: Part["s"], c?: Part["c"]): Part => ({
	t: "cyl",
	p,
	s,
	c,
});
const sph = (p: Part["p"], s: Part["s"], c?: Part["c"]): Part => ({
	t: "sphere",
	p,
	s,
	c,
});
const cone = (p: Part["p"], s: Part["s"], c?: Part["c"]): Part => ({
	t: "cone",
	p,
	s,
	c,
});

const item = (
	id: string,
	name: string,
	category: string,
	size: [number, number, number],
	color: string,
	accent: string,
	parts: Part[],
	tags: string[] = [],
	extra: Partial<CatalogItem> = {},
): CatalogItem => ({
	id,
	name,
	category,
	size,
	color,
	accent,
	parts,
	tags,
	...extra,
});

const legs = (h = 0.25, c: Part["c"] = "accent"): Part[] => [
	box([-0.45, 0, -0.45], [0.06, h, 0.06], c),
	box([0.45, 0, -0.45], [0.06, h, 0.06], c),
	box([-0.45, 0, 0.45], [0.06, h, 0.06], c),
	box([0.45, 0, 0.45], [0.06, h, 0.06], c),
];

const sofa = (w: number, name: string, id: string, color: string) =>
	item(
		id,
		name,
		"seating",
		[w, 90, 85],
		color,
		"#5b4636",
		[
			box([0, 0.18, 0], [1, 0.32, 1], "main"),
			box([0, 0.5, -0.4], [1, 0.5, 0.2], "main"),
			box([-0.46, 0.5, 0], [0.1, 0.3, 0.8], "main"),
			box([0.46, 0.5, 0], [0.1, 0.3, 0.8], "main"),
			box([0, 0, 0], [0.96, 0.18, 0.9], "accent"),
		],
		["sofa", "couch", "sala", "living"],
	);

export const CATALOG: CatalogItem[] = [
	// ---- Seating
	sofa(200, "Sofá 3 lugares", "sofa-3", "#7c8ea3"),
	sofa(150, "Sofá 2 lugares", "sofa-2", "#a0715b"),
	item(
		"armchair",
		"Poltrona",
		"seating",
		[85, 85, 85],
		"#8a9a5b",
		"#5b4636",
		[
			box([0, 0.2, 0], [1, 0.3, 1], "main"),
			box([0, 0.55, -0.4], [1, 0.55, 0.2], "main"),
			box([-0.45, 0.45, 0], [0.1, 0.3, 0.8], "main"),
			box([0.45, 0.45, 0], [0.1, 0.3, 0.8], "main"),
			...legs(0.15),
		],
		["chair", "poltrona"],
	),
	item(
		"chair",
		"Cadeira",
		"seating",
		[45, 90, 45],
		"#d3b186",
		"#8b5e3c",
		[
			box([0, 0.45, 0], [1, 0.08, 1], "main"),
			box([0, 0.72, -0.45], [1, 0.5, 0.1], "main"),
			...legs(0.45),
		],
		["chair", "cadeira"],
	),
	item(
		"stool",
		"Banco alto",
		"seating",
		[38, 70, 38],
		"#3c4044",
		"#b8bec4",
		[
			cyl([0, 0.85, 0], [1, 0.15, 1], "main"),
			cyl([0, 0, 0], [0.15, 0.85, 0.15], "accent"),
		],
		["stool", "banco"],
	),
	item(
		"office-chair",
		"Cadeira de escritório",
		"seating",
		[60, 105, 60],
		"#2b2d31",
		"#8a8f94",
		[
			cyl([0, 0.4, 0], [1, 0.1, 1], "main"),
			box([0, 0.75, -0.4], [0.9, 0.5, 0.15], "main"),
			cyl([0, 0, 0], [0.1, 0.4, 0.1], "accent"),
			cyl([0, 0, 0], [0.9, 0.06, 0.9], "accent"),
		],
		["office", "chair", "escritorio"],
	),
	item(
		"bench",
		"Banco",
		"seating",
		[120, 45, 40],
		"#b98a5e",
		"#5c3d28",
		[box([0, 0.8, 0], [1, 0.2, 1], "main"), ...legs(0.8)],
		["bench"],
	),

	// ---- Tables
	item(
		"dining-table",
		"Mesa de jantar",
		"tables",
		[160, 75, 90],
		"#c19a6b",
		"#8b5e3c",
		[box([0, 0.9, 0], [1, 0.1, 1], "main"), ...legs(0.9)],
		["table", "mesa", "jantar"],
	),
	item(
		"round-table",
		"Mesa redonda",
		"tables",
		[100, 75, 100],
		"#d3b186",
		"#8b5e3c",
		[
			cyl([0, 0.9, 0], [1, 0.1, 1], "main"),
			cyl([0, 0, 0], [0.12, 0.9, 0.12], "accent"),
			cyl([0, 0, 0], [0.5, 0.06, 0.5], "accent"),
		],
		["table", "round"],
	),
	item(
		"coffee-table",
		"Mesa de centro",
		"tables",
		[100, 42, 55],
		"#a97c50",
		"#3c4044",
		[box([0, 0.8, 0], [1, 0.2, 1], "main"), ...legs(0.8)],
		["coffee", "centro"],
	),
	item(
		"desk",
		"Escrivaninha",
		"tables",
		[140, 75, 70],
		"#e6cfa8",
		"#3c4044",
		[
			box([0, 0.92, 0], [1, 0.08, 1], "main"),
			box([-0.47, 0, 0], [0.04, 0.92, 0.9], "accent"),
			box([0.47, 0, 0], [0.04, 0.92, 0.9], "accent"),
		],
		["desk", "office", "escritorio"],
	),
	item(
		"side-table",
		"Mesa lateral",
		"tables",
		[45, 50, 45],
		"#e6e1d6",
		"#8a8f94",
		[
			cyl([0, 0.85, 0], [1, 0.15, 1], "main"),
			cyl([0, 0, 0], [0.1, 0.85, 0.1], "accent"),
		],
		["side", "lateral"],
	),
	item(
		"tv-stand",
		"Rack de TV",
		"tables",
		[160, 50, 40],
		"#5c3d28",
		"#3c4044",
		[
			box([0, 0.2, 0], [1, 0.8, 1], "main"),
			box([0, 0, 0], [0.95, 0.2, 0.9], "accent"),
		],
		["tv", "rack"],
	),

	// ---- Beds
	item(
		"bed-double",
		"Cama de casal",
		"beds",
		[160, 90, 210],
		"#e9e2d4",
		"#8b5e3c",
		[
			box([0, 0.15, 0], [1, 0.3, 1], "accent"),
			box([0, 0.45, 0.03], [0.96, 0.2, 0.9], "main"),
			box([0, 0.5, -0.46], [1, 0.5, 0.08], "accent"),
			box([-0.22, 0.65, -0.32], [0.4, 0.1, 0.18], "#ffffff"),
			box([0.22, 0.65, -0.32], [0.4, 0.1, 0.18], "#ffffff"),
		],
		["bed", "cama", "casal", "bedroom"],
	),
	item(
		"bed-single",
		"Cama de solteiro",
		"beds",
		[95, 90, 200],
		"#cfe3e8",
		"#8b5e3c",
		[
			box([0, 0.15, 0], [1, 0.3, 1], "accent"),
			box([0, 0.45, 0.03], [0.94, 0.2, 0.9], "main"),
			box([0, 0.5, -0.46], [1, 0.5, 0.08], "accent"),
			box([0, 0.65, -0.32], [0.7, 0.1, 0.18], "#ffffff"),
		],
		["bed", "cama", "solteiro"],
	),
	item(
		"crib",
		"Berço",
		"beds",
		[70, 90, 130],
		"#fff7e6",
		"#d3b186",
		[
			box([0, 0.25, 0], [1, 0.1, 1], "accent"),
			box([0, 0.35, -0.5], [1, 0.65, 0.04], "main"),
			box([0, 0.35, 0.5], [1, 0.65, 0.04], "main"),
			box([-0.5, 0.35, 0], [0.04, 0.65, 1], "main"),
			box([0.5, 0.35, 0], [0.04, 0.65, 1], "main"),
		],
		["crib", "baby", "berco"],
	),
	item(
		"bunk-bed",
		"Beliche",
		"beds",
		[100, 170, 205],
		"#d3b186",
		"#8b5e3c",
		[
			box([0, 0.15, 0], [1, 0.12, 1], "main"),
			box([0, 0.6, 0], [1, 0.12, 1], "main"),
			box([-0.48, 0, -0.48], [0.05, 1, 0.05], "accent"),
			box([0.48, 0, -0.48], [0.05, 1, 0.05], "accent"),
			box([-0.48, 0, 0.48], [0.05, 1, 0.05], "accent"),
			box([0.48, 0, 0.48], [0.05, 1, 0.05], "accent"),
		],
		["bunk", "beliche"],
	),
	item(
		"nightstand",
		"Criado-mudo",
		"beds",
		[45, 50, 40],
		"#d3b186",
		"#8b5e3c",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.55, 0.5], [0.8, 0.12, 0.02], "accent"),
		],
		["nightstand", "criado"],
	),

	// ---- Storage
	item(
		"wardrobe",
		"Guarda-roupa",
		"storage",
		[180, 220, 60],
		"#e6dccb",
		"#8b5e3c",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([-0.25, 0.4, 0.5], [0.02, 0.3, 0.02], "accent"),
			box([0.25, 0.4, 0.5], [0.02, 0.3, 0.02], "accent"),
		],
		["wardrobe", "closet", "guarda-roupa"],
	),
	item(
		"bookshelf",
		"Estante",
		"storage",
		[100, 190, 32],
		"#8b5e3c",
		"#5c3d28",
		[
			box([-0.48, 0, 0], [0.04, 1, 1], "main"),
			box([0.48, 0, 0], [0.04, 1, 1], "main"),
			box([0, 0, 0], [1, 0.03, 1], "main"),
			box([0, 0.25, 0], [1, 0.03, 1], "main"),
			box([0, 0.5, 0], [1, 0.03, 1], "main"),
			box([0, 0.75, 0], [1, 0.03, 1], "main"),
			box([0, 0.97, 0], [1, 0.03, 1], "main"),
		],
		["shelf", "estante", "books"],
	),
	item(
		"dresser",
		"Cômoda",
		"storage",
		[110, 85, 48],
		"#c19a6b",
		"#5c3d28",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.25, 0.5], [0.8, 0.02, 0.02], "accent"),
			box([0, 0.55, 0.5], [0.8, 0.02, 0.02], "accent"),
			box([0, 0.8, 0.5], [0.8, 0.02, 0.02], "accent"),
		],
		["dresser", "comoda"],
	),
	item(
		"cabinet",
		"Armário baixo",
		"storage",
		[90, 90, 40],
		"#e6e1d6",
		"#8a8f94",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["cabinet", "armario"],
	),

	// ---- Appliances
	item(
		"fridge",
		"Geladeira",
		"appliances",
		[70, 185, 70],
		"#d9dde0",
		"#8a8f94",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0.4, 0.6, 0.5], [0.04, 0.2, 0.02], "accent"),
		],
		["fridge", "geladeira", "kitchen"],
	),
	item(
		"stove",
		"Fogão",
		"appliances",
		[60, 90, 60],
		"#c9cdd1",
		"#2b2d31",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			cyl([-0.22, 1, -0.22], [0.3, 0.02, 0.3], "accent"),
			cyl([0.22, 1, -0.22], [0.3, 0.02, 0.3], "accent"),
			cyl([-0.22, 1, 0.22], [0.3, 0.02, 0.3], "accent"),
			cyl([0.22, 1, 0.22], [0.3, 0.02, 0.3], "accent"),
		],
		["stove", "fogao", "kitchen"],
	),
	item(
		"washer",
		"Máquina de lavar",
		"appliances",
		[60, 85, 60],
		"#f2f2f2",
		"#8a9199",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			cyl([0, 0.4, 0.5], [0.6, 0.4, 0.04], "accent"),
		],
		["washer", "lavar", "laundry"],
	),
	item(
		"dishwasher",
		"Lava-louças",
		"appliances",
		[60, 85, 60],
		"#e0e2e4",
		"#8a9199",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["dishwasher"],
	),
	item(
		"microwave",
		"Micro-ondas",
		"appliances",
		[50, 30, 38],
		"#2b2d31",
		"#8a8f94",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["microwave"],
		{ elevation: 90 },
	),
	item(
		"tv",
		"TV",
		"appliances",
		[120, 70, 8],
		"#111111",
		"#3c4044",
		[
			box([0, 0.15, 0], [1, 0.85, 0.5], "main"),
			box([0, 0, 0], [0.3, 0.15, 0.9], "accent"),
		],
		["tv", "television"],
	),
	item(
		"kitchen-counter",
		"Bancada de cozinha",
		"appliances",
		[120, 90, 60],
		"#e6e1d6",
		"#3c4044",
		[
			box([0, 0, 0], [1, 0.95, 1], "main"),
			box([0, 0.95, 0], [1.02, 0.05, 1.02], "accent"),
		],
		["counter", "bancada", "kitchen"],
	),
	item(
		"kitchen-sink",
		"Pia de cozinha",
		"appliances",
		[120, 90, 60],
		"#e6e1d6",
		"#b8bec4",
		[
			box([0, 0, 0], [1, 0.95, 1], "main"),
			box([0, 0.95, 0], [1.02, 0.05, 1.02], "accent"),
			box([0, 0.96, 0], [0.4, 0.04, 0.7], "#b8bec4"),
		],
		["sink", "pia", "kitchen"],
	),

	// ---- Bathroom
	item(
		"toilet",
		"Vaso sanitário",
		"bathroom",
		[40, 75, 70],
		"#f5f5f5",
		"#d0d0d0",
		[
			box([0, 0, -0.15], [0.9, 0.5, 0.65], "main"),
			box([0, 0.5, -0.4], [0.9, 0.5, 0.2], "main"),
		],
		["toilet", "wc", "vaso"],
	),
	item(
		"basin",
		"Pia de banheiro",
		"bathroom",
		[60, 85, 45],
		"#f5f5f5",
		"#b8bec4",
		[
			box([0, 0, 0], [0.4, 0.8, 0.5], "accent"),
			box([0, 0.8, 0], [1, 0.2, 1], "main"),
		],
		["sink", "basin", "pia"],
	),
	item(
		"bathtub",
		"Banheira",
		"bathroom",
		[170, 60, 75],
		"#f5f5f5",
		"#b8bec4",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.9, 0], [0.9, 0.1, 0.85], "#cfe3e8"),
		],
		["bath", "banheira", "tub"],
	),
	item(
		"shower",
		"Box de chuveiro",
		"bathroom",
		[90, 210, 90],
		"#cfe3e8",
		"#8a9199",
		[
			box([0, 0, 0], [1, 0.05, 1], "main"),
			box([0.5, 0, 0], [0.02, 1, 1], "#a8dadc"),
			box([0, 0, 0.5], [1, 1, 0.02], "#a8dadc"),
		],
		["shower", "chuveiro"],
	),
	item(
		"bidet",
		"Bidê",
		"bathroom",
		[40, 40, 60],
		"#f5f5f5",
		"#d0d0d0",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["bidet"],
	),

	// ---- Decor
	item(
		"rug",
		"Tapete",
		"decor",
		[200, 2, 140],
		"#b7a79a",
		"#8a7968",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 1, 0], [0.8, 0.1, 0.8], "accent"),
		],
		["rug", "tapete", "carpet"],
	),
	item(
		"plant-pot",
		"Vaso com planta",
		"decor",
		[40, 110, 40],
		"#6a994e",
		"#a34a2f",
		[
			cyl([0, 0, 0], [0.8, 0.3, 0.8], "accent"),
			sph([0, 0.35, 0], [1, 0.65, 1], "main"),
		],
		["plant", "planta", "vaso"],
	),
	item(
		"painting",
		"Quadro",
		"decor",
		[80, 60, 3],
		"#e9c46a",
		"#3c4044",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.1, 0.5], [0.85, 0.8, 0.05], "#457b9d"),
		],
		["picture", "quadro"],
		{ elevation: 140, wallMounted: true },
	),
	item(
		"mirror",
		"Espelho",
		"decor",
		[60, 150, 4],
		"#a8dadc",
		"#8b5e3c",
		[
			box([0, 0, 0], [1, 1, 1], "accent"),
			box([0, 0.03, 0.5], [0.9, 0.94, 0.05], "main"),
		],
		["mirror", "espelho"],
		{ elevation: 30, wallMounted: true },
	),
	item(
		"curtain",
		"Cortina",
		"decor",
		[150, 230, 12],
		"#e9c6c1",
		"#8a8f94",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["curtain", "cortina"],
		{ wallMounted: true },
	),
	item(
		"fireplace",
		"Lareira",
		"decor",
		[130, 110, 40],
		"#8a8f94",
		"#3c4044",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.1, 0.5], [0.6, 0.5, 0.05], "accent"),
		],
		["fireplace", "lareira"],
	),

	// ---- Lighting
	item(
		"floor-lamp",
		"Luminária de piso",
		"lighting",
		[35, 160, 35],
		"#f0e2a9",
		"#3c4044",
		[
			cyl([0, 0, 0], [0.8, 0.04, 0.8], "accent"),
			cyl([0, 0, 0], [0.06, 0.8, 0.06], "accent"),
			cone([0, 0.75, 0], [1, 0.25, 1], "main"),
		],
		["lamp", "luminaria"],
	),
	item(
		"pendant",
		"Pendente",
		"lighting",
		[45, 60, 45],
		"#f0e2a9",
		"#3c4044",
		[
			cyl([0, 0.4, 0], [0.04, 0.6, 0.04], "accent"),
			cone([0, 0, 0], [1, 0.4, 1], "main"),
		],
		["pendant", "pendente", "ceiling"],
		{ elevation: 190 },
	),
	item(
		"table-lamp",
		"Abajur",
		"lighting",
		[28, 45, 28],
		"#f0e2a9",
		"#3c4044",
		[
			cyl([0, 0, 0], [0.4, 0.5, 0.4], "accent"),
			cone([0, 0.45, 0], [1, 0.55, 1], "main"),
		],
		["lamp", "abajur"],
		{ elevation: 50 },
	),

	// ---- Stairs & columns & fences (as items for quick placement)
	item(
		"column-round",
		"Coluna redonda",
		"columns",
		[30, 270, 30],
		"#e6e1d6",
		"#b8bec4",
		[cyl([0, 0, 0], [1, 1, 1], "main")],
		["column", "coluna"],
	),
	item(
		"column-square",
		"Coluna quadrada",
		"columns",
		[30, 270, 30],
		"#cfcfcf",
		"#8a8f94",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["column", "pilar"],
	),
	item(
		"fence-section",
		"Cerca",
		"fences",
		[200, 100, 6],
		"#e6dccb",
		"#8b5e3c",
		[
			box([0, 0.2, 0], [1, 0.1, 1], "accent"),
			box([0, 0.7, 0], [1, 0.1, 1], "accent"),
			box([-0.48, 0, 0], [0.04, 1, 1.5], "main"),
			box([0.48, 0, 0], [0.04, 1, 1.5], "main"),
			box([0, 0, 0], [0.9, 0.9, 0.6], "main"),
		],
		["fence", "cerca"],
		{ outdoor: true },
	),
	item(
		"gate",
		"Portão",
		"fences",
		[140, 130, 6],
		"#3c4044",
		"#8a8f94",
		[box([0, 0, 0], [1, 1, 1], "main")],
		["gate", "portao"],
		{ outdoor: true },
	),

	// ---- Plants / exterior
	item(
		"tree-round",
		"Árvore",
		"plants",
		[220, 450, 220],
		"#4f772d",
		"#7f5539",
		[
			cyl([0, 0, 0], [0.08, 0.45, 0.08], "accent"),
			sph([0, 0.35, 0], [1, 0.65, 1], "main"),
		],
		["tree", "arvore"],
		{ outdoor: true },
	),
	item(
		"tree-pine",
		"Pinheiro",
		"plants",
		[180, 500, 180],
		"#2d6a4f",
		"#7f5539",
		[
			cyl([0, 0, 0], [0.08, 0.3, 0.08], "accent"),
			cone([0, 0.2, 0], [1, 0.5, 1], "main"),
			cone([0, 0.5, 0], [0.7, 0.5, 0.7], "main"),
		],
		["tree", "pine", "pinheiro"],
		{ outdoor: true },
	),
	item(
		"bush",
		"Arbusto",
		"plants",
		[90, 80, 90],
		"#6a994e",
		"#4f772d",
		[sph([0, 0, 0], [1, 1, 1], "main")],
		["bush", "arbusto"],
		{ outdoor: true },
	),
	item(
		"flower-bed",
		"Canteiro de flores",
		"plants",
		[150, 30, 50],
		"#e5989b",
		"#7f5539",
		[
			box([0, 0, 0], [1, 0.6, 1], "accent"),
			sph([-0.3, 0.5, 0], [0.3, 0.5, 0.5], "main"),
			sph([0, 0.5, 0], [0.3, 0.5, 0.5], "#f4a261"),
			sph([0.3, 0.5, 0], [0.3, 0.5, 0.5], "#e9c46a"),
		],
		["flowers", "flor"],
		{ outdoor: true },
	),

	// ---- Patio
	item(
		"patio-table",
		"Mesa de jardim",
		"patio",
		[120, 74, 120],
		"#d3b186",
		"#3c4044",
		[
			cyl([0, 0.9, 0], [1, 0.1, 1], "main"),
			cyl([0, 0, 0], [0.1, 0.9, 0.1], "accent"),
		],
		["patio", "garden"],
		{ outdoor: true },
	),
	item(
		"umbrella",
		"Ombrelone",
		"patio",
		[220, 250, 220],
		"#e63946",
		"#d9d3c7",
		[
			cyl([0, 0, 0], [0.03, 0.9, 0.03], "accent"),
			cone([0, 0.7, 0], [1, 0.3, 1], "main"),
		],
		["umbrella", "ombrelone"],
		{ outdoor: true },
	),
	item(
		"sun-lounger",
		"Espreguiçadeira",
		"patio",
		[65, 35, 190],
		"#f4f4f2",
		"#8a9199",
		[
			box([0, 0.3, 0.1], [1, 0.3, 0.7], "main"),
			box([0, 0.5, -0.4], [1, 0.5, 0.2], "main"),
			...legs(0.3),
		],
		["lounger", "pool"],
		{ outdoor: true },
	),
	item(
		"grill",
		"Churrasqueira",
		"patio",
		[100, 100, 60],
		"#3c4044",
		"#a34a2f",
		[
			box([0, 0, 0], [1, 0.8, 1], "accent"),
			box([0, 0.8, 0], [1, 0.2, 1], "main"),
		],
		["grill", "bbq", "churrasco"],
		{ outdoor: true },
	),

	// ---- Pool & leisure
	item(
		"pool",
		"Piscina",
		"pool",
		[600, 10, 300],
		"#4cc9f0",
		"#b8bec4",
		[
			box([0, 0, 0], [1, 1, 1], "main"),
			box([0, 0.95, 0], [1.04, 0.1, 1.08], "accent"),
		],
		["pool", "piscina"],
		{ outdoor: true },
	),
	item(
		"swing",
		"Balanço",
		"pool",
		[200, 220, 150],
		"#f4a261",
		"#7f5539",
		[
			box([0, 0, 0], [1, 0.05, 1], "accent"),
			box([0, 0.9, 0], [1, 0.1, 0.1], "accent"),
		],
		["swing", "playground"],
		{ outdoor: true },
	),
	item(
		"trampoline",
		"Cama elástica",
		"pool",
		[300, 90, 300],
		"#3c4044",
		"#e63946",
		[
			cyl([0, 0.7, 0], [1, 0.1, 1], "main"),
			cyl([0, 0, 0], [0.9, 0.7, 0.9], "accent"),
		],
		["trampoline"],
		{ outdoor: true },
	),

	// ---- Garage
	item(
		"car",
		"Carro",
		"garage",
		[180, 145, 440],
		"#457b9d",
		"#111111",
		[
			box([0, 0.15, 0], [1, 0.4, 1], "main"),
			box([0, 0.55, 0.05], [0.9, 0.4, 0.5], "#a8dadc"),
			cyl([-0.5, 0, -0.3], [0.2, 0.35, 0.18], "accent"),
			cyl([0.5, 0, -0.3], [0.2, 0.35, 0.18], "accent"),
			cyl([-0.5, 0, 0.3], [0.2, 0.35, 0.18], "accent"),
			cyl([0.5, 0, 0.3], [0.2, 0.35, 0.18], "accent"),
		],
		["car", "carro", "vehicle"],
		{ outdoor: true },
	),
	item(
		"workbench",
		"Bancada de oficina",
		"garage",
		[180, 90, 60],
		"#8b5e3c",
		"#3c4044",
		[box([0, 0.9, 0], [1, 0.1, 1], "main"), ...legs(0.9)],
		["workbench", "oficina"],
	),
];

export const itemById = (id: string) => CATALOG.find((i) => i.id === id);

export function searchCatalog(query: string, category: string | null) {
	const q = query.trim().toLowerCase();
	const allowed = category ? new Set(categoryTree(category)) : null;
	return CATALOG.filter((it) => {
		if (allowed && !allowed.has(it.category)) return false;
		if (!q) return true;
		return (
			it.name.toLowerCase().includes(q) ||
			it.id.includes(q) ||
			it.tags.some((t) => t.includes(q))
		);
	});
}

export type OpeningPreset = {
	id: string;
	name: string;
	kind: OpeningKind;
	width: number;
	height: number;
	sill: number;
	category: "doors" | "windows";
};

export const OPENING_PRESETS: OpeningPreset[] = [
	{
		id: "door-single",
		name: "Porta simples",
		kind: "door",
		width: 90,
		height: 210,
		sill: 0,
		category: "doors",
	},
	{
		id: "door-narrow",
		name: "Porta estreita",
		kind: "door",
		width: 70,
		height: 210,
		sill: 0,
		category: "doors",
	},
	{
		id: "door-double",
		name: "Porta dupla",
		kind: "doubleDoor",
		width: 160,
		height: 210,
		sill: 0,
		category: "doors",
	},
	{
		id: "door-sliding",
		name: "Porta de correr",
		kind: "slidingDoor",
		width: 180,
		height: 215,
		sill: 0,
		category: "doors",
	},
	{
		id: "arch",
		name: "Arco",
		kind: "arch",
		width: 120,
		height: 230,
		sill: 0,
		category: "doors",
	},
	{
		id: "garage-door",
		name: "Portão de garagem",
		kind: "garage",
		width: 260,
		height: 230,
		sill: 0,
		category: "doors",
	},
	{
		id: "window-single",
		name: "Janela simples",
		kind: "window",
		width: 100,
		height: 120,
		sill: 90,
		category: "windows",
	},
	{
		id: "window-wide",
		name: "Janela larga",
		kind: "window",
		width: 180,
		height: 120,
		sill: 90,
		category: "windows",
	},
	{
		id: "window-small",
		name: "Janela pequena",
		kind: "window",
		width: 60,
		height: 60,
		sill: 140,
		category: "windows",
	},
	{
		id: "window-floor",
		name: "Janela até o chão",
		kind: "window",
		width: 140,
		height: 220,
		sill: 0,
		category: "windows",
	},
];
