/** CSS cursors drawn as inline SVG so resize/rotate affordances follow the object's rotation. */

const cache = new Map<string, string>();

function make(
	key: string,
	svg: string,
	hx: number,
	hy: number,
	fallback: string,
) {
	const hit = cache.get(key);
	if (hit) return hit;
	const css = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hx} ${hy}, ${fallback}`;
	cache.set(key, css);
	return css;
}

const norm = (deg: number, step: number) =>
	(((Math.round(deg / step) * step) % 360) + 360) % 360;

/** Double-headed arrow along `angle` (degrees, 0 = pointing right). */
export function resizeCursor(angle: number) {
	const a = norm(angle, 15);
	const arrow = "M3 12h18M3 12l4-3.5M3 12l4 3.5M21 12l-4-3.5M21 12l-4 3.5";
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
		`<g transform="rotate(${a} 12 12)" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
		`<path d="${arrow}" stroke="#fff" stroke-width="4.5"/>` +
		`<path d="${arrow}" stroke="#111" stroke-width="1.8"/></g></svg>`;
	return make(`rs${a}`, svg, 12, 12, "nwse-resize");
}

/** Curved double arrow used when hovering just outside a corner. `angle` points from the centre to the corner. */
export function rotateCursor(angle: number) {
	const a = norm(angle, 15);
	const arc =
		"M5 15a8 8 0 0 1 14 0M5 15l-1.2-3.8M5 15l3.8-1.2M19 15l1.2-3.8M19 15l-3.8-1.2";
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">` +
		`<g transform="rotate(${a + 90} 12 12)" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
		`<path d="${arc}" stroke="#fff" stroke-width="4.5"/>` +
		`<path d="${arc}" stroke="#111" stroke-width="1.8"/></g></svg>`;
	return make(`ro${a}`, svg, 12, 12, "grab");
}
