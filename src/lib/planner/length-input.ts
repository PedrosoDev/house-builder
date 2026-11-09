export type Units = "metric" | "imperial";

const num = (s: string) => Number.parseFloat(s.replace(",", "."));
const NUMBER = /^\d+(?:[.,]\d+)?$/;

/**
 * Parses what the user typed for a length into centimetres, or null when it is not a positive length.
 *  - metric:   "4,5" / "4.5" / "4.5m" → metres; "450cm" → centimetres
 *  - imperial: "12" / "12ft" → feet; `12'6"` / `6"` / "12ft 6in" → feet and inches
 */
export function parseLength(text: string, units: Units): number | null {
	const t = text.trim().toLowerCase().replace(/\s+/g, " ");
	if (!t) return null;

	let cm: number | null = null;
	if (units === "imperial") {
		const m =
			/^(?:(\d+(?:[.,]\d+)?)\s*(?:'|ft))?\s*(?:(\d+(?:[.,]\d+)?)\s*(?:"|in))?$/.exec(
				t,
			);
		if (m && (m[1] || m[2])) {
			const feet = m[1] ? num(m[1]) : 0;
			const inches = m[2] ? num(m[2]) : 0;
			cm = (feet * 12 + inches) * 2.54;
		} else if (NUMBER.test(t)) cm = num(t) * 30.48;
	} else {
		const m = /^(\d+(?:[.,]\d+)?)\s*(cm|m)?$/.exec(t);
		if (m) cm = m[2] === "cm" ? num(m[1]) : num(m[1]) * 100;
	}
	return cm !== null && Number.isFinite(cm) && cm > 0 ? cm : null;
}

/** Text shown when editing a length, designed to round-trip through parseLength. */
export function formatLengthInput(cm: number, units: Units): string {
	if (units === "imperial") {
		const totalIn = cm / 2.54;
		let ft = Math.floor(totalIn / 12);
		let inch = Math.round(totalIn - ft * 12);
		if (inch === 12) {
			ft += 1;
			inch = 0;
		}
		return `${ft}'${inch}"`;
	}
	return cm >= 100 ? `${(cm / 100).toFixed(2)}m` : `${Math.round(cm)}cm`;
}
