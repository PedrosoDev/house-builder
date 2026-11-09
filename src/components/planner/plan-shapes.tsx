import type { Part } from "#/lib/planner/catalog";
import { itemById } from "#/lib/planner/catalog";
import { lerp, wallAngle, wallLength } from "#/lib/planner/geometry";
import type { Item, Opening, Point, Wall } from "#/lib/planner/types";

/**
 * World-space shapes. Stroke widths are fixed in screen pixels (`vector-effect: non-scaling-stroke`),
 * so these never depend on the camera and the scene can be memoized across zoom/pan.
 */

const NS = "non-scaling-stroke" as const;

function partColor(c: Part["c"], item: Pick<Item, "color" | "accent">) {
	if (!c || c === "main") return item.color;
	if (c === "accent") return item.accent;
	return c;
}

function dim(hex: string, amt: number) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return hex;
	const n = Number.parseInt(m[1], 16);
	const f = (v: number) => Math.max(0, Math.min(255, v + amt));
	return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function openingEnds(w: Wall, o: Pick<Opening, "t" | "width">) {
	const len = wallLength(w) || 1;
	const half = o.width / 2 / len;
	return { s: lerp(w.a, w.b, o.t - half), e: lerp(w.a, w.b, o.t + half) };
}

export function OpeningShape({
	wall,
	opening: o,
	selected = false,
}: {
	wall: Wall;
	opening: Opening;
	selected?: boolean;
}) {
	const { s, e } = openingEnds(wall, o);
	const ang = wallAngle(wall);
	const n = { x: -Math.sin(ang), y: Math.cos(ang) };
	const half = wall.thickness / 2;
	const stroke = selected ? "var(--selection)" : "#1f2937";
	const c = lerp(s, e, 0.5);
	const line = (
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		w = 1.4,
		extra: Record<string, string | number> = {},
	) => (
		<line
			x1={x1}
			y1={y1}
			x2={x2}
			y2={y2}
			stroke={stroke}
			strokeWidth={w}
			vectorEffect={NS}
			{...extra}
		/>
	);

	const side = o.mirror ? -1 : 1;
	const leaf = (hinge: Point, other: Point, width: number) => {
		const tip = {
			x: hinge.x + n.x * side * width,
			y: hinge.y + n.y * side * width,
		};
		const v1 = { x: tip.x - hinge.x, y: tip.y - hinge.y };
		const v2 = { x: other.x - hinge.x, y: other.y - hinge.y };
		const sweep = v1.x * v2.y - v1.y * v2.x > 0 ? 1 : 0;
		return (
			<g>
				{line(hinge.x, hinge.y, tip.x, tip.y, 2)}
				<path
					d={`M ${tip.x} ${tip.y} A ${width} ${width} 0 0 ${sweep} ${other.x} ${other.y}`}
					fill="none"
					stroke={stroke}
					strokeWidth={1}
					strokeDasharray="4 3"
					vectorEffect={NS}
				/>
			</g>
		);
	};

	let body: React.ReactNode;
	switch (o.kind) {
		case "door":
			body = o.flip ? leaf(e, s, o.width) : leaf(s, e, o.width);
			break;
		case "doubleDoor":
			body = (
				<>
					{leaf(s, c, o.width / 2)}
					{leaf(e, c, o.width / 2)}
				</>
			);
			break;
		case "slidingDoor":
			body = (
				<>
					{line(
						s.x + n.x * half * 0.4,
						s.y + n.y * half * 0.4,
						c.x + n.x * half * 0.4,
						c.y + n.y * half * 0.4,
						2.5,
					)}
					{line(
						c.x - n.x * half * 0.4,
						c.y - n.y * half * 0.4,
						e.x - n.x * half * 0.4,
						e.y - n.y * half * 0.4,
						2.5,
					)}
				</>
			);
			break;
		case "window":
			body = (
				<>
					{line(
						s.x + n.x * half * 0.55,
						s.y + n.y * half * 0.55,
						e.x + n.x * half * 0.55,
						e.y + n.y * half * 0.55,
					)}
					<line
						x1={s.x}
						y1={s.y}
						x2={e.x}
						y2={e.y}
						stroke="#38bdf8"
						strokeWidth={2.5}
						vectorEffect={NS}
					/>
					{line(
						s.x - n.x * half * 0.55,
						s.y - n.y * half * 0.55,
						e.x - n.x * half * 0.55,
						e.y - n.y * half * 0.55,
					)}
				</>
			);
			break;
		case "garage":
			body = line(s.x, s.y, e.x, e.y, 2.5, { strokeDasharray: "10 5" });
			break;
		default:
			body = (
				<path
					d={`M ${s.x} ${s.y} A ${o.width / 2} ${o.width / 2} 0 0 ${side > 0 ? 1 : 0} ${e.x} ${e.y}`}
					fill="none"
					stroke={stroke}
					strokeWidth={1.2}
					strokeDasharray="4 3"
					vectorEffect={NS}
				/>
			);
	}
	return (
		<g data-kind="opening" data-id={o.id} style={{ cursor: "pointer" }}>
			<line
				x1={s.x}
				y1={s.y}
				x2={e.x}
				y2={e.y}
				stroke="transparent"
				strokeWidth={wall.thickness + 8}
			/>
			{line(
				s.x + n.x * half,
				s.y + n.y * half,
				s.x - n.x * half,
				s.y - n.y * half,
			)}
			{line(
				e.x + n.x * half,
				e.y + n.y * half,
				e.x - n.x * half,
				e.y - n.y * half,
			)}
			{body}
		</g>
	);
}

export function ItemShape({ item: it }: { item: Item }) {
	const def = itemById(it.catalogId);
	const sx = it.w / (def?.size[0] ?? it.w);
	const sd = it.d / (def?.size[2] ?? it.d);
	const ordered = [...(def?.parts ?? [])].sort(
		(a, b) => a.p[1] + a.s[1] - (b.p[1] + b.s[1]),
	);
	const w = def?.size[0] ?? it.w;
	const d = def?.size[2] ?? it.d;
	return (
		<g
			data-kind="item"
			data-id={it.id}
			transform={`translate(${it.x} ${it.y}) rotate(${it.rotation}) scale(${it.flipped ? -sx : sx} ${sd})`}
		>
			<rect x={-w / 2} y={-d / 2} width={w} height={d} fill="transparent" />
			{ordered.map((p, i) => {
				const col = dim(partColor(p.c, it), -Math.round(p.p[1] * 14));
				const cx = p.p[0] * w;
				const cy = p.p[2] * d;
				const pw = p.s[0] * w;
				const pd = p.s[2] * d;
				return p.t === "box" ? (
					<rect
						key={i}
						x={cx - pw / 2}
						y={cy - pd / 2}
						width={pw}
						height={pd}
						fill={col}
						stroke="rgba(0,0,0,0.35)"
						strokeWidth={0.8}
						vectorEffect={NS}
					/>
				) : (
					<ellipse
						key={i}
						cx={cx}
						cy={cy}
						rx={pw / 2}
						ry={pd / 2}
						fill={col}
						stroke="rgba(0,0,0,0.35)"
						strokeWidth={0.8}
						vectorEffect={NS}
					/>
				);
			})}
		</g>
	);
}
