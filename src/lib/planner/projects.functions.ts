import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { polygonArea } from "./geometry";
import type { Project } from "./types";

export type ProjectSummary = {
	id: string;
	name: string;
	floors: number;
	area: number;
	thumbnail: string | null;
	updatedAt: string;
	createdAt: string;
};

const projectDoc = z
	.object({ id: z.string().min(1), name: z.string().min(1).max(120) })
	.passthrough();

function areaOf(p: Project) {
	return (
		p.floors.reduce(
			(s, f) => s + f.rooms.reduce((a, r) => a + polygonArea(r.points), 0),
			0,
		) / 10000
	);
}

async function db() {
	const { prisma } = await import("#/db");
	return prisma;
}

export const listProjects = createServerFn({ method: "GET" }).handler(
	async (): Promise<ProjectSummary[]> => {
		const prisma = await db();
		const rows = await prisma.project.findMany({
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				name: true,
				floors: true,
				area: true,
				thumbnail: true,
				updatedAt: true,
				createdAt: true,
			},
		});
		return rows.map((r) => ({
			...r,
			updatedAt: r.updatedAt.toISOString(),
			createdAt: r.createdAt.toISOString(),
		}));
	},
);

export const getProject = createServerFn({ method: "GET" })
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }): Promise<Project | null> => {
		const prisma = await db();
		const row = await prisma.project.findUnique({ where: { id: data.id } });
		return row ? (JSON.parse(row.data) as Project) : null;
	});

export const saveProject = createServerFn({ method: "POST" })
	.validator(
		z.object({
			project: projectDoc,
			thumbnail: z.string().nullable().optional(),
		}),
	)
	.handler(async ({ data }) => {
		const prisma = await db();
		const project = data.project as unknown as Project;
		const payload = {
			name: project.name,
			data: JSON.stringify(project),
			floors: project.floors?.length ?? 1,
			area: areaOf(project),
			...(data.thumbnail !== undefined ? { thumbnail: data.thumbnail } : {}),
		};
		const row = await prisma.project.upsert({
			where: { id: project.id },
			create: { id: project.id, ...payload },
			update: payload,
		});
		return { id: row.id, updatedAt: row.updatedAt.toISOString() };
	});

export const deleteProject = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string() }))
	.handler(async ({ data }) => {
		const prisma = await db();
		await prisma.project.deleteMany({ where: { id: data.id } });
		return { ok: true };
	});

export const renameProject = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.string(), name: z.string().min(1).max(120) }))
	.handler(async ({ data }) => {
		const prisma = await db();
		const row = await prisma.project.findUnique({ where: { id: data.id } });
		if (!row) return { ok: false };
		const doc = JSON.parse(row.data) as Project;
		doc.name = data.name;
		await prisma.project.update({
			where: { id: data.id },
			data: { name: data.name, data: JSON.stringify(doc) },
		});
		return { ok: true };
	});
