import { type Box, boxOfRefs, outlineOfRef } from "#/lib/planner/bounds";
import { type Camera, type Size, toScreen } from "#/lib/planner/camera";
import { resizeCursor, rotateCursor } from "#/lib/planner/cursors";
import {
	dist,
	formatArea,
	formatLength,
	lerp,
	polygonArea,
	polygonCentroid,
	rectCorners,
	wallLength,
	wallQuad,
} from "#/lib/planner/geometry";
import { roomTypeLabel } from "#/lib/planner/materials";
import type { Guide, Measure } from "#/lib/planner/snapping";
import type {
	Floor,
	Item,
	Opening,
	Point,
	SelectionRef,
	ToolId,
	Wall,
} from "#/lib/planner/types";
import { labelBox, wallLabelAnchor } from "#/lib/planner/wall-label";
import { ItemShape, OpeningShape } from "./plan-shapes";

export type OverlayProps = {
	floor: Floor;
	cam: Camera;
	size: Size;
	units: "metric" | "imperial";
	selection: SelectionRef[];
	hover: SelectionRef | null;
	tool: ToolId;
	showDimensions: boolean;
	showRoomLabels: boolean;
	guides: Guide[];
	measures: Measure[];
	marquee: { a: Point; b: Point } | null;
	chain: { start: Point } | null;
	polyDraft: Point[];
	cursor: Point | null;
	rectDraft: { a: Point; b: Point } | null;
	rulerDraft: { a: Point; b: Point } | null;
	ghostItem: Item | null;
	ghostOpening: { wall: Wall; opening: Opening } | null;
	/** Wall the preview is magnetised to (placing an opening or a wall-flush item). */
	targetWall: Wall | null;
	badge: { x: number; y: number; text: string } | null;
	renamingRoomId: string | null;
	editingWallId: string | null;
};

const SEL = "var(--selection)";
const GUIDE = "var(--guide)";
const HANDLE = 8;

export function Pill({
	x,
	y,
	text,
	bg = SEL,
	fg = "#fff",
}: {
	x: number;
	y: number;
	text: string;
	bg?: string;
	fg?: string;
}) {
	const w = text.length * 6.4 + 14;
	return (
		<g transform={`translate(${x} ${y})`} pointerEvents="none">
			<rect x={-w / 2} y={-9} width={w} height={18} rx={4} fill={bg} />
			<text
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={11}
				fontWeight={500}
				fill={fg}
			>
				{text}
			</text>
		</g>
	);
}

const haloText = {
	paintOrder: "stroke",
	stroke: "var(--background)",
	strokeWidth: 3,
	strokeLinejoin: "round",
} as const;

export function PlanOverlay(p: OverlayProps) {
	const { cam, floor, units } = p;
	const S = (pt: Point) => toScreen(cam, pt);
	const pts = (poly: Point[]) =>
		poly
			.map((q) => {
				const s = S(q);
				return `${s.x},${s.y}`;
			})
			.join(" ");
	const isSel = (r: SelectionRef) =>
		p.selection.some((s) => s.kind === r.kind && s.id === r.id);

	// ---- single item/stair frame (resize + rotate handles)
	const only = p.selection.length === 1 ? p.selection[0] : null;
	const frameItem =
		only?.kind === "item" ? floor.items.find((i) => i.id === only.id) : null;
	const frameStair =
		only?.kind === "stair" ? floor.stairs.find((i) => i.id === only.id) : null;
	const frame = frameItem
		? {
				id: frameItem.id,
				x: frameItem.x,
				y: frameItem.y,
				w: frameItem.w,
				d: frameItem.d,
				rot: frameItem.rotation,
				locked: frameItem.locked,
			}
		: frameStair
			? {
					id: frameStair.id,
					x: frameStair.x,
					y: frameStair.y,
					w: frameStair.width,
					d: frameStair.length,
					rot: frameStair.rotation,
					locked: false,
				}
			: null;

	const selBox: Box | null = boxOfRefs(floor, p.selection);
	const selBoxScreen = selBox
		? {
				x: selBox.minX * cam.zoom + cam.x,
				y: selBox.minY * cam.zoom + cam.y,
				w: (selBox.maxX - selBox.minX) * cam.zoom,
				h: (selBox.maxY - selBox.minY) * cam.zoom,
			}
		: null;

	const hoverVisible = p.hover && !isSel(p.hover) && p.tool === "select";
	const centroid = (() => {
		const a = floor.walls.flatMap((w) => [w.a, w.b]);
		if (a.length === 0) return { x: 0, y: 0 };
		return {
			x: a.reduce((s, q) => s + q.x, 0) / a.length,
			y: a.reduce((s, q) => s + q.y, 0) / a.length,
		};
	})();

	return (
		<svg
			width={p.size.w}
			height={p.size.h}
			className="pointer-events-none absolute inset-0"
			role="presentation"
		>
			{/* world-space previews */}
			<g transform={`translate(${cam.x} ${cam.y}) scale(${cam.zoom})`}>
				{p.ghostItem && (
					<g opacity={0.65} pointerEvents="none">
						<ItemShape item={p.ghostItem} />
					</g>
				)}
				{p.ghostOpening && (
					<g opacity={0.75} pointerEvents="none">
						<OpeningShape
							wall={p.ghostOpening.wall}
							opening={p.ghostOpening.opening}
							selected
						/>
					</g>
				)}
				{p.chain && p.cursor && (
					<line
						x1={p.chain.start.x}
						y1={p.chain.start.y}
						x2={p.cursor.x}
						y2={p.cursor.y}
						stroke={SEL}
						strokeWidth={p.tool === "partition" ? 10 : 20}
						strokeOpacity={0.5}
						strokeLinecap="square"
					/>
				)}
				{p.rectDraft && (
					<rect
						x={Math.min(p.rectDraft.a.x, p.rectDraft.b.x)}
						y={Math.min(p.rectDraft.a.y, p.rectDraft.b.y)}
						width={Math.abs(p.rectDraft.b.x - p.rectDraft.a.x)}
						height={Math.abs(p.rectDraft.b.y - p.rectDraft.a.y)}
						fill={SEL}
						fillOpacity={0.12}
						stroke={SEL}
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
				)}
				{p.rulerDraft && (
					<line
						x1={p.rulerDraft.a.x}
						y1={p.rulerDraft.a.y}
						x2={p.rulerDraft.b.x}
						y2={p.rulerDraft.b.y}
						stroke="#0284c7"
						strokeWidth={1.6}
						strokeDasharray="6 4"
						vectorEffect="non-scaling-stroke"
					/>
				)}
				{p.polyDraft.length > 0 && (
					<path
						d={
							p.polyDraft
								.map((q, i) => `${i === 0 ? "M" : "L"} ${q.x} ${q.y}`)
								.join(" ") + (p.cursor ? ` L ${p.cursor.x} ${p.cursor.y}` : "")
						}
						fill={SEL}
						fillOpacity={0.12}
						stroke={SEL}
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
					/>
				)}
			</g>

			{/* placement preview chrome: target wall, outline and size pill */}
			{p.targetWall && (
				<polygon
					points={pts(wallQuad(p.targetWall))}
					fill={SEL}
					fillOpacity={0.12}
					stroke={SEL}
					strokeWidth={1.5}
					strokeDasharray="5 3"
					strokeLinejoin="round"
				/>
			)}
			{p.ghostItem &&
				(() => {
					const g = p.ghostItem;
					const corners = rectCorners(g.x, g.y, g.w, g.d, g.rotation).map(S);
					const cx = corners.reduce((a, q) => a + q.x, 0) / corners.length;
					const by = Math.max(...corners.map((q) => q.y));
					return (
						<g pointerEvents="none">
							<polygon
								points={corners.map((q) => `${q.x},${q.y}`).join(" ")}
								fill="none"
								stroke={SEL}
								strokeWidth={1.5}
							/>
							<Pill
								x={cx}
								y={by + 16}
								text={`${formatLength(g.w, units)} × ${formatLength(g.d, units)}`}
							/>
						</g>
					);
				})()}
			{p.ghostOpening &&
				(() => {
					const { wall, opening } = p.ghostOpening;
					const c = S(lerp(wall.a, wall.b, opening.t));
					return (
						<Pill
							x={c.x}
							y={c.y - 22}
							text={formatLength(opening.width, units)}
						/>
					);
				})()}

			{/* hover */}
			{hoverVisible &&
				p.hover &&
				(() => {
					const o = outlineOfRef(floor, p.hover);
					if (!o) return null;
					return (
						<polygon
							points={pts(o)}
							fill={p.hover.kind === "room" ? SEL : "none"}
							fillOpacity={0.06}
							stroke={SEL}
							strokeWidth={1.5}
							strokeLinejoin="round"
						/>
					);
				})()}

			{/* selection outlines */}
			{p.selection.map((r) => {
				const o = outlineOfRef(floor, r);
				if (!o) return null;
				const open = r.kind === "ruler";
				const Tag = open ? "polyline" : "polygon";
				return (
					<Tag
						key={`${r.kind}-${r.id}`}
						points={pts(o)}
						fill={r.kind === "room" || r.kind === "opening" ? SEL : "none"}
						fillOpacity={r.kind === "room" ? 0.08 : 0.2}
						stroke={SEL}
						strokeWidth={1.5}
						strokeLinejoin="round"
					/>
				);
			})}

			{/* bounding box for multi selection */}
			{p.selection.length > 1 && selBoxScreen && (
				<rect
					x={selBoxScreen.x}
					y={selBoxScreen.y}
					width={selBoxScreen.w}
					height={selBoxScreen.h}
					fill="none"
					stroke={SEL}
					strokeWidth={1}
				/>
			)}

			{/* guides + measurements */}
			{p.guides.map((g, i) => {
				const a =
					g.axis === "x"
						? S({ x: g.pos, y: g.from })
						: S({ x: g.from, y: g.pos });
				const b =
					g.axis === "x" ? S({ x: g.pos, y: g.to }) : S({ x: g.to, y: g.pos });
				const cross = (q: Point) => (
					<g key={`${q.x}-${q.y}`}>
						<line
							x1={q.x - 3}
							y1={q.y - 3}
							x2={q.x + 3}
							y2={q.y + 3}
							stroke={GUIDE}
						/>
						<line
							x1={q.x - 3}
							y1={q.y + 3}
							x2={q.x + 3}
							y2={q.y - 3}
							stroke={GUIDE}
						/>
					</g>
				);
				return (
					<g key={i} shapeRendering="crispEdges">
						<line
							x1={a.x}
							y1={a.y}
							x2={b.x}
							y2={b.y}
							stroke={GUIDE}
							strokeWidth={1}
						/>
						{cross(a)}
						{cross(b)}
					</g>
				);
			})}
			{p.measures.map((m, i) => {
				const a = S(m.a);
				const b = S(m.b);
				const horizontal = Math.abs(b.y - a.y) < Math.abs(b.x - a.x);
				const mid = lerp(a, b, 0.5);
				return (
					<g key={i}>
						<line
							x1={a.x}
							y1={a.y}
							x2={b.x}
							y2={b.y}
							stroke={GUIDE}
							strokeWidth={1}
						/>
						{horizontal ? (
							<>
								<line
									x1={a.x}
									y1={a.y - 4}
									x2={a.x}
									y2={a.y + 4}
									stroke={GUIDE}
								/>
								<line
									x1={b.x}
									y1={b.y - 4}
									x2={b.x}
									y2={b.y + 4}
									stroke={GUIDE}
								/>
							</>
						) : (
							<>
								<line
									x1={a.x - 4}
									y1={a.y}
									x2={a.x + 4}
									y2={a.y}
									stroke={GUIDE}
								/>
								<line
									x1={b.x - 4}
									y1={b.y}
									x2={b.x + 4}
									y2={b.y}
									stroke={GUIDE}
								/>
							</>
						)}
						<Pill
							x={mid.x + (horizontal ? 0 : 22)}
							y={mid.y + (horizontal ? -14 : 0)}
							text={formatLength(m.value, units)}
							bg={GUIDE}
						/>
					</g>
				);
			})}

			{/* labels (clickable: double click renames a room / edits a wall length) */}
			{p.showRoomLabels &&
				floor.rooms.map((r) => {
					if (r.id === p.renamingRoomId) return null;
					const c = S(polygonCentroid(r.points));
					const sp = r.points.map(S);
					const bw =
						Math.max(...sp.map((q) => q.x)) - Math.min(...sp.map((q) => q.x));
					const bh =
						Math.max(...sp.map((q) => q.y)) - Math.min(...sp.map((q) => q.y));
					if (bw < 64 || bh < 36) return null;
					const name = r.name || roomTypeLabel(r.type);
					const box = labelBox(name);
					return (
						<g key={`l-${r.id}`} textAnchor="middle" fill="#1f2937">
							<rect
								data-kind="roomlabel"
								data-id={r.id}
								x={c.x - box.w / 2}
								y={c.y - 4 - box.h / 2 - 3}
								width={box.w}
								height={box.h}
								rx={4}
								fill="transparent"
								style={{ pointerEvents: "all", cursor: "text" }}
							/>
							<text
								x={c.x}
								y={c.y - 4}
								fontSize={12}
								fontWeight={600}
								pointerEvents="none"
								style={haloText}
								strokeOpacity={0.6}
							>
								{name}
							</text>
							<text
								x={c.x}
								y={c.y + 11}
								fontSize={11}
								fill="#4b5563"
								pointerEvents="none"
								style={haloText}
								strokeOpacity={0.6}
							>
								{formatArea(polygonArea(r.points), units)}
							</text>
						</g>
					);
				})}
			{p.showDimensions &&
				floor.walls.map((w) => {
					if (w.hidden || w.id === p.editingWallId) return null;
					const len = wallLength(w);
					if (len * cam.zoom < 56) return null;
					const { x, y, deg } = wallLabelAnchor(w, cam, centroid);
					const text = formatLength(len, units);
					const box = labelBox(text);
					return (
						<g
							key={`d-${w.id}`}
							transform={`translate(${x} ${y}) rotate(${deg})`}
						>
							<rect
								data-kind="dim"
								data-id={w.id}
								x={-box.w / 2}
								y={-box.h / 2}
								width={box.w}
								height={box.h}
								rx={4}
								fill="transparent"
								style={{ pointerEvents: "all", cursor: "text" }}
							/>
							<text
								fontSize={11}
								fill="#374151"
								textAnchor="middle"
								dominantBaseline="central"
								pointerEvents="none"
								style={haloText}
							>
								{text}
							</text>
						</g>
					);
				})}
			{floor.rulers.map((r) => {
				const m = S(lerp(r.a, r.b, 0.5));
				return (
					<Pill
						key={`rl-${r.id}`}
						x={m.x}
						y={m.y - 12}
						text={formatLength(dist(r.a, r.b), units)}
						bg="#0284c7"
					/>
				);
			})}

			{/* handles: walls, rooms */}
			{only?.kind === "wall" &&
				(() => {
					const w = floor.walls.find((x) => x.id === only.id);
					if (!w) return null;
					return (["a", "b"] as const).map((end) => {
						const s = S(w[end]);
						return (
							<circle
								key={end}
								data-kind="handle"
								data-id={w.id}
								data-extra={`joint-${end}`}
								cx={s.x}
								cy={s.y}
								r={5.5}
								fill="#fff"
								stroke={SEL}
								strokeWidth={1.5}
								style={{ pointerEvents: "all", cursor: "move" }}
							/>
						);
					});
				})()}
			{only?.kind === "room" &&
				(() => {
					const r = floor.rooms.find((x) => x.id === only.id);
					if (!r) return null;
					return r.points.map((q, i) => {
						const s = S(q);
						return (
							<rect
								key={`${r.id}-${i}`}
								data-kind="handle"
								data-id={`${r.id}#${i}`}
								data-extra="vertex"
								x={s.x - HANDLE / 2}
								y={s.y - HANDLE / 2}
								width={HANDLE}
								height={HANDLE}
								fill="#fff"
								stroke={SEL}
								strokeWidth={1.5}
								style={{ pointerEvents: "all", cursor: "move" }}
							/>
						);
					});
				})()}

			{/* item / stair frame with 8 resize handles and 4 rotate zones */}
			{frame &&
				!frame.locked &&
				(() => {
					const rad = (frame.rot * Math.PI) / 180;
					const u = { x: Math.cos(rad), y: Math.sin(rad) };
					const v = { x: -Math.sin(rad), y: Math.cos(rad) };
					const corners = rectCorners(
						frame.x,
						frame.y,
						frame.w,
						frame.d,
						frame.rot,
					).map(S);
					const kind = frameItem ? "item" : "stair";
					const dirs: [number, number][] = [
						[-1, -1],
						[0, -1],
						[1, -1],
						[1, 0],
						[1, 1],
						[0, 1],
						[-1, 1],
						[-1, 0],
					];
					const at = (hx: number, hy: number) =>
						S({
							x: frame.x + (hx * frame.w * u.x) / 2 + (hy * frame.d * v.x) / 2,
							y: frame.y + (hx * frame.w * u.y) / 2 + (hy * frame.d * v.y) / 2,
						});
					const dirAngle = (hx: number, hy: number) =>
						(Math.atan2(hx * u.y + hy * v.y, hx * u.x + hy * v.x) * 180) /
						Math.PI;
					return (
						<g>
							<polygon
								points={corners.map((q) => `${q.x},${q.y}`).join(" ")}
								fill="none"
								stroke={SEL}
								strokeWidth={1}
							/>
							{dirs
								.filter(([hx, hy]) => hx !== 0 && hy !== 0)
								.map(([hx, hy]) => {
									const s = at(hx, hy);
									const a = dirAngle(hx, hy);
									const ox = Math.cos((a * Math.PI) / 180) * 11;
									const oy = Math.sin((a * Math.PI) / 180) * 11;
									return (
										<circle
											key={`r${hx}${hy}`}
											data-kind="handle"
											data-id={frame.id}
											data-extra={`rotate:${kind}`}
											cx={s.x + ox}
											cy={s.y + oy}
											r={11}
											fill="transparent"
											style={{ pointerEvents: "all", cursor: rotateCursor(a) }}
										/>
									);
								})}
							{dirs.map(([hx, hy]) => {
								const s = at(hx, hy);
								const a = dirAngle(hx, hy);
								return (
									<rect
										key={`h${hx}${hy}`}
										data-kind="handle"
										data-id={frame.id}
										data-extra={`resize:${kind}:${hx}:${hy}`}
										x={s.x - HANDLE / 2}
										y={s.y - HANDLE / 2}
										width={HANDLE}
										height={HANDLE}
										fill="#fff"
										stroke={SEL}
										strokeWidth={1.5}
										style={{ pointerEvents: "all", cursor: resizeCursor(a) }}
									/>
								);
							})}
						</g>
					);
				})()}

			{/* dimension pill under the selection */}
			{selBox &&
				selBoxScreen &&
				p.tool === "select" &&
				p.selection.some(
					(s) => s.kind !== "wall" && s.kind !== "room" && s.kind !== "opening",
				) && (
					<Pill
						x={selBoxScreen.x + selBoxScreen.w / 2}
						y={selBoxScreen.y + selBoxScreen.h + (frame ? 26 : 16)}
						text={
							frame
								? `${formatLength(frame.w, units)} × ${formatLength(frame.d, units)}`
								: `${formatLength(selBox.maxX - selBox.minX, units)} × ${formatLength(selBox.maxY - selBox.minY, units)}`
						}
					/>
				)}

			{/* drafting readouts */}
			{p.chain && p.cursor && (
				<Pill
					x={S(p.cursor).x + 14}
					y={S(p.cursor).y - 20}
					text={`${formatLength(dist(p.chain.start, p.cursor), units)} · ${Math.round(((Math.atan2(p.cursor.y - p.chain.start.y, p.cursor.x - p.chain.start.x) * 180) / Math.PI + 360) % 360)}°`}
				/>
			)}
			{p.rectDraft && (
				<Pill
					x={S(lerp(p.rectDraft.a, p.rectDraft.b, 0.5)).x}
					y={S(lerp(p.rectDraft.a, p.rectDraft.b, 0.5)).y}
					text={`${formatLength(Math.abs(p.rectDraft.b.x - p.rectDraft.a.x), units)} × ${formatLength(Math.abs(p.rectDraft.b.y - p.rectDraft.a.y), units)}`}
				/>
			)}
			{p.rulerDraft && (
				<Pill
					x={S(lerp(p.rulerDraft.a, p.rulerDraft.b, 0.5)).x}
					y={S(lerp(p.rulerDraft.a, p.rulerDraft.b, 0.5)).y - 12}
					text={formatLength(dist(p.rulerDraft.a, p.rulerDraft.b), units)}
					bg="#0284c7"
				/>
			)}
			{p.polyDraft.length > 0 &&
				p.polyDraft.map((q, i) => {
					const s = S(q);
					return (
						<circle
							key={i}
							cx={s.x}
							cy={s.y}
							r={i === 0 ? 6 : 3.5}
							fill={i === 0 ? SEL : "#fff"}
							stroke={SEL}
							strokeWidth={1.5}
						/>
					);
				})}

			{p.marquee && (
				<rect
					x={Math.min(S(p.marquee.a).x, S(p.marquee.b).x)}
					y={Math.min(S(p.marquee.a).y, S(p.marquee.b).y)}
					width={Math.abs(S(p.marquee.b).x - S(p.marquee.a).x)}
					height={Math.abs(S(p.marquee.b).y - S(p.marquee.a).y)}
					fill={SEL}
					fillOpacity={0.08}
					stroke={SEL}
					strokeWidth={1}
				/>
			)}
			{p.badge && <Pill x={p.badge.x} y={p.badge.y} text={p.badge.text} />}
		</svg>
	);
}
