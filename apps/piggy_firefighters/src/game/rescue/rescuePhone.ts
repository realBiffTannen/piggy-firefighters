/**
 * RESCUE SCENE — the pure rules behind the phone (stacked) band and the scene's spray / rescue watcher.
 * No Svelte, no Pixi, no imports: game/stateGame.svelte.ts picks the band with `rescueBandCells`,
 * components/rescue/RescueScene.svelte lays the phone band out with `phoneRescueBand` / `phoneDropSlot` / `phoneDropPath`
 * / `trotterSlot`, plays its one-shots from `roomOneShots`, picks each rescued Trotter's exit with `createDropGate` and
 * times the scene drop / banner / plaques with `phoneDropPose` / `phoneBannerRail` / `plaqueAlpha`;
 * game/rescue/rescueDirector.ts words the rescue banner with `rescueBannerText` and runs the phone TOTAL with
 * `runningTotal`. Gate: qa/gate/check_rescue_phone.mjs.
 *
 * PHONE BAND (owner 2026-09-26, "This view is not clear at all" + "no mascots in the mobile view"): the band grows by an
 * info rail above the cornice that carries BUILDING / TOTAL / xN, so nothing sits on the windows and the flames and
 * smoke rising over the cornice show; the jump sheet and its performers are gone; the window Trotters stand lower and
 * smaller so the fire shows; EVERY rescued Trotter drops at window size straight down its own column and out of sight
 * behind the header beam; each prize sits on a small cream plaque under its sill, shown once its Trotter has passed, and
 * TOTAL takes it in at the same moment; transient banners ride the rail (one layer at a time) instead of the middle
 * reel row.
 */

/** Cells the phone band adds above the cornice for the info rail. */
export const RESCUE_RAIL_CELLS = 0.75;

/** The Rescue band (cells) the layout reserves above the frame: the facade band on wide layouts, the facade band plus
 *  the info rail on phones. Wide layouts are untouched. */
export const rescueBandCells = (facadeBandCells: number, stacked: boolean): number =>
	stacked ? Math.round((facadeBandCells + RESCUE_RAIL_CELLS) * 100) / 100 : facadeBandCells;

// ---- the spray / rescue watcher --------------------------------------------------------------------------------------
export type RoomMark = { readonly reel: number; readonly fire: number; readonly sprayed: number; readonly rescued: boolean };
/** What the scene has already played, per reel, and which rooms array it saw last. */
export type RoomsSeen = { ref: unknown; sprayed: number[]; rescued: boolean[] };
export type OneShots = { sprays: { reel: number; fireAfter: number }[]; rescues: number[] };

export const createRoomsSeen = (): RoomsSeen => ({ ref: null, sprayed: [], rescued: [] });
/** The scene left: the next rooms array is a new feature. */
export const forgetRooms = (seen: RoomsSeen): void => {
	seen.ref = null;
	seen.sprayed.length = 0;
	seen.rescued.length = 0;
};

/**
 * The director changes a room IN PLACE on a douse (sprayed += 1, fire, rescued) and REPLACES the rooms array only at the
 * feature start and at a building change. So: an in-place bump plays ONE jet (a jump of several counts is still one
 * jet: the same window, the same moment), a room turning rescued plays its drop, and a new array only re-syncs. That
 * is what keeps a building change from firing every stale spray of the saved building at the new one.
 */
export function roomOneShots(rooms: readonly RoomMark[], seen: RoomsSeen): OneShots {
	const fresh = rooms !== seen.ref;
	seen.ref = rooms;
	const out: OneShots = { sprays: [], rescues: [] };
	for (const room of rooms) {
		const r = room.reel;
		const sprayedUp = room.sprayed > (seen.sprayed[r] ?? 0);
		const rescuedNow = room.rescued && !seen.rescued[r];
		seen.sprayed[r] = room.sprayed;
		seen.rescued[r] = room.rescued;
		if (fresh) continue;
		if (sprayedUp) out.sprays.push({ reel: r, fireAfter: room.fire });
		if (rescuedNow) out.rescues.push(r);
	}
	return out;
}

/**
 * The reel banner on a rescue. On a phone the prize is said ONCE, on the plaque under the rescued room's sill (it stays
 * there, next to the pig that earned it, until the building is cleared); the banner only says RESCUED!, and the rail's
 * TOTAL takes the prize in at the same rescue (`runningTotal`), so the plaques and TOTAL never disagree. Wide layouts
 * keep the amount on the banner.
 */
export const rescueBannerText = (prizeText: string | null | undefined, stacked: boolean): string =>
	prizeText && !stacked ? `RESCUED! +${prizeText}` : 'RESCUED!';

/**
 * The phone rail's TOTAL at a rescue: the book's running total plus the prize the book just paid (inferno_prizes: two
 * 500 prizes read 0 -> 500 -> 1000 at their rescues, then the spin's setTotalWin 1100 states the book's figure, which
 * always includes them). Clamped to the 15,000x cap (roundTier WIN_CAP_BOOKED, passed in: this module imports
 * nothing), so it can never show more than the round can pay.
 */
export const runningTotal = (total: number, prize: number | null | undefined, cap: number): number =>
	prize && prize > 0 ? Math.min(total + prize, cap) : total;

// ---- phone band geometry (board units: SYMBOL_SIZE per cell, y down, reels start at y = 0) ------------------------------
/** A top-left rect. */
export type Rect = { x: number; y: number; w: number; h: number };
/** A CENTRED box: x / y are its centre. */
export type Box = { x: number; y: number; w: number; h: number };

/** Phone lettering, in cells (x S board units): >= 14 px at 390x844, where a stacked cell is 78 px. */
/** The share of a sill plaque's width its figure may fill: the bolts sit in the plate's corners, the figure between. */
export const PLAQUE_TEXT_FILL = 0.84;
export const PHONE_FONT = { building: 0.2, total: 0.21, badge: 0.3, plaque: 0.21, banner: 0.28 } as const;

export type PhoneBandInput = {
	S: number;
	W: number;
	/** top of the band the layout reserves */
	bandTop: number;
	/** the highest flame / smoke of any room (the rooms' sprites rise above the cornice) */
	smokeTop: number;
	/** the frame's header beam (outer top edge) */
	frameTop: number;
	/** each room's window, reel order */
	windows: readonly Rect[];
	/** the blank spins plate, width / height */
	plateAspect: number;
	/** the blank badge, height / width */
	badgeAspect: number;
};

export type PhoneBand = {
	railY: number;
	building: Box;
	total: Box;
	badge: Box;
	/** where a transient banner rides: on the rail, left of the badge (the xN keeps showing) */
	banner: Box;
	/** one prize plaque per window, between its sill and the header beam */
	plaques: Box[];
	/** font sizes (board units) before any fit-to-width */
	font: { building: number; total: number; badge: number; plaque: number; banner: number };
};

/** Cells a sill plaque keeps clear of the header beam's top line. */
const PLAQUE_BEAM_CLEAR = 0.03;

export function phoneRescueBand(i: PhoneBandInput): PhoneBand {
	const { S, W } = i;
	const railH = i.smokeTop - i.bandTop;
	const railY = i.bandTop + railH / 2;
	const maxH = railH * 0.9;
	const plate = (x: number, w: number): Box => {
		const h = Math.min(w / i.plateAspect, maxH);
		return { x, y: railY, w: h * i.plateAspect, h };
	};
	const building = plate(S * 0.8, S * 1.45);
	const total = plate(W / 2 + S * 0.1, S * 1.8);
	const badgeW = Math.min(S * 0.74, maxH / i.badgeAspect);
	// in from the edge far enough that its swell on a multiplier change (x1.28) stays on screen
	const badge = { x: W - S * 0.5, y: railY, w: badgeW, h: badgeW * i.badgeAspect };
	const bx0 = S * 0.08;
	// right of the banner: room for the badge's swell on a multiplier change (0.5 x 1.28 of its width) plus a margin
	const bx1 = badge.x - badge.w * 0.64 - S * 0.06;
	const banner = { x: (bx0 + bx1) / 2, y: railY, w: bx1 - bx0, h: Math.min(maxH, S * 0.62) };
	const centres = i.windows.map((w) => w.x + w.w / 2);
	// each plaque between its sill and the header beam, kept off the beam's top line, and narrow enough that two
	// neighbours read as two plaques (a clear 0.14-cell gap at the reel pitch), not one long bar
	const plaques = i.windows.map((w, k) => {
		const sill = w.y + w.h;
		const room = Math.max(0, i.frameTop - S * PLAQUE_BEAM_CLEAR - sill);
		const pitch = Math.min(k > 0 ? centres[k] - centres[k - 1] : Infinity, k < centres.length - 1 ? centres[k + 1] - centres[k] : Infinity, S);
		let h = Math.min(room * 0.96, S * 0.4);
		let pw = h * i.plateAspect;
		if (pw > pitch * 0.86) {
			pw = pitch * 0.86;
			h = pw / i.plateAspect;
		}
		return { x: centres[k], y: sill + room / 2, w: pw, h };
	});
	const f = PHONE_FONT;
	return { railY, building, total, badge, banner, plaques, font: { building: S * f.building, total: S * f.total, badge: S * f.badge, plaque: S * f.plaque, banner: S * f.banner } };
}

/** The ONE slot the phone drop plays in, whichever window it leaves: all five columns, from above the window tops down
 *  to the header beam. It never moves, so a queued second rescue cannot drag the first pig across the facade, and its
 *  mask ends at the beam, so the pig drops out of sight there instead of hanging over the reels. */
export const phoneDropSlot = (i: { S: number; W: number; windows: readonly Rect[]; frameTop: number }): Rect => {
	const top = Math.min(...i.windows.map((w) => w.y)) - i.S * 0.35;
	return { x: -i.S * 0.25, y: top, w: i.W + i.S * 0.5, h: i.frameTop - top };
};

/** Straight down the rescued room's own column, from where its window Trotter stands to wholly under the beam
 *  (pigH is the window Trotter's height, so the pig drops at WINDOW size). */
export const phoneDropPath = (feet: { x: number; y: number }, frameTop: number, pigH: number) => ({
	from: { x: feet.x, y: feet.y },
	to: { x: feet.x, y: frameTop + pigH * 1.4 },
});

/** How a rescued Trotter leaves its window on a phone: the rig's own slide (`rig`), the scene's drop of a snapshot of it
 *  (`drop`), or, under reduced motion, the snapshot fading in place (`fade`). */
export type PhoneExit = 'rig' | 'drop' | 'fade';
export type MotionMode = { reduced: boolean; speedTier: 0 | 1 | 2 };

/**
 * EVERY rescue beat on a phone gives its Trotter ONE visible exit. The rig runtime slides only the first rescue of a
 * douse: it queues the rest (each slide 1.2 s + land 0.6 s, game/anim RigPlayback's rescue queue) and the next spin
 * cancels whatever is still queued, which on a phone is always before a queued drop has cleared the beam; on turbo the
 * next beat cuts even the first slide mid-fall, and on super turbo / reduced motion it slides nothing at all. So at
 * normal speed the rig drop shows for the FIRST rescue of each douse (its host is
 * hidden at that drop's landing, behind the header beam, so the queued slides play unseen), and every other rescued
 * Trotter is snapshotted at its beat, before the rig hides it, and dropped by the scene down its own column, side by
 * side with the first (`phoneDropPose`); reduced motion fades the snapshot in place.
 */
export function createDropGate() {
	let rescues = 0;
	return {
		/** a douse beat: a new spin's rescues begin */
		douse: (): void => {
			rescues = 0;
		},
		/** a rescue beat: how THIS rescued Trotter leaves its window */
		rescue: (motion: MotionMode): PhoneExit => {
			rescues += 1;
			if (motion.reduced) return 'fade';
			// turbo: the holds shrink to 0.4x but the rig slide still takes 0.8 s, so the next beat (NEXT BUILDING, the
			// next spin) would cut it mid-fall; super turbo slides nothing
			if (motion.speedTier !== 0) return 'drop';
			return rescues === 1 ? 'rig' : 'drop';
		},
		/** the rig drop reached the beam: true when its host must hide (phones only) */
		landed: (stacked: boolean): boolean => stacked,
	};
}

/** The scene's phone drop at progress p (0..1): a small hop up out of the window, then a fall (gravity: q^2) straight
 *  down its own column to the path end (wholly under the beam, where the drop layer's mask hides it). */
export function phoneDropPose(p: number, from: { x: number; y: number }, to: { x: number; y: number }, S: number) {
	const HOP_P = 0.16;
	const hop = S * 0.08;
	if (p <= HOP_P) {
		const q = p / HOP_P;
		return { x: from.x, y: from.y - hop * Math.sin((Math.PI / 2) * q), rot: -0.12 * q };
	}
	const q = Math.min(1, (p - HOP_P) / (1 - HOP_P));
	const top = from.y - hop;
	return { x: from.x, y: top + (to.y - top) * q * q, rot: -0.12 + 0.3 * q };
}

/** Where a room's Trotter stands (the `rescueRoom` slot, top-left rect). Wide layouts: the window, from 0.1 h above it.
 *  Phones: lower and smaller in the window, so the fire behind the pig (Inferno's smouldering flame, Rescue's roaring
 *  flames) still shows around it. The phone drop starts from the same slot's feet. */
export const trotterSlot = (wr: Rect, stacked: boolean): Rect =>
	stacked ? { x: wr.x + wr.w * 0.12, y: wr.y + wr.h * 0.28, w: wr.w * 0.76, h: wr.h * 0.74 } : { x: wr.x, y: wr.y - wr.h * 0.1, w: wr.w, h: wr.h * 1.05 };

/** The banner timeline's point (0..1, over 1.5 s) where the phone banner is fully in: a banner replacing one still up
 *  restarts here, swapping its words without dropping back to the rail. */
export const BANNER_FULL = 0.14;
/**
 * The phone banner rides the rail and REPLACES its plates while up: one layer at a time, never a cross-fade (two sets of
 * half-opaque letters in one place read as 'BUILDING 2 BUILDING TOTAL $3.00 SPINS'). The rail fades out first
 * (0-90 ms), then the banner fades in; at the end the banner fades out completely before the rail fades back in.
 */
export function phoneBannerRail(t: number): { banner: number; rail: number } {
	const RAIL_OUT = 0.06;
	const OUT_START = 0.75;
	const OUT_END = 0.88;
	const clamp = (v: number) => Math.max(0, Math.min(1, v));
	if (t >= 1) return { banner: 0, rail: 1 };
	if (t < RAIL_OUT) return { banner: 0, rail: clamp(1 - t / RAIL_OUT) };
	if (t < BANNER_FULL) return { banner: clamp((t - RAIL_OUT) / (BANNER_FULL - RAIL_OUT)), rail: 0 };
	if (t < OUT_START) return { banner: 1, rail: 0 };
	if (t < OUT_END) return { banner: clamp(1 - (t - OUT_START) / (OUT_END - OUT_START)), rail: 0 };
	return { banner: 0, rail: clamp((t - OUT_END) / (1 - OUT_END)) };
}

/** A prize plaque shows only once its Trotter has dropped past it (the phone drop clears the plaque ~0.9 s after the
 *  rescue beat), then fades in: the pig falls past bare brick, never into its own prize sign. `speed` scales the wait
 *  (turbo 0.6, reduced motion small). */
export const plaqueAlpha = (msSinceRescue: number, speed: number): number => {
	const delay = 900 * speed;
	const fade = 220 * speed;
	return msSinceRescue <= delay ? 0 : Math.min(1, (msSinceRescue - delay) / Math.max(1, fade));
};

/** Scale that fits a measured text width into `maxW` (never grows it). */
export const fitWidth = (textW: number, maxW: number): number => (textW > maxW && textW > 0 ? maxW / textW : 1);
