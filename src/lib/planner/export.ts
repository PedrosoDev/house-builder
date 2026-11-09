import { z } from "zod";
import { createProject } from "./factory";
import { boundsOf } from "./geometry";
import { currentFloorOf } from "./store";
import type { Floor, Point, Project } from "./types";

const point = z.object({ x: z.number(), y: z.number() });
const material = z.object({
	texture: z.string().nullable(),
	color: z.string(),
	scale: z.number(),
	rotation: z.number(),
});

const projectSchema = z
	.object({
		id: z.string(),
		name: z.string(),
		units: z.enum(["metric", "imperial"]),
		currentFloorId: z.string(),
		environment: z.object({
			groundColor: z.string(),
			sky: z.string(),
			showGround: z.boolean(),
			north: z.number(),
		}),
		floors: z
			.array(
				z.object({
					id: z.string(),
					name: z.string(),
					height: z.number(),
					visible: z.boolean(),
					walls: z.array(
						z
							.object({
								id: z.string(),
								a: point,
								b: point,
								thickness: z.number(),
								left: material,
								right: material,
							})
							.passthrough(),
					),
					rooms: z.array(
						z
							.object({
								id: z.string(),
								points: z.array(point),
								floor: material,
							})
							.passthrough(),
					),
					openings: z.array(
						z.object({ id: z.string(), wallId: z.string() }).passthrough(),
					),
					items: z.array(
						z.object({ id: z.string(), catalogId: z.string() }).passthrough(),
					),
					rulers: z.array(z.object({ id: z.string(), a: point, b: point })),
					stairs: z.array(z.object({ id: z.string() }).passthrough()),
					roof: z.object({ kind: z.string(), material }).passthrough(),
				}),
			)
			.min(1),
	})
	.passthrough();

export function parseProjectJson(text: string): Project {
	const raw = JSON.parse(text);
	const doc = raw.project ?? raw;
	const parsed = projectSchema.parse(doc) as unknown as Project;
	const base = createProject(parsed.name);
	return { ...base, ...parsed, id: parsed.id || base.id };
}

function download(name: string, href: string) {
	const a = document.createElement("a");
	a.href = href;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

const slug = (s: string) =>
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase() || "projeto";

export function exportProjectJson(project: Project) {
	const blob = new Blob(
		[JSON.stringify({ format: "house-builder", version: 1, project }, null, 2)],
		{ type: "application/json" },
	);
	const url = URL.createObjectURL(blob);
	download(`${slug(project.name)}.house.json`, url);
	setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Standalone SVG of the current floor, built from the live canvas DOM. */
export function planSvgString(
	svg: SVGSVGElement,
	floor: Floor,
	padding = 60,
): { xml: string; width: number; height: number } {
	const pts: Point[] = [];
	for (const w of floor.walls) pts.push(w.a, w.b);
	for (const r of floor.rooms) pts.push(...r.points);
	for (const i of floor.items)
		pts.push(
			{ x: i.x - i.w / 2, y: i.y - i.d / 2 },
			{ x: i.x + i.w / 2, y: i.y + i.d / 2 },
		);
	const b = pts.length
		? boundsOf(pts)
		: { minX: 0, minY: 0, maxX: 400, maxY: 400 };
	const x = b.minX - padding;
	const y = b.minY - padding;
	const w = b.maxX - b.minX + padding * 2;
	const h = b.maxY - b.minY + padding * 2;
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const group = clone.querySelector(":scope > g");
	if (group) group.setAttribute("transform", "");
	for (const el of clone.querySelectorAll(
		'[data-kind="handle"], [pointer-events="none"] > rect[fill="url(#grid-minor)"]',
	))
		el.remove();
	for (const el of clone.querySelectorAll('rect[fill^="url(#grid"]'))
		el.remove();
	clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
	clone.setAttribute("width", String(w));
	clone.setAttribute("height", String(h));
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	clone.removeAttribute("class");
	const mask = clone.querySelector("#wall-mask");
	if (mask) {
		for (const r of mask.querySelectorAll("rect")) {
			r.setAttribute("x", String(x - 100));
			r.setAttribute("y", String(y - 100));
			r.setAttribute("width", String(w + 200));
			r.setAttribute("height", String(h + 200));
		}
		mask.setAttribute("x", String(x - 100));
		mask.setAttribute("y", String(y - 100));
		mask.setAttribute("width", String(w + 200));
		mask.setAttribute("height", String(h + 200));
	}
	let xml = new XMLSerializer().serializeToString(clone);
	xml = xml
		.replace(/var\(--primary\)/g, "#2563eb")
		.replace(/var\(--background\)/g, "#ffffff")
		.replace(/currentColor/g, "#374151");
	xml = xml.replace(
		/^(<svg[^>]*>)/,
		`$1<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`,
	);
	return {
		xml: `<?xml version="1.0" encoding="UTF-8"?>
${xml}`,
		width: w,
		height: h,
	};
}

export function exportPlanSvg(svg: SVGSVGElement, project: Project) {
	const { xml } = planSvgString(svg, currentFloorOf(project));
	const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
	download(`${slug(project.name)}-planta.svg`, url);
	setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function planPngDataUrl(
	svg: SVGSVGElement,
	project: Project,
	maxSide = 2400,
): Promise<string> {
	const { xml, width, height } = planSvgString(svg, currentFloorOf(project));
	const scale = Math.min(maxSide / Math.max(width, height), 3);
	const img = new Image();
	const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
	await new Promise<void>((resolve, reject) => {
		img.onload = () => resolve();
		img.onerror = () => reject(new Error("Não foi possível gerar a imagem"));
		img.src = url;
	});
	const c = document.createElement("canvas");
	c.width = Math.round(width * scale);
	c.height = Math.round(height * scale);
	const g = c.getContext("2d");
	if (!g) throw new Error("Canvas indisponível");
	g.fillStyle = "#fff";
	g.fillRect(0, 0, c.width, c.height);
	g.drawImage(img, 0, 0, c.width, c.height);
	return c.toDataURL("image/png");
}

export async function exportPlanPng(svg: SVGSVGElement, project: Project) {
	download(
		`${slug(project.name)}-planta.png`,
		await planPngDataUrl(svg, project),
	);
}

export function exportSnapshot3D() {
	window.dispatchEvent(new Event("planner:snapshot-3d"));
}

/** Rough bill of quantities for the current project, exported as CSV. */
export function exportQuantitiesCsv(project: Project) {
	const rows: string[][] = [
		["Piso", "Tipo", "Descrição", "Quantidade", "Unidade"],
	];
	for (const f of project.floors) {
		const wallLen =
			f.walls.reduce(
				(s, w) => s + Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y),
				0,
			) / 100;
		rows.push([f.name, "Parede", "Comprimento total", wallLen.toFixed(2), "m"]);
		for (const r of f.rooms) {
			let a = 0;
			for (let i = 0; i < r.points.length; i++) {
				const p = r.points[i];
				const q = r.points[(i + 1) % r.points.length];
				a += p.x * q.y - q.x * p.y;
			}
			rows.push([
				f.name,
				"Cômodo",
				r.name,
				(Math.abs(a) / 2 / 10000).toFixed(2),
				"m²",
			]);
		}
		const counts = new Map<string, number>();
		for (const i of f.items)
			counts.set(i.label, (counts.get(i.label) ?? 0) + 1);
		for (const [k, v] of counts)
			rows.push([f.name, "Objeto", k, String(v), "un"]);
		const ops = new Map<string, number>();
		for (const o of f.openings) ops.set(o.kind, (ops.get(o.kind) ?? 0) + 1);
		for (const [k, v] of ops)
			rows.push([f.name, "Abertura", k, String(v), "un"]);
	}
	const csv = rows
		.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))
		.join("\n");
	const url = URL.createObjectURL(
		new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
	);
	download(`${slug(project.name)}-quantitativo.csv`, url);
	setTimeout(() => URL.revokeObjectURL(url), 2000);
}
