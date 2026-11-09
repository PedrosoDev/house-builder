import { useEffect, useState } from "react";

/** True while `show` is true and for `ms` more after it turns false (so a leaving element can finish its exit animation). */
export function useDelayedUnmount(show: boolean, ms: number) {
	const [mounted, setMounted] = useState(show);
	useEffect(() => {
		if (show) {
			setMounted(true);
			return;
		}
		const id = window.setTimeout(() => setMounted(false), ms);
		return () => window.clearTimeout(id);
	}, [show, ms]);
	return show || mounted;
}
