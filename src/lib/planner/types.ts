// Planner domain model. All lengths are in centimetres, angles in degrees.

export type Point = { x: number; y: number };

export type MaterialRef = {
	/** Texture family id (see materials.ts). `null` means flat colour. */
	texture: string | null;
	color: string;
	/** Pattern scale multiplier. */
	scale: number;
	/** Pattern rotation in degrees. */
	rotation: number;
};

export type Wall = {
	id: string;
	a: Point;
	b: Point;
	thickness: number;
	/** Overrides the floor height when set. */
	height: number | null;
	/** Material on the left side (looking from a -> b) and right side. */
	left: MaterialRef;
	right: MaterialRef;
	/** Partition walls are thinner, interior-only walls. */
	partition: boolean;
	hidden: boolean;
};

export type RoomType =
	| "living"
	| "kitchen"
	| "bedroom"
	| "bathroom"
	| "toilet"
	| "hall"
	| "office"
	| "balcony"
	| "dining"
	| "kids"
	| "guest"
	| "garage"
	| "laundry"
	| "storage"
	| "gym"
	| "attic"
	| "basement"
	| "workshop"
	| "playroom"
	| "media"
	| "utility"
	| "studio"
	| "other";

export type Room = {
	id: string;
	name: string;
	type: RoomType;
	points: Point[];
	floor: MaterialRef;
	/** Extra ceiling height override. */
	ceiling: boolean;
	/** Raised/sunken floor offset relative to floor level. */
	floorOffset: number;
};

export type OpeningKind =
	| "door"
	| "window"
	| "arch"
	| "garage"
	| "doubleDoor"
	| "slidingDoor";

export type Opening = {
	id: string;
	wallId: string;
	kind: OpeningKind;
	/** Position of the opening centre along the wall, 0..1. */
	t: number;
	width: number;
	height: number;
	/** Height of the lower edge above the floor. */
	sill: number;
	flip: boolean;
	/** Opening direction (door swing side). */
	mirror: boolean;
	open: boolean;
	frame: MaterialRef;
};

export type Item = {
	id: string;
	catalogId: string;
	x: number;
	y: number;
	/** Footprint (cm) after scaling. */
	w: number;
	d: number;
	h: number;
	rotation: number;
	elevation: number;
	color: string;
	accent: string;
	locked: boolean;
	flipped: boolean;
	groupId: string | null;
	label: string;
	/** 2D stacking order (higher = on top). Unset = default order (see layers.ts). */
	z?: number;
};

export type Ruler = {
	id: string;
	a: Point;
	b: Point;
};

export type RoofKind = "none" | "gable" | "hip" | "flat" | "shed";

export type Roof = {
	kind: RoofKind;
	pitch: number;
	overhang: number;
	thickness: number;
	material: MaterialRef;
};

export type Stair = {
	id: string;
	x: number;
	y: number;
	rotation: number;
	width: number;
	length: number;
	steps: number;
	kind: "straight" | "l" | "spiral";
	color: string;
};

export type Floor = {
	id: string;
	name: string;
	height: number;
	walls: Wall[];
	rooms: Room[];
	openings: Opening[];
	items: Item[];
	rulers: Ruler[];
	stairs: Stair[];
	roof: Roof;
	visible: boolean;
	/** Display names of item groups (by groupId). */
	groupNames?: Record<string, string>;
};

export type Environment = {
	groundColor: string;
	sky: "day" | "evening" | "night" | "clear";
	showGround: boolean;
	north: number;
};

export type Project = {
	id: string;
	name: string;
	units: "metric" | "imperial";
	floors: Floor[];
	currentFloorId: string;
	environment: Environment;
	createdAt: string;
	updatedAt: string;
};

export type ToolId =
	| "select"
	| "pan"
	| "wall"
	| "partition"
	| "room"
	| "roomRect"
	| "door"
	| "window"
	| "ruler"
	| "eraser"
	| "item"
	| "stair";

export type SelectionKind =
	| "wall"
	| "room"
	| "opening"
	| "item"
	| "ruler"
	| "stair";

export type SelectionRef = { kind: SelectionKind; id: string };

export type ViewMode = "2d" | "3d" | "split";
