import { useEffect, useRef } from "react";
import { type Camera, gridSteps, type Size } from "#/lib/planner/camera";

type Props = {
	cam: Camera;
	size: Size;
	showGrid: boolean;
};

function cssColor(name: string, fallback: string) {
	const v = getComputedStyle(document.documentElement)
		.getPropertyValue(name)
		.trim();
	return v || fallback;
}

/** Background grid drawn on a canvas (crisp at any zoom, retina-aware). */
export function ViewportGrid({ cam, size, showGrid }: Props) {
	const gridRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = gridRef.current;
		if (!canvas || size.w < 2) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(size.w * dpr);
		canvas.height = Math.round(size.h * dpr);
		const g = canvas.getContext("2d");
		if (!g) return;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, size.w, size.h);
		if (!showGrid) return;
		const { major, minor } = gridSteps(cam.zoom);
		const border = cssColor("--border", "#d4d4d8");
		const draw = (step: number, alpha: number) => {
			g.globalAlpha = alpha;
			g.beginPath();
			const x0 = Math.floor(-cam.x / cam.zoom / step) * step;
			for (let x = x0; x * cam.zoom + cam.x <= size.w; x += step) {
				const sx = Math.round(x * cam.zoom + cam.x) + 0.5;
				g.moveTo(sx, 0);
				g.lineTo(sx, size.h);
			}
			const y0 = Math.floor(-cam.y / cam.zoom / step) * step;
			for (let y = y0; y * cam.zoom + cam.y <= size.h; y += step) {
				const sy = Math.round(y * cam.zoom + cam.y) + 0.5;
				g.moveTo(0, sy);
				g.lineTo(size.w, sy);
			}
			g.stroke();
		};
		g.strokeStyle = border;
		g.lineWidth = 1;
		if (minor * cam.zoom >= 9) draw(minor, 0.45);
		draw(major, 0.9);
		g.globalAlpha = 1;
	}, [cam, size, showGrid]);

	const style = { width: size.w, height: size.h };
	return (
		<canvas
			ref={gridRef}
			style={style}
			className="pointer-events-none absolute inset-0 text-foreground"
			aria-hidden
		/>
	);
}
