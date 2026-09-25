/**
 * LUCKY — Fortune Build / Golden Dragon Build AUDIO DIRECTOR (bonus-scene seam; internal Hold & Build / Golden Build).
 *
 * This is the SINGLE seam the bonus scene calls for sound. It is no longer a
 * no-op: every method now drives the ONE game audio manager and the
 * presentation-state director (`game/audio`). The director and HouseView call
 * sites are UNCHANGED — only the bodies here changed. Method names still map
 * 1:1 to the Spine rig events the animation worker documents in
 * art-src/animation/runtime-manifest.json (§12).
 *
 * Everything is idempotent + bounded: the manager caps per-cue instances and
 * cooldowns from cues.json, coalesces dense upgrade/collect clusters into a
 * readable sequence, and ducks the music (3–6 dB) only for entry / retrigger /
 * jackpot / collection. If audio never unlocked, every call is a safe no-op.
 */
import { audioManager, presentationDirector } from '../audio';
import { CUES } from '../audio/cueManifest';
import type { BonusKind, JackpotKind } from '../typesBookEvent';

// tier (1..5) → material cue
const HOUSE_CUE = ['house_straw', 'house_wood', 'house_brick', 'house_mansion', 'house_palace'] as const;
const HAT_CUES = ['hat_land_1', 'hat_land_2', 'hat_land_3'];

const houseCue = (tier: number): string => HOUSE_CUE[Math.min(5, Math.max(1, Math.round(tier))) - 1];

export type AudioDirector = {
	/** A hard hat makes contact with a cell (evt_hat_contact). */
	hatContact: () => void;
	/** A new house is built on a previously-empty cell (tier). */
	houseAppear: (tier: number) => void;
	/** A house is upgraded to `tier` under the dust cover (evt_tier_swap). */
	houseUpgrade: (tier: number) => void;
	/** A Tier-5 house is hit again — "maxed" sparkle, no upgrade. */
	houseMaxed: () => void;
	/** Exactly one +1 SPIN award beat for this spin (2+ hats landed). */
	extraSpin: () => void;
	/** Bonus intro plate (covered transition into the build site). */
	bonusIntro: (bonus: BonusKind) => void;
	/** Bonus outro / return to base board. */
	bonusOutro: () => void;
	/** A door latch opens (evt_door_latch). */
	doorLatch: () => void;
	/** A prize value becomes visible in a doorway (evt_prize_visible). The door's
	 *  final tier picks the chime size for an ordinary (non-jackpot) door. */
	prizeVisible: (tier: number, jackpot: JackpotKind) => void;
	/** A jackpot plaque (MINOR / MAJOR / GRAND) is presented. */
	jackpot: (kind: Exclude<JackpotKind, null>) => void;
	/** FULL STREET x2: the multiplier moment (a dedicated cue if the audio lane ships one, else the minor sting). */
	streetBonus?: (multiplier: number) => void;
	/** Collection of a door prize into the running total (evt_collect_start). */
	collect: () => void;
	/** Final bonus total-win presentation, scaled by winLevel. `win_max` belongs to the cap ONLY (winLevelMap
	 *  level 10, alias `max`); every lower rung plays its own total stinger. */
	total: (winLevel: number) => void;
	/** GRAND FESTIVAL (full 15/15 board, x10): its own celebration cue, `grand_festival` (AUDIO lane, 2026-09-23). */
	grandFestival?: () => void;
	/** Mascot celebrate/win apex (pig rig evt_celebrate_peak). Added by the
	 *  animation worker; now cues the non-verbal "hup!" accent. */
	pigCelebratePeak?: () => void;
	/** Mascot celebrate landing (pig rig evt_land). Now cues the landing thud. */
	pigLand?: () => void;

	// ---- wave-5 scene direction seams (picture-driven, never timers) ------------
	/** The roller shutter's bar hits the sill (first impact only). */
	shutterSlam?: () => void;
	/** One of the three hauls as the shutter rattles back up (1..3). */
	shutterHaul?: (n: number) => void;
	/** Feature-entry blast reveal starts: the air is sucked in (riser into a vacuum). */
	blastStart?: () => void;
	/** The blast's `impact` event from the VFX rig (picture-driven). */
	blastImpact?: () => void;
	/** The door is gone under the white: the bonus site lands (stinger). */
	blastReveal?: () => void;
	/** A 3D hat starts its retrigger flip (swell + tumble whoosh). */
	hatFlipStart?: (golden: boolean) => void;
	/** The flip reaches the manifest's PEAK frame: energy crack (banner ticks here). */
	hatFlipPeak?: (golden: boolean) => void;
	/** The flip settles front-facing again. */
	hatFlipSettle?: () => void;
	/** The hat slams flat into its cell as the square trace starts. */
	hatSlam?: () => void;
	/** Square trace around the target cell, pitched by the tier being built. */
	squareTrace?: (tier: number) => void;
	/** The spins banner reaches 1. */
	lastSpin?: () => void;
	/** 13-14 cells are filled. */
	nearFull?: () => void;
	/** A door prize pops (n = 0-based reveal index -> climbing chime). */
	doorChime?: (n: number) => void;

	// ---- cell reels + EXPANDED features (contract 7.2) ---------------------------------
	/** The bonus cell reels start turning (one loop for every board). */
	reelSpinStart?: () => void;
	/** Every cell reel has come to rest. */
	reelSpinStop?: () => void;
	/** One cell reel hits its stop (`order` = 0..14 reading order; hats tick brighter). */
	reelStop?: (hat: boolean, order: number) => void;
	/** Expanded / Golden Expanded entry (mode card on the shutter + bed). */
	expandIntro?: (golden: boolean) => void;
	/** The camera pulls back and the site opens up. */
	expandOpen?: () => void;
	/** An extra board touches down on the yard (weight, before the bolts). */
	boardLand?: () => void;
	/** An extra board is bolted down. */
	boardUnlock?: () => void;
	/** A board's spins ran out while others continue. */
	boardComplete?: () => void;
	/** The SITE COMPLETE badge's stamp hits the paper (owner, 2026-09-19: a real stamp sound). */
	siteStamp?: (golden: boolean) => void;

	// ---- SITE PERMIT count reel (owner, 2026-09-19) ---------------------------------------------
	/** The counter comes up and the drum spins up. */
	permitReelStart?: () => void;
	/** The drum turning at speed (loop on / off). */
	permitReelTick?: (on: boolean) => void;
	/** A face passes the window during the ease-down (ratchet click). */
	permitReelSlow?: () => void;
	/** The drum lands on the booked count and the latch slides home. */
	permitReelStop?: (golden: boolean) => void;
	/** The "N SITES" stamp hits. */
	permitStamp?: (golden: boolean) => void;
};

/** First cue id that actually exists in the manifest (dedicated cue first, then
 *  the closest existing sound), so a seam never throws and never goes silent
 *  just because a bespoke cue has not been authored yet. */
const firstCue = (...ids: string[]): string | null => ids.find((id) => id in CUES) ?? null;
const play = (opts: { family?: string; coalesceMs?: number } | undefined, ...ids: string[]) => {
	const id = firstCue(...ids);
	if (id) audioManager.playCue(id, opts ?? {});
};

export const audioDirector: AudioDirector = {
	hatContact: () => {
		// alternate the three hat samples via presentation RNG, not outcome RNG
		audioManager.playRoundRobin('hat', HAT_CUES);
	},
	houseAppear: (tier) => {
		audioManager.playCue(houseCue(tier), { family: 'house', coalesceMs: 90 });
	},
	houseUpgrade: (tier) => {
		// coalesce dense upgrade clusters into a readable sequence (not 15 chimes)
		audioManager.playCue(houseCue(tier), { family: 'house', coalesceMs: 90 });
	},
	houseMaxed: () => {
		audioManager.playCue('house_maxed', { family: 'house', coalesceMs: 90 });
	},
	extraSpin: () => {
		// a retrigger is a bounded intensity accent, not a bed change: duck lightly
		// so the +1-spin motif reads over the bonus bed (spec: duck on retrigger)
		audioManager.duck({ db: 3, holdMs: 150, releaseMs: 300 });
		audioManager.playCue('extra_spin'); // maxInstances 1 in the manifest
	},
	bonusIntro: (bonus) => {
		void presentationDirector.bonusIntro(bonus);
	},
	bonusOutro: () => {
		audioManager.playCue('bonus_exit');
		presentationDirector.returnToBase();
	},
	doorLatch: () => {
		// first latch thins the bed to the reveal underscore (idempotent)
		presentationDirector.doorReveal();
		audioManager.playCue('door_latch', { family: 'door', coalesceMs: 60 });
	},
	prizeVisible: (tier, jackpot) => {
		// jackpot doorways get their plaque via jackpot(); an ordinary door gets a
		// prize chime sized by its final tier: 1–2 small, 3 medium, 4–5 large.
		if (jackpot) return;
		const t = Math.min(5, Math.max(1, Math.round(tier)));
		const cue = t >= 4 ? 'prize_large' : t === 3 ? 'prize_medium' : 'prize_small';
		audioManager.playCue(cue, { family: 'prize', coalesceMs: 40 });
	},
	streetBonus: () => {
		audioManager.duck({ holdMs: 250 });
		play({ family: 'street', coalesceMs: 200 }, 'street_bonus', 'jackpot_minor', 'total_win_mid');
	},
	jackpot: (kind) => {
		const id = `jackpot_${String(kind).toLowerCase()}`;
		audioManager.duck({ holdMs: 300 });
		audioManager.playCue(id);
	},
	collect: () => {
		presentationDirector.collect();
		// per-door tick; the manager coalesces a dense count-up
		audioManager.playCue('collect_tick', { family: 'collect', coalesceMs: 50 });
	},
	total: (winLevel) => {
		presentationDirector.collect();
		audioManager.duck({ holdMs: 400 });
		audioManager.playCue('collect_resolve');
		// LUCKY fix (2026-09-23, AUDIO lane report): levels 4-9 used to fall through to `win_max`, so a 31.5x Fortune
		// Build total played the MAX WIN fanfare. The max fanfare now plays for the cap rung (10) only.
		const level = Math.round(winLevel);
		const stinger =
			level >= 10 ? 'win_max' : level <= 1 ? 'total_win_small' : level === 2 ? 'total_win_mid' : 'total_win_big';
		audioManager.playCue(stinger);
	},
	grandFestival: () => {
		audioManager.duck({ holdMs: 900 });
		audioManager.playCue('grand_festival' in CUES ? 'grand_festival' : 'total_win_big');
	},
	pigCelebratePeak: () => {
		audioManager.playCue('pig_hup', { family: 'pig', coalesceMs: 120 });
	},
	pigLand: () => {
		audioManager.playCue('pig_thud', { family: 'pig', coalesceMs: 80 });
	},

	// shutter_slam / shutter_haul_1-3 shipped 2026-09-19 (audio/tools/build_transition.py), so
	// they now play on EVERY scene change. The timber sign impact and the three bolt pops stay
	// in the chain as the stand-ins they used to be, in case a cue ever fails to load.
	shutterSlam: () => {
		audioManager.duck({ db: 4, holdMs: 220, releaseMs: 380 });
		play(undefined, 'shutter_slam', 'sign_impact_timber', 'crate_stop');
	},
	shutterHaul: (n) => play({ family: 'shutter', coalesceMs: 60 }, `shutter_haul_${n}`, `bolt_pop_${n}`),
	// Feature-entry blast reveal (SceneShutter, pw_fx_transition rig). The vacuum has
	// no stand-in: a wrong riser is worse than silence. The impact and the reveal
	// borrow from the same heavy-timber family the slam uses until their own cues land.
	blastStart: () => play({ family: 'blast', coalesceMs: 400 }, 'blast_vacuum'),
	blastImpact: () => {
		audioManager.duck({ db: 5, holdMs: 260, releaseMs: 420 });
		play({ family: 'blast', coalesceMs: 120 }, 'blast_impact', 'sign_impact_timber', 'crate_stop');
	},
	blastReveal: () => play({ family: 'blastreveal', coalesceMs: 400 }, 'blast_reveal', 'board_land', 'crate_stop'),
	hatFlipStart: (golden) =>
		play({ family: 'hatflip', coalesceMs: 120 }, ...(golden ? ['ghat_flip_whoosh'] : []), 'hat_flip_whoosh'),
	hatFlipPeak: (golden) =>
		play({ family: 'hatcrack', coalesceMs: 120 }, ...(golden ? ['ghat_energy_crack'] : []), 'hat_energy_crack'),
	hatFlipSettle: () => play({ family: 'hatsettle', coalesceMs: 120 }, 'hat_flip_settle'),
	hatSlam: () => play({ family: 'hatslam', coalesceMs: 60 }, 'hat_slam'),
	squareTrace: (tier) => {
		const t = Math.min(5, Math.max(1, Math.round(tier)));
		play({ family: 'trace', coalesceMs: 60 }, `square_trace_t${t}`, 'square_tick');
	},
	lastSpin: () => play(undefined, 'last_spin'),
	nearFull: () => play(undefined, 'near_full_shimmer'),
	doorChime: (n) => play({ family: 'chime', coalesceMs: 30 }, `door_chime_${Math.min(8, Math.max(1, n + 1))}`),

	// reel_spin_loop is a LOOP: started / stopped here, never layered. Ids that are
	// not in the manifest yet are safe no-ops.
	reelSpinStart: () => {
		if ('reel_spin_loop' in CUES) audioManager.startSfxLoop('reel_spin_loop', 140, 0.8);
	},
	reelSpinStop: () => {
		if ('reel_spin_loop' in CUES) audioManager.stopSfxLoop('reel_spin_loop', 220);
	},
	reelStop: (hat, order) => {
		// up to 60 reels can stop in one expanded tick: coalesce into a readable patter
		if (hat) play({ family: 'cellreel_hat', coalesceMs: 70 }, 'cell_reel_hat_stop', 'hat_land_1');
		else play({ family: 'cellreel', coalesceMs: 85 }, 'cell_reel_stop', `reel_stop_${(order % 5) + 1}`);
	},
	expandIntro: (golden) => {
		// the presentation director picks the bed (expanded_build_loop /
		// golden_expanded_loop) and the entry stinger from the bonus name
		void presentationDirector.bonusIntro(golden ? 'goldenExpanded' : 'expandedHoldAndBuild');
	},
	expandOpen: () => {
		audioManager.duck({ db: 3, holdMs: 260, releaseMs: 420 });
		play(undefined, 'expand_open');
	},
	boardLand: () => play({ family: 'boardland', coalesceMs: 120 }, 'board_land', 'crate_stop', 'sign_impact_timber'),
	boardUnlock: () => play({ family: 'boardunlock', coalesceMs: 120 }, 'board_unlock', 'bolt_pop_1'),
	permitReelStart: () => play({ family: 'permit', coalesceMs: 200 }, 'permit_reel_start', 'expand_open'),
	permitReelTick: (on) => {
		if (!('permit_reel_tick' in CUES)) return;
		if (on) audioManager.startSfxLoop('permit_reel_tick', 90);
		else audioManager.stopSfxLoop('permit_reel_tick', 220);
	},
	permitReelSlow: () => play({ family: 'permitclick', coalesceMs: 40 }, 'permit_reel_slow', 'bolt_pop_1'),
	permitReelStop: (golden) => play({ family: 'permit', coalesceMs: 120 }, ...(golden ? ['gpermit_reel_stop'] : []), 'permit_reel_stop', 'board_unlock'),
	permitStamp: (golden) => play({ family: 'permitstamp', coalesceMs: 200 }, ...(golden ? ['gpermit_stamp'] : []), 'permit_stamp', 'board_land'),
	boardComplete: () => play({ family: 'boardcomplete', coalesceMs: 120 }, 'board_complete'),
	siteStamp: (golden) => play({ family: 'sitestamp', coalesceMs: 150 }, ...(golden ? ['gsite_stamp'] : []), 'site_stamp', 'permit_stamp'),
};
