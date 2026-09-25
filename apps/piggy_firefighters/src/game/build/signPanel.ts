/**
 * LUCKY — festival-signboard look for the feature cards (donor: construction signage).
 *
 * The feature intro/outro, Fortune-or-Bust and total-win plates all share this one
 * timber signboard language so they read as part of the game's cartoon world
 * instead of generic dark rounded rectangles:
 *
 *   - a bolted timber plank body with a thick dark-brown outline
 *   - a header beam: a gold-studded lacquer lattice (feature / gold) or a plain brown beam
 *   - cream lettering in the wordmark font (Alfa Slab One → `LuckySign`, declared
 *     CSP-safe in app.html) with a gold side-shadow and a dark outline
 *
 * Everything is drawn with Pixi Graphics in the card's local units (S = 120 px
 * cell). Variants: `timber` (Fortune Build), `gold` (Golden Dragon Build / celebration),
 * `hazard` (Fortune or Bust; internal name kept), `muted` (bust — deliberately flat, no fanfare).
 */
// `Graphics` from pixi-svelte is the Svelte COMPONENT type, and pixi.js is not a
// direct dependency of the app, so the drawing surface is typed structurally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Graphics = any;

export type SignVariant = 'timber' | 'gold' | 'hazard' | 'muted' | 'win';

export const SIGN = {
	outline: 0x2a1a0d,
	wood: 0x9a6631,
	woodDark: 0x6f451f,
	woodLight: 0xb98548,
	woodMuted: 0x6b5537,
	beam: 0x3a2413,
	cream: 0xf6ead2,
	gold: 0xf7c948,
	goldDeep: 0xd99a20,
	// the header band (names kept): gold studs on lacquer red (LUCKY; was hazard yellow on brown)
	hazardY: 0xf7c948,
	hazardB: 0x8e1b1b,
	bolt: 0x3a2413,
	boltFace: 0x6a4f2f,
	boltHi: 0xcbb896,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The sign's header band. LUCKY (2026-09-23): a festival lattice — a row of gold diamonds (cash-coin studs) on a
 *  lacquer band — replaces the donor's yellow/brown hazard diagonals (construction signage). Same footprint and
 *  call signature; clamped to the x-range so it never spills past the panel's rounded corners. */
function drawHazardBand(
	g: Graphics,
	x0: number,
	x1: number,
	y0: number,
	hb: number,
	colAccent: number,
	colBase: number,
): void {
	g.rect(x0, y0, x1 - x0, hb).fill({ color: colBase, alpha: 0.95 });
	// thin gold rules along both edges of the band
	g.rect(x0, y0 + hb * 0.08, x1 - x0, hb * 0.07).fill({ color: colAccent, alpha: 0.9 });
	g.rect(x0, y0 + hb * 0.85, x1 - x0, hb * 0.07).fill({ color: colAccent, alpha: 0.9 });
	const period = hb * 1.25;
	const r = hb * 0.26;
	const cy = y0 + hb / 2;
	for (let cx = x0 + period / 2; cx < x1 - r * 0.5; cx += period) {
		if (cx - r < x0 || cx + r > x1) continue;
		g.poly([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy]).fill({ color: colAccent, alpha: 0.95 });
		g.circle(cx, cy, r * 0.32).fill({ color: colBase, alpha: 0.95 });
	}
}

/** Draw one sign panel centred on (0,0), width `w` × height `h`. */
export function drawSignPanel(
	g: Graphics,
	{ w, h, s, variant = 'timber' }: { w: number; h: number; s: number; variant?: SignVariant },
): void {
	const r = s * 0.2;
	const goldTrim = variant === 'gold' || variant === 'win';
	const wood = variant === 'muted' ? SIGN.woodMuted : goldTrim ? 0x8a5f28 : SIGN.wood;

	// drop shadow
	g.roundRect(-w / 2 + s * 0.05, -h / 2 + s * 0.09, w, h, r).fill({ color: 0x000000, alpha: 0.3 });
	// plank body
	g.roundRect(-w / 2, -h / 2, w, h, r).fill({ color: wood });

	// horizontal plank seams (inset from the rounded corners)
	const planks = 4;
	for (let i = 1; i < planks; i += 1) {
		const y = -h / 2 + (h * i) / planks;
		g.rect(-w / 2 + r * 0.5, y - s * 0.018, w - r, s * 0.036).fill({ color: SIGN.woodDark, alpha: 0.55 });
		g.rect(-w / 2 + r * 0.5, y + s * 0.022, w - r, s * 0.012).fill({ color: SIGN.woodLight, alpha: 0.35 });
	}

	// header beam
	const hx0 = -w / 2 + r * 0.6;
	const hx1 = w / 2 - r * 0.6;
	const hy0 = -h / 2 + s * 0.14;
	const hb = s * 0.46;
	if (variant === 'hazard' || goldTrim) {
		drawHazardBand(g, hx0, hx1, hy0, hb, goldTrim ? SIGN.gold : SIGN.hazardY, SIGN.hazardB);
	} else {
		g.rect(hx0, hy0, hx1 - hx0, hb).fill({ color: variant === 'muted' ? 0x4f3f28 : SIGN.beam, alpha: 0.92 });
	}

	// thick dark-brown outline (the signature frame)
	g.roundRect(-w / 2, -h / 2, w, h, r).stroke({ width: s * 0.09, color: SIGN.outline });
	if (goldTrim) {
		g.roundRect(-w / 2 - s * 0.03, -h / 2 - s * 0.03, w + s * 0.06, h + s * 0.06, r).stroke({
			width: s * 0.035,
			color: SIGN.gold,
			alpha: 0.9,
		});
	}

	// corner bolts
	const bx = w / 2 - s * 0.3;
	const by = h / 2 - s * 0.3;
	for (const [px, py] of [
		[-bx, -by],
		[bx, -by],
		[-bx, by],
		[bx, by],
	] as const) {
		g.circle(px, py, s * 0.11).fill({ color: SIGN.bolt });
		g.circle(px, py, s * 0.07).fill({ color: SIGN.boltFace });
		g.circle(px - s * 0.02, py - s * 0.02, s * 0.026).fill({ color: SIGN.boltHi, alpha: 0.7 });
	}
}

/** Title text style: wordmark font, cream (or gold) face, gold side-shadow,
 *  dark outline — echoing the wordmark. */
export const signTitleStyle = (s: number, { gold = false }: { gold?: boolean } = {}) => ({
	fontFamily: 'LuckySign, Inter, sans-serif',
	fontSize: s * 0.56,
	fill: gold ? SIGN.gold : SIGN.cream,
	stroke: { color: SIGN.outline, width: s * 0.07 },
	dropShadow: { color: SIGN.goldDeep, alpha: 0.95, blur: 0, distance: s * 0.055, angle: Math.PI / 2.2 },
	align: 'center' as const,
});

export const signSubStyle = (s: number) => ({
	fontFamily: 'LuckySign, Inter, sans-serif',
	fontSize: s * 0.2,
	fill: SIGN.cream,
	stroke: { color: SIGN.outline, width: s * 0.028 },
	align: 'center' as const,
});

export const signHintStyle = (s: number) => ({
	fontFamily: 'Inter, sans-serif',
	fontSize: s * 0.16,
	fontWeight: '600' as const,
	fill: 0xe7d6b4,
	align: 'center' as const,
});

/** Big value/amount style (total win, grand opening multiplier). */
export const signValueStyle = (s: number, size = 1.0) => ({
	fontFamily: 'LuckySign, Inter, sans-serif',
	fontSize: s * size,
	fill: SIGN.cream,
	stroke: { color: SIGN.outline, width: s * 0.09 },
	dropShadow: { color: SIGN.goldDeep, alpha: 0.95, blur: 0, distance: s * 0.07, angle: Math.PI / 2.2 },
	align: 'center' as const,
});

let fontKicked = false;
/** Nudge the browser to load the wordmark font so Pixi text renders in it the
 *  first time a card shows (idempotent, never throws). */
export function ensureSignFont(): void {
	if (fontKicked) return;
	fontKicked = true;
	try {
		const fonts = (document as unknown as { fonts?: { load?: (f: string) => Promise<unknown> } }).fonts;
		void fonts?.load?.('400 120px LuckySign');
	} catch {
		/* fonts API unavailable — falls back to Inter, no throw */
	}
}
