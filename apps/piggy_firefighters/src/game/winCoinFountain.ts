/**
 * THE IN-FEATURE WIN COUNT-UP: its plaque and its coin fountain (components/Win.svelte, components/WinCoins.svelte).
 * Pure numbers only (no Svelte, no Pixi): checked by qa/gate/check_win_coins.mjs.
 *
 * Units are BOARD units (SYMBOL_SIZE = 120 per reel cell): the figure, the plaque and both fountains live in one
 * container at the board centre, scaled like the board, so they keep their proportions on every layout.
 *
 * Why a V3 config: pixi-svelte's asset loader flattens the coin spritesheet into a plain Texture[] (its `coin`
 * animation is dropped) and particle-emitter's upgradeConfig turns a V1 config + Texture[] into `textureRandom` — one
 * frozen random frame per coin, spinning flat like a sticker. A config that already has `behaviors` is passed through
 * unchanged, so the tumble (`animatedRandom` over the 32-frame turntable, a random start phase per coin, both spin
 * directions) is built here.
 */

/** Board units per reel cell (game/constants.ts SYMBOL_SIZE; repeated so this module stays import-free). */
export const COIN_CELL = 120;
/** Frames in the coin turntable (static/assets/3d/winrungs/coins/coin_sheet.json, animation `coin`). */
export const COIN_FRAMES = 32;
/** Real-time frame rate of the tumble. */
export const COIN_FPS = 24;
/** ParticleEmitter `emitSpeed`: the emitter advances deltaMS * this, so every time below is in real seconds. */
export const COIN_TIME_SCALE = 0.001;

/** Draw order inside the Win overlay's FadeContainer (each a zIndexed direct child of it). */
export const WIN_LAYER = { dimmer: 0, coins: 1, figure: 10 } as const;

/** The plaque (flat cel, one hard shadow tone, thick ink; theme §1 palette). Opaque, so a coin passing behind it never
 *  shows through the digits. */
export const PLAQUE_STYLE = {
	fill: 0x14203a, // deep dusk navy
	fillAlpha: 1,
	shade: 0x0c1528, // the one hard shadow tone (lower band)
	rim: 0xe9b23b, // brass gold
	rimLight: 0xf5d23c, // hydrant-yellow glint line on the rim's top run
	ink: 0x3b2313, // the family's dark-brown ink
} as const;

/** The interGold face colour (static/assets/fonts/interGold, sampled): what the contrast check measures. */
export const DIGIT_FACE = 0xf0d060;

// ---- the figure's REAL ink box -------------------------------------------------------------------------------------
// A Pixi 8 BitmapText with anchor 0.5 centres its LAYOUT box (lineHeight + the font's base-line offset), not its ink, and
// the gold font's glyph boxes are tight (outline included): the '$' rises 0.10 x fontSize above the digits and the comma's
// tail drops 0.15 below them. Sizing the plaque from a nominal digit height let both cut through the bottom rim (judge,
// 2026-09-26), so the plaque is sized and the figure centred on the glyphs the figure actually uses.

/** One glyph of a bitmap font, in the font's own units (Pixi's BitmapFont.chars: xOffset / yOffset / xAdvance + the
 *  texture's width / height; the gate reads the same numbers from interGold.xml). */
export type Glyph = { xOffset: number; yOffset: number; width: number; height: number; xAdvance: number };
export type BitmapFontMetrics = {
	/** the size the font was rendered at (BitmapFont.baseMeasurementFontSize) */
	size: number;
	lineHeight: number;
	/** lineHeight - base (BitmapFont.baseLineOffset) */
	baseLineOffset: number;
	chars: Record<string, Glyph | undefined>;
};
/** The ink of a label at scale 1, in its local units around its anchor (0.5, 0.5): width, horizontal centre, top, bottom. */
export type InkBox = { w: number; cx: number; top: number; bottom: number };

/** interGold (size 184, lineHeight 266, base 194) when the font object is not at hand: the '$' top (yoffset 24), the
 *  comma's tail (yoffset 153 + 99), the outline's overhang (16 left of the first glyph, 14 right of the last); in fontSize
 *  units from the anchor. The gate checks these against interGold.xml. */
export const GOLD_INK_FALLBACK = { top: (24 - 97) / 184, bottom: (252 - 97) / 184, left: -16 / 184, right: 14 / 184 } as const;

/**
 * The ink box of `text` set at `fontSize` whose Pixi layout is `layoutW` wide (the label's width at scale 1). Vertically
 * it spans every glyph of `text` plus all ten digits (the count shows any of them before it lands), so one box holds for
 * the whole count.
 */
export const inkBoxOf = (text: string, layoutW: number, fontSize: number, font: BitmapFontMetrics | null | undefined): InkBox => {
	const chars = [...text];
	const glyphs = font ? [...new Set([...chars, ...'0123456789'])].map((c) => font.chars[c]).filter((g): g is Glyph => !!g && g.height > 0) : [];
	if (!font || !(font.size > 0) || !glyphs.length || !chars.length) {
		const f = GOLD_INK_FALLBACK;
		const left = -layoutW / 2 + f.left * fontSize;
		const right = layoutW / 2 + f.right * fontSize;
		return { w: right - left, cx: (left + right) / 2, top: f.top * fontSize, bottom: f.bottom * fontSize };
	}
	const k = fontSize / font.size;
	// Pixi: glyph y = baseLineOffset + yOffset, the whole block shifted up by half of (lineHeight + baseLineOffset)
	const originY = font.baseLineOffset - (font.lineHeight + font.baseLineOffset) / 2;
	let top = Infinity;
	let bottom = -Infinity;
	for (const g of glyphs) {
		top = Math.min(top, g.yOffset);
		bottom = Math.max(bottom, g.yOffset + g.height);
	}
	const first = font.chars[chars[0]];
	const last = font.chars[chars[chars.length - 1]];
	const left = -layoutW / 2 + (first ? first.xOffset : 0) * k;
	const right = layoutW / 2 + (last ? last.xOffset + last.width - last.xAdvance : 0) * k;
	return { w: right - left, cx: (left + right) / 2, top: (originY + top) * k, bottom: (originY + bottom) * k };
};

/** Where the label goes (in the plaque's frame) so its ink box is centred at scale `s`. */
export const labelAt = (ink: InkBox, s: number): { x: number; y: number } => ({ x: -ink.cx * s, y: (-(ink.top + ink.bottom) / 2) * s });

// ---- the landing punch -------------------------------------------------------------------------------------------
/** One overshoot and a settle, plaque and figure together (a heavy plaque, a small kick). */
export const PUNCH_AMP = 0.18;
export const punchScale = (p: number): number => {
	const q = p < 0 ? 0 : p > 1 ? 1 : p;
	return 1 + PUNCH_AMP * Math.exp(-4.2 * q) * Math.sin(q * Math.PI * 2.2) * (1 - q);
};
/** The punch's peak scale (~1.073). */
export const PUNCH_PEAK = (() => {
	let m = 1;
	for (let i = 0; i <= 1000; i += 1) m = Math.max(m, punchScale(i / 1000));
	return m;
})();

const FIELD_PER_INK = 1.16; // plaque field height / ink height (the ink box includes the '$' top and the comma's tail)
const RIM = 0.065; // brass rim, per plaque height
const OUTER_INK = 0.05; // outer ink line, per plaque height
const PLAQUE_PAD_X = 0.3; // side padding per end from the ink's edge, in plaque heights (room for the rivets)

/**
 * The widest plaque (board units) a board `boardW` wide may carry when the viewport is `viewW` board units wide: 90 % of
 * the board, and at the punch's peak the plaque with its outer ink stays inside 95 % of the viewport (a phone's board runs
 * edge to edge, so 90 % of it x the punch reached the screen edges).
 */
export const plaqueMaxW = (boardW: number, viewW: number): number =>
	Math.min(boardW * 0.9, (viewW * 0.95) / (PUNCH_PEAK * (1 + 2 * OUTER_INK * 0.5)));

export type PlaqueBox = {
	/** scale applied to the figure so the plaque fits `maxW` (never > 1) */
	fit: number;
	w: number;
	h: number;
	/** corner radius */
	r: number;
	/** outer ink and brass rim widths */
	ink: number;
	rimW: number;
	rivetR: number;
	rivets: { x: number; y: number }[];
	/** the label's position at scale `fit` (its ink box centred on the plaque) */
	labelX: number;
	labelY: number;
};

/** The plaque for a figure whose ink box (at scale 1) is `ink`, no wider than `maxW`. The field (inside the rim) is
 *  FIELD_PER_INK x the ink tall and the ink sits in its middle. */
export const plaqueFor = (ink: InkBox, maxW: number): PlaqueBox => {
	const inkH = Math.max(1, ink.bottom - ink.top);
	const h1 = (FIELD_PER_INK * inkH) / (1 - 2 * RIM);
	const fit = Math.min(1, maxW / Math.max(1, ink.w + 2 * PLAQUE_PAD_X * h1));
	const h = h1 * fit;
	const w = ink.w * fit + 2 * PLAQUE_PAD_X * h;
	const rivetR = h * 0.07;
	const rx = w / 2 - h * 0.18;
	const ry = h * 0.24;
	const at = labelAt(ink, fit);
	return {
		fit,
		w,
		h,
		r: h * 0.3,
		ink: Math.max(2, h * OUTER_INK),
		rimW: h * RIM,
		rivetR,
		rivets: [
			{ x: -rx, y: -ry },
			{ x: -rx, y: ry },
			{ x: rx, y: -ry },
			{ x: rx, y: ry },
		],
		labelX: at.x,
		labelY: at.y,
	};
};

// ---- count pacing ------------------------------------------------------------------------------------------------
/** The overlay's fade in / out (Win.svelte FadeContainer). */
export const WIN_FADE_MS = 240;
/** A per-spin win inside a feature counts for at most this long (the tier table's 18-20 s is the base game's rung climb,
 *  judge 2026-09-26: three 20 s counts in one max-win feature). */
export const COUNT_MAX_MS = 6000;
/** The count's length for a tier pace of `presentMs` (turbo halves it). */
export const countMs = (presentMs: number, turbo: boolean): number =>
	Math.min(COUNT_MAX_MS, Math.max(presentMs || 0, 2200)) * (turbo ? 0.5 : 1);
/** The count holds at its first figure while the overlay fades in (a translucent figure over the paylines read as mud);
 *  the lead comes out of the count, so the win takes no longer. */
export const countLeadMs = (ms: number): number => Math.min(WIN_FADE_MS, ms * 0.25);
/** The figure lands as soon as the eased value is within 0.04 % (or one book unit) of the amount: the ease's tail only
 *  moved the cents for the last seconds and then sat a cent short. */
export const countLands = (value: number, amount: number): boolean => amount - value <= Math.max(1, amount * 0.0004);
/** How long the figure takes to fade before the round resumes (out of a hold of `holdMs`). */
export const outroMs = (holdMs: number): number => Math.min(160, holdMs * 0.3);

export type CoinAnim<T> = { textures: T[]; framerate: number; loop: true };

/** Rotated copies of the turntable (one per start phase), alternating spin direction, the rate varied +-15 % so the
 *  shower never tumbles in lockstep. Every copy is the whole loop; only arrays are made, no textures. */
export const coinTumbleAnims = <T>(frames: readonly T[], phases = 8): CoinAnim<T>[] => {
	const n = frames.length;
	const out: CoinAnim<T>[] = [];
	for (let p = 0; p < phases; p += 1) {
		const start = Math.round((p * n) / phases) % n;
		const reverse = p % 2 === 1;
		const textures = Array.from({ length: n }, (_, j) => frames[(start + (reverse ? -j : j) + n * 2) % n]);
		const framerate = Math.round(COIN_FPS * (0.85 + (0.3 * ((p * 5) % phases)) / Math.max(1, phases - 1)));
		out.push({ textures, framerate, loop: true });
	}
	return out;
};

/** The frame an anim shows `t` seconds after its particle was born (particle-emitter's own arithmetic). */
export const frameAt = <T>(anim: CoinAnim<T>, t: number): T => {
	const duration = anim.textures.length / anim.framerate;
	const e = t % duration;
	return anim.textures[Math.min(anim.textures.length - 1, (e * anim.framerate + 1e-7) | 0)];
};

export type CoinBudget = { max: number; perSecond: number };
/** Both fountains together, per quality tier (game/quality.svelte qv): the same caps the old shower had. */
export const COIN_BUDGET: Record<'high' | 'mid' | 'low', CoinBudget> = {
	high: { max: 60, perSecond: 22 },
	mid: { max: 30, perSecond: 14 },
	low: { max: 16, perSecond: 8 },
};

const G = 15 * COIN_CELL; // gravity, board units / s^2
const SPEED_SPREAD = 0.8; // slowest launch / fastest launch
const FAN = { inner: 278, outer: 242 }; // launch angles for the LEFT fountain (deg; 270 = straight up), mirrored right
const COIN_SCALE = 0.52; // 128 px cell -> ~0.55 cell across at the nearest
/** How far above the reels' top edge a coin's centre may climb, in cells. On desktop the rescued pigs' windows end ~0.85
 *  cells and the Rescue plate row (BUILDING / TOTAL / xN) ~1.5 cells above that edge: the old 3.1-cell apex crossed the
 *  TOTAL digits again and again (judge, 2026-09-26). 0.6 keeps a coin (0.28 cells in radius) on the frame's header beam. */
export const COIN_CEIL_ABOVE = 0.6;

/** The highest y (board units, from the board centre; up is negative) a coin's centre may reach: COIN_CEIL_ABOVE cells
 *  over the reels' top edge. `boardH` is the square-cell board height, `rowPitch` the layout's row stretch. */
export const coinCeiling = (boardH: number, rowPitch: number): number => -((boardH / 2) * (rowPitch || 1) + COIN_CEIL_ABOVE * COIN_CELL);

type Behavior = { type: string; config: Record<string, unknown> };
export type CoinFountainConfig = {
	lifetime: { min: number; max: number };
	frequency: number;
	maxParticles: number;
	particlesPerWave: number;
	addAtBack: boolean;
	pos: { x: number; y: number };
	behaviors: Behavior[];
};

/**
 * One of the two fountains (`side` -1 = left half, 1 = right half). Coins are born BEHIND the plaque just under its top
 * edge (the plaque is drawn over them) and rise out of it, fanning up and outward, tumbling, falling away and fading.
 * They never cross the digits: anything inside the plaque's box is behind the opaque plaque. The launch speed is derived
 * from `ceiling` (coinCeiling) so even a coin shot straight up tops out under it.
 */
export const coinFountainConfig = <T>(
	frames: readonly T[],
	side: -1 | 1,
	plaque: { w: number; h: number },
	budget: CoinBudget,
	ceiling: number,
): CoinFountainConfig => {
	const y = -plaque.h / 2 + plaque.h * 0.12;
	const outer = side * (plaque.w / 2 - plaque.h * 0.34);
	const inner = side * Math.min(plaque.w * 0.06, Math.abs(outer) * 0.5);
	const [a0, a1] = side < 0 ? [FAN.outer, FAN.inner] : [540 - FAN.inner, 540 - FAN.outer];
	// the fan includes 270 (straight up): the fastest coin's apex is exactly the ceiling
	const rise = Math.max(0.9 * COIN_CELL, y - ceiling);
	const vMax = Math.sqrt(2 * G * rise);
	return {
		lifetime: { min: 1.15, max: 1.5 },
		frequency: 2 / budget.perSecond,
		maxParticles: Math.floor(budget.max / 2),
		particlesPerWave: 1,
		addAtBack: false,
		pos: { x: 0, y: 0 },
		behaviors: [
			{ type: 'spawnShape', config: { type: 'polygonalChain', data: [[{ x: inner, y }, { x: outer, y }]] } },
			{ type: 'animatedRandom', config: { anims: coinTumbleAnims(frames) } },
			// launch direction (the heading moveAcceleration reads), then a gentle wobble on the sprite
			{ type: 'rotation', config: { minStart: a0, maxStart: a1, minSpeed: -70, maxSpeed: 70, accel: 0 } },
			{ type: 'moveAcceleration', config: { accel: { x: 0, y: G }, minStart: vMax * SPEED_SPREAD, maxStart: vMax, rotate: false, maxSpeed: 0 } },
			// the sprite stands upright at birth (the turntable's axis vertical); the wobble above turns it from there
			{ type: 'noRotation', config: { rotation: 0 } },
			// depth: a random size per coin (far = small), a slight swell as it flies at the camera
			{ type: 'scale', config: { scale: { list: [{ time: 0, value: COIN_SCALE * 0.92 }, { time: 1, value: COIN_SCALE * 1.04 }] }, minMult: 0.58 } },
			{ type: 'alpha', config: { alpha: { list: [{ time: 0, value: 1 }, { time: 0.72, value: 1 }, { time: 1, value: 0 }] } } },
			// a shade under the digits' gold, so the figure stays the brightest thing on screen
			{ type: 'colorStatic', config: { color: 'dcd1bd' } },
		],
	};
};

// ---- contrast (WCAG relative luminance) ---------------------------------------------------------------------------
const lin = (c: number) => {
	const s = c / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: number) => 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
export const contrastRatio = (a: number, b: number): number => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};
