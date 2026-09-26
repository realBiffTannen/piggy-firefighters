/**
 * The top edge of the studio HUD bar, in canvas px. The HUD measures its own `#hud` box into `hudReserve.css`
 * (0 until the first measurement): that is the truth on every layout, including the two-row phone bar (hud.css,
 * portrait under 800 px) that the package's `hudReservedHeight` mirror under-reserves by a whole row. Until the
 * measurement lands, the mirror stands in.
 */
export const hudBarTop = (canvasHeight: number, measuredCss: number, mirrorReserve: number): number => {
	const reserve = measuredCss > 0 ? measuredCss : mirrorReserve;
	return Math.max(0, canvasHeight - reserve);
};

export type ChipBox = { left: number; top: number; width: number };
/**
 * Ember's ground on a stacked layout (screen px). She stands on the bar unless the HUD's ante chip (measured, standing
 * above the bar at the right) covers her ground: then she sits on top of the chip. Her slot is fitted by height, so
 * it is wider than her drawing; stepping sideways cannot clear the chip on a narrow phone, sitting on it always does.
 */
export const emberGround = (barTop: number, chip: ChipBox | null, emberLeft: number, emberRight: number): number => {
	if (!chip || chip.top >= barTop) return barTop;
	const overlaps = emberRight > chip.left && emberLeft < chip.left + chip.width;
	return overlaps ? chip.top : barTop;
};
