import type { Floor, Opening, Point } from "./types";

/** Raio do corpo do visitante (cm): quão perto das paredes ele consegue chegar. */
export const PLAYER_RADIUS = 25;
/** Tamanho máximo de cada sub-passo (cm): evita atravessar parede com um passo grande. */
const MAX_STEP = 10;
/**
 * O vão deixa passar? Arco, porta de correr e garagem (que não têm animação de abrir) são
 * sempre livres; portas de giro só quando abertas; janelas nunca.
 */
export function isPassable(o: Opening): boolean {
	if (o.kind === "window") return false;
	if (o.kind === "door" || o.kind === "doubleDoor") return o.open;
	return true;
}

export type V3 = { x: number; y: number; z: number };

/** Pedaço sólido de parede: retângulo orientado (coordenadas da planta, cm). */
type Block = {
	cx: number;
	cy: number;
	cos: number;
	sin: number;
	halfLen: number;
	halfThick: number;
};

/** Trechos sólidos das paredes: o comprimento da parede menos os vãos que deixam passar (`isPassable`). */
function blocksOf(floor: Floor): Block[] {
	const blocks: Block[] = [];
	for (const w of floor.walls) {
		if (w.hidden) continue;
		const dx = w.b.x - w.a.x;
		const dy = w.b.y - w.a.y;
		const len = Math.hypot(dx, dy);
		if (len < 1e-6) continue;
		const cos = dx / len;
		const sin = dy / len;
		const gaps = floor.openings
			.filter((o) => o.wallId === w.id && isPassable(o))
			.map((o) => [o.t * len - o.width / 2, o.t * len + o.width / 2] as const)
			.sort((p, q) => p[0] - q[0]);
		let from = 0;
		const add = (s: number, e: number) => {
			if (e - s < 1e-6) return;
			const mid = (s + e) / 2;
			blocks.push({
				cx: w.a.x + cos * mid,
				cy: w.a.y + sin * mid,
				cos,
				sin,
				halfLen: (e - s) / 2,
				halfThick: w.thickness / 2,
			});
		};
		for (const [s, e] of gaps) {
			add(from, Math.min(s, len));
			from = Math.max(from, e);
		}
		add(from, len);
	}
	return blocks;
}

/** Se o círculo (centro `p`, raio `r`) invade o bloco, devolve o ponto empurrado para fora. */
function pushOut(p: Point, r: number, b: Block): Point | null {
	const rx = p.x - b.cx;
	const ry = p.y - b.cy;
	const u = rx * b.cos + ry * b.sin; // ao longo da parede
	const v = -rx * b.sin + ry * b.cos; // através da parede
	const ex = Math.max(Math.abs(u) - b.halfLen, 0);
	const ey = Math.max(Math.abs(v) - b.halfThick, 0);
	const dist = Math.hypot(ex, ey);
	if (dist >= r) return null;
	let nu: number;
	let nv: number;
	if (dist > 1e-9) {
		// fora do retângulo: empurra na direção do ponto mais próximo
		const k = r / dist;
		nu = Math.sign(u) * (b.halfLen + ex * k);
		nv = Math.sign(v) * (b.halfThick + ey * k);
		if (ex === 0) nu = u;
		if (ey === 0) nv = v;
	} else {
		// dentro do retângulo: sai pelo lado mais raso
		const outU = b.halfLen + r - Math.abs(u);
		const outV = b.halfThick + r - Math.abs(v);
		if (outV <= outU) {
			nu = u;
			nv = (v >= 0 ? 1 : -1) * (b.halfThick + r);
		} else {
			nu = (u >= 0 ? 1 : -1) * (b.halfLen + r);
			nv = v;
		}
	}
	return {
		x: b.cx + nu * b.cos - nv * b.sin,
		y: b.cy + nu * b.sin + nv * b.cos,
	};
}

/** Anda de `from` até `to` sem atravessar paredes: encosta e desliza. Portas deixam passar. */
export function moveWithCollision(
	floor: Floor,
	from: Point,
	to: Point,
	radius = PLAYER_RADIUS,
): Point {
	const blocks = blocksOf(floor);
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / MAX_STEP));
	const ideal = (i: number): Point => ({
		x: from.x + (dx * i) / steps,
		y: from.y + (dy * i) / steps,
	});
	let p: Point = { x: from.x, y: from.y };
	for (let i = 0; i < steps; i++) {
		// o deslocamento causado pelas colisões dos passos anteriores vale para os próximos
		// (é o que faz deslizar); sem colisão ele é exatamente 0 e não acumula erro de float
		const prev = ideal(i);
		const next = ideal(i + 1);
		p = { x: next.x + (p.x - prev.x), y: next.y + (p.y - prev.y) };
		// duas passadas resolvem quinas onde dois blocos se tocam
		for (let pass = 0; pass < 2; pass++) {
			for (const b of blocks) {
				const out = pushOut(p, radius, b);
				if (out) p = out;
			}
		}
	}
	return p;
}

/** O teleporte só vale se o destino não encosta numa parede e o caminho até ele está livre. */
export function canTeleport(floor: Floor, from: Point, to: Point): boolean {
	const blocks = blocksOf(floor);
	if (blocks.some((b) => pushOut(to, PLAYER_RADIUS - 0.5, b))) return false;
	const reached = moveWithCollision(floor, from, to);
	return Math.hypot(reached.x - to.x, reached.y - to.y) < 0.5;
}

const GRAVITY = 9.8;
const ARC_SPEED = 9; // m/s: alcance de ~8 m a 45°
const ARC_DT = 0.02;
const ARC_MAX_TIME = 3;
const ARC_MIN_RANGE = 0.5;

/**
 * Arco de teleporte (projétil) saindo do controle. Devolve o ponto onde ele toca o piso
 * (`floorY`) e o caminho para desenhar, ou `null` se não há ponto válido
 * (apontando para cima, perto demais ou além do alcance). Unidades em metros.
 */
export function arcFloorHit(
	origin: V3,
	dir: V3,
	floorY: number,
	opts: { maxRange?: number } = {},
): { point: V3; path: V3[] } | null {
	const maxRange = opts.maxRange ?? 12;
	const n = Math.hypot(dir.x, dir.y, dir.z);
	if (n < 1e-9) return null;
	const v = {
		x: (dir.x / n) * ARC_SPEED,
		y: (dir.y / n) * ARC_SPEED,
		z: (dir.z / n) * ARC_SPEED,
	};
	const at = (t: number): V3 => ({
		x: origin.x + v.x * t,
		y: origin.y + v.y * t - 0.5 * GRAVITY * t * t,
		z: origin.z + v.z * t,
	});
	const path: V3[] = [at(0)];
	for (let t = ARC_DT; t <= ARC_MAX_TIME; t += ARC_DT) {
		const prev = path[path.length - 1];
		const cur = at(t);
		if (cur.y <= floorY && prev.y > floorY) {
			const k = (prev.y - floorY) / (prev.y - cur.y);
			const point = {
				x: prev.x + (cur.x - prev.x) * k,
				y: floorY,
				z: prev.z + (cur.z - prev.z) * k,
			};
			path.push(point);
			const range = Math.hypot(point.x - origin.x, point.z - origin.z);
			if (range < ARC_MIN_RANGE || range > maxRange) return null;
			return { point, path };
		}
		path.push(cur);
	}
	return null;
}

/** Gira `yaw` (rad) um passo: `dir` = 1 para a direita, −1 para a esquerda. Resultado em [−π, π]. */
export function snapTurn(yaw: number, dir: 1 | -1, stepDeg: number): number {
	let y = yaw - dir * ((stepDeg * Math.PI) / 180);
	while (y > Math.PI) y -= 2 * Math.PI;
	while (y < -Math.PI) y += 2 * Math.PI;
	return y;
}

function centerOf(points: Point[]): Point | null {
	if (points.length === 0) return null;
	const xs = points.map((p) => p.x);
	const ys = points.map((p) => p.y);
	return {
		x: (Math.min(...xs) + Math.max(...xs)) / 2,
		y: (Math.min(...ys) + Math.max(...ys)) / 2,
	};
}

/** Onde o visitante nasce: centro do primeiro cômodo; sem cômodos, centro das paredes. */
export function spawnPoint(floor: Floor): Point {
	const room = floor.rooms.find((r) => r.points.length >= 3);
	const fromRoom = room ? centerOf(room.points) : null;
	if (fromRoom) return fromRoom;
	const ends = floor.walls.flatMap((w) => [w.a, w.b]);
	return centerOf(ends) ?? { x: 0, y: 0 };
}
