import { CATALOG, CATEGORIES, type CatalogItem } from "./catalog";

/** A category with its own objects and its sub-categories (only categories that end up with objects exist). */
export type CatalogGroup = {
	id: string;
	name: string;
	icon: string;
	/** Objects in this group and in everything below it. */
	count: number;
	/** Objects directly in this category. */
	items: CatalogItem[];
	children: CatalogGroup[];
};

const plain = (s: string) =>
	s
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();

const matches = (it: CatalogItem, q: string) =>
	!q ||
	plain(it.name).includes(q) ||
	it.id.includes(q) ||
	it.tags.some((t) => plain(t).includes(q));

/** The catalog as a category tree (in catalog order), keeping only the objects that match `query`. */
export function groupCatalog(query: string): CatalogGroup[] {
	const q = plain(query.trim());
	const found = CATALOG.filter((it) => matches(it, q));
	const build = (parent: string | null): CatalogGroup[] =>
		CATEGORIES.filter((c) => c.parent === parent).flatMap((c) => {
			const items = found.filter((it) => it.category === c.id);
			const children = build(c.id);
			const count = items.length + children.reduce((s, g) => s + g.count, 0);
			return count === 0
				? []
				: [{ id: c.id, name: c.name, icon: c.icon, count, items, children }];
		});
	return build(null);
}

/** Every group of the tree, parents before their children. */
export const flattenGroups = (groups: CatalogGroup[]): CatalogGroup[] =>
	groups.flatMap((g) => [g, ...flattenGroups(g.children)]);

/** One block of the drawer list: a category with its own objects, plus the names of its ancestors (for the sticky title). */
export type CatalogSection = {
	id: string;
	name: string;
	icon: string;
	path: string[];
	items: CatalogItem[];
};

/** The categories that have objects, flattened in catalog order (what the carousel and the sections show). */
export function sectionsOf(groups: CatalogGroup[]): CatalogSection[] {
	const walk = (gs: CatalogGroup[], path: string[]): CatalogSection[] =>
		gs.flatMap((g) => [
			...(g.items.length > 0
				? [{ id: g.id, name: g.name, icon: g.icon, path, items: g.items }]
				: []),
			...walk(g.children, [...path, g.name]),
		]);
	return walk(groups, []);
}

/**
 * Scroll-spy: index of the last section whose top (offsets from the top of the list, ascending) has reached the scroll
 * position, counting `margin` px early. Before the first title it is the first section; -1 when there are none.
 */
export function activeSectionIndex(
	tops: number[],
	scrollTop: number,
	margin = 8,
): number {
	let idx = tops.length > 0 ? 0 : -1;
	for (let i = 0; i < tops.length; i++)
		if (tops[i] <= scrollTop + margin) idx = i;
	return idx;
}
