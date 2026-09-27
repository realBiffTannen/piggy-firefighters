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
