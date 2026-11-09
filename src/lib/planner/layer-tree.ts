import {
	pointInPolygon,
	polygonArea,
	projectOnSegment,
	wallLength,
} from "./geometry";
import { renderOrder } from "./layers";
import type {
	Floor,
	Item,
	OpeningKind,
	Point,
	Room,
	SelectionKind,
	SelectionRef,
	Wall,
} from "./types";

export type LayerKind = "section" | "group" | SelectionKind;
export type LayerNode = {
	id: string;
	kind: LayerKind;
	label: string;
	children?: LayerNode[];
	ref?: SelectionRef;
	locked?: boolean;
	/** Wall that belongs to more than one room. */
	shared?: boolean;
	/** Starts closed in the panel. */
	collapsed?: boolean;
};

const OPENING_LABEL: Record<OpeningKind, string> = {
	door: "Porta",
	window: "Janela",
	arch: "Arco",
	garage: "Portão de garagem",
	doubleDoor: "Porta dupla",
	slidingDoor: "Porta de correr",
};

const meters = (cm: number) => `${(cm / 100).toFixed(2).replace(".", ",")} m`;

const leaf = (
	kind: SelectionKind,
	id: string,
	label: string,
	locked?: boolean,
	idPrefix = "",
): LayerNode => ({
	id: `${idPrefix}${kind}:${id}`,
	kind,
	label,
	ref: { kind, id },
	locked,
});

/**
 * A wall belongs to a room when it lies within the room's footprint: every sample along it is inside the polygon or on its
 * outline (within the half wall thickness, plus a little slack). Covers the room's own walls, walls shared with a neighbour,
 * the walls of a room nested in it and partitions inside it; a wall that only touches the edge does not count.
 */
const wallInRoom = (w: Wall, room: Room): boolean => {
	const samples = Math.max(5, Math.ceil(wallLength(w) / 20));
	const reach = w.thickness / 2 + 8;
	for (let k = 0; k < samples; k++) {
		const t = 0.1 + (0.8 * k) / (samples - 1);
		const p = {
			x: w.a.x + (w.b.x - w.a.x) * t,
			y: w.a.y + (w.b.y - w.a.y) * t,
		};
		if (
			!pointInPolygon(p, room.points) &&
			distToOutline(p, room.points) > reach
		)
			return false;
	}
	return true;
};

/** Distance from `p` to the outline of a polygon. */
const distToOutline = (p: Point, poly: Point[]) =>
	Math.min(
		...poly.map(
			(a, k) => projectOnSegment(p, a, poly[(k + 1) % poly.length]).distance,
		),
	);

/**
 * The "layers tree" of a floor (Figma-style). Rooms are top-level nodes that contain their objects (and item groups) and
 * the doors/windows of their walls; nested rooms give the object to the smallest room around it. What is in no room goes
 * to the "items"/"openings" sections. Walls, stairs and rulers keep their own sections. Objects are listed top-most first
 * following the 2D stacking order; item groups (shared `groupId`, 2+ members) are expandable nodes placed at the position
 * of their top-most member.
 */
export function buildLayerTree(floor: Floor): LayerNode[] {
	const tree: LayerNode[] = [];
	const push = (name: string, label: string, children: LayerNode[]) => {
		if (children.length > 0)
			tree.push({ id: `section:${name}`, kind: "section", label, children });
	};

	// smallest room first, so "smallest room that contains it" is the first hit
	const bySize = [...floor.rooms].sort(
		(a, b) => polygonArea(a.points) - polygonArea(b.points),
	);
	const roomOfPoint = (p: Point, margin: number) =>
		bySize.find(
			(r) =>
				pointInPolygon(p, r.points) || distToOutline(p, r.points) <= margin,
		);

	const topFirst = [...renderOrder(floor.items)].reverse();
	const members = new Map<string, Item[]>();
	for (const it of topFirst)
		if (it.groupId)
			members.set(it.groupId, [...(members.get(it.groupId) ?? []), it]);
	const isGroup = (gid: string | null): gid is string =>
		!!gid && (members.get(gid)?.length ?? 0) > 1;

	const groupNumber = new Map<string, number>();
	for (const it of topFirst)
		if (isGroup(it.groupId) && !groupNumber.has(it.groupId))
			groupNumber.set(it.groupId, groupNumber.size + 1);

	// objects (a group is placed by its top-most member), bucketed per room
	const perRoom = new Map<string, LayerNode[]>();
	const loose: LayerNode[] = [];
	const emitted = new Set<string>();
	for (const it of topFirst) {
		let node: LayerNode;
		if (isGroup(it.groupId)) {
			const gid = it.groupId;
			if (emitted.has(gid)) continue;
			emitted.add(gid);
			node = {
				id: `group:${gid}`,
				kind: "group",
				label: floor.groupNames?.[gid] ?? `Grupo ${groupNumber.get(gid)}`,
				children: (members.get(gid) ?? []).map((m) =>
					leaf("item", m.id, m.label, m.locked),
				),
			};
		} else node = leaf("item", it.id, it.label, it.locked);
		const room = roomOfPoint({ x: it.x, y: it.y }, 0);
		if (room) perRoom.set(room.id, [...(perRoom.get(room.id) ?? []), node]);
		else loose.push(node);
	}

	// doors and windows go to the room whose walls they are in
	const looseOpenings: LayerNode[] = [];
	for (const o of floor.openings) {
		const node = leaf("opening", o.id, OPENING_LABEL[o.kind] ?? o.kind);
		const wall = floor.walls.find((w) => w.id === o.wallId);
		const room = wall
			? roomOfPoint(
					{
						x: wall.a.x + (wall.b.x - wall.a.x) * o.t,
						y: wall.a.y + (wall.b.y - wall.a.y) * o.t,
					},
					wall.thickness + 12,
				)
			: undefined;
		if (room) perRoom.set(room.id, [...(perRoom.get(room.id) ?? []), node]);
		else looseOpenings.push(node);
	}

	// walls: in every room they belong to (shared walls appear in each); the rest are "loose"
	const wallRooms = new Map<string, string[]>();
	for (const w of floor.walls)
		wallRooms.set(
			w.id,
			floor.rooms.filter((r) => wallInRoom(w, r)).map((r) => r.id),
		);

	for (const r of floor.rooms) {
		const kids = [...(perRoom.get(r.id) ?? [])];
		const mine = floor.walls.filter((w) => wallRooms.get(w.id)?.includes(r.id));
		if (mine.length > 0)
			kids.unshift({
				id: `room:${r.id}/walls`,
				kind: "section",
				label: "Paredes",
				collapsed: true,
				children: mine.map((w) => ({
					...leaf(
						"wall",
						w.id,
						`Parede ${meters(wallLength(w))}`,
						undefined,
						`room:${r.id}/`,
					),
					shared: (wallRooms.get(w.id)?.length ?? 0) > 1,
				})),
			});
		tree.push({
			id: `room:${r.id}`,
			kind: "room",
			label: r.name,
			ref: { kind: "room", id: r.id },
			children: kids,
		});
	}
	push("items", floor.rooms.length > 0 ? "Fora dos cômodos" : "Objetos", loose);
	push(
		"stairs",
		"Escadas",
		floor.stairs.map((s) => leaf("stair", s.id, "Escada")),
	);
	push(
		"openings",
		floor.rooms.length > 0
			? "Portas e janelas fora dos cômodos"
			: "Portas e janelas",
		looseOpenings,
	);
	push(
		"walls",
		floor.rooms.length > 0 ? "Paredes soltas" : "Paredes",
		floor.walls
			.filter((w) => (wallRooms.get(w.id)?.length ?? 0) === 0)
			.map((w) => leaf("wall", w.id, `Parede ${meters(wallLength(w))}`)),
	);
	push(
		"rulers",
		"Réguas",
		floor.rulers.map((r) => leaf("ruler", r.id, "Régua")),
	);
	return tree;
}

/** The selectable refs under a node (a leaf's own ref; a group/section's descendants). */
export function nodeRefs(node: LayerNode): SelectionRef[] {
	if (node.ref) return [node.ref];
	return (node.children ?? []).flatMap(nodeRefs);
}

export function selectionState(
	node: LayerNode,
	selection: SelectionRef[],
): "none" | "partial" | "all" {
	const refs = nodeRefs(node);
	if (refs.length === 0) return "none";
	const n = refs.filter((r) =>
		selection.some((s) => s.kind === r.kind && s.id === r.id),
	).length;
	return n === 0 ? "none" : n === refs.length ? "all" : "partial";
}
