import { useSyncExternalStore } from "react";
import { itemById } from "./catalog";
import {
	createFloor,
	createItem,
	createOpening,
	createRoom,
	createWall,
} from "./factory";
import { dist, projectOnSegment, uid, wallLength } from "./geometry";
import { moveJoint, shiftJoint } from "./joints";
import { type LayerOp, reorderLayers } from "./layers";
import { addRectangleRoomShared, afterWallAdded } from "./topology";
import type {
	Floor,
	Item,
	MaterialRef,
	OpeningKind,
	Point,
	Project,
	SelectionRef,
	ToolId,
	ViewMode,
} from "./types";
import {
	setWallLength as applyWallLength,
	MIN_WALL_LENGTH,
} from "./wall-resize";

/** What the user is dragging out of the catalog (HTML drag data is unreadable during dragover, so we keep it here). */
export type DragPayload =
	| { kind: "item"; id: string }
	| {
			kind: "opening";
			preset: {
				kind: OpeningKind;
				width: number;
				height: number;
				sill: number;
			};
	  };

export type PlannerState = {
	project: Project;
	tool: ToolId;
	selection: SelectionRef[];
	catalogItemId: string | null;
	openingPreset: {
		kind: OpeningKind;
		width: number;
		height: number;
		sill: number;
	} | null;
	snap: boolean;
	grid: number;
	showGrid: boolean;
	showDimensions: boolean;
	showRoomLabels: boolean;
	/** Snap moves to edges/centres of other objects (Figma-style smart guides). */
	smartGuides: boolean;
	/** When true a plain wheel zooms; by default it pans and Ctrl/pinch zooms (Figma model). */
	wheelZoom: boolean;
	view: ViewMode;
	camera: { x: number; y: number; zoom: number };
	past: Project[];
	future: Project[];
	dirty: boolean;
	savedAt: string | null;
	clipboard: Item[];
	dragPayload: DragPayload | null;
};

const MAX_HISTORY = 100;

function emptyState(project: Project): PlannerState {
	return {
		project,
		tool: "select",
		selection: [],
		catalogItemId: null,
		openingPreset: null,
		snap: true,
		grid: 10,
		showGrid: true,
		showDimensions: true,
		showRoomLabels: true,
		smartGuides: true,
		wheelZoom: false,
		view: "2d",
		camera: { x: 0, y: 0, zoom: 0.5 },
		past: [],
		future: [],
		dirty: false,
		savedAt: null,
		clipboard: [],
		dragPayload: null,
	};
}

export class PlannerStore {
	private state: PlannerState;
	private listeners = new Set<() => void>();
	private gestureBase: Project | null = null;

	constructor(project: Project) {
		this.state = emptyState(project);
	}

	subscribe = (fn: () => void) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};

	getState = () => this.state;

	private emit() {
		for (const l of this.listeners) l();
	}

	private set(patch: Partial<PlannerState>) {
		this.state = { ...this.state, ...patch };
		this.emit();
	}

	// ---- helpers

	get floor(): Floor {
		const p = this.state.project;
		return p.floors.find((f) => f.id === p.currentFloorId) ?? p.floors[0];
	}

	load(project: Project) {
		this.gestureBase = null;
		this.state = {
			...emptyState(project),
			view: this.state.view,
			snap: this.state.snap,
			grid: this.state.grid,
			showGrid: this.state.showGrid,
			showDimensions: this.state.showDimensions,
			showRoomLabels: this.state.showRoomLabels,
			smartGuides: this.state.smartGuides,
			wheelZoom: this.state.wheelZoom,
		};
		this.emit();
	}

	// ---- view / ui state

	setTool(tool: ToolId) {
		this.set({
			tool,
			selection: tool === "select" ? this.state.selection : [],
		});
	}
	setCatalogItem(id: string | null) {
		this.set({
			catalogItemId: id,
			tool: id ? "item" : this.state.tool,
			openingPreset: null,
		});
	}
	setOpeningPreset(
		preset: PlannerState["openingPreset"],
		tool: "door" | "window" = "door",
	) {
		this.set({
			openingPreset: preset,
			tool: preset ? tool : this.state.tool,
			catalogItemId: null,
		});
	}
	setDragPayload(dragPayload: DragPayload | null) {
		this.set({ dragPayload });
	}
	setView(view: ViewMode) {
		this.set({ view });
	}
	setCamera(camera: PlannerState["camera"]) {
		this.set({ camera });
	}
	setOption(
		patch: Partial<
			Pick<
				PlannerState,
				| "snap"
				| "grid"
				| "showGrid"
				| "showDimensions"
				| "showRoomLabels"
				| "smartGuides"
				| "wheelZoom"
			>
		>,
	) {
		this.set(patch);
	}
	select(selection: SelectionRef[]) {
		this.set({ selection });
	}
	toggleSelect(ref: SelectionRef) {
		const exists = this.state.selection.some(
			(s) => s.kind === ref.kind && s.id === ref.id,
		);
		this.set({
			selection: exists
				? this.state.selection.filter(
						(s) => !(s.kind === ref.kind && s.id === ref.id),
					)
				: [...this.state.selection, ref],
		});
	}
	markSaved(at: string) {
		this.set({ dirty: false, savedAt: at });
	}

	// ---- mutation core

	/** Apply a recorded mutation. */
	mutate(fn: (draft: Project) => void, opts: { record?: boolean } = {}) {
		const record = opts.record ?? this.gestureBase === null;
		const next = structuredClone(this.state.project);
		fn(next);
		next.updatedAt = new Date().toISOString();
		if (record) {
			this.set({
				project: next,
				past: [...this.state.past, this.state.project].slice(-MAX_HISTORY),
				future: [],
				dirty: true,
			});
		} else {
			this.set({ project: next, dirty: true });
		}
	}

	mutateFloor(
		fn: (floor: Floor, draft: Project) => void,
		opts: { record?: boolean } = {},
	) {
		this.mutate((p) => {
			const f = p.floors.find((x) => x.id === p.currentFloorId) ?? p.floors[0];
			fn(f, p);
		}, opts);
	}

	beginGesture() {
		if (this.gestureBase === null) this.gestureBase = this.state.project;
	}
	endGesture() {
		if (this.gestureBase === null) return;
		const base = this.gestureBase;
		this.gestureBase = null;
		if (base !== this.state.project) {
			this.set({
				past: [...this.state.past, base].slice(-MAX_HISTORY),
				future: [],
			});
		}
	}
	cancelGesture() {
		if (this.gestureBase === null) return;
		this.set({ project: this.gestureBase });
		this.gestureBase = null;
	}

	undo() {
		const { past, project, future } = this.state;
		if (past.length === 0) return;
		const prev = past[past.length - 1];
		this.set({
			project: prev,
			past: past.slice(0, -1),
			future: [project, ...future],
			selection: [],
			dirty: true,
		});
	}
	redo() {
		const { past, project, future } = this.state;
		if (future.length === 0) return;
		this.set({
			project: future[0],
			past: [...past, project],
			future: future.slice(1),
			selection: [],
			dirty: true,
		});
	}

	// ---- project level

	rename(name: string) {
		this.mutate((p) => {
			p.name = name;
		});
	}
	setUnits(units: Project["units"]) {
		this.mutate((p) => {
			p.units = units;
		});
	}
	setEnvironment(env: Partial<Project["environment"]>) {
		this.mutate((p) => {
			p.environment = { ...p.environment, ...env };
		});
	}

	// ---- floors

	addFloor(copyFrom?: string) {
		const id = uid("floor");
		this.mutate((p) => {
			const src = copyFrom ? p.floors.find((f) => f.id === copyFrom) : null;
			const n = p.floors.length + 1;
			const f: Floor = src
				? { ...structuredClone(src), id, name: `Piso ${n}` }
				: { ...createFloor(`Piso ${n}`), id };
			if (src) {
				const map = new Map<string, string>();
				f.walls.forEach((w) => {
					const nid = uid("wall");
					map.set(w.id, nid);
					w.id = nid;
				});
				f.openings.forEach((o) => {
					o.id = uid("open");
					o.wallId = map.get(o.wallId) ?? o.wallId;
				});
				f.rooms.forEach((r) => {
					r.id = uid("room");
				});
				f.items.forEach((i) => {
					i.id = uid("item");
				});
				f.rulers.forEach((r) => {
					r.id = uid("rul");
				});
				f.stairs = [];
			}
			p.floors.push(f);
			p.currentFloorId = id;
		});
		this.set({ selection: [] });
	}
	setCurrentFloor(id: string) {
		this.mutate(
			(p) => {
				p.currentFloorId = id;
			},
			{ record: false },
		);
		this.set({ selection: [] });
	}
	renameFloor(id: string, name: string) {
		this.mutate((p) => {
			const f = p.floors.find((x) => x.id === id);
			if (f) f.name = name;
		});
	}
	setFloorHeight(id: string, height: number) {
		this.mutate((p) => {
			const f = p.floors.find((x) => x.id === id);
			if (f) f.height = height;
		});
	}
	toggleFloorVisible(id: string) {
		this.mutate(
			(p) => {
				const f = p.floors.find((x) => x.id === id);
				if (f) f.visible = !f.visible;
			},
			{ record: false },
		);
	}
	deleteFloor(id: string) {
		if (this.state.project.floors.length <= 1) return;
		this.mutate((p) => {
			p.floors = p.floors.filter((f) => f.id !== id);
			if (p.currentFloorId === id) p.currentFloorId = p.floors[0].id;
		});
		this.set({ selection: [] });
	}
	moveFloor(id: string, dir: -1 | 1) {
		this.mutate((p) => {
			const i = p.floors.findIndex((f) => f.id === id);
			const j = i + dir;
			if (i < 0 || j < 0 || j >= p.floors.length) return;
			const [f] = p.floors.splice(i, 1);
			p.floors.splice(j, 0, f);
		});
	}

	// ---- creating

	addWall(a: Point, b: Point, partition = false) {
		if (dist(a, b) < 5) return null;
		let id = "";
		this.mutateFloor((f) => {
			const w = createWall(a, b, partition);
			id = w.id;
			f.walls.push(w);
			afterWallAdded(f, w);
		});
		return id;
	}

	addRoomPolygon(points: Point[]) {
		if (points.length < 3) return;
		this.mutateFloor((f) => {
			f.rooms.push(createRoom(points));
		});
	}

	addRectangleRoom(x: number, y: number, w: number, d: number) {
		if (w < 50 || d < 50) return;
		this.mutateFloor((f) => {
			addRectangleRoomShared(f, x, y, w, d);
		});
	}

	addOpening(
		wallId: string,
		kind: OpeningKind,
		t: number,
		size?: { width?: number; height?: number; sill?: number; mirror?: boolean },
	) {
		let id = "";
		this.mutateFloor((f) => {
			const wall = f.walls.find((w) => w.id === wallId);
			if (!wall) return;
			const o = createOpening(wall, kind, t, size);
			id = o.id;
			f.openings.push(o);
		});
		return id;
	}

	addItem(catalogId: string, x: number, y: number, rotation = 0) {
		const it = createItem(catalogId, x, y, rotation);
		if (!it) return null;
		this.mutateFloor((f) => {
			f.items.push(it);
		});
		this.set({ selection: [{ kind: "item", id: it.id }] });
		return it.id;
	}

	addRuler(a: Point, b: Point) {
		if (dist(a, b) < 5) return;
		this.mutateFloor((f) => {
			f.rulers.push({ id: uid("rul"), a, b });
		});
	}

	addStair(x: number, y: number) {
		this.mutateFloor((f) => {
			f.stairs.push({
				id: uid("stair"),
				x,
				y,
				rotation: 0,
				width: 100,
				length: 280,
				steps: 14,
				kind: "straight",
				color: "#c19a6b",
			});
		});
	}

	// ---- editing

	updateWall(id: string, patch: Partial<Floor["walls"][number]>) {
		this.mutateFloor((f) => {
			const w = f.walls.find((x) => x.id === id);
			if (w) Object.assign(w, patch);
		});
	}
	updateRoom(id: string, patch: Partial<Floor["rooms"][number]>) {
		this.mutateFloor((f) => {
			const r = f.rooms.find((x) => x.id === id);
			if (r) Object.assign(r, patch);
		});
	}
	updateOpening(id: string, patch: Partial<Floor["openings"][number]>) {
		this.mutateFloor((f) => {
			const o = f.openings.find((x) => x.id === id);
			if (o) Object.assign(o, patch);
		});
	}
	updateItem(id: string, patch: Partial<Item>) {
		this.mutateFloor((f) => {
			const i = f.items.find((x) => x.id === id);
			if (i) Object.assign(i, patch);
		});
	}
	updateStair(id: string, patch: Partial<Floor["stairs"][number]>) {
		this.mutateFloor((f) => {
			const s = f.stairs.find((x) => x.id === id);
			if (s) Object.assign(s, patch);
		});
	}
	updateRoof(patch: Partial<Floor["roof"]>, floorId?: string) {
		this.mutate((p) => {
			const f = p.floors.find((x) => x.id === (floorId ?? p.currentFloorId));
			if (f) f.roof = { ...f.roof, ...patch };
		});
	}

	setMaterial(
		target: "wallLeft" | "wallRight" | "wallBoth" | "roomFloor" | "itemColor",
		material: MaterialRef | string,
	) {
		const sel = this.state.selection;
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "wall") {
					const w = f.walls.find((x) => x.id === s.id);
					if (!w || typeof material === "string") continue;
					if (target === "wallLeft" || target === "wallBoth")
						w.left = { ...material };
					if (target === "wallRight" || target === "wallBoth")
						w.right = { ...material };
				}
				if (
					s.kind === "room" &&
					target === "roomFloor" &&
					typeof material !== "string"
				) {
					const r = f.rooms.find((x) => x.id === s.id);
					if (r) r.floor = { ...material };
				}
				if (
					s.kind === "item" &&
					target === "itemColor" &&
					typeof material === "string"
				) {
					const i = f.items.find((x) => x.id === s.id);
					if (i) i.color = material;
				}
			}
		});
	}

	moveSelection(dx: number, dy: number) {
		const sel = this.state.selection;
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "item") {
					const i = f.items.find((x) => x.id === s.id);
					if (i && !i.locked) {
						i.x += dx;
						i.y += dy;
					}
				} else if (s.kind === "wall") {
					const w = f.walls.find((x) => x.id === s.id);
					if (w) {
						moveWallWithJoints(f, w, dx, dy);
					}
				} else if (s.kind === "room") {
					const r = f.rooms.find((x) => x.id === s.id);
					if (r)
						for (const p of r.points) {
							p.x += dx;
							p.y += dy;
						}
				} else if (s.kind === "stair") {
					const st = f.stairs.find((x) => x.id === s.id);
					if (st) {
						st.x += dx;
						st.y += dy;
					}
				}
			}
		});
	}

	rotateSelection(deg: number) {
		const sel = this.state.selection;
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "item") {
					const i = f.items.find((x) => x.id === s.id);
					if (i && !i.locked)
						i.rotation = (((i.rotation + deg) % 360) + 360) % 360;
				}
				if (s.kind === "stair") {
					const st = f.stairs.find((x) => x.id === s.id);
					if (st) st.rotation = (((st.rotation + deg) % 360) + 360) % 360;
				}
			}
		});
	}

	/** Brings the selected items forward/back in the 2D stacking order (1 undo step). */
	reorderSelection(op: LayerOp) {
		const ids = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => s.id);
		if (ids.length === 0) return;
		this.mutateFloor((f) => reorderLayers(f.items, ids, op));
	}

	deleteSelection() {
		const sel = this.state.selection;
		if (sel.length === 0) return;
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "wall") {
					f.walls = f.walls.filter((w) => w.id !== s.id);
					f.openings = f.openings.filter((o) => o.wallId !== s.id);
				}
				if (s.kind === "room") f.rooms = f.rooms.filter((r) => r.id !== s.id);
				if (s.kind === "opening")
					f.openings = f.openings.filter((o) => o.id !== s.id);
				if (s.kind === "item") f.items = f.items.filter((i) => i.id !== s.id);
				if (s.kind === "ruler")
					f.rulers = f.rulers.filter((r) => r.id !== s.id);
				if (s.kind === "stair")
					f.stairs = f.stairs.filter((r) => r.id !== s.id);
			}
			tidyGroups(f);
		});
		this.set({ selection: [] });
	}

	/** Duplicates items, rooms and stairs of the selection and selects the copies. */
	duplicateSelection(offset = 30) {
		const sel = this.state.selection;
		const created: SelectionRef[] = [];
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "item") {
					const i = f.items.find((x) => x.id === s.id);
					if (!i) continue;
					const copy = {
						...structuredClone(i),
						id: uid("item"),
						x: i.x + offset,
						y: i.y + offset,
						groupId: null,
					};
					f.items.push(copy);
					created.push({ kind: "item", id: copy.id });
				}
				if (s.kind === "room") {
					const r = f.rooms.find((x) => x.id === s.id);
					if (!r) continue;
					const copy = {
						...structuredClone(r),
						id: uid("room"),
						points: r.points.map((p) => ({
							x: p.x + offset,
							y: p.y + offset,
						})),
					};
					f.rooms.push(copy);
					created.push({ kind: "room", id: copy.id });
				}
				if (s.kind === "stair") {
					const st = f.stairs.find((x) => x.id === s.id);
					if (!st) continue;
					const copy = {
						...structuredClone(st),
						id: uid("stair"),
						x: st.x + 40,
						y: st.y + 40,
					};
					f.stairs.push(copy);
					created.push({ kind: "stair", id: copy.id });
				}
			}
		});
		if (created.length) this.set({ selection: created });
	}

	copySelection() {
		const f = this.floor;
		const items = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => f.items.find((i) => i.id === s.id))
			.filter((i): i is Item => !!i)
			.map((i) => structuredClone(i));
		if (items.length) this.set({ clipboard: items });
	}
	paste() {
		const clip = this.state.clipboard;
		if (clip.length === 0) return;
		const created: SelectionRef[] = [];
		this.mutateFloor((f) => {
			for (const i of clip) {
				const copy = {
					...structuredClone(i),
					id: uid("item"),
					x: i.x + 40,
					y: i.y + 40,
					groupId: null,
				};
				f.items.push(copy);
				created.push({ kind: "item", id: copy.id });
			}
		});
		this.set({ selection: created });
	}

	groupSelection() {
		const ids = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => s.id);
		if (ids.length < 2) return;
		const gid = uid("group");
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.groupId = gid;
		});
	}
	ungroupSelection() {
		const ids = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => s.id);
		this.mutateFloor((f) => {
			const groups = new Set(
				f.items
					.filter((i) => ids.includes(i.id) && i.groupId)
					.map((i) => i.groupId),
			);
			for (const i of f.items)
				if (i.groupId && groups.has(i.groupId)) i.groupId = null;
			tidyGroups(f);
		});
	}

	setItemsLocked(ids: string[], locked: boolean) {
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.locked = locked;
		});
	}

	/** Sets (or clears, when blank) the display name of a group. */
	renameGroup(groupId: string, name: string) {
		this.mutateFloor((f) => {
			const clean = name.trim();
			const names = { ...(f.groupNames ?? {}) };
			if (clean) names[groupId] = clean;
			else delete names[groupId];
			f.groupNames = names;
		});
	}

	/** Takes items out of their groups; groups left with fewer than 2 members dissolve. */
	removeFromGroup(ids: string[]) {
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.groupId = null;
			tidyGroups(f);
		});
	}

	addToGroup(ids: string[], groupId: string) {
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.groupId = groupId;
			tidyGroups(f);
		});
	}

	lockSelection(locked: boolean) {
		const ids = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => s.id);
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.locked = locked;
		});
	}

	flipSelection() {
		const ids = this.state.selection
			.filter((s) => s.kind === "item")
			.map((s) => s.id);
		this.mutateFloor((f) => {
			for (const i of f.items) if (ids.includes(i.id)) i.flipped = !i.flipped;
		});
		const openIds = this.state.selection
			.filter((s) => s.kind === "opening")
			.map((s) => s.id);
		if (openIds.length)
			this.mutateFloor((f) => {
				for (const o of f.openings)
					if (openIds.includes(o.id)) o.flip = !o.flip;
			});
	}

	/** Splits the selected wall in two at its midpoint. */
	splitSelectedWall() {
		const sel = this.state.selection.find((s) => s.kind === "wall");
		if (!sel) return;
		this.mutateFloor((f) => {
			const w = f.walls.find((x) => x.id === sel.id);
			if (!w) return;
			const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
			const second = createWall(mid, w.b, w.partition, w.thickness);
			second.left = { ...w.left };
			second.right = { ...w.right };
			w.b = mid;
			f.walls.push(second);
		});
	}

	resetMaterials() {
		const sel = this.state.selection;
		this.mutateFloor((f) => {
			for (const s of sel) {
				if (s.kind === "item") {
					const i = f.items.find((x) => x.id === s.id);
					const def = i && itemById(i.catalogId);
					if (i && def) {
						i.color = def.color;
						i.accent = def.accent;
					}
				}
				if (s.kind === "wall") {
					const w = f.walls.find((x) => x.id === s.id);
					if (w) {
						w.left = {
							texture: "plaster",
							color: "#f5f1ea",
							scale: 1,
							rotation: 0,
						};
						w.right = {
							texture: "plaster",
							color: "#f5f1ea",
							scale: 1,
							rotation: 0,
						};
					}
				}
			}
		});
	}

	/** Remove everything on the current floor. */
	clearFloor() {
		this.mutateFloor((f) => {
			f.walls = [];
			f.rooms = [];
			f.openings = [];
			f.items = [];
			f.rulers = [];
			f.stairs = [];
		});
		this.set({ selection: [] });
	}

	/** Sets a wall length (cm); connected walls and rooms follow. One undo step. */
	setWallLength(id: string, length: number) {
		if (!Number.isFinite(length) || length < MIN_WALL_LENGTH) return;
		if (!this.floor.walls.some((w) => w.id === id)) return;
		this.mutateFloor((f) => {
			applyWallLength(f, id, length);
		});
	}

	moveJoint(from: Point, to: Point) {
		this.mutateFloor((f) => moveJoint(f, from, to));
	}

	nearestWall(p: Point, maxDist = 40) {
		let best: {
			wall: Floor["walls"][number];
			t: number;
			distance: number;
		} | null = null;
		for (const w of this.floor.walls) {
			const pr = projectOnSegment(p, w.a, w.b);
			if (pr.distance < maxDist && (!best || pr.distance < best.distance))
				best = { wall: w, t: pr.t, distance: pr.distance };
		}
		return best;
	}

	wallLengthOf(id: string) {
		const w = this.floor.walls.find((x) => x.id === id);
		return w ? wallLength(w) : 0;
	}
}

/** Moves a wall and every wall end point that shares its joints, so rooms stay connected. */
function moveWallWithJoints(
	f: Floor,
	wall: Floor["walls"][number],
	dx: number,
	dy: number,
) {
	const oldA = { ...wall.a };
	const oldB = { ...wall.b };
	shiftJoint(f, oldA, dx, dy);
	shiftJoint(f, oldB, dx, dy);
}

export { moveJoint };

// ---- React bindings

export function usePlanner<T>(
	store: PlannerStore,
	selector: (s: PlannerState) => T,
): T {
	return useSyncExternalStore(
		store.subscribe,
		() => selector(store.getState()),
		() => selector(store.getState()),
	);
}

export function currentFloorOf(project: Project): Floor {
	return (
		project.floors.find((f) => f.id === project.currentFloorId) ??
		project.floors[0]
	);
}

/** Dissolves groups with fewer than 2 members and forgets the names of groups that no longer exist. */
function tidyGroups(f: Floor) {
	const count = new Map<string, number>();
	for (const i of f.items)
		if (i.groupId) count.set(i.groupId, (count.get(i.groupId) ?? 0) + 1);
	for (const i of f.items)
		if (i.groupId && (count.get(i.groupId) ?? 0) < 2) i.groupId = null;
	if (f.groupNames) {
		const alive = Object.fromEntries(
			Object.entries(f.groupNames).filter(([g]) => (count.get(g) ?? 0) >= 2),
		);
		f.groupNames = alive;
	}
}
