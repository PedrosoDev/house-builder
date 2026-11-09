import { type Camera, toScreen } from "./camera";
import { lerp } from "./geometry";
import type { Point, Wall } from "./types";

export type LabelAnchor = { x: number; y: number; deg: number };

/** Gap in px between the wall's outer face and its length label. */
const GAP = 10;

/**
 * Screen position and rotation of a wall's length label. It sits on the side of the wall facing away from the
 * plan (`centroid`), and the text is rotated to stay upright (always within [-90°, 90°]).
 */
export function wallLabelAnchor(
	wall: Wall,
	cam: Camera,
	centroid: Point,
): LabelAnchor {
	const sa = toScreen(cam, wall.a);
	const sb = toScreen(cam, wall.b);
	const mid = lerp(sa, sb, 0.5);
	const c = toScreen(cam, centroid);
	const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
	let nx = -Math.sin(ang);
	let ny = Math.cos(ang);
	if ((mid.x - c.x) * nx + (mid.y - c.y) * ny < 0) {
		nx = -nx;
		ny = -ny;
	}
	const off = (wall.thickness / 2) * cam.zoom + GAP;
	let deg = (ang * 180) / Math.PI;
	if (deg > 90) deg -= 180;
	else if (deg < -90) deg += 180;
	return { x: mid.x + nx * off, y: mid.y + ny * off, deg };
}

/** Size in px of the clickable box around a label with this text (11px font). */
export function labelBox(text: string): { w: number; h: number } {
	return { w: Math.round(text.length * 6.5 + 12), h: 18 };
}

/** Mean of all wall end points: the side of a wall away from it is "outside" the plan. */
export function planCentroid(walls: Pick<Wall, "a" | "b">[]): Point {
	if (walls.length === 0) return { x: 0, y: 0 };
	let x = 0;
	let y = 0;
	for (const w of walls) {
		x += w.a.x + w.b.x;
		y += w.a.y + w.b.y;
	}
	return { x: x / (walls.length * 2), y: y / (walls.length * 2) };
}
