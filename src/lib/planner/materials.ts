import type { MaterialRef, RoomType } from "./types";

/** Texture families (procedural patterns; no proprietary imagery is bundled). */
export type TextureFamily = {
	id: string;
	label: string;
	/** Pattern used by the canvas texture generator. */
	pattern:
		| "flat"
		| "planks"
		| "tiles"
		| "bricks"
		| "stone"
		| "weave"
		| "dots"
		| "stripes"
		| "noise"
		| "herringbone";
	colors: string[];
	scope: "wall" | "floor" | "both" | "roof";
};

export const TEXTURE_FAMILIES: TextureFamily[] = [
	{
		id: "plaster",
		label: "Reboco",
		pattern: "noise",
		colors: ["#f5f1ea", "#e9e2d4", "#d9e4ea", "#e8d9d5", "#d7e3d3", "#cfd4dc"],
		scope: "both",
	},
	{
		id: "wallpaper",
		label: "Papel de parede",
		pattern: "stripes",
		colors: ["#e3d5c3", "#c9d6df", "#e9c6c1", "#cbd7c1", "#d8c9e0", "#f0e2a9"],
		scope: "wall",
	},
	{
		id: "brick",
		label: "Tijolo",
		pattern: "bricks",
		colors: ["#a8553a", "#b9694a", "#8f4a34", "#c9a58c", "#7a7a7a"],
		scope: "wall",
	},
	{
		id: "stone",
		label: "Pedra",
		pattern: "stone",
		colors: ["#9aa0a6", "#b8b2a7", "#7d8590", "#c8bca8"],
		scope: "both",
	},
	{
		id: "concrete",
		label: "Concreto",
		pattern: "noise",
		colors: ["#a7a9ab", "#c1c3c4", "#8c8f91"],
		scope: "both",
	},
	{
		id: "tiles",
		label: "Azulejo",
		pattern: "tiles",
		colors: ["#f4f4f2", "#cfe3e8", "#d9d3c7", "#2f4858", "#8fb8a6"],
		scope: "both",
	},
	{
		id: "wood",
		label: "Madeira",
		pattern: "planks",
		colors: ["#b98a5e", "#d3b186", "#8b5e3c", "#e6cfa8", "#5c3d28"],
		scope: "both",
	},
	{
		id: "parquet",
		label: "Parquet",
		pattern: "herringbone",
		colors: ["#c19a6b", "#a97c50", "#d8b98a", "#6f4b2f"],
		scope: "floor",
	},
	{
		id: "laminate",
		label: "Laminado",
		pattern: "planks",
		colors: ["#c8a97e", "#b0b0a8", "#9c7a56", "#e1d3bd"],
		scope: "floor",
	},
	{
		id: "carpet",
		label: "Carpete",
		pattern: "weave",
		colors: ["#9aa5b1", "#b7a79a", "#6b7f73", "#c9b5c0", "#4a5568"],
		scope: "floor",
	},
	{
		id: "linoleum",
		label: "Linóleo",
		pattern: "dots",
		colors: ["#c9d3c1", "#d9c9b0", "#b6c4d1"],
		scope: "floor",
	},
	{
		id: "metal",
		label: "Metálico",
		pattern: "stripes",
		colors: ["#b8bec4", "#8a9199", "#d4a373"],
		scope: "both",
	},
	{
		id: "fabric",
		label: "Tecido",
		pattern: "weave",
		colors: ["#c8b6a6", "#a3b18a", "#bcb8b1", "#e5989b"],
		scope: "both",
	},
	{
		id: "grass",
		label: "Gramado",
		pattern: "noise",
		colors: ["#6a994e", "#86a65b", "#4f772d"],
		scope: "floor",
	},
	{
		id: "roof",
		label: "Telhado",
		pattern: "tiles",
		colors: ["#a34a2f", "#5b5f66", "#7a5c3e", "#3d4a52"],
		scope: "roof",
	},
];

export const COLOR_SWATCHES = [
	"#ffffff",
	"#f5f1ea",
	"#e6e1d6",
	"#cfcfcf",
	"#8a8f94",
	"#3c4044",
	"#111111",
	"#e63946",
	"#f4a261",
	"#e9c46a",
	"#2a9d8f",
	"#264653",
	"#457b9d",
	"#a8dadc",
	"#6a994e",
	"#bc6c25",
	"#7f5539",
	"#b5838d",
	"#6d597a",
	"#9d4edd",
];

export const textureById = (id: string | null) =>
	TEXTURE_FAMILIES.find((t) => t.id === id) ?? null;

export const makeMaterial = (
	color = "#f3efe8",
	texture: string | null = null,
	scale = 1,
	rotation = 0,
): MaterialRef => ({
	texture,
	color,
	scale,
	rotation,
});

export const ROOM_TYPES: { id: RoomType; label: string; floor: MaterialRef }[] =
	[
		{
			id: "living",
			label: "Sala de estar",
			floor: makeMaterial("#c19a6b", "parquet"),
		},
		{
			id: "kitchen",
			label: "Cozinha",
			floor: makeMaterial("#f4f4f2", "tiles"),
		},
		{
			id: "bedroom",
			label: "Quarto",
			floor: makeMaterial("#c8a97e", "laminate"),
		},
		{
			id: "bathroom",
			label: "Banheiro",
			floor: makeMaterial("#cfe3e8", "tiles"),
		},
		{ id: "toilet", label: "Lavabo", floor: makeMaterial("#cfe3e8", "tiles") },
		{
			id: "hall",
			label: "Hall de entrada",
			floor: makeMaterial("#d9d3c7", "tiles"),
		},
		{
			id: "office",
			label: "Escritório",
			floor: makeMaterial("#b0b0a8", "laminate"),
		},
		{
			id: "balcony",
			label: "Varanda",
			floor: makeMaterial("#9aa0a6", "stone"),
		},
		{
			id: "dining",
			label: "Sala de jantar",
			floor: makeMaterial("#a97c50", "parquet"),
		},
		{
			id: "kids",
			label: "Quarto infantil",
			floor: makeMaterial("#9aa5b1", "carpet"),
		},
		{
			id: "guest",
			label: "Quarto de hóspedes",
			floor: makeMaterial("#c8a97e", "laminate"),
		},
		{
			id: "garage",
			label: "Garagem",
			floor: makeMaterial("#a7a9ab", "concrete"),
		},
		{
			id: "laundry",
			label: "Lavanderia",
			floor: makeMaterial("#d9d3c7", "tiles"),
		},
		{
			id: "storage",
			label: "Despensa",
			floor: makeMaterial("#c1c3c4", "concrete"),
		},
		{ id: "gym", label: "Academia", floor: makeMaterial("#3c4044", null) },
		{ id: "attic", label: "Sótão", floor: makeMaterial("#8b5e3c", "wood") },
		{
			id: "basement",
			label: "Porão",
			floor: makeMaterial("#8c8f91", "concrete"),
		},
		{
			id: "workshop",
			label: "Oficina",
			floor: makeMaterial("#a7a9ab", "concrete"),
		},
		{
			id: "playroom",
			label: "Sala de jogos",
			floor: makeMaterial("#6b7f73", "carpet"),
		},
		{
			id: "media",
			label: "Sala multimídia",
			floor: makeMaterial("#4a5568", "carpet"),
		},
		{
			id: "utility",
			label: "Área de serviço",
			floor: makeMaterial("#d9d3c7", "tiles"),
		},
		{ id: "studio", label: "Studio", floor: makeMaterial("#d3b186", "wood") },
		{ id: "other", label: "Outro", floor: makeMaterial("#e6e1d6", null) },
	];

export const roomTypeLabel = (t: RoomType) =>
	ROOM_TYPES.find((r) => r.id === t)?.label ?? t;
