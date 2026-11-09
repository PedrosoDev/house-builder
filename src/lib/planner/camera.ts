import type { Point } from "./types";

export type Camera = { x: number; y: number; zoom: number };
export type Size = { w: number; h: number };
export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** zoom = pixels per centimetre. */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 16;
export const ZOOM_STEPS = [
	0.02, 0.05, 0.1, 0.15, 0.25, 0.35, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8, 16,
];

export const clampZoom = (z: number) =>
	Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export const toScreen = (cam: Camera, p: Point): Point => ({
	x: p.x * cam.zoom + cam.x,
	y: p.y * cam.zoom + cam.y,
});

export const toWorldPoint = (cam: Camera, p: Point): Point => ({
	x: (p.x - cam.x) / cam.zoom,
	y: (p.y - cam.y) / cam.zoom,
});

/** Zoom keeping the world point under the screen position (sx, sy) fixed. */
export function zoomAt(
	cam: Camera,
	zoom: number,
	sx: number,
	sy: number,
): Camera {
	const z = clampZoom(zoom);
	const k = z / cam.zoom;
	return { zoom: z, x: sx - (sx - cam.x) * k, y: sy - (sy - cam.y) * k };
}

export type Insets = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};
export const NO_INSETS: Insets = { left: 0, right: 0, top: 0, bottom: 0 };

/**
 * Camera that frames `box` in the canvas. `insets` are the parts of the canvas covered by floating panels: the box is
 * fitted into, and centred in, the remaining visible area.
 */
export function fitBox(
	box: Box | null,
	size: Size,
	opts: {
		padding?: number;
		maxZoom?: number;
		minSpan?: number;
		insets?: Insets;
	} = {},
): Camera {
	const padding = opts.padding ?? 56;
	const maxZoom = opts.maxZoom ?? 2;
	const minSpan = opts.minSpan ?? 200;
	const ins = opts.insets ?? NO_INSETS;
	const visW = size.w - ins.left - ins.right;
	const visH = size.h - ins.top - ins.bottom;
	const b = box ?? { minX: -300, minY: -300, maxX: 700, maxY: 500 };
	const bw = Math.max(minSpan, b.maxX - b.minX);
	const bh = Math.max(minSpan, b.maxY - b.minY);
	const zoom = clampZoom(
		Math.min((visW - padding * 2) / bw, (visH - padding * 2) / bh, maxZoom),
	);
	return {
		zoom,
		x: ins.left + visW / 2 - ((b.minX + b.maxX) / 2) * zoom,
		y: ins.top + visH / 2 - ((b.minY + b.maxY) / 2) * zoom,
	};
}

/** Next zoom stop above (dir=1) or below (dir=-1) the current zoom. */
export function nextZoomStep(zoom: number, dir: 1 | -1) {
	if (dir === 1) return ZOOM_STEPS.find((s) => s > zoom * 1.001) ?? MAX_ZOOM;
	for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
		if (ZOOM_STEPS[i] < zoom * 0.999) return ZOOM_STEPS[i];
	}
	return MIN_ZOOM;
}

export type WheelIntent =
	| { kind: "zoom"; factor: number }
	| { kind: "pan"; dx: number; dy: number };

/**
 * Figma-style wheel: plain scroll pans, Ctrl/⌘ + scroll (and trackpad pinch, which browsers report as
 * ctrlKey wheel events) zooms around the cursor. `wheelZoom` makes a plain wheel zoom as well.
 */
export function interpretWheel(
	e: {
		deltaX: number;
		deltaY: number;
		deltaMode: number;
		ctrlKey: boolean;
		metaKey: boolean;
		shiftKey: boolean;
	},
	pageHeight: number,
	wheelZoom: boolean,
): WheelIntent {
	const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pageHeight : 1;
	let dx = e.deltaX * unit;
	let dy = e.deltaY * unit;
	if (e.ctrlKey || e.metaKey || wheelZoom) {
		// A mouse-wheel notch is ~100px; trackpad pinch emits many tiny deltas.
		const k = Math.abs(dy) >= 50 ? 0.0015 : 0.01;
		return { kind: "zoom", factor: Math.exp(-dy * k) };
	}
	if (e.shiftKey && dx === 0) {
		dx = dy;
		dy = 0;
	}
	return { kind: "pan", dx: -dx, dy: -dy };
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Animates the camera to `to`, interpolating zoom geometrically and the world point at the viewport centre,
 * so a zoom-to-fit glides instead of jumping. Returns a cancel function.
 */
export function tweenCamera(
	from: Camera,
	to: Camera,
	size: Size,
	set: (c: Camera) => void,
	ms = 200,
): () => void {
	const c = { x: size.w / 2, y: size.h / 2 };
	const w0 = toWorldPoint(from, c);
	const w1 = toWorldPoint(to, c);
	const lz0 = Math.log(from.zoom);
	const lz1 = Math.log(to.zoom);
	const start = performance.now();
	let raf = 0;
	let cancelled = false;
	const step = (now: number) => {
		if (cancelled) return;
		const t = Math.min(1, (now - start) / ms);
		const e = easeOutCubic(t);
		const zoom = Math.exp(lz0 + (lz1 - lz0) * e);
		const wx = w0.x + (w1.x - w0.x) * e;
		const wy = w0.y + (w1.y - w0.y) * e;
		set(t >= 1 ? to : { zoom, x: c.x - wx * zoom, y: c.y - wy * zoom });
		if (t < 1) raf = requestAnimationFrame(step);
	};
	raf = requestAnimationFrame(step);
	return () => {
		cancelled = true;
		cancelAnimationFrame(raf);
	};
}

// ---- adaptive grid / ruler steps

const NICE = [
	5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000,
];

/** Labelled step (cm) so labels sit at least ~`minPx` apart, plus the minor step (always 1/5 of it). */
export function gridSteps(zoom: number, minPx = 72) {
	const major = NICE.find((s) => s * zoom >= minPx) ?? NICE[NICE.length - 1];
	return { major, minor: major / 5 };
}
