import { textureById } from "./materials";
import type { MaterialRef } from "./types";

const cache = new Map<string, HTMLCanvasElement>();

function shade(hex: string, amt: number) {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex);
	if (!m) return hex;
	const n = Number.parseInt(m[1], 16);
	const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
	const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
	const b = Math.max(0, Math.min(255, (n & 255) + amt));
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Deterministic pseudo random so textures are stable between renders.
function rng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) % 4294967296;
		return s / 4294967296;
	};
}

/** Square, tileable pattern canvas for the texture family + base colour. Browser only. */
export function textureCanvas(
	textureId: string,
	color: string,
	size = 128,
): HTMLCanvasElement | null {
	if (typeof document === "undefined") return null;
	const key = `${textureId}|${color}|${size}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const fam = textureById(textureId);
	const c = document.createElement("canvas");
	c.width = c.height = size;
	const g = c.getContext("2d");
	if (!g) return null;
	const rand = rng(textureId.length * 977 + color.charCodeAt(1) * 31);
	g.fillStyle = color;
	g.fillRect(0, 0, size, size);
	const pattern = fam?.pattern ?? "flat";
	const line = shade(color, -38);
	const light = shade(color, 18);
	switch (pattern) {
		case "planks": {
			const rows = 4;
			const h = size / rows;
			for (let r = 0; r < rows; r++) {
				g.fillStyle = shade(color, Math.round((rand() - 0.5) * 24));
				g.fillRect(0, r * h, size, h);
				g.fillStyle = line;
				g.fillRect(0, r * h, size, 1.5);
				const off = (r % 2) * (size / 2);
				g.fillRect(off, r * h, 1.5, h);
				g.fillRect((off + size / 2) % size, r * h, 1.5, h);
				g.globalAlpha = 0.12;
				for (let k = 0; k < 6; k++) {
					g.fillStyle = "#000";
					g.fillRect(rand() * size, r * h + rand() * h, 14 + rand() * 24, 1);
				}
				g.globalAlpha = 1;
			}
			break;
		}
		case "herringbone": {
			const s = size / 4;
			for (let i = -1; i < 5; i++) {
				for (let j = -1; j < 5; j++) {
					g.save();
					g.translate(i * s, j * s);
					g.fillStyle = shade(color, Math.round((rand() - 0.5) * 26));
					if ((i + j) % 2 === 0) g.fillRect(0, 0, s, s / 2 - 1);
					else g.fillRect(0, 0, s / 2 - 1, s);
					g.restore();
				}
			}
			g.strokeStyle = line;
			g.globalAlpha = 0.5;
			for (let i = 0; i <= 4; i++) {
				g.beginPath();
				g.moveTo(i * s, 0);
				g.lineTo(i * s, size);
				g.stroke();
			}
			g.globalAlpha = 1;
			break;
		}
		case "tiles": {
			const n = 4;
			const s = size / n;
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++) {
					g.fillStyle = shade(color, Math.round((rand() - 0.5) * 10));
					g.fillRect(i * s, j * s, s, s);
				}
			g.strokeStyle = line;
			g.lineWidth = 2;
			for (let i = 0; i <= n; i++) {
				g.beginPath();
				g.moveTo(i * s, 0);
				g.lineTo(i * s, size);
				g.moveTo(0, i * s);
				g.lineTo(size, i * s);
				g.stroke();
			}
			break;
		}
		case "bricks": {
			const rows = 8;
			const h = size / rows;
			const w = size / 4;
			g.fillStyle = shade(color, -55);
			g.fillRect(0, 0, size, size);
			for (let r = 0; r < rows; r++) {
				const off = (r % 2) * (w / 2);
				for (let k = -1; k < 5; k++) {
					g.fillStyle = shade(color, Math.round((rand() - 0.5) * 30));
					g.fillRect(k * w + off + 1, r * h + 1, w - 2, h - 2);
				}
			}
			break;
		}
		case "stone": {
			g.fillStyle = shade(color, -30);
			g.fillRect(0, 0, size, size);
			for (let k = 0; k < 18; k++) {
				const x = rand() * size;
				const y = rand() * size;
				const rw = 18 + rand() * 28;
				const rh = 14 + rand() * 20;
				g.fillStyle = shade(color, Math.round((rand() - 0.4) * 36));
				g.beginPath();
				g.ellipse(x, y, rw, rh, rand() * Math.PI, 0, Math.PI * 2);
				g.fill();
			}
			break;
		}
		case "weave": {
			const s = 4;
			for (let x = 0; x < size; x += s)
				for (let y = 0; y < size; y += s) {
					g.fillStyle = (x / s + y / s) % 2 === 0 ? light : line;
					g.globalAlpha = 0.35;
					g.fillRect(x, y, s, s);
				}
			g.globalAlpha = 1;
			break;
		}
		case "dots": {
			for (let k = 0; k < 80; k++) {
				g.fillStyle = rand() > 0.5 ? light : line;
				g.globalAlpha = 0.5;
				g.beginPath();
				g.arc(rand() * size, rand() * size, 1 + rand() * 2, 0, Math.PI * 2);
				g.fill();
			}
			g.globalAlpha = 1;
			break;
		}
		case "stripes": {
			const s = size / 8;
			for (let i = 0; i < 8; i += 2) {
				g.fillStyle = light;
				g.fillRect(i * s, 0, s, size);
			}
			g.fillStyle = line;
			g.globalAlpha = 0.25;
			for (let i = 0; i < 8; i++) g.fillRect(i * s, 0, 1, size);
			g.globalAlpha = 1;
			break;
		}
		case "noise": {
			const img = g.getImageData(0, 0, size, size);
			for (let i = 0; i < img.data.length; i += 4) {
				const n = (rand() - 0.5) * 18;
				img.data[i] += n;
				img.data[i + 1] += n;
				img.data[i + 2] += n;
			}
			g.putImageData(img, 0, 0);
			break;
		}
		default:
			break;
	}
	cache.set(key, c);
	return c;
}

const urlCache = new Map<string, string>();

/** Data URL for a material pattern, for use in SVG <pattern> fills. */
export function materialDataUrl(m: MaterialRef): string | null {
	if (!m.texture) return null;
	const key = `${m.texture}|${m.color}`;
	const hit = urlCache.get(key);
	if (hit) return hit;
	const c = textureCanvas(m.texture, m.color);
	if (!c) return null;
	const url = c.toDataURL("image/png");
	urlCache.set(key, url);
	return url;
}

/** Real-world repeat in cm for one texture tile (before the material scale). */
export const TILE_CM = 100;
