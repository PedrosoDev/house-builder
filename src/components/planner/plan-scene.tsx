import { memo } from "react";
import { renderOrder } from "#/lib/planner/layers";
import { materialDataUrl, TILE_CM } from "#/lib/planner/textures";
import type { Floor, MaterialRef } from "#/lib/planner/types";
import { ItemShape, OpeningShape, openingEnds } from "./plan-shapes";

const BIG = 200000;

export const matKey = (m: MaterialRef) =>
	`${m.texture}-${m.color.replace("#", "")}-${m.scale}-${m.rotation}`;

/**
 * The drawing itself (rooms, walls, openings, stairs, items, rulers). It is memoized on the floor data, so zooming
 * and panning (which only change the parent group's transform) never re-render it. Selection, hover, handles,
 * labels and guides live in the screen-space overlay.
 */
export const PlanScene = memo(function PlanScene({
	floor,
	below,
}: {
	floor: Floor;
	below: Floor | null;
}) {
	const materials = new Map<string, MaterialRef>();
	for (const r of floor.rooms)
		if (r.floor.texture) materials.set(matKey(r.floor), r.floor);

	return (
		<>
			<defs>
				{[...materials.entries()].map(([key, m]) => {
					const url = materialDataUrl(m);
					if (!url) return null;
					const s = TILE_CM * m.scale;
					return (
						<pattern
							key={key}
							id={`mat-${key}`}
							width={s}
							height={s}
							patternUnits="userSpaceOnUse"
							patternTransform={`rotate(${m.rotation})`}
						>
							<image href={url} width={s} height={s} />
						</pattern>
					);
				})}
				<mask
					id="wall-mask"
					maskUnits="userSpaceOnUse"
					x={-BIG}
					y={-BIG}
					width={BIG * 2}
					height={BIG * 2}
				>
					<rect
						x={-BIG}
						y={-BIG}
						width={BIG * 2}
						height={BIG * 2}
						fill="white"
					/>
					{floor.openings.map((o) => {
						const w = floor.walls.find((x) => x.id === o.wallId);
						if (!w) return null;
						const { s, e } = openingEnds(w, o);
						return (
							<line
								key={o.id}
								x1={s.x}
								y1={s.y}
								x2={e.x}
								y2={e.y}
								stroke="black"
								strokeWidth={w.thickness + 4}
							/>
						);
					})}
				</mask>
			</defs>

			{below && (
				<g opacity={0.25} pointerEvents="none">
					{below.walls.map((w) => (
						<line
							key={w.id}
							x1={w.a.x}
							y1={w.a.y}
							x2={w.b.x}
							y2={w.b.y}
							stroke="currentColor"
							strokeWidth={w.thickness}
							strokeLinecap="square"
							className="text-foreground"
						/>
					))}
				</g>
			)}

			{floor.rooms.map((r) => {
				const d = `${r.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")} Z`;
				const fill =
					r.floor.texture && materialDataUrl(r.floor)
						? `url(#mat-${matKey(r.floor)})`
						: r.floor.color;
				return (
					<path key={r.id} data-kind="room" data-id={r.id} d={d} fill={fill} />
				);
			})}

			<g mask="url(#wall-mask)">
				{floor.walls.map((w) => {
					if (w.hidden) return null;
					const color = w.partition ? "#6b7280" : "#374151";
					return (
						<g key={w.id} data-kind="wall" data-id={w.id}>
							<line
								x1={w.a.x}
								y1={w.a.y}
								x2={w.b.x}
								y2={w.b.y}
								stroke={color}
								strokeWidth={w.thickness}
								strokeLinecap="square"
							/>
							{/* hairline keeps thin walls visible when zoomed far out */}
							<line
								x1={w.a.x}
								y1={w.a.y}
								x2={w.b.x}
								y2={w.b.y}
								stroke={color}
								strokeWidth={1.5}
								vectorEffect="non-scaling-stroke"
							/>
							{/* generous hit target (screen pixels) */}
							<line
								x1={w.a.x}
								y1={w.a.y}
								x2={w.b.x}
								y2={w.b.y}
								stroke="transparent"
								strokeWidth={12}
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						</g>
					);
				})}
			</g>

			{floor.openings.map((o) => {
				const w = floor.walls.find((x) => x.id === o.wallId);
				return w ? <OpeningShape key={o.id} wall={w} opening={o} /> : null;
			})}

			{floor.stairs.map((s) => (
				<g
					key={s.id}
					data-kind="stair"
					data-id={s.id}
					transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}
				>
					<rect
						x={-s.width / 2}
						y={-s.length / 2}
						width={s.width}
						height={s.length}
						fill={s.color}
						fillOpacity={0.55}
						stroke="#374151"
						strokeWidth={1.2}
						vectorEffect="non-scaling-stroke"
					/>
					{Array.from({ length: s.steps - 1 }, (_, i) => {
						const yy = -s.length / 2 + ((i + 1) * s.length) / s.steps;
						return (
							<line
								key={i}
								x1={-s.width / 2}
								x2={s.width / 2}
								y1={yy}
								y2={yy}
								stroke="#374151"
								strokeWidth={1}
								vectorEffect="non-scaling-stroke"
								pointerEvents="none"
							/>
						);
					})}
					<path
						d={`M 0 ${s.length / 2 - 15} L 0 ${-s.length / 2 + 15} M -12 ${-s.length / 2 + 30} L 0 ${-s.length / 2 + 15} L 12 ${-s.length / 2 + 30}`}
						fill="none"
						stroke="#374151"
						strokeWidth={1.5}
						vectorEffect="non-scaling-stroke"
						pointerEvents="none"
					/>
				</g>
			))}

			{renderOrder(floor.items).map((it) => (
				<ItemShape key={it.id} item={it} />
			))}

			{floor.rulers.map((r) => (
				<g key={r.id} data-kind="ruler" data-id={r.id}>
					<line
						x1={r.a.x}
						y1={r.a.y}
						x2={r.b.x}
						y2={r.b.y}
						stroke="#0284c7"
						strokeWidth={1.6}
						strokeDasharray="6 4"
						vectorEffect="non-scaling-stroke"
					/>
					<line
						x1={r.a.x}
						y1={r.a.y}
						x2={r.b.x}
						y2={r.b.y}
						stroke="transparent"
						strokeWidth={12}
						vectorEffect="non-scaling-stroke"
					/>
				</g>
			))}
		</>
	);
});
