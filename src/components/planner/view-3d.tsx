import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Part } from "#/lib/planner/catalog";
import { itemById } from "#/lib/planner/catalog";
import {
	boundsOf,
	lerp,
	polygonCentroid,
	wallAngle,
	wallLength,
} from "#/lib/planner/geometry";
import { orbitLimits } from "#/lib/planner/orbit-limits";
import { roomStackRanks } from "#/lib/planner/room-stack";
import {
	currentFloorOf,
	type PlannerStore,
	usePlanner,
} from "#/lib/planner/store";
import { TILE_CM, textureCanvas } from "#/lib/planner/textures";
import type {
	Floor,
	Item,
	MaterialRef,
	Opening,
	Project,
	Wall,
} from "#/lib/planner/types";
import {
	CUT_HEIGHT,
	endNeighbourLevels,
	type Piece,
	stepLevel,
	type WallMode,
	wallPieces,
	wallsToLower,
	wallTopProfile,
} from "#/lib/planner/wall-cutaway";

export type Camera3D = "orbit" | "walk";

type Props = {
	store: PlannerStore;
	mode: Camera3D;
	cutaway: boolean;
	/** Sims-style walls: full height, lowered when facing the camera, or all lowered. */
	wallMode: WallMode;
};

const M = 0.01; // cm -> m
const SLAB = 0.2;
/** Height gap (m) between the floors of nested rooms, so they do not z-fight. */
const ROOM_LAYER_GAP = 0.004;

const texCache = new Map<string, THREE.CanvasTexture>();
function textureFor(m: MaterialRef): THREE.CanvasTexture | null {
	if (!m.texture) return null;
	const key = `${m.texture}|${m.color}`;
	let t = texCache.get(key);
	if (!t) {
		const c = textureCanvas(m.texture, m.color, 256);
		if (!c) return null;
		t = new THREE.CanvasTexture(c);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.colorSpace = THREE.SRGBColorSpace;
		t.anisotropy = 4;
		texCache.set(key, t);
	}
	return t;
}

function standardMaterial(
	m: MaterialRef,
	opts: { side?: THREE.Side } = {},
): THREE.MeshStandardMaterial {
	const base = textureFor(m);
	const mat = new THREE.MeshStandardMaterial({
		color: base ? "#ffffff" : m.color,
		roughness: 0.85,
		metalness: 0.02,
		side: opts.side ?? THREE.FrontSide,
	});
	if (base) {
		const t = base.clone();
		t.needsUpdate = true;
		const rep = 1 / (TILE_CM * M * m.scale);
		t.repeat.set(rep, rep);
		t.rotation = (m.rotation * Math.PI) / 180;
		mat.map = t;
	}
	return mat;
}

function floorElevation(project: Project, floorId: string) {
	let e = 0;
	for (const f of project.floors) {
		if (f.id === floorId) break;
		e += f.height * M + SLAB;
	}
	return e;
}

function partMaterial(c: Part["c"], item: Pick<Item, "color" | "accent">) {
	const color =
		!c || c === "main" ? item.color : c === "accent" ? item.accent : c;
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.7,
		metalness: 0.05,
	});
}

function buildItem(it: Item) {
	const def = itemById(it.catalogId);
	const group = new THREE.Group();
	if (!def) return group;
	const w = it.w * M;
	const d = it.d * M;
	const h = it.h * M;
	for (const p of def.parts) {
		const sx = p.s[0] * w;
		const sy = Math.max(p.s[1] * h, 0.004);
		const sz = p.s[2] * d;
		let geo: THREE.BufferGeometry;
		if (p.t === "box") geo = new THREE.BoxGeometry(sx, sy, sz);
		else if (p.t === "cyl")
			geo = new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 20);
		else if (p.t === "cone") geo = new THREE.ConeGeometry(sx / 2, sy, 20);
		else geo = new THREE.SphereGeometry(0.5, 20, 14).scale(sx, sy, sz);
		const mesh = new THREE.Mesh(geo, partMaterial(p.c, it));
		mesh.position.set(
			p.p[0] * w,
			p.p[1] * h + sy / 2 + (p.t === "sphere" ? 0 : 0),
			p.p[2] * d,
		);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
	}
	group.scale.x = it.flipped ? -1 : 1;
	return group;
}

function archShape(
	shape: THREE.Shape,
	x0: number,
	x1: number,
	y0: number,
	y1: number,
) {
	const r = (x1 - x0) / 2;
	const spring = y1 - r;
	const hole = new THREE.Path();
	hole.moveTo(x0, y0);
	hole.lineTo(x1, y0);
	hole.lineTo(x1, spring);
	hole.absarc((x0 + x1) / 2, spring, r, 0, Math.PI, false);
	hole.lineTo(x0, y0);
	shape.holes.push(hole);
}

function buildWall(wall: Wall, openings: Opening[], floorHeightCm: number) {
	const group = new THREE.Group();
	const len = wallLength(wall) * M;
	const ext = Math.max(wall.thickness * M * 0.5 - 0.001, 0);
	const h = (wall.height ?? floorHeightCm) * M;
	const shape = new THREE.Shape();
	shape.moveTo(-ext, 0);
	shape.lineTo(len + ext, 0);
	shape.lineTo(len + ext, h);
	shape.lineTo(-ext, h);
	shape.lineTo(-ext, 0);
	const totalLen = len;
	for (const o of openings) {
		const cx = o.t * totalLen;
		const x0 = cx - (o.width * M) / 2;
		const x1 = cx + (o.width * M) / 2;
		const y0 = Math.max(o.sill * M, 0.01);
		const y1 = Math.min((o.sill + o.height) * M, h - 0.01);
		if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue;
		if (o.kind === "arch") {
			archShape(shape, x0, x1, y0, y1);
		} else {
			const hole = new THREE.Path();
			hole.moveTo(x0, y0);
			hole.lineTo(x1, y0);
			hole.lineTo(x1, y1);
			hole.lineTo(x0, y1);
			hole.lineTo(x0, y0);
			shape.holes.push(hole);
		}
	}
	const half = wall.thickness * M * 0.5;
	const make = (mat: MaterialRef, zStart: number) => {
		const geo = new THREE.ExtrudeGeometry(shape, {
			depth: half,
			bevelEnabled: false,
			steps: 1,
		});
		const mesh = new THREE.Mesh(geo, standardMaterial(mat));
		mesh.position.z = zStart;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	};
	// local +z is the wall's "right" side (normal (-sin, cos) -> mapped below)
	group.add(make(wall.right, 0));
	group.add(make(wall.left, -half));

	for (const o of openings) {
		const cx = o.t * totalLen;
		group.add(buildOpening(o, cx, wall));
	}
	return group;
}

function buildOpening(o: Opening, cx: number, wall: Wall) {
	const g = new THREE.Group();
	// a visita em VR acha as portas por aqui (vr-view.tsx)
	g.userData.openingId = o.id;
	const width = o.width * M;
	const height = Math.min(o.height * M, 5);
	const sill = Math.max(o.sill * M, 0.01);
	const t = wall.thickness * M;
	const frameMat = new THREE.MeshStandardMaterial({
		color: o.frame.color,
		roughness: 0.6,
	});
	const addBox = (
		sx: number,
		sy: number,
		sz: number,
		x: number,
		y: number,
		z: number,
		mat: THREE.Material,
	) => {
		const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
		m.position.set(x, y, z);
		m.castShadow = true;
		g.add(m);
		return m;
	};
	const fw = 0.04;
	if (o.kind === "window") {
		const glass = new THREE.MeshPhysicalMaterial({
			color: "#bfe7ff",
			transparent: true,
			opacity: 0.35,
			roughness: 0.05,
			metalness: 0,
			side: THREE.DoubleSide,
		});
		addBox(width, height, 0.01, cx, sill + height / 2, 0, glass);
		addBox(width, fw, t * 0.8, cx, sill + fw / 2, 0, frameMat);
		addBox(width, fw, t * 0.8, cx, sill + height - fw / 2, 0, frameMat);
		addBox(
			fw,
			height,
			t * 0.8,
			cx - width / 2 + fw / 2,
			sill + height / 2,
			0,
			frameMat,
		);
		addBox(
			fw,
			height,
			t * 0.8,
			cx + width / 2 - fw / 2,
			sill + height / 2,
			0,
			frameMat,
		);
		addBox(fw / 2, height, t * 0.5, cx, sill + height / 2, 0, frameMat);
		addBox(
			width,
			t * 0.9,
			0.03,
			cx,
			sill - 0.01,
			t / 2 + 0.01,
			new THREE.MeshStandardMaterial({ color: "#e5e1d8" }),
		);
	} else if (o.kind === "door" || o.kind === "doubleDoor") {
		const doorMat = new THREE.MeshStandardMaterial({
			color: o.frame.color === "#ffffff" ? "#b98a5e" : o.frame.color,
			roughness: 0.6,
		});
		addBox(
			fw,
			height,
			t * 0.9,
			cx - width / 2 + fw / 2,
			sill + height / 2,
			0,
			frameMat,
		);
		addBox(
			fw,
			height,
			t * 0.9,
			cx + width / 2 - fw / 2,
			sill + height / 2,
			0,
			frameMat,
		);
		addBox(width, fw, t * 0.9, cx, sill + height - fw / 2, 0, frameMat);
		const side = o.mirror ? -1 : 1;
		const leaf = (hingeX: number, lw: number, dir: number) => {
			const pivot = new THREE.Group();
			pivot.position.set(hingeX, 0, 0);
			const m = new THREE.Mesh(
				new THREE.BoxGeometry(lw, height - fw, 0.04),
				doorMat,
			);
			m.position.set((dir * lw) / 2, sill + (height - fw) / 2, 0);
			m.castShadow = true;
			pivot.add(m);
			// ângulo da folha toda aberta: a visita em VR anima entre 0 e este valor
			pivot.userData.swing = side * dir * -Math.PI * 0.45;
			if (o.open) pivot.rotation.y = pivot.userData.swing;
			g.add(pivot);
		};
		if (o.kind === "door") {
			if (o.flip) leaf(cx + width / 2 - fw, width - fw * 2, -1);
			else leaf(cx - width / 2 + fw, width - fw * 2, 1);
		} else {
			leaf(cx - width / 2 + fw, width / 2 - fw, 1);
			leaf(cx + width / 2 - fw, width / 2 - fw, -1);
		}
	} else if (o.kind === "slidingDoor") {
		const glass = new THREE.MeshPhysicalMaterial({
			color: "#cfe9f7",
			transparent: true,
			opacity: 0.4,
			roughness: 0.05,
			side: THREE.DoubleSide,
		});
		addBox(
			width / 2,
			height,
			0.02,
			cx - width / 4,
			sill + height / 2,
			0.02,
			glass,
		);
		addBox(
			width / 2,
			height,
			0.02,
			cx + width / 4,
			sill + height / 2,
			-0.02,
			glass,
		);
		addBox(width, fw, t * 0.9, cx, sill + height - fw / 2, 0, frameMat);
	} else if (o.kind === "garage") {
		const mat = new THREE.MeshStandardMaterial({
			color: "#d9dde0",
			roughness: 0.5,
			metalness: 0.2,
		});
		const panels = 6;
		const ph = height / panels;
		for (let i = 0; i < panels; i++)
			addBox(width - 0.04, ph - 0.01, 0.04, cx, sill + ph * i + ph / 2, 0, mat);
	}
	return g;
}

function placeWall(group: THREE.Group, wall: Wall, elevation: number) {
	// Wall local x runs a -> b; 2D (x, y) -> 3D (x, z). Rotation about Y is the negated 2D angle.
	group.position.set(wall.a.x * M, elevation, wall.a.y * M);
	group.rotation.y = -wallAngle(wall);
}

function buildRoof(floor: Floor, elevation: number) {
	const r = floor.roof;
	if (r.kind === "none" || floor.walls.length === 0) return null;
	const pts = floor.walls.flatMap((w) => [w.a, w.b]);
	const b = boundsOf(pts);
	const o = r.overhang * M;
	const x0 = b.minX * M - o;
	const x1 = b.maxX * M + o;
	const z0 = b.minY * M - o;
	const z1 = b.maxY * M + o;
	const w = x1 - x0;
	const d = z1 - z0;
	const y = elevation + floor.height * M;
	const mat = standardMaterial(r.material, { side: THREE.DoubleSide });
	const g = new THREE.Group();
	const th = r.thickness * M;
	const rise = (Math.min(w, d) / 2) * Math.tan((r.pitch * Math.PI) / 180);
	const longX = w >= d;
	let geo: THREE.BufferGeometry;
	if (r.kind === "flat") {
		geo = new THREE.BoxGeometry(w, th, d);
		const m = new THREE.Mesh(geo, mat);
		m.position.set((x0 + x1) / 2, y + th / 2, (z0 + z1) / 2);
		g.add(m);
	} else if (r.kind === "gable" || r.kind === "shed") {
		const s = new THREE.Shape();
		const span = longX ? d : w;
		const len = longX ? w : d;
		if (r.kind === "gable") {
			const rr = (span / 2) * Math.tan((r.pitch * Math.PI) / 180);
			s.moveTo(-span / 2, 0);
			s.lineTo(span / 2, 0);
			s.lineTo(0, rr);
		} else {
			const rr = span * Math.tan((r.pitch * Math.PI) / 180);
			s.moveTo(-span / 2, 0);
			s.lineTo(span / 2, 0);
			s.lineTo(span / 2, rr);
		}
		geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
		geo.translate(0, 0, -len / 2);
		const m = new THREE.Mesh(geo, mat);
		m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
		m.rotation.y = longX ? Math.PI / 2 : 0;
		m.castShadow = true;
		g.add(m);
	} else {
		// hip: pyramid-like frustum
		const ridgeLen = Math.max(Math.abs(w - d), 0.01);
		const hw = w / 2;
		const hd = d / 2;
		const rr = rise;
		const verts: number[] = [];
		const push = (...v: number[]) => verts.push(...v);
		const cx = (x0 + x1) / 2;
		const cz = (z0 + z1) / 2;
		const ra = longX ? ridgeLen / 2 : 0;
		const rb = longX ? 0 : ridgeLen / 2;
		const A = [cx - hw, y, cz - hd];
		const B = [cx + hw, y, cz - hd];
		const C = [cx + hw, y, cz + hd];
		const D = [cx - hw, y, cz + hd];
		const R1 = [cx - ra, y + rr, cz - rb];
		const R2 = [cx + ra, y + rr, cz + rb];
		if (longX) {
			push(...A, ...B, ...R2, ...A, ...R2, ...R1);
			push(...D, ...R1, ...R2, ...D, ...R2, ...C);
			push(...A, ...R1, ...D);
			push(...B, ...C, ...R2);
		} else {
			push(...A, ...B, ...R1, ...B, ...R2, ...R1);
			push(...D, ...R2, ...C, ...D, ...R1, ...R2);
			push(...A, ...R1, ...D, ...R1, ...D, ...R2); // fallback faces
			push(...B, ...C, ...R2);
		}
		geo = new THREE.BufferGeometry();
		geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
		geo.computeVertexNormals();
		const m = new THREE.Mesh(geo, mat);
		m.castShadow = true;
		g.add(m);
	}
	return g;
}

function buildStair(
	s: Floor["stairs"][number],
	elevation: number,
	floorHeight: number,
) {
	const g = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({
		color: s.color,
		roughness: 0.7,
	});
	const stepH = (floorHeight * M + SLAB) / s.steps;
	const stepL = (s.length * M) / s.steps;
	for (let i = 0; i < s.steps; i++) {
		const m = new THREE.Mesh(
			new THREE.BoxGeometry(s.width * M, stepH * (i + 1), stepL),
			mat,
		);
		// ascending toward -y in 2D (the arrow direction)
		m.position.set(
			0,
			(stepH * (i + 1)) / 2,
			(s.length * M) / 2 - stepL * (i + 0.5),
		);
		m.castShadow = true;
		m.receiveShadow = true;
		g.add(m);
	}
	g.position.set(s.x * M, elevation, s.y * M);
	g.rotation.y = -(s.rotation * Math.PI) / 180;
	return g;
}

function disposeGroup(g: THREE.Object3D) {
	g.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (mesh.geometry) mesh.geometry.dispose();
		const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
		if (Array.isArray(mat)) for (const m of mat) m.dispose();
		else mat?.dispose();
	});
}

/** Geometry of one slab (z0..z1) from the solid pieces: boxes with sloped tops, built by hand so it can be redone every frame. */
function slabGeometry(
	pieces: Piece[],
	ext: number,
	lenCm: number,
	z0: number,
	z1: number,
) {
	const pos: number[] = [];
	const uv: number[] = [];
	const quad = (
		a: number[],
		b: number[],
		c: number[],
		d: number[],
		uvs: number[][],
	) => {
		const order = [0, 1, 2, 0, 2, 3];
		const verts = [a, b, c, d];
		for (const k of order) {
			const v = verts[k];
			pos.push(v[0], v[1], v[2]);
			uv.push(uvs[k][0], uvs[k][1]);
		}
	};
	for (const p of pieces) {
		const xa = (p.xa <= 0.01 ? p.xa - ext : p.xa) * M;
		const xb = (p.xb >= lenCm - 0.01 ? p.xb + ext : p.xb) * M;
		const y0 = p.y0 * M;
		const ta = p.ta * M;
		const tb = p.tb * M;
		// front (+z) and back (-z)
		quad(
			[xa, y0, z1],
			[xb, y0, z1],
			[xb, tb, z1],
			[xa, ta, z1],
			[
				[xa, y0],
				[xb, y0],
				[xb, tb],
				[xa, ta],
			],
		);
		quad(
			[xb, y0, z0],
			[xa, y0, z0],
			[xa, ta, z0],
			[xb, tb, z0],
			[
				[xb, y0],
				[xa, y0],
				[xa, ta],
				[xb, tb],
			],
		);
		// sloped top
		quad(
			[xa, ta, z0],
			[xa, ta, z1],
			[xb, tb, z1],
			[xb, tb, z0],
			[
				[xa, z0],
				[xa, z1],
				[xb, z1],
				[xb, z0],
			],
		);
		// ends
		if (ta - y0 > 1e-4)
			quad(
				[xa, y0, z0],
				[xa, y0, z1],
				[xa, ta, z1],
				[xa, ta, z0],
				[
					[z0, y0],
					[z1, y0],
					[z1, ta],
					[z0, ta],
				],
			);
		if (tb - y0 > 1e-4)
			quad(
				[xb, y0, z1],
				[xb, y0, z0],
				[xb, tb, z0],
				[xb, tb, z1],
				[
					[z1, y0],
					[z0, y0],
					[z0, tb],
					[z1, tb],
				],
			);
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
	geo.computeVertexNormals();
	return geo;
}

/**
 * The animated version of a wall (Sims-style cut-away): rebuilt from a top profile that depends on the wall level and on the
 * levels of the walls at its ends, so stubs rise smoothly and slope up to the raised wall beside them.
 */
type DynWall = {
	group: THREE.Group;
	right: THREE.Mesh;
	left: THREE.Mesh;
	opens: { obj: THREE.Object3D; cx: number; topCm: number }[];
};

function createDynWall(wall: Wall, openings: Opening[]): DynWall {
	const group = new THREE.Group();
	const mk = (mat: MaterialRef) => {
		const mesh = new THREE.Mesh(
			new THREE.BufferGeometry(),
			standardMaterial(mat),
		);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
		return mesh;
	};
	const right = mk(wall.right);
	const left = mk(wall.left);
	const len = wallLength(wall);
	const opens = openings.map((o) => {
		const obj = buildOpening(o, o.t * len * M, wall);
		group.add(obj);
		return { obj, cx: o.t * len, topCm: o.sill + o.height };
	});
	return { group, right, left, opens };
}

function updateDynWall(
	d: DynWall,
	wall: Wall,
	openings: Opening[],
	floorHeightCm: number,
	p: { level: number; rampA: number; rampB: number },
) {
	const len = wallLength(wall);
	const full = wall.height ?? floorHeightCm;
	const profile = wallTopProfile(len, {
		low: Math.min(CUT_HEIGHT, full),
		full,
		...p,
	});
	const pieces = wallPieces(
		len,
		openings.map((o) => ({
			t: o.t,
			width: o.width,
			sill: o.sill,
			height: o.height,
		})),
		profile,
	);
	const half = wall.thickness * M * 0.5;
	const ext = Math.max(wall.thickness * 0.5 - 0.1, 0);
	d.right.geometry.dispose();
	d.left.geometry.dispose();
	d.right.geometry = slabGeometry(pieces, ext, len, 0, half);
	d.left.geometry = slabGeometry(pieces, ext, len, -half, 0);
	// door/window objects only show once the wall covers them
	for (const o of d.opens) o.obj.visible = profile.top(o.cx) >= o.topCm - 1;
}

/** Both versions of a wall: the full-height one (cheap, static) and the animated one used while it is lowered. */
type WallEntry = {
	wall: Wall;
	openings: Opening[];
	floorHeight: number;
	full: THREE.Group;
	dyn: DynWall;
	level?: number;
	key: string;
};

export function buildScene(project: Project, opts: { cutaway: boolean }) {
	const root = new THREE.Group();
	const walls: WallEntry[] = [];
	root.userData.walls = walls;
	const env = project.environment;
	for (const floor of project.floors) {
		if (!floor.visible) continue;
		const elev = floorElevation(project, floor.id);
		const fg = new THREE.Group();
		fg.userData.floorId = floor.id;

		for (const w of floor.walls) {
			if (w.hidden) continue;
			const ops = floor.openings.filter((o) => o.wallId === w.id);
			const full = buildWall(w, ops, floor.height);
			const dyn = createDynWall(w, ops);
			placeWall(full, w, elev);
			placeWall(dyn.group, w, elev);
			dyn.group.visible = false;
			const wg = new THREE.Group();
			wg.add(full, dyn.group);
			wg.userData.ref = { kind: "wall", id: w.id, floorId: floor.id };
			fg.add(wg);
			walls.push({
				wall: w,
				openings: ops,
				floorHeight: floor.height,
				full,
				dyn,
				key: "full",
			});
		}
		const ranks = roomStackRanks(floor.rooms);
		for (const r of floor.rooms) {
			if (r.points.length < 3) continue;
			const lift = (ranks.get(r.id) ?? 0) * ROOM_LAYER_GAP;
			const shape = new THREE.Shape(
				r.points.map((p) => new THREE.Vector2(p.x * M, p.y * M)),
			);
			const geo = new THREE.ShapeGeometry(shape);
			geo.rotateX(Math.PI / 2);
			// ShapeGeometry lies in XY; after rotating +90deg about X, y -> z (we keep 2D y == 3D z)
			const mat = standardMaterial(r.floor, { side: THREE.DoubleSide });
			const mesh = new THREE.Mesh(geo, mat);
			mesh.position.y = elev + r.floorOffset * M + 0.005 + lift;
			mesh.receiveShadow = true;
			mesh.userData.ref = { kind: "room", id: r.id, floorId: floor.id };
			fg.add(mesh);

			if (elev > 0) {
				const slab = new THREE.Mesh(
					new THREE.ExtrudeGeometry(shape, {
						depth: SLAB,
						bevelEnabled: false,
					}),
					new THREE.MeshStandardMaterial({ color: "#d4d0c8" }),
				);
				slab.geometry.rotateX(Math.PI / 2);
				slab.position.y = elev;
				slab.receiveShadow = true;
				fg.add(slab);
			}
			if (r.ceiling && !opts.cutaway) {
				const cg = new THREE.ShapeGeometry(shape);
				cg.rotateX(Math.PI / 2);
				const cm = new THREE.Mesh(
					cg,
					new THREE.MeshStandardMaterial({
						color: "#f7f5f0",
						side: THREE.FrontSide,
					}),
				);
				cm.position.y = elev + floor.height * M - 0.01 - lift;
				fg.add(cm);
			}
		}
		for (const it of floor.items) {
			const ig = buildItem(it);
			ig.position.set(it.x * M, elev + it.elevation * M, it.y * M);
			ig.rotation.y = -(it.rotation * Math.PI) / 180;
			ig.userData.ref = { kind: "item", id: it.id, floorId: floor.id };
			fg.add(ig);
		}
		for (const s of floor.stairs) fg.add(buildStair(s, elev, floor.height));
		if (!opts.cutaway) {
			const roof = buildRoof(floor, elev);
			if (roof) fg.add(roof);
		}
		root.add(fg);
	}
	if (env.showGround) {
		const ground = new THREE.Mesh(
			new THREE.CircleGeometry(80, 48),
			new THREE.MeshStandardMaterial({ color: env.groundColor, roughness: 1 }),
		);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.02;
		ground.receiveShadow = true;
		root.add(ground);
	}
	return root;
}

export const SKY: Record<
	string,
	{ bg: string; sun: number; amb: number; sunColor: string }
> = {
	day: { bg: "#bfe3f7", sun: 2.2, amb: 0.9, sunColor: "#fff4dc" },
	evening: { bg: "#f2b88a", sun: 1.5, amb: 0.55, sunColor: "#ffb77a" },
	night: { bg: "#10172a", sun: 0.25, amb: 0.35, sunColor: "#9db4ff" },
	clear: { bg: "#ffffff", sun: 1.2, amb: 1.1, sunColor: "#ffffff" },
};

export function View3D({ store, mode, cutaway, wallMode }: Props) {
	const project = usePlanner(store, (s) => s.project);
	const hostRef = useRef<HTMLDivElement>(null);
	const wallModeRef = useRef<WallMode>(wallMode);
	const three = useRef<{
		renderer: THREE.WebGLRenderer;
		scene: THREE.Scene;
		camera: THREE.PerspectiveCamera;
		controls: OrbitControls;
		content: THREE.Object3D | null;
		sun: THREE.DirectionalLight;
		amb: THREE.HemisphereLight;
		framed: string | null;
		walk: { yaw: number; pitch: number; keys: Set<string>; pos: THREE.Vector3 };
		modeRef: Camera3D;
		raf: number;
		dirty: boolean;
		wallSig: string;
		wallLower: Set<string>;
		wallSettled: boolean;
		wallLevels: Map<string, number>;
	} | null>(null);

	// init
	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			preserveDrawingBuffer: true,
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFShadowMap;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		host.appendChild(renderer.domElement);
		renderer.domElement.style.display = "block";
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
		camera.position.set(8, 9, 12);
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableDamping = true;
		// wheel: smoother steps and zoom toward the pointer (like the 2D canvas)
		controls.zoomSpeed = 0.8;
		controls.zoomToCursor = true;
		controls.maxPolarAngle = Math.PI * 0.495;
		const amb = new THREE.HemisphereLight("#ffffff", "#8a7f6a", 0.9);
		scene.add(amb);
		const sun = new THREE.DirectionalLight("#fff4dc", 2.2);
		sun.position.set(18, 30, 12);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		const sc = sun.shadow.camera;
		sc.left = -30;
		sc.right = 30;
		sc.top = 30;
		sc.bottom = -30;
		sc.near = 1;
		sc.far = 90;
		sun.shadow.bias = -0.0005;
		scene.add(sun);

		const state = {
			renderer,
			scene,
			camera,
			controls,
			content: null as THREE.Object3D | null,
			sun,
			amb,
			framed: null as string | null,
			walk: {
				yaw: 0,
				pitch: 0,
				keys: new Set<string>(),
				pos: new THREE.Vector3(0, 1.6, 0),
			},
			modeRef: "orbit" as Camera3D,
			raf: 0,
			dirty: true,
			wallSig: "",
			wallLower: new Set<string>(),
			wallSettled: false,
			wallLevels: new Map<string, number>(),
		};
		three.current = state;

		const resize = () => {
			const w = host.clientWidth;
			const h = host.clientHeight;
			if (w === 0 || h === 0) return;
			renderer.setSize(w, h);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			state.dirty = true;
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		// Sims-style walls: each wall eases between full height and a stub as the camera moves; stubs slope up to raised walls
		const applyWalls = (dt: number) => {
			const content = state.content;
			const entries = content?.userData.walls as WallEntry[] | undefined;
			if (!content || !entries) return;
			const m = state.modeRef === "walk" ? "up" : wallModeRef.current;
			const p = camera.position;
			const t = controls.target;
			const sig = `${content.uuid}|${m}|${p.x.toFixed(2)},${p.z.toFixed(2)}|${t.x.toFixed(2)},${t.z.toFixed(2)}`;
			if (sig !== state.wallSig) {
				state.wallSig = sig;
				state.wallLower = wallsToLower(
					entries.map((e) => e.wall),
					m,
					{ x: p.x / M, y: p.z / M },
					{ x: t.x / M, y: t.z / M },
				);
				state.wallSettled = false;
			}
			if (state.wallSettled) return;
			let moving = false;
			const levels = new Map<string, number>();
			for (const e of entries) {
				const target = state.wallLower.has(e.wall.id) ? 0 : 1;
				const start = e.level ?? state.wallLevels.get(e.wall.id) ?? target;
				e.level = stepLevel(start, target, dt);
				if (e.level !== target) moving = true;
				levels.set(e.wall.id, e.level);
				state.wallLevels.set(e.wall.id, e.level);
			}
			const near = endNeighbourLevels(
				entries.map((e) => e.wall),
				levels,
			);
			for (const e of entries) {
				const level = e.level ?? 1;
				const nb = near.get(e.wall.id) ?? { a: 0, b: 0 };
				const key =
					level >= 0.999
						? "full"
						: `${level.toFixed(3)}|${nb.a.toFixed(3)}|${nb.b.toFixed(3)}`;
				if (key === e.key) continue;
				e.key = key;
				if (key === "full") {
					e.full.visible = true;
					e.dyn.group.visible = false;
				} else {
					updateDynWall(e.dyn, e.wall, e.openings, e.floorHeight, {
						level,
						rampA: nb.a,
						rampB: nb.b,
					});
					e.full.visible = false;
					e.dyn.group.visible = true;
				}
			}
			state.wallSettled = !moving;
		};

		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min((now - last) / 1000, 0.1);
			last = now;
			if (state.modeRef === "orbit") {
				controls.update();
			} else {
				const k = state.walk.keys;
				const speed = (k.has("shift") ? 4.5 : 2) * dt;
				const dir = new THREE.Vector3(
					Math.sin(state.walk.yaw),
					0,
					Math.cos(state.walk.yaw),
				);
				const right = new THREE.Vector3(
					Math.cos(state.walk.yaw),
					0,
					-Math.sin(state.walk.yaw),
				);
				if (k.has("w") || k.has("arrowup"))
					state.walk.pos.addScaledVector(dir, -speed);
				if (k.has("s") || k.has("arrowdown"))
					state.walk.pos.addScaledVector(dir, speed);
				if (k.has("a") || k.has("arrowleft"))
					state.walk.pos.addScaledVector(right, -speed);
				if (k.has("d") || k.has("arrowright"))
					state.walk.pos.addScaledVector(right, speed);
				camera.position.copy(state.walk.pos);
				camera.rotation.order = "YXZ";
				camera.rotation.y = state.walk.yaw;
				camera.rotation.x = state.walk.pitch;
			}
			applyWalls(dt);
			renderer.render(scene, camera);
			state.raf = requestAnimationFrame(loop);
		};
		state.raf = requestAnimationFrame(loop);

		// picking
		const ray = new THREE.Raycaster();
		let downAt: { x: number; y: number } | null = null;
		const el = renderer.domElement;
		const onDown = (e: PointerEvent) => {
			downAt = { x: e.clientX, y: e.clientY };
			if (state.modeRef === "walk") {
				el.setPointerCapture(e.pointerId);
			}
		};
		const onMove = (e: PointerEvent) => {
			if (state.modeRef !== "walk" || !(e.buttons & 1)) return;
			state.walk.yaw -= e.movementX * 0.004;
			state.walk.pitch = Math.max(
				-1.3,
				Math.min(1.3, state.walk.pitch - e.movementY * 0.004),
			);
		};
		const onUp = (e: PointerEvent) => {
			if (!downAt) return;
			const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
			downAt = null;
			if (moved > 4 || !state.content) return;
			const rect = el.getBoundingClientRect();
			const ndc = new THREE.Vector2(
				((e.clientX - rect.left) / rect.width) * 2 - 1,
				-((e.clientY - rect.top) / rect.height) * 2 + 1,
			);
			ray.setFromCamera(ndc, camera);
			const hits = ray.intersectObject(state.content, true);
			for (const h of hits) {
				let shown = true;
				for (let v: THREE.Object3D | null = h.object; v; v = v.parent)
					if (!v.visible) shown = false;
				if (!shown) continue;
				let o: THREE.Object3D | null = h.object;
				while (o && !o.userData.ref) o = o.parent;
				if (o?.userData.ref) {
					const ref = o.userData.ref as {
						kind: "wall" | "room" | "item";
						id: string;
						floorId: string;
					};
					if (ref.floorId !== store.getState().project.currentFloorId)
						store.setCurrentFloor(ref.floorId);
					store.select([{ kind: ref.kind, id: ref.id }]);
					return;
				}
			}
			store.select([]);
		};
		el.addEventListener("pointerdown", onDown);
		el.addEventListener("pointermove", onMove);
		el.addEventListener("pointerup", onUp);
		const kd = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.tagName === "INPUT") return;
			state.walk.keys.add(e.key.toLowerCase());
		};
		const ku = (e: KeyboardEvent) =>
			state.walk.keys.delete(e.key.toLowerCase());
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);

		const snap = () => {
			renderer.render(scene, camera);
			const a = document.createElement("a");
			a.href = renderer.domElement.toDataURL("image/png");
			a.download = `${store.getState().project.name || "projeto"}-3d.png`;
			a.click();
		};
		window.addEventListener("planner:snapshot-3d", snap);
		const frame = () => frameProject(state, store.getState().project);
		window.addEventListener("planner:fit-3d", frame);

		return () => {
			cancelAnimationFrame(state.raf);
			ro.disconnect();
			el.removeEventListener("pointerdown", onDown);
			el.removeEventListener("pointermove", onMove);
			el.removeEventListener("pointerup", onUp);
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
			window.removeEventListener("planner:snapshot-3d", snap);
			window.removeEventListener("planner:fit-3d", frame);
			if (state.content) disposeGroup(state.content);
			controls.dispose();
			renderer.dispose();
			host.removeChild(renderer.domElement);
			three.current = null;
		};
	}, [store]);

	// rebuild geometry when project changes
	useEffect(() => {
		const t = three.current;
		if (!t) return;
		const id = window.setTimeout(() => {
			if (t.content) {
				t.scene.remove(t.content);
				disposeGroup(t.content);
			}
			t.content = buildScene(project, { cutaway });
			t.scene.add(t.content);
			const sky = SKY[project.environment.sky] ?? SKY.day;
			t.scene.background = new THREE.Color(sky.bg);
			t.scene.fog = new THREE.Fog(sky.bg, 80, 220);
			t.sun.color.set(sky.sunColor);
			t.sun.intensity = sky.sun;
			t.amb.intensity = sky.amb;
			const north = (project.environment.north * Math.PI) / 180;
			t.sun.position.set(Math.cos(north) * 20, 30, Math.sin(north) * 20);
			if (t.framed !== project.id) {
				t.framed = project.id;
				frameProject(t, project);
			}
		}, 40);
		return () => window.clearTimeout(id);
	}, [project, cutaway]);

	// wall mode (full / Sims-style / lowered)
	useEffect(() => {
		wallModeRef.current = wallMode;
		if (three.current) three.current.wallSig = "";
	}, [wallMode]);

	// mode switching
	useEffect(() => {
		const t = three.current;
		if (!t) return;
		t.modeRef = mode;
		t.controls.enabled = mode === "orbit";
		if (mode === "walk") {
			const f = currentFloorOf(project);
			const elev = floorElevation(project, f.id);
			const room = f.rooms[0];
			const c = room ? polygonCentroid(room.points) : { x: 200, y: 200 };
			t.walk.pos.set(c.x * M, elev + 1.6, c.y * M);
			t.walk.yaw = 0;
			t.walk.pitch = 0;
		} else {
			frameProject(t, project);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode]);

	return <div ref={hostRef} className="relative size-full overflow-hidden" />;
}

function frameProject(
	t: { camera: THREE.PerspectiveCamera; controls: OrbitControls },
	project: Project,
) {
	const pts = project.floors.flatMap((f) => f.walls.flatMap((w) => [w.a, w.b]));
	const b = pts.length
		? boundsOf(pts)
		: { minX: 0, minY: 0, maxX: 600, maxY: 600 };
	const cx = ((b.minX + b.maxX) / 2) * M;
	const cz = ((b.minY + b.maxY) / 2) * M;
	const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 300) * M;
	const totalH = project.floors.reduce((s, f) => s + f.height * M + SLAB, 0);
	const lim = orbitLimits(size);
	t.controls.minDistance = lim.min;
	t.controls.maxDistance = lim.max;
	t.controls.target.set(cx, totalH / 3, cz);
	t.camera.position.set(cx + size * 0.9, size * 0.9 + totalH, cz + size * 1.2);
	t.controls.update();
}

export { lerp };
