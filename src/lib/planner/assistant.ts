import { CATALOG, type CatalogItem } from "./catalog";
import { boundsOf, polygonCentroid } from "./geometry";
import { makeMaterial, ROOM_TYPES, TEXTURE_FAMILIES } from "./materials";
import { currentFloorOf, type PlannerStore } from "./store";
import type { Point, RoomType } from "./types";

/**
 * Offline command assistant. It understands a small set of Portuguese phrases and turns them into
 * editor commands (add item, draw room, repaint, delete…). There is no remote model involved.
 */

const COLORS: Record<string, string> = {
	branco: "#ffffff",
	branca: "#ffffff",
	preto: "#1f2024",
	preta: "#1f2024",
	cinza: "#8a8f94",
	vermelho: "#d1495b",
	vermelha: "#d1495b",
	azul: "#457b9d",
	verde: "#6a994e",
	amarelo: "#e9c46a",
	amarela: "#e9c46a",
	laranja: "#f4a261",
	rosa: "#e5989b",
	roxo: "#6d597a",
	roxa: "#6d597a",
	marrom: "#7f5539",
	bege: "#e6dccb",
	creme: "#f5f1ea",
};

const strip = (s: string) =>
	s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function findItem(text: string): CatalogItem | null {
	const t = strip(text);
	let best: { item: CatalogItem; score: number } | null = null;
	for (const item of CATALOG) {
		const names = [strip(item.name), ...item.tags.map(strip)];
		let score = 0;
		for (const n of names)
			if (n.length > 2 && t.includes(n)) score = Math.max(score, n.length);
		if (score && (!best || score > best.score)) best = { item, score };
	}
	return best?.item ?? null;
}

function roomByName(store: PlannerStore, text: string) {
	const t = strip(text);
	const floor = currentFloorOf(store.getState().project);
	for (const r of floor.rooms) {
		if (t.includes(strip(r.name))) return r;
	}
	for (const rt of ROOM_TYPES) {
		if (t.includes(strip(rt.label))) {
			const r = floor.rooms.find((x) => x.type === rt.id);
			if (r) return r;
		}
	}
	return null;
}

function number(text: string) {
	const m = text.replace(",", ".").match(/(\d+(?:\.\d+)?)/g);
	return m ? m.map(Number) : [];
}

function freeSpot(store: PlannerStore): Point {
	const floor = currentFloorOf(store.getState().project);
	const pts = floor.walls.flatMap((w) => [w.a, w.b]);
	if (pts.length === 0) return { x: 0, y: 0 };
	const b = boundsOf(pts);
	return { x: b.maxX + 100, y: b.minY };
}

export const ASSISTANT_EXAMPLES = [
	"Crie um quarto de 4 por 3 metros",
	"Adicione um sofá na sala de estar",
	"Adicione uma janela na parede selecionada",
	"Pinte a parede selecionada de azul",
	"Troque o piso para madeira",
	"Apague a seleção",
	"Crie um novo piso",
];

export function runAssistant(store: PlannerStore, input: string): string {
	const text = strip(input).trim();
	if (!text)
		return "Escreva um comando, por exemplo: “Crie um quarto de 4 por 3 metros”.";
	const state = store.getState();
	const floor = currentFloorOf(state.project);
	const sel = state.selection;

	if (/(desfaz|desfazer|undo)/.test(text)) {
		store.undo();
		return "Última alteração desfeita.";
	}
	if (/(refaz|refazer|redo)/.test(text)) {
		store.redo();
		return "Alteração refeita.";
	}
	if (/(novo|nova|adicion\w+|crie|criar).*(piso|andar|pavimento)/.test(text)) {
		store.addFloor();
		return "Novo piso criado e selecionado.";
	}
	if (/(apag|delet|remov|exclu)\w*.*(tudo|piso inteiro|planta)/.test(text)) {
		store.clearFloor();
		return "O piso atual foi esvaziado.";
	}
	if (/(apag|delet|remov|exclu)\w*/.test(text)) {
		if (sel.length) {
			const n = sel.length;
			store.deleteSelection();
			return `${n} elemento(s) removido(s).`;
		}
		const item = findItem(text);
		if (item) {
			const found = floor.items.filter((i) => i.catalogId === item.id);
			if (found.length) {
				store.select(found.map((i) => ({ kind: "item" as const, id: i.id })));
				store.deleteSelection();
				return `${found.length} × ${item.name} removido(s).`;
			}
		}
		return "Selecione algo na planta ou diga o que apagar (ex.: “apague o sofá”).";
	}

	// rooms
	const mentioned = findItem(text);
	if (
		!mentioned &&
		/(crie|criar|adicion\w+|fazer|faca|desenh\w+).*(comodo|quarto|sala|cozinha|banheiro|escritorio|garagem|varanda|lavabo)/.test(
			text,
		)
	) {
		const [w = 4, d = 3] = number(text);
		const type: RoomType =
			ROOM_TYPES.find((r) => text.includes(strip(r.label).split(" ")[0]))?.id ??
			(text.includes("quarto") ? "bedroom" : "other");
		const spot = freeSpot(store);
		store.addRectangleRoom(spot.x, spot.y, w * 100, d * 100);
		const created = currentFloorOf(store.getState().project).rooms.at(-1);
		if (created) {
			const def = ROOM_TYPES.find((r) => r.id === type);
			store.updateRoom(created.id, {
				type,
				name: def?.label ?? created.name,
				floor: def?.floor ?? created.floor,
			});
			store.select([{ kind: "room", id: created.id }]);
		}
		window.dispatchEvent(new Event("planner:fit"));
		return `Cômodo de ${w} × ${d} m criado (${ROOM_TYPES.find((r) => r.id === type)?.label}).`;
	}

	// walls
	if (/(adicion\w+|crie|criar|desenh\w+).*parede/.test(text)) {
		const [len = 3] = number(text);
		const spot = freeSpot(store);
		store.addWall(
			spot,
			{ x: spot.x + len * 100, y: spot.y },
			/divisoria/.test(text),
		);
		return `Parede de ${len} m adicionada.`;
	}

	// openings
	if (
		/(porta|janela|arco|portao)/.test(text) &&
		/(adicion\w+|coloc\w+|insir\w+|crie|criar)/.test(text)
	) {
		const wallSel = sel.find((s) => s.kind === "wall");
		const wall = wallSel
			? floor.walls.find((w) => w.id === wallSel.id)
			: floor.walls[0];
		if (!wall) return "Desenhe uma parede primeiro.";
		const kind = /janela/.test(text)
			? "window"
			: /arco/.test(text)
				? "arch"
				: /portao/.test(text)
					? "garage"
					: /dupla/.test(text)
						? "doubleDoor"
						: "door";
		store.addOpening(wall.id, kind, 0.5);
		return `${kind === "window" ? "Janela" : "Porta"} adicionada à parede.`;
	}

	// colours / materials
	const colorWord = Object.keys(COLORS).find((c) =>
		new RegExp(`\\b${c}\\b`).test(text),
	);
	if (/(pint\w+|cor|mude|troque|colora)/.test(text) && colorWord) {
		const hex = COLORS[colorWord];
		if (!sel.length)
			return "Selecione uma parede, cômodo ou objeto para mudar a cor.";
		let n = 0;
		for (const s of sel) {
			if (s.kind === "wall") {
				store.select([s]);
				store.setMaterial("wallBoth", makeMaterial(hex, "plaster"));
				n++;
			}
			if (s.kind === "room") {
				store.select([s]);
				store.setMaterial("roomFloor", makeMaterial(hex, null));
				n++;
			}
			if (s.kind === "item") {
				store.select([s]);
				store.setMaterial("itemColor", hex);
				n++;
			}
		}
		store.select(sel);
		return `${n} elemento(s) pintado(s) de ${colorWord}.`;
	}
	const tex = TEXTURE_FAMILIES.find(
		(t) => text.includes(strip(t.label)) || text.includes(t.id),
	);
	if (/(piso|chao|parede|textura|material)/.test(text) && tex) {
		const target = sel.length ? sel : [];
		if (/piso|chao/.test(text)) {
			const rooms = target.filter((s) => s.kind === "room");
			const ids = rooms.length
				? rooms.map((r) => r.id)
				: floor.rooms.map((r) => r.id);
			for (const id of ids)
				store.updateRoom(id, { floor: makeMaterial(tex.colors[0], tex.id) });
			return `Piso alterado para ${tex.label} em ${ids.length} cômodo(s).`;
		}
		const walls = target.filter((s) => s.kind === "wall");
		const ids = walls.length
			? walls.map((w) => w.id)
			: floor.walls.map((w) => w.id);
		for (const id of ids)
			store.updateWall(id, {
				left: makeMaterial(tex.colors[0], tex.id),
				right: makeMaterial(tex.colors[0], tex.id),
			});
		return `Paredes alteradas para ${tex.label} (${ids.length}).`;
	}

	// rotate
	if (/(gir\w+|rotacion\w+)/.test(text)) {
		const [deg = 90] = number(text);
		store.rotateSelection(deg);
		return `Seleção girada ${deg}°.`;
	}

	// group
	if (/desagrup/.test(text)) {
		store.ungroupSelection();
		return "Grupo desfeito.";
	}
	if (/agrup/.test(text)) {
		store.groupSelection();
		return "Itens agrupados.";
	}

	// items
	if (/(adicion\w+|coloc\w+|insir\w+|crie|criar|ponha|quero)/.test(text)) {
		const item = findItem(text);
		if (!item)
			return "Não encontrei esse objeto no catálogo. Tente “sofá”, “cama de casal”, “geladeira”, “árvore”…";
		const qty = Math.min(
			Math.max(number(text.replace(/\d+\s*(x|por)\s*\d+/g, ""))[0] ?? 1, 1),
			12,
		);
		const room = roomByName(store, input);
		const c: Point = room
			? polygonCentroid(room.points)
			: floor.rooms[0]
				? polygonCentroid(floor.rooms[0].points)
				: freeSpot(store);
		for (let i = 0; i < qty; i++)
			store.addItem(item.id, c.x + i * (item.size[0] + 20), c.y);
		return `${qty} × ${item.name} adicionado(s)${room ? ` em “${room.name}”` : ""}. Arraste para posicionar.`;
	}

	return "Não entendi. Tente: " + ASSISTANT_EXAMPLES.slice(0, 3).join(" · ");
}
