import {
	AppWindow,
	Archive,
	Armchair,
	Bath,
	BedDouble,
	Box,
	BrickWall,
	Car,
	Columns3,
	DoorOpen,
	Fence,
	Flower2,
	Footprints,
	Lamp,
	type LucideIcon,
	Refrigerator,
	Sofa,
	Table,
	Trees,
	Umbrella,
	Waves,
} from "lucide-react";
import type { CatalogItem } from "#/lib/planner/catalog";

const ICONS: Record<string, LucideIcon> = {
	AppWindow,
	Archive,
	Armchair,
	Bath,
	BedDouble,
	BrickWall,
	Car,
	Columns3,
	DoorOpen,
	Fence,
	Flower2,
	Footprints,
	Lamp,
	Refrigerator,
	Sofa,
	Table,
	Trees,
	Umbrella,
	Waves,
};

export function Icon({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const C = ICONS[name] ?? Box;
	return <C className={className} />;
}

export function ItemPreview({
	item,
	size = 56,
}: {
	item: CatalogItem;
	size?: number;
}) {
	const [w, , d] = item.size;
	const max = Math.max(w, d);
	const parts = [...item.parts].sort(
		(a, b) => a.p[1] + a.s[1] - (b.p[1] + b.s[1]),
	);
	const col = (c?: string) =>
		!c || c === "main" ? item.color : c === "accent" ? item.accent : c;
	return (
		<svg
			width={size}
			height={size}
			viewBox={`${-max * 0.6} ${-max * 0.6} ${max * 1.2} ${max * 1.2}`}
			aria-hidden
		>
			{parts.map((p, i) => {
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
						fill={col(p.c)}
						stroke="rgba(0,0,0,.35)"
						strokeWidth={max * 0.01}
					/>
				) : (
					<ellipse
						key={i}
						cx={cx}
						cy={cy}
						rx={pw / 2}
						ry={pd / 2}
						fill={col(p.c)}
						stroke="rgba(0,0,0,.35)"
						strokeWidth={max * 0.01}
					/>
				);
			})}
		</svg>
	);
}
