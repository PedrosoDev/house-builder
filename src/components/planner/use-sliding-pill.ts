import { useLayoutEffect, useRef, useState } from "react";

export type Pill = { left: number; top: number; width: number; height: number };

/**
 * A "selected" pill that slides to the active tab (like the black pill of the dock). Register every tab with
 * `register(key)` and the tabs' common parent (which must be `position: relative`) with `containerRef`; render the pill
 * with the returned `pill` style, adding the transition only once `ready` (no slide on the first paint).
 */
export function useSlidingPill(activeKey: string) {
	const items = useRef(new Map<string, HTMLElement>());
	const containerRef = useRef<HTMLElement | null>(null);
	const [pill, setPill] = useState<Pill | null>(null);
	const [ready, setReady] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: measures whenever the active tab changes
	useLayoutEffect(() => {
		const measure = () => {
			const el = items.current.get(activeKey);
			if (!el) return;
			setPill({
				left: el.offsetLeft,
				top: el.offsetTop,
				width: el.offsetWidth,
				height: el.offsetHeight,
			});
		};
		measure();
		const ro = new ResizeObserver(measure);
		if (containerRef.current) ro.observe(containerRef.current);
		const raf = requestAnimationFrame(() => setReady(true));
		return () => {
			ro.disconnect();
			cancelAnimationFrame(raf);
		};
	}, [activeKey]);

	const register = (key: string) => (el: HTMLElement | null) => {
		if (el) items.current.set(key, el);
		else items.current.delete(key);
	};

	return { register, containerRef, pill, ready };
}
