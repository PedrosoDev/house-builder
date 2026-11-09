import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ContextMenu,
	ContextMenuTrigger,
} from "#/components/ui/context-menu.tsx";
import {
	axisPairs,
	guidesForPoint,
	hitsToGuides,
	jointRefs,
	type ShiftPair,
	snapPointToAxes,
	snapShiftToAxes,
} from "#/lib/planner/axis-stick";
import {
	type Box,
	boxOfFloor,
	boxOfPoints,
	boxOfRef,
	boxOfRefs,
	unionBox,
	wallFaceBoxes,
} from "#/lib/planner/bounds";
import {
	type Camera,
	fitBox,
	type Insets,
	interpretWheel,
	NO_INSETS,
	nextZoomStep,
	tweenCamera,
	zoomAt,
} from "#/lib/planner/camera";
import { itemById } from "#/lib/planner/catalog";
import { snapDrawPoint } from "#/lib/planner/draw-snap";
import {
	dist,
	formatLength,
	lerp,
	pointInPolygon,
	projectOnSegment,
	rectCorners,
	snapValue,
} from "#/lib/planner/geometry";
import { placeItem, snapOpening } from "#/lib/planner/placement";
import {
	type Guide,
	type Measure,
	measureBetween,
	snapBoxMove,
} from "#/lib/planner/snapping";
import {
	currentFloorOf,
	type DragPayload,
	moveJoint,
	type PlannerStore,
	usePlanner,
} from "#/lib/planner/store";
import { healAfterMove } from "#/lib/planner/topology";
import type {
	Floor,
	Item,
	Opening,
	Point,
	SelectionRef,
	Wall,
} from "#/lib/planner/types";
import { itemsAttachedToWalls } from "#/lib/planner/wall-items";
import { PlanContextMenuContent } from "./plan-context-menu";
import { PlanOverlay } from "./plan-overlay";
import { PlanScene } from "./plan-scene";
import { RoomRename } from "./room-rename";
import { ViewportGrid } from "./viewport-grid";
import { WallLengthEdit } from "./wall-length-edit";
import { ZoomControls } from "./zoom-controls";

type Props = {
	store: PlannerStore;
	/** Parts of the canvas covered by floating panels (fit, zoom pill, rulers and hints respect them). */
	insets?: Insets;
};

type Ptr = {
	clientX: number;
	clientY: number;
	shiftKey: boolean;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
};

type Drag =
	| { type: "pan"; sx: number; sy: number; ox: number; oy: number }
	| {
			type: "move";
			start: Point;
			base: Floor;
			targets: SelectionRef[];
			walls: Set<string>;
			items: Set<string>;
			roomIds: Set<string>;
			stairs: Set<string>;
			baseBox: Box | null;
			pairs: ShiftPair[];
			/** Items glued to the moved walls: they are carried along. */
			ride: Set<string>;
			others: Box[];
			moved: boolean;
	  }
	| { type: "joint"; wallId: string; end: "a" | "b" }
	| { type: "vertex"; roomId: string; index: number }
	| {
			type: "rotate";
			id: string;
			center: Point;
			startAngle: number;
			startRot: number;
	  }
	| {
			type: "resize";
			id: string;
			kind: "item" | "stair";
			hx: number;
			hy: number;
			base: { x: number; y: number; w: number; d: number; rot: number };
	  }
	| { type: "opening"; id: string }
	| { type: "marquee"; start: Point; additive: boolean }
	| { type: "roomRect"; start: Point }
	| { type: "ruler"; start: Point };

/** How far (screen px) the pointer must go past a horizontal/vertical alignment before a wall may tilt. */
const AXIS_STICK_PX = 16;

const ENTITY_KINDS = ["wall", "room", "opening", "item", "ruler", "stair"];
const EDGE = 28;

export function PlanCanvas({ store, insets = NO_INSETS }: Props) {
	const insetsRef = useRef(insets);
	insetsRef.current = insets;
	const project = usePlanner(store, (s) => s.project);
	const tool = usePlanner(store, (s) => s.tool);
	const selection = usePlanner(store, (s) => s.selection);
	const catalogItemId = usePlanner(store, (s) => s.catalogItemId);
	const openingPreset = usePlanner(store, (s) => s.openingPreset);
	const showGrid = usePlanner(store, (s) => s.showGrid);
	const showDimensions = usePlanner(store, (s) => s.showDimensions);
	const showRoomLabels = usePlanner(store, (s) => s.showRoomLabels);
	const cam = usePlanner(store, (s) => s.camera);
	const dragPayload = usePlanner(store, (s) => s.dragPayload);

	const floor = currentFloorOf(project);
	const floorIndex = project.floors.findIndex((f) => f.id === floor.id);
	const below = floorIndex > 0 ? project.floors[floorIndex - 1] : null;
	const units = project.units;

	const wrapRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ w: 800, h: 600 });
	const sizeRef = useRef(size);
	sizeRef.current = size;
	const camRef = useRef<Camera>(cam);
	camRef.current = cam;

	const [cursor, setCursor] = useState<Point | null>(null);
	const [hover, setHover] = useState<SelectionRef | null>(null);
	const [chain, setChain] = useState<{
		start: Point;
		first: Point;
		count: number;
	} | null>(null);
	const [polyDraft, setPolyDraft] = useState<Point[]>([]);
	const [draft, setDraft] = useState<{
		kind: "rect" | "ruler";
		a: Point;
		b: Point;
	} | null>(null);
	const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
	const [guides, setGuides] = useState<Guide[]>([]);
	const [badge, setBadge] = useState<{
		x: number;
		y: number;
		text: string;
	} | null>(null);
	const [ghostRotation, setGhostRotation] = useState(0);
	const [spaceDown, setSpaceDown] = useState(false);
	const [altDown, setAltDown] = useState(false);
	const [ctrlDown, setCtrlDown] = useState(false);
	/** Gaps/guides/wall shown while an existing opening is dragged along walls. */
	const [openingDrag, setOpeningDrag] = useState<{
		wall: Wall;
		gaps: Measure[];
		guides: Guide[];
	} | null>(null);
	const lastWall = useRef<string | null>(null);
	const ghostRotationRef = useRef(0);
	const [panning, setPanning] = useState(false);
	const [renaming, setRenaming] = useState<string | null>(null);
	const [editingWall, setEditingWall] = useState<string | null>(null);
	const drag = useRef<Drag | null>(null);
	const lastPtr = useRef<Ptr | null>(null);
	const edgeRaf = useRef(0);
	const tween = useRef<(() => void) | null>(null);
	const autoFit = useRef(true);
	const insetsKey = `${insets.left}|${insets.right}|${insets.top}|${insets.bottom}`;
	const cursorRaf = useRef(0);

	// ---------------------------------------------------------------- camera

	const cancelTween = () => {
		tween.current?.();
		tween.current = null;
	};
	const setCam = useCallback(
		(c: Camera) => {
			camRef.current = c;
			store.setCamera(c);
		},
		[store],
	);
	const animateTo = useCallback(
		(target: Camera, animate = true) => {
			cancelTween();
			autoFit.current = false;
			if (!animate || sizeRef.current.w < 50) setCam(target);
			else
				tween.current = tweenCamera(
					camRef.current,
					target,
					sizeRef.current,
					setCam,
					220,
				);
		},
		[setCam],
	);
	const fitView = useCallback(
		(selectionOnly: boolean, animate = true) => {
			const st = store.getState();
			const f = currentFloorOf(st.project);
			const box =
				selectionOnly && st.selection.length
					? boxOfRefs(f, st.selection)
					: boxOfFloor(f);
			animateTo(
				fitBox(box, sizeRef.current, {
					padding: 56,
					maxZoom: selectionOnly ? 4 : 2,
					insets: insetsRef.current,
				}),
				animate,
			);
		},
		[store, animateTo],
	);
	const zoomTo = useCallback(
		(zoom: number) => {
			const { w, h } = sizeRef.current;
			const ins = insetsRef.current;
			animateTo(
				zoomAt(
					camRef.current,
					zoom,
					ins.left + (w - ins.left - ins.right) / 2,
					ins.top + (h - ins.top - ins.bottom) / 2,
				),
			);
		},
		[animateTo],
	);
	const zoomStep = useCallback(
		(dir: 1 | -1) => zoomTo(nextZoomStep(camRef.current.zoom, dir)),
		[zoomTo],
	);

	useEffect(() => {
		const el = wrapRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() =>
			setSize({ w: el.clientWidth, h: el.clientHeight }),
		);
		ro.observe(el);
		setSize({ w: el.clientWidth, h: el.clientHeight });
		return () => ro.disconnect();
	}, []);

	// Keep the plan framed while the layout settles, until the user pans or zooms.
	useEffect(() => {
		if (size.w < 50 || !autoFit.current) return;
		const st = store.getState();
		const box = boxOfFloor(currentFloorOf(st.project));
		setCam(
			fitBox(box, size, {
				padding: 56,
				insets: insetsRef.current,
			}),
		);
	}, [size, insetsKey, store, setCam]);

	useEffect(() => {
		const h = () => fitView(false);
		window.addEventListener("planner:fit", h);
		return () => window.removeEventListener("planner:fit", h);
	}, [fitView]);

	// Figma wheel model: scroll pans, Ctrl/⌘ + scroll or pinch zooms around the cursor.
	useEffect(() => {
		const el = wrapRef.current;
		if (!el) return;
		const onWheel = (e: WheelEvent) => {
			if ((e.target as HTMLElement).closest("[data-no-wheel]")) return;
			e.preventDefault();
			cancelTween();
			autoFit.current = false;
			const rect = el.getBoundingClientRect();
			const intent = interpretWheel(e, rect.height, store.getState().wheelZoom);
			const c = camRef.current;
			if (intent.kind === "zoom")
				setCam(
					zoomAt(
						c,
						c.zoom * intent.factor,
						e.clientX - rect.left,
						e.clientY - rect.top,
					),
				);
			else setCam({ ...c, x: c.x + intent.dx, y: c.y + intent.dy });
		};
		el.addEventListener("wheel", onWheel, { passive: false });
		return () => el.removeEventListener("wheel", onWheel);
	}, [store, setCam]);

	// ---------------------------------------------------------------- helpers

	const toWorld = useCallback((e: { clientX: number; clientY: number }) => {
		const rect = wrapRef.current?.getBoundingClientRect();
		const c = camRef.current;
		return {
			x: (e.clientX - (rect?.left ?? 0) - c.x) / c.zoom,
			y: (e.clientY - (rect?.top ?? 0) - c.y) / c.zoom,
		};
	}, []);

	const isFree = (e: Pick<Ptr, "ctrlKey" | "metaKey">) =>
		e.ctrlKey || e.metaKey;

	const snapPt = useCallback(
		(p: Point, opts: { anchor?: Point; free?: boolean } = {}): Point => {
			const st = store.getState();
			return snapDrawPoint(currentFloorOf(st.project), p, {
				zoom: camRef.current.zoom,
				grid: st.grid,
				snap: st.snap,
				free: !!opts.free,
				anchor: opts.anchor,
			});
		},
		[store],
	);

	const hitOf = (target: EventTarget | null) => {
		let el = target as Element | null;
		while (el && el !== wrapRef.current) {
			const ds = (el as HTMLElement).dataset;
			if (ds?.kind) return { kind: ds.kind, id: ds.id ?? "", extra: ds.extra };
			el = el.parentElement;
		}
		return null;
	};

	const isSelected = (kind: string, id: string) =>
		store.getState().selection.some((s) => s.kind === kind && s.id === id);

	/**
	 * One placement pipeline for everything being added: hover preview, click, catalog drag-and-drop.
	 * Items magnetise to walls and align to other objects; openings glue to the best wall (see placement.ts).
	 */
	const computePlacement = useCallback(
		(p: Point, placing: DragPayload, free: boolean) => {
			const st = store.getState();
			const f = currentFloorOf(st.project);
			const o = {
				zoom: camRef.current.zoom,
				grid: st.grid,
				snap: st.snap,
				smartGuides: st.smartGuides,
				free,
				preferWallId: lastWall.current,
			};
			if (placing.kind === "item") {
				const def = itemById(placing.id);
				if (!def) return null;
				return {
					kind: "item" as const,
					def,
					r: placeItem(f, def, p, ghostRotationRef.current, o),
				};
			}
			const r = snapOpening(f, p, placing.preset.width, o);
			return r ? { kind: "opening" as const, preset: placing.preset, r } : null;
		},
		[store],
	);

	// ---------------------------------------------------------------- pointer

	const cancelDraft = () => {
		setChain(null);
		setPolyDraft([]);
		setDraft(null);
		setMarquee(null);
		setGuides([]);
		setBadge(null);
		if (drag.current && drag.current.type !== "pan") store.cancelGesture();
		drag.current = null;
	};

	const beginPan = (e: React.PointerEvent) => {
		cancelTween();
		autoFit.current = false;
		wrapRef.current?.setPointerCapture(e.pointerId);
		setPanning(true);
		drag.current = {
			type: "pan",
			sx: e.clientX,
			sy: e.clientY,
			ox: camRef.current.x,
			oy: camRef.current.y,
		};
	};

	const startMove = (start: Point, sel: SelectionRef[], duplicate: boolean) => {
		store.beginGesture();
		let working = sel;
		if (
			duplicate &&
			sel.length > 0 &&
			sel.every(
				(s) => s.kind === "item" || s.kind === "room" || s.kind === "stair",
			)
		) {
			store.duplicateSelection(0);
			working = store.getState().selection;
		}
		const f = store.floor;
		const walls = new Set<string>();
		const items = new Set<string>();
		const roomIds = new Set<string>();
		const stairs = new Set<string>();
		for (const s of working) {
			if (s.kind === "wall") walls.add(s.id);
			if (s.kind === "item") items.add(s.id);
			if (s.kind === "stair") stairs.add(s.id);
			if (s.kind === "room") {
				roomIds.add(s.id);
				const room = f.rooms.find((r) => r.id === s.id);
				if (!room) continue;
				for (const w of f.walls) {
					const near = (p: Point) =>
						room.points.some((_, k) => {
							const pr = projectOnSegment(
								p,
								room.points[k],
								room.points[(k + 1) % room.points.length],
							);
							return pr.distance < w.thickness + 8;
						});
					if (near(w.a) && near(w.b)) walls.add(w.id);
				}
				for (const it of f.items)
					if (pointInPolygon({ x: it.x, y: it.y }, room.points))
						items.add(it.id);
			}
		}
		// What moves, and what it can snap to (Figma smart guides).
		let baseBox: Box | null = null;
		const others: Box[] = [];
		for (const it of f.items) {
			const b = boxOfRef(f, { kind: "item", id: it.id });
			if (!b) continue;
			if (items.has(it.id)) baseBox = unionBox(baseBox, b);
			else others.push(b);
		}
		for (const s of f.stairs) {
			const b = boxOfRef(f, { kind: "stair", id: s.id });
			if (!b) continue;
			if (stairs.has(s.id)) baseBox = unionBox(baseBox, b);
			else others.push(b);
		}
		for (const r of f.rooms) {
			const b = boxOfPoints(r.points);
			if (!b) continue;
			if (roomIds.has(r.id)) baseBox = unionBox(baseBox, b);
			else others.push(b);
		}
		for (const w of f.walls) {
			if (walls.has(w.id)) {
				baseBox = unionBox(baseBox, boxOfPoints([w.a, w.b]));
			} else others.push(...wallFaceBoxes(w));
		}
		drag.current = {
			type: "move",
			start,
			base: structuredClone(f),
			targets: working,
			walls,
			items,
			roomIds,
			stairs,
			baseBox,
			pairs: axisPairs(f, walls),
			ride: itemsAttachedToWalls(f, walls),
			others,
			moved: false,
		};
	};

	const applyMove = (d: Extract<Drag, { type: "move" }>, e: Ptr) => {
		const raw = toWorld(e);
		let dx = raw.x - d.start.x;
		let dy = raw.y - d.start.y;
		const zoom = camRef.current.zoom;
		if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return;
		d.moved = true;
		if (e.shiftKey) {
			if (Math.abs(dx) > Math.abs(dy)) dy = 0;
			else dx = 0;
		}
		const st = store.getState();
		const free = isFree(e);
		let snappedX = false;
		let snappedY = false;
		let nextGuides: Guide[] = [];
		let axisX = false;
		let axisY = false;
		if (!free && st.snap && d.pairs.length) {
			// Diagonals take a deliberate extra movement: side-effect walls stick to the axes first.
			const a = snapShiftToAxes(d.pairs, dx, dy, AXIS_STICK_PX / zoom);
			if (a.snappedX && !(e.shiftKey && dx === 0)) {
				dx = a.dx;
				axisX = snappedX = true;
			}
			if (a.snappedY && !(e.shiftKey && dy === 0)) {
				dy = a.dy;
				axisY = snappedY = true;
			}
			if (axisX || axisY) nextGuides = hitsToGuides(a.hits);
		}
		if (!free && st.smartGuides && d.baseBox) {
			const r = snapBoxMove(
				{
					minX: d.baseBox.minX + dx,
					maxX: d.baseBox.maxX + dx,
					minY: d.baseBox.minY + dy,
					maxY: d.baseBox.maxY + dy,
				},
				d.others,
				6 / zoom,
			);
			if (r.snapX && !axisX && !(e.shiftKey && dx === 0)) {
				dx += r.dx;
				snappedX = true;
			}
			if (r.snapY && !axisY && !(e.shiftKey && dy === 0)) {
				dy += r.dy;
				snappedY = true;
			}
			if ((snappedX && !axisX) || (snappedY && !axisY))
				nextGuides = [...nextGuides, ...r.guides];
		}
		if (!free && st.snap) {
			if (!snappedX) dx = snapValue(dx, st.grid);
			if (!snappedY) dy = snapValue(dy, st.grid);
		}
		setGuides((prev) =>
			prev.length === 0 && nextGuides.length === 0 ? prev : nextGuides,
		);

		const base = d.base;
		store.mutateFloor(
			(f) => {
				const movedJoints: Point[] = [];
				for (const bw of base.walls)
					if (d.walls.has(bw.id)) movedJoints.push(bw.a, bw.b);
				const isMoved = (p: Point) => movedJoints.some((m) => dist(m, p) < 1);
				for (const w of f.walls) {
					const bw = base.walls.find((x) => x.id === w.id);
					if (!bw) continue;
					w.a = isMoved(bw.a)
						? { x: bw.a.x + dx, y: bw.a.y + dy }
						: { ...bw.a };
					w.b = isMoved(bw.b)
						? { x: bw.b.x + dx, y: bw.b.y + dy }
						: { ...bw.b };
				}
				for (const r of f.rooms) {
					const br = base.rooms.find((x) => x.id === r.id);
					if (!br) continue;
					if (d.roomIds.has(r.id))
						r.points = br.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
					else if (d.roomIds.size === 0)
						r.points = br.points.map((p) =>
							movedJoints.some((m) => dist(m, p) < 25)
								? { x: p.x + dx, y: p.y + dy }
								: { ...p },
						);
				}
				for (const it of f.items) {
					const bi = base.items.find((x) => x.id === it.id);
					if (bi && (d.items.has(it.id) || d.ride.has(it.id)) && !bi.locked) {
						it.x = bi.x + dx;
						it.y = bi.y + dy;
					}
				}
				for (const s of f.stairs) {
					const bs = base.stairs.find((x) => x.id === s.id);
					if (bs && d.stairs.has(s.id)) {
						s.x = bs.x + dx;
						s.y = bs.y + dy;
					}
				}
				for (const rl of f.rulers) {
					const br = base.rulers.find((x) => x.id === rl.id);
					if (
						br &&
						d.targets.some((t) => t.kind === "ruler" && t.id === rl.id)
					) {
						rl.a = { x: br.a.x + dx, y: br.a.y + dy };
						rl.b = { x: br.b.x + dx, y: br.b.y + dy };
					}
				}
			},
			{ record: false },
		);
	};

	/** Leftover split points of the side walls disappear when a drag ends (the side wall just gets longer). */
	const healWalls = (ids: Set<string>) => {
		if (ids.size === 0) return;
		const prefer = new Set(
			store
				.getState()
				.selection.filter((x) => x.kind === "wall")
				.map((x) => x.id),
		);
		store.mutateFloor((f) => healAfterMove(f, ids, prefer), { record: false });
	};

	const startEdgePan = () => {
		if (edgeRaf.current) return;
		const loop = () => {
			const d = drag.current;
			const p = lastPtr.current;
			const el = wrapRef.current;
			if (!d || d.type === "pan" || !p || !el) {
				edgeRaf.current = 0;
				return;
			}
			const rect = el.getBoundingClientRect();
			const x = p.clientX - rect.left;
			const y = p.clientY - rect.top;
			const speed = (edge: number) =>
				edge > 0 ? Math.min(1, edge / EDGE) * 14 : 0;
			const vx = speed(EDGE - x) - speed(x - (rect.width - EDGE));
			const vy = speed(EDGE - y) - speed(y - (rect.height - EDGE));
			if (vx !== 0 || vy !== 0) {
				const c = camRef.current;
				setCam({ ...c, x: c.x + vx, y: c.y + vy });
				handlePointerMove(p);
			}
			edgeRaf.current = requestAnimationFrame(loop);
		};
		edgeRaf.current = requestAnimationFrame(loop);
	};
	useEffect(
		() => () => {
			cancelAnimationFrame(edgeRaf.current);
			cancelAnimationFrame(cursorRaf.current);
			cancelTween();
		},
		[],
	);

	const onPointerDown = (e: React.PointerEvent) => {
		cancelTween();
		if (e.pointerType === "mouse" && e.button === 1) {
			e.preventDefault();
			beginPan(e);
			return;
		}
		if (e.button === 2) {
			if (chain || polyDraft.length) cancelDraft();
			return;
		}
		if (e.button !== 0) return;
		const st = store.getState();
		wrapRef.current?.setPointerCapture(e.pointerId);
		lastPtr.current = e;
		const raw = toWorld(e);
		const free = isFree(e);

		if (spaceDown || st.tool === "pan") {
			beginPan(e);
			return;
		}

		switch (st.tool) {
			case "wall":
			case "partition": {
				const p = snapPt(raw, { anchor: chain?.start, free });
				if (!chain) {
					setChain({ start: p, first: p, count: 0 });
					return;
				}
				if (dist(p, chain.start) < 5) return;
				store.addWall(chain.start, p, st.tool === "partition");
				const closed = chain.count >= 1 && dist(p, chain.first) < 2;
				if (closed) setChain(null);
				else setChain({ start: p, first: chain.first, count: chain.count + 1 });
				return;
			}
			case "room": {
				const p = snapPt(raw, { free });
				if (
					polyDraft.length >= 3 &&
					dist(p, polyDraft[0]) < 12 / camRef.current.zoom
				) {
					store.addRoomPolygon(polyDraft);
					setPolyDraft([]);
					return;
				}
				setPolyDraft([...polyDraft, p]);
				return;
			}
			case "roomRect": {
				const p = snapPt(raw, { free });
				drag.current = { type: "roomRect", start: p };
				setDraft({ kind: "rect", a: p, b: p });
				startEdgePan();
				return;
			}
			case "ruler": {
				const p = snapPt(raw, { free });
				drag.current = { type: "ruler", start: p };
				setDraft({ kind: "ruler", a: p, b: p });
				startEdgePan();
				return;
			}
			case "door":
			case "window": {
				const preset =
					st.openingPreset ??
					(st.tool === "window"
						? { kind: "window" as const, width: 100, height: 120, sill: 90 }
						: { kind: "door" as const, width: 90, height: 210, sill: 0 });
				const pl = computePlacement(raw, { kind: "opening", preset }, free);
				if (pl?.kind === "opening") {
					const id = store.addOpening(pl.r.wall.id, pl.preset.kind, pl.r.t, {
						...pl.preset,
						mirror: pl.r.mirror,
					});
					if (id) store.select([{ kind: "opening", id }]);
				}
				return;
			}
			case "item": {
				if (st.catalogItemId) {
					const pl = computePlacement(
						raw,
						{ kind: "item", id: st.catalogItemId },
						free,
					);
					if (pl?.kind === "item")
						store.addItem(st.catalogItemId, pl.r.x, pl.r.y, pl.r.rotation);
				}
				return;
			}
			case "stair": {
				const p = snapPt(raw, { free });
				store.addStair(p.x, p.y);
				store.setTool("select");
				return;
			}
			case "eraser": {
				const hit = hitOf(e.target);
				if (hit && ENTITY_KINDS.includes(hit.kind)) {
					store.select([
						{ kind: hit.kind as SelectionRef["kind"], id: hit.id },
					]);
					store.deleteSelection();
				}
				return;
			}
			default:
				break;
		}

		// ---- select tool
		const hit = hitOf(e.target);
		if (hit?.kind === "dim" || hit?.kind === "roomlabel") {
			store.select([
				{ kind: hit.kind === "dim" ? "wall" : "room", id: hit.id },
			]);
			return;
		}
		if (hit?.kind === "handle") {
			const extra = hit.extra ?? "";
			const f = store.floor;
			if (extra.startsWith("joint-")) {
				const wall = f.walls.find((w) => w.id === hit.id);
				if (wall) {
					store.beginGesture();
					drag.current = {
						type: "joint",
						wallId: wall.id,
						end: extra === "joint-a" ? "a" : "b",
					};
					startEdgePan();
				}
				return;
			}
			if (extra === "vertex") {
				const [roomId, idx] = hit.id.split("#");
				store.beginGesture();
				drag.current = { type: "vertex", roomId, index: Number(idx) };
				startEdgePan();
				return;
			}
			if (extra.startsWith("rotate:") || extra.startsWith("resize:")) {
				const [action, kind, hx, hy] = extra.split(":");
				const target =
					kind === "item"
						? f.items.find((i) => i.id === hit.id)
						: f.stairs.find((i) => i.id === hit.id);
				if (!target) return;
				const t = target as Item & {
					width?: number;
					length?: number;
				};
				const w = kind === "item" ? t.w : (t.width ?? 0);
				const dd = kind === "item" ? t.d : (t.length ?? 0);
				store.beginGesture();
				if (action === "rotate") {
					drag.current = {
						type: "rotate",
						id: hit.id,
						center: { x: t.x, y: t.y },
						startAngle: (Math.atan2(raw.y - t.y, raw.x - t.x) * 180) / Math.PI,
						startRot: t.rotation,
					};
				} else {
					drag.current = {
						type: "resize",
						id: hit.id,
						kind: kind as "item" | "stair",
						hx: Number(hx),
						hy: Number(hy),
						base: { x: t.x, y: t.y, w, d: dd, rot: t.rotation },
					};
				}
				startEdgePan();
				return;
			}
		}
		if (hit && ENTITY_KINDS.includes(hit.kind)) {
			const ref = { kind: hit.kind as SelectionRef["kind"], id: hit.id };
			const f = store.floor;
			let sel = st.selection;
			const already = isSelected(ref.kind, ref.id);
			if (e.shiftKey) {
				store.toggleSelect(ref);
				sel = store.getState().selection;
			} else if (!already) {
				const it =
					ref.kind === "item" ? f.items.find((i) => i.id === ref.id) : null;
				sel = it?.groupId
					? f.items
							.filter((i) => i.groupId === it.groupId)
							.map((i) => ({ kind: "item" as const, id: i.id }))
					: [ref];
				store.select(sel);
			}
			if (ref.kind === "opening") {
				store.beginGesture();
				drag.current = { type: "opening", id: ref.id };
				return;
			}
			if (!sel.some((s) => s.kind === ref.kind && s.id === ref.id)) return;
			startMove(raw, sel, e.altKey);
			startEdgePan();
			return;
		}
		if (!e.shiftKey) store.select([]);
		drag.current = { type: "marquee", start: raw, additive: e.shiftKey };
		setMarquee({ a: raw, b: raw });
		startEdgePan();
	};

	const handlePointerMove = (e: Ptr & { target?: EventTarget | null }) => {
		lastPtr.current = e;
		const raw = toWorld(e);
		const st = store.getState();
		const d = drag.current;
		const free = isFree(e);

		if (d?.type === "pan") {
			setCam({
				...camRef.current,
				x: d.ox + (e.clientX - d.sx),
				y: d.oy + (e.clientY - d.sy),
			});
			return;
		}
		if (!d) {
			const t = st.tool;
			let p = raw;
			if (t === "wall" || t === "partition")
				p = snapPt(raw, { anchor: chain?.start, free });
			else if (
				t === "room" ||
				t === "roomRect" ||
				t === "ruler" ||
				t === "stair"
			)
				p = snapPt(raw, { free });
			if (!cursorRaf.current)
				cursorRaf.current = requestAnimationFrame(() => {
					cursorRaf.current = 0;
					setCursor(p);
				});
			if (t === "select" && e.target) {
				const hit = hitOf(e.target);
				const next =
					hit && ENTITY_KINDS.includes(hit.kind)
						? { kind: hit.kind as SelectionRef["kind"], id: hit.id }
						: null;
				setHover((prev) =>
					prev?.kind === next?.kind && prev?.id === next?.id ? prev : next,
				);
			} else setHover((prev) => (prev ? null : prev));
			return;
		}

		switch (d.type) {
			case "roomRect":
			case "ruler": {
				const p = snapPt(raw, { free });
				setDraft({
					kind: d.type === "roomRect" ? "rect" : "ruler",
					a: d.start,
					b: p,
				});
				return;
			}
			case "marquee":
				setMarquee({ a: d.start, b: raw });
				return;
			case "joint": {
				const wall = store.floor.walls.find((w) => w.id === d.wallId);
				if (!wall) return;
				const other = d.end === "a" ? wall.b : wall.a;
				let p = snapPt(raw, { anchor: other, free });
				if (!free && store.getState().snap) {
					const refs = jointRefs(store.floor, d.wallId, d.end);
					const a = snapPointToAxes(
						p,
						refs,
						AXIS_STICK_PX / camRef.current.zoom,
					);
					p = a.point;
					const g = guidesForPoint(p, refs, a.snappedX, a.snappedY);
					setGuides((prev) => (prev.length === 0 && g.length === 0 ? prev : g));
				}
				const cur = wall[d.end];
				if (dist(cur, p) < 0.01) return;
				store.mutateFloor((f) => moveJoint(f, cur, p), { record: false });
				return;
			}
			case "vertex": {
				const p = snapPt(raw, { free });
				store.mutateFloor(
					(f) => {
						const r = f.rooms.find((x) => x.id === d.roomId);
						if (r) r.points[d.index] = p;
					},
					{ record: false },
				);
				return;
			}
			case "rotate": {
				const ang =
					(Math.atan2(raw.y - d.center.y, raw.x - d.center.x) * 180) / Math.PI;
				let rot = d.startRot + (ang - d.startAngle);
				if (!free) rot = Math.round(rot / 15) * 15;
				rot = ((rot % 360) + 360) % 360;
				store.mutateFloor(
					(f) => {
						const t =
							f.items.find((i) => i.id === d.id) ??
							f.stairs.find((i) => i.id === d.id);
						if (t) t.rotation = rot;
					},
					{ record: false },
				);
				const rect = wrapRef.current?.getBoundingClientRect();
				setBadge({
					x: e.clientX - (rect?.left ?? 0) + 24,
					y: e.clientY - (rect?.top ?? 0) - 20,
					text: `${Math.round(rot)}°`,
				});
				return;
			}
			case "resize": {
				const b = d.base;
				const rad = (b.rot * Math.PI) / 180;
				const u = { x: Math.cos(rad), y: Math.sin(rad) };
				const v = { x: -Math.sin(rad), y: Math.cos(rad) };
				const sym = e.altKey;
				const ax = b.x - d.hx * (b.w / 2) * u.x - d.hy * (b.d / 2) * v.x;
				const ay = b.y - d.hx * (b.w / 2) * u.y - d.hy * (b.d / 2) * v.y;
				const rel = sym
					? { x: raw.x - b.x, y: raw.y - b.y }
					: { x: raw.x - ax, y: raw.y - ay };
				const qu = rel.x * u.x + rel.y * u.y;
				const qv = rel.x * v.x + rel.y * v.y;
				const k = sym ? 2 : 1;
				let nw = d.hx !== 0 ? Math.max(5, k * qu * d.hx) : b.w;
				let nd = d.hy !== 0 ? Math.max(5, k * qv * d.hy) : b.d;
				if (e.shiftKey && d.hx !== 0 && d.hy !== 0) {
					const s = Math.max(nw / b.w, nd / b.d);
					nw = b.w * s;
					nd = b.d * s;
				} else if (!free && st.snap) {
					nw = Math.max(5, snapValue(nw, st.grid));
					nd = Math.max(5, snapValue(nd, st.grid));
				}
				const cx = sym
					? b.x
					: ax + d.hx * (nw / 2) * u.x + d.hy * (nd / 2) * v.x;
				const cy = sym
					? b.y
					: ay + d.hx * (nw / 2) * u.y + d.hy * (nd / 2) * v.y;
				store.mutateFloor(
					(f) => {
						if (d.kind === "item") {
							const it = f.items.find((i) => i.id === d.id);
							if (it) Object.assign(it, { x: cx, y: cy, w: nw, d: nd });
						} else {
							const s = f.stairs.find((i) => i.id === d.id);
							if (s) Object.assign(s, { x: cx, y: cy, width: nw, length: nd });
						}
					},
					{ record: false },
				);
				return;
			}
			case "opening": {
				const f = store.floor;
				const cur = f.openings.find((x) => x.id === d.id);
				if (!cur) return;
				const r = snapOpening(f, raw, cur.width, {
					zoom: camRef.current.zoom,
					grid: st.grid,
					snap: st.snap,
					smartGuides: st.smartGuides,
					free,
					preferWallId: cur.wallId,
					excludeId: d.id,
				});
				if (!r) {
					setOpeningDrag(null);
					return;
				}
				store.mutateFloor(
					(ff) => {
						const o = ff.openings.find((x) => x.id === d.id);
						if (!o) return;
						o.wallId = r.wall.id;
						o.t = r.t;
					},
					{ record: false },
				);
				setOpeningDrag({ wall: r.wall, gaps: r.gaps, guides: r.guides });
				return;
			}
			case "move":
				applyMove(d, e);
				return;
		}
	};

	const onPointerUp = (e: React.PointerEvent) => {
		const d = drag.current;
		drag.current = null;
		setPanning(false);
		setOpeningDrag(null);
		setGuides((g) => (g.length ? [] : g));
		setBadge(null);
		if (wrapRef.current?.hasPointerCapture(e.pointerId))
			wrapRef.current.releasePointerCapture(e.pointerId);
		if (!d) return;
		const raw = toWorld(e);
		const f = store.floor;
		switch (d.type) {
			case "roomRect": {
				const end = snapPt(raw, { free: isFree(e) });
				store.addRectangleRoom(
					Math.min(d.start.x, end.x),
					Math.min(d.start.y, end.y),
					Math.abs(end.x - d.start.x),
					Math.abs(end.y - d.start.y),
				);
				setDraft(null);
				return;
			}
			case "ruler":
				store.addRuler(d.start, snapPt(raw, { free: isFree(e) }));
				setDraft(null);
				return;
			case "marquee": {
				const minX = Math.min(d.start.x, raw.x);
				const maxX = Math.max(d.start.x, raw.x);
				const minY = Math.min(d.start.y, raw.y);
				const maxY = Math.max(d.start.y, raw.y);
				setMarquee(null);
				const z = camRef.current.zoom;
				if ((maxX - minX) * z < 4 && (maxY - minY) * z < 4) return;
				const inside = (p: Point) =>
					p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
				const found: SelectionRef[] = d.additive
					? [...store.getState().selection]
					: [];
				for (const i of f.items)
					if (inside(i)) found.push({ kind: "item", id: i.id });
				for (const w of f.walls)
					if (inside(w.a) && inside(w.b))
						found.push({ kind: "wall", id: w.id });
				for (const o of f.openings) {
					const w = f.walls.find((x) => x.id === o.wallId);
					if (w && inside(lerp(w.a, w.b, o.t)))
						found.push({ kind: "opening", id: o.id });
				}
				for (const s of f.stairs)
					if (inside(s)) found.push({ kind: "stair", id: s.id });
				for (const r of f.rooms)
					if (r.points.every(inside)) found.push({ kind: "room", id: r.id });
				store.select(found);
				return;
			}
			case "move":
			case "joint":
				healWalls(d.type === "move" ? d.walls : new Set([d.wallId]));
				store.endGesture();
				return;
			case "vertex":
			case "rotate":
			case "resize":
			case "opening":
				store.endGesture();
				return;
			default:
				return;
		}
	};

	const onDoubleClick = (e: React.MouseEvent) => {
		const st = store.getState();
		if ((st.tool === "wall" || st.tool === "partition") && chain)
			setChain(null);
		if (st.tool === "room" && polyDraft.length >= 3) {
			store.addRoomPolygon(polyDraft);
			setPolyDraft([]);
		}
		if (st.tool === "select") {
			// Pointer capture (set on pointerdown) retargets click/dblclick to the container, so e.target is useless here.
			const hit = hitOf(document.elementFromPoint(e.clientX, e.clientY));
			if (hit?.kind === "dim") {
				store.select([{ kind: "wall", id: hit.id }]);
				setRenaming(null);
				setEditingWall(hit.id);
			} else if (hit?.kind === "room" || hit?.kind === "roomlabel") {
				store.select([{ kind: "room", id: hit.id }]);
				setEditingWall(null);
				setRenaming(hit.id);
			}
		}
	};

	const onContextMenu = (e: React.MouseEvent) => {
		if (store.getState().tool !== "select") {
			e.preventDefault();
			return;
		}
		const hit = hitOf(document.elementFromPoint(e.clientX, e.clientY));
		if (hit && ENTITY_KINDS.includes(hit.kind)) {
			if (!isSelected(hit.kind, hit.id))
				store.select([{ kind: hit.kind as SelectionRef["kind"], id: hit.id }]);
		} else if (hit?.kind !== "handle") store.select([]);
	};

	// ---------------------------------------------------------------- keyboard

	useEffect(() => {
		const isTyping = (t: EventTarget | null) => {
			const el = t as HTMLElement | null;
			return (
				!!el &&
				(el.tagName === "INPUT" ||
					el.tagName === "TEXTAREA" ||
					el.isContentEditable ||
					el.getAttribute?.("role") === "slider")
			);
		};
		const nudge = (dx: number, dy: number, e: KeyboardEvent) => {
			if (store.getState().selection.length === 0) return;
			e.preventDefault();
			store.moveSelection(dx, dy);
		};
		const down = (e: KeyboardEvent) => {
			if (e.key === "Alt") setAltDown(true);
			if (e.key === "Control" || e.key === "Meta") setCtrlDown(true);
			if (isTyping(e.target)) return;
			const mod = e.ctrlKey || e.metaKey;
			const key = e.key.toLowerCase();
			if (e.code === "Space") {
				setSpaceDown(true);
				e.preventDefault();
				return;
			}
			// zoom (Figma): Shift+1 fit, Shift+2 selection, Shift+0 / Ctrl+0 100%, +/- steps
			if (e.shiftKey && e.code === "Digit1") {
				e.preventDefault();
				return fitView(false);
			}
			if (e.shiftKey && e.code === "Digit2") {
				e.preventDefault();
				return fitView(true);
			}
			if (e.code === "Digit0" && (e.shiftKey || mod)) {
				e.preventDefault();
				return zoomTo(1);
			}
			if (e.key === "+" || e.key === "=" || e.code === "NumpadAdd") {
				e.preventDefault();
				return zoomStep(1);
			}
			if (e.key === "-" || e.key === "_" || e.code === "NumpadSubtract") {
				e.preventDefault();
				return zoomStep(-1);
			}
			if (mod && key === "z") {
				e.preventDefault();
				return e.shiftKey ? store.redo() : store.undo();
			}
			if (mod && key === "y") {
				e.preventDefault();
				return store.redo();
			}
			if (mod && (e.code === "BracketRight" || e.code === "BracketLeft")) {
				e.preventDefault();
				const up = e.code === "BracketRight";
				return store.reorderSelection(
					e.shiftKey ? (up ? "front" : "back") : up ? "forward" : "backward",
				);
			}
			if (mod && key === "c") return store.copySelection();
			if (mod && key === "v") return store.paste();
			if (mod && key === "d") {
				e.preventDefault();
				return store.duplicateSelection();
			}
			if (mod && key === "g") {
				e.preventDefault();
				return e.shiftKey ? store.ungroupSelection() : store.groupSelection();
			}
			if (mod && key === "a") {
				e.preventDefault();
				const f = store.floor;
				return store.select([
					...f.items.map((i) => ({ kind: "item" as const, id: i.id })),
					...f.walls.map((w) => ({ kind: "wall" as const, id: w.id })),
				]);
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				e.preventDefault();
				return store.deleteSelection();
			}
			if (e.key === "Escape") {
				cancelDraft();
				setRenaming(null);
				setEditingWall(null);
				store.setCatalogItem(null);
				store.setTool("select");
				return;
			}
			if (e.key === "Enter") {
				if (polyDraft.length >= 3) {
					store.addRoomPolygon(polyDraft);
					setPolyDraft([]);
				}
				return setChain(null);
			}
			if (key === "r" && !mod && !e.shiftKey) {
				if (store.getState().tool === "item")
					setGhostRotation((r) => (r + 90) % 360);
				else store.rotateSelection(e.altKey ? -15 : 15);
				return;
			}
			const step = e.shiftKey ? 50 : 10;
			if (e.key === "ArrowLeft") return nudge(-step, 0, e);
			if (e.key === "ArrowRight") return nudge(step, 0, e);
			if (e.key === "ArrowUp") return nudge(0, -step, e);
			if (e.key === "ArrowDown") return nudge(0, step, e);
			const map: Record<string, Parameters<PlannerStore["setTool"]>[0]> = {
				v: "select",
				h: "pan",
				w: "wall",
				p: "partition",
				o: "room",
				d: "door",
				n: "window",
				m: "ruler",
				e: "eraser",
			};
			const t = map[key];
			if (t && !mod && !e.shiftKey) {
				if (t === "door" || t === "window") store.setOpeningPreset(null, t);
				store.setTool(t);
			}
		};
		const up = (e: KeyboardEvent) => {
			if (e.code === "Space") setSpaceDown(false);
			if (e.key === "Alt") setAltDown(false);
			if (e.key === "Control" || e.key === "Meta") setCtrlDown(false);
		};
		const blur = () => {
			setSpaceDown(false);
			setAltDown(false);
			setCtrlDown(false);
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", blur);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", blur);
		};
	}, [store, polyDraft, fitView, zoomTo, zoomStep]);

	// reset drafts when tool changes
	useEffect(() => {
		setChain(null);
		setPolyDraft([]);
		setDraft(null);
		setHover(null);
	}, [tool]);

	// ---------------------------------------------------------------- render data

	const measures = useMemo(() => {
		if (!altDown || !hover || selection.length === 0 || tool !== "select")
			return [];
		if (selection.some((s) => s.kind === hover.kind && s.id === hover.id))
			return [];
		const a = boxOfRefs(floor, selection);
		const b = boxOfRef(floor, hover);
		return a && b ? measureBetween(a, b) : [];
	}, [altDown, hover, selection, floor, tool]);

	ghostRotationRef.current = ghostRotation;
	const placing = useMemo<DragPayload | null>(() => {
		if (dragPayload) return dragPayload;
		if (tool === "item" && catalogItemId)
			return { kind: "item", id: catalogItemId };
		if (tool === "door" || tool === "window")
			return {
				kind: "opening",
				preset:
					openingPreset ??
					(tool === "window"
						? { kind: "window", width: 100, height: 120, sill: 90 }
						: { kind: "door", width: 90, height: 210, sill: 0 }),
			};
		return null;
	}, [dragPayload, tool, catalogItemId, openingPreset]);

	const placement = useMemo(
		() =>
			placing && cursor ? computePlacement(cursor, placing, ctrlDown) : null,
		[
			placing,
			cursor,
			ctrlDown,
			computePlacement,
			floor,
			cam.zoom,
			ghostRotation,
		],
	);
	useEffect(() => {
		lastWall.current = placement?.r.wall?.id ?? null;
	}, [placement]);

	const ghostItem: Item | null = useMemo(() => {
		if (placement?.kind !== "item") return null;
		const { def, r } = placement;
		return {
			id: "ghost",
			catalogId: def.id,
			x: r.x,
			y: r.y,
			w: def.size[0],
			d: def.size[2],
			h: def.size[1],
			rotation: r.rotation,
			elevation: 0,
			color: def.color,
			accent: def.accent,
			locked: false,
			flipped: false,
			groupId: null,
			label: def.name,
		};
	}, [placement]);

	const ghostOpening = useMemo(() => {
		if (placement?.kind !== "opening") return null;
		const { preset, r } = placement;
		const opening: Opening = {
			id: "ghost",
			wallId: r.wall.id,
			kind: preset.kind,
			t: r.t,
			width: preset.width,
			height: preset.height,
			sill: preset.sill,
			flip: false,
			mirror: r.mirror,
			open: false,
			frame: { texture: null, color: "#fff", scale: 1, rotation: 0 },
		};
		return { wall: r.wall, opening };
	}, [placement]);

	const overlayGuides = useMemo(
		() => [
			...guides,
			...(placement?.r.guides ?? []),
			...(openingDrag?.guides ?? []),
		],
		[guides, placement, openingDrag],
	);
	const overlayMeasures = useMemo(
		() => [
			...measures,
			...(placement?.kind === "opening" ? placement.r.gaps : []),
			...(openingDrag?.gaps ?? []),
		],
		[measures, placement, openingDrag],
	);
	const targetWall = placement?.r.wall ?? openingDrag?.wall ?? null;

	const cursorStyle = panning
		? "grabbing"
		: spaceDown || tool === "pan"
			? "grab"
			: tool === "select"
				? "default"
				: tool === "eraser"
					? "not-allowed"
					: "crosshair";

	const editingWallObj = editingWall
		? floor.walls.find((w) => w.id === editingWall)
		: null;
	const renamingRoom = renaming
		? floor.rooms.find((r) => r.id === renaming)
		: null;
	const dragCursorRaf = useRef(0);
	const onDragOver = (e: React.DragEvent) => {
		const has =
			!!store.getState().dragPayload ||
			e.dataTransfer.types.includes("application/x-planner-item");
		if (!has) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
		const free = e.ctrlKey || e.metaKey;
		setCtrlDown((c) => (c === free ? c : free));
		const p = toWorld(e);
		if (!dragCursorRaf.current)
			dragCursorRaf.current = requestAnimationFrame(() => {
				dragCursorRaf.current = 0;
				setCursor(p);
			});
	};
	const onDrop = (e: React.DragEvent) => {
		const id = e.dataTransfer.getData("application/x-planner-item");
		const payload: DragPayload | null =
			store.getState().dragPayload ?? (id ? { kind: "item", id } : null);
		if (!payload) return;
		e.preventDefault();
		cancelAnimationFrame(dragCursorRaf.current);
		dragCursorRaf.current = 0;
		const pl = computePlacement(toWorld(e), payload, e.ctrlKey || e.metaKey);
		if (pl?.kind === "item")
			store.addItem(pl.def.id, pl.r.x, pl.r.y, pl.r.rotation);
		else if (pl?.kind === "opening") {
			const oid = store.addOpening(pl.r.wall.id, pl.preset.kind, pl.r.t, {
				...pl.preset,
				mirror: pl.r.mirror,
			});
			if (oid) store.select([{ kind: "opening", id: oid }]);
		}
		store.setDragPayload(null);
		setCursor(null);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger
				asChild
				disabled={tool !== "select" || !!chain || polyDraft.length > 0}
			>
				<div
					ref={wrapRef}
					className="planner-canvas relative size-full overflow-hidden bg-muted/40"
					style={{ cursor: cursorStyle }}
					onPointerDown={onPointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={onPointerUp}
					onPointerCancel={onPointerUp}
					onDoubleClick={onDoubleClick}
					onContextMenu={onContextMenu}
					onPointerLeave={() => {
						setCursor(null);
						setHover(null);
					}}
					onDragOver={onDragOver}
					onDragLeave={(e) => {
						if (!e.currentTarget.contains(e.relatedTarget as Node | null))
							setCursor(null);
					}}
					onDrop={onDrop}
				>
					<ViewportGrid cam={cam} size={size} showGrid={showGrid} />
					<svg
						width={size.w}
						height={size.h}
						className="absolute inset-0 block"
					>
						<g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
							<PlanScene floor={floor} below={below} />
						</g>
					</svg>
					<PlanOverlay
						floor={floor}
						cam={cam}
						size={size}
						units={units}
						selection={selection}
						hover={hover}
						tool={tool}
						showDimensions={showDimensions}
						showRoomLabels={showRoomLabels}
						guides={overlayGuides}
						measures={overlayMeasures}
						marquee={marquee}
						chain={chain}
						polyDraft={polyDraft}
						cursor={cursor}
						rectDraft={draft?.kind === "rect" ? draft : null}
						rulerDraft={draft?.kind === "ruler" ? draft : null}
						ghostItem={ghostItem}
						ghostOpening={ghostOpening}
						targetWall={targetWall}
						badge={badge}
						renamingRoomId={renaming}
						editingWallId={editingWall}
					/>

					{editingWallObj && (
						<WallLengthEdit
							key={editingWallObj.id}
							store={store}
							wall={editingWallObj}
							walls={floor.walls}
							cam={cam}
							units={units}
							onDone={() => setEditingWall(null)}
						/>
					)}
					{renamingRoom && (
						<RoomRename
							store={store}
							room={renamingRoom}
							cam={cam}
							onDone={() => setRenaming(null)}
						/>
					)}

					<div
						className="pointer-events-none absolute bottom-24 max-w-[28rem] -translate-x-1/2 truncate rounded-md bg-background/70 px-2 py-1 text-xs text-muted-foreground backdrop-blur"
						style={{
							left: insets.left + (size.w - insets.left - insets.right) / 2,
						}}
					>
						{cursor
							? `${formatLength(cursor.x, units)} , ${formatLength(cursor.y, units)} · `
							: ""}
						{hint(tool, !!chain, polyDraft.length)}
					</div>
					<div data-no-wheel>
						<ZoomControls
							store={store}
							style={{ right: 12 }}
							zoom={cam.zoom}
							onZoomStep={zoomStep}
							onZoomTo={zoomTo}
							onFit={() => fitView(false)}
							onFitSelection={() => fitView(true)}
						/>
					</div>
				</div>
			</ContextMenuTrigger>
			<PlanContextMenuContent
				store={store}
				onFitSelection={() => fitView(selection.length > 0)}
			/>
		</ContextMenu>
	);
}

function hint(tool: string, chain: boolean, polyN: number) {
	switch (tool) {
		case "wall":
		case "partition":
			return chain
				? "Clique para continuar · duplo clique ou Esc termina · Ctrl: sem encaixe"
				: "Clique para iniciar uma parede";
		case "room":
			return polyN
				? "Clique no 1º ponto ou Enter para fechar"
				: "Clique para marcar os vértices do cômodo";
		case "roomRect":
			return "Arraste para criar um cômodo retangular";
		case "door":
		case "window":
			return "Passe sobre uma parede e clique para inserir";
		case "item":
			return "Clique para posicionar · R gira · Esc sai";
		case "ruler":
			return "Arraste para medir";
		case "eraser":
			return "Clique em um elemento para apagar";
		case "stair":
			return "Clique para posicionar a escada";
		case "pan":
			return "Arraste para mover a vista";
		default:
			return "Rolar move · Ctrl+rolar dá zoom · Espaço arrasta · Alt+arrastar duplica · Alt mede";
	}
}

// Re-exported for the corner math used by tests and the overlay.
export { rectCorners };
