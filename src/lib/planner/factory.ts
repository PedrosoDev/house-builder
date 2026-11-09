import { itemById } from "./catalog";
import { uid, wallLength } from "./geometry";
import { makeMaterial, ROOM_TYPES } from "./materials";
import type {
	Environment,
	Floor,
	Item,
	Opening,
	OpeningKind,
	Point,
	Project,
	Roof,
	Room,
	RoomType,
	Wall,
} from "./types";

export const DEFAULT_WALL_THICKNESS = 20;
export const DEFAULT_PARTITION_THICKNESS = 10;
export const DEFAULT_FLOOR_HEIGHT = 270;

export const defaultRoof = (): Roof => ({
	kind: "none",
	pitch: 30,
	overhang: 40,
	thickness: 18,
	material: makeMaterial("#a34a2f", "roof"),
});

export const defaultEnvironment = (): Environment => ({
	groundColor: "#8fae7c",
	sky: "day",
	showGround: true,
	north: 0,
});

export function createFloor(name = "Piso 1"): Floor {
	return {
		id: uid("floor"),
		name,
		height: DEFAULT_FLOOR_HEIGHT,
		walls: [],
		rooms: [],
		openings: [],
		items: [],
		rulers: [],
		stairs: [],
		roof: defaultRoof(),
		visible: true,
	};
}

export function createProject(name = "Novo projeto"): Project {
	const floor = createFloor("Piso 1");
	const now = new Date().toISOString();
	return {
		id: uid("proj"),
		name,
		units: "metric",
		floors: [floor],
		currentFloorId: floor.id,
		environment: defaultEnvironment(),
		createdAt: now,
		updatedAt: now,
	};
}

export function createWall(
	a: Point,
	b: Point,
	partition = false,
	thickness?: number,
): Wall {
	return {
		id: uid("wall"),
		a: { ...a },
		b: { ...b },
		thickness:
			thickness ??
			(partition ? DEFAULT_PARTITION_THICKNESS : DEFAULT_WALL_THICKNESS),
		height: null,
		left: makeMaterial("#f5f1ea", "plaster"),
		right: makeMaterial("#f5f1ea", "plaster"),
		partition,
		hidden: false,
	};
}

export function createRoom(
	points: Point[],
	type: RoomType = "other",
	name?: string,
): Room {
	const def =
		ROOM_TYPES.find((r) => r.id === type) ?? ROOM_TYPES[ROOM_TYPES.length - 1];
	return {
		id: uid("room"),
		name: name ?? def.label,
		type,
		points: points.map((p) => ({ ...p })),
		floor: { ...def.floor },
		ceiling: true,
		floorOffset: 0,
	};
}

export function createOpening(
	wall: Wall,
	kind: OpeningKind,
	t: number,
	size?: { width?: number; height?: number; sill?: number; mirror?: boolean },
): Opening {
	const isWindow = kind === "window";
	const width =
		size?.width ??
		(kind === "doubleDoor"
			? 160
			: kind === "slidingDoor"
				? 180
				: kind === "garage"
					? 260
					: isWindow
						? 100
						: 90);
	const len = wallLength(wall) || 1;
	const half = width / 2 / len;
	return {
		id: uid("open"),
		wallId: wall.id,
		kind,
		t: Math.min(Math.max(t, half), 1 - half),
		width,
		height: size?.height ?? (isWindow ? 120 : kind === "garage" ? 230 : 210),
		sill: size?.sill ?? (isWindow ? 90 : 0),
		flip: false,
		mirror: size?.mirror ?? false,
		open: false,
		frame: makeMaterial("#ffffff", null),
	};
}

export function createItem(
	catalogId: string,
	x: number,
	y: number,
	rotation = 0,
): Item | null {
	const def = itemById(catalogId);
	if (!def) return null;
	return {
		id: uid("item"),
		catalogId,
		x,
		y,
		w: def.size[0],
		d: def.size[2],
		h: def.size[1],
		rotation,
		elevation: def.elevation ?? 0,
		color: def.color,
		accent: def.accent,
		locked: false,
		flipped: false,
		groupId: null,
		label: def.name,
	};
}

/** Adds four walls and a room for an axis-aligned rectangle (cm). */
export function addRectangleRoom(
	floor: Floor,
	x: number,
	y: number,
	w: number,
	d: number,
	type: RoomType = "other",
	opts: { partition?: boolean; name?: string } = {},
) {
	const pts: Point[] = [
		{ x, y },
		{ x: x + w, y },
		{ x: x + w, y: y + d },
		{ x, y: y + d },
	];
	for (let i = 0; i < 4; i++) {
		floor.walls.push(
			createWall(pts[i], pts[(i + 1) % 4], opts.partition ?? false),
		);
	}
	const inset = DEFAULT_WALL_THICKNESS / 2;
	const room = createRoom(
		[
			{ x: x + inset, y: y + inset },
			{ x: x + w - inset, y: y + inset },
			{ x: x + w - inset, y: y + d - inset },
			{ x: x + inset, y: y + d - inset },
		],
		type,
		opts.name,
	);
	floor.rooms.push(room);
	return room;
}

export function wallsNearSegment(floor: Floor, a: Point, b: Point) {
	return floor.walls.filter((w) => {
		const s1 =
			(w.a.x === a.x && w.a.y === a.y) || (w.b.x === a.x && w.b.y === a.y);
		const s2 =
			(w.a.x === b.x && w.a.y === b.y) || (w.b.x === b.x && w.b.y === b.y);
		return s1 && s2;
	});
}
