import type { Item } from "./types";

/**
 * 2D stacking order of items (like layers in Figma). The explicit `Item.z` wins; items without one fall back to
 * creation order, except things lying on the floor (rugs) which sit below everything else by default.
 */
export type LayerOp = "front" | "back" | "forward" | "backward";

const FLAT_MAX_HEIGHT = 5;
const FLAT_BIAS = -1_000_000;

/** Floor coverings (rugs, mats): thin and not raised. */
export function isFlat(item: Item): boolean {
	return item.h <= FLAT_MAX_HEIGHT && item.elevation === 0;
}

/** Items from bottom to top. Does not mutate the input. */
export function renderOrder(items: Item[]): Item[] {
	return items
		.map((item, index) => ({
			item,
			index,
			key: item.z ?? index + (isFlat(item) ? FLAT_BIAS : 0),
		}))
		.sort((a, b) => a.key - b.key || a.index - b.index)
		.map((e) => e.item);
}

/** Moves the items `ids` in the stacking order (as a block) and stores the result as explicit `z` on every item. */
export function reorderLayers(items: Item[], ids: string[], op: LayerOp): void {
	const picked = new Set(ids);
	const order = renderOrder(items);
	let next = order;
	if (op === "front" || op === "back") {
		const sel = order.filter((i) => picked.has(i.id));
		const rest = order.filter((i) => !picked.has(i.id));
		next = op === "front" ? [...rest, ...sel] : [...sel, ...rest];
	} else {
		next = [...order];
		if (op === "forward") {
			for (let i = next.length - 2; i >= 0; i--)
				if (picked.has(next[i].id) && !picked.has(next[i + 1].id))
					[next[i], next[i + 1]] = [next[i + 1], next[i]];
		} else {
			for (let i = 1; i < next.length; i++)
				if (picked.has(next[i].id) && !picked.has(next[i - 1].id))
					[next[i], next[i - 1]] = [next[i - 1], next[i]];
		}
	}
	next.forEach((it, z) => {
		it.z = z;
	});
}
