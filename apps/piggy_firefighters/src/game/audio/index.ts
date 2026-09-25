/**
 * Piggy Workers — audio public surface.
 *
 * ONE manager (`audioManager`, a Web Audio graph implementing the HUD `Sfx`
 * interface), ONE presentation director (`presentationDirector`), and the two
 * wiring seams the rest of the game uses:
 *
 *   - `gameAudioSfx`  → pass as `HudConfig.sfx` so the burger sliders + M-key
 *                       mute drive this manager's buses.
 *   - `HUD_SFX_CUES`  → pass as `HudConfig.sfxCues` so the HUD's own button
 *                       broadcasts name real Piggy Workers cue ids.
 *   - `unlockAudio()` → call inside the splash-dismiss gesture.
 *   - `subscribeGameAudio(emitter)` → register the emitter bridge from a
 *                       component's init (Splash) so Build-or-Bust + HUD button
 *                       broadcasts reach the manager.
 *
 * `game/fx/audioDirector.ts` re-exports the bonus-scene seam from here.
 */
import { audioManager } from './audioManager';
import { presentationDirector } from './presentationDirector';
import type { Sfx } from '@crashgalaxy/hud';

export { audioManager } from './audioManager';
export { presentationDirector } from './presentationDirector';
export type { PresentationState } from './presentationDirector';

/** The HUD's `Sfx` port — the burger sliders + mute talk to the manager. */
export const gameAudioSfx: Sfx = audioManager;

/** Real cue ids for the HUD's own button sounds (`HudConfig.sfxCues`).
 *  The donor defaults (`sfx_btn_spin` / `sfx_btn_general`) do not exist in the
 *  Piggy Workers sprite; these do. */
export const HUD_SFX_CUES = { spinPress: 'spin_start', general: 'ui_click' } as const;

/** Unlock + resume the context on the initial user gesture and start the base
 *  bed. Safe, idempotent, never throws — the game plays on if audio cannot start. */
export function unlockAudio(): void {
	void audioManager.unlock();
	presentationDirector.watchBase();
}

/** Start downloading every short cue while the splash is still up (no gesture needed to FETCH), so
 *  the unlock gesture only has decoding left to do. Idempotent. */
export function prefetchGameAudio(): void {
	audioManager.prefetch(['base_loop', ...audioManager.shortCueIds()]);
}

/**
 * Base-game audio seam — the ONE place the base/ante board talks to the manager.
 *
 * The donor Howler system (Sound.svelte / sound.ts / the `sound` asset) is gone;
 * these call sites (spin press, the 5-rung reel-stop ladder, hat-land ladder,
 * wild land, base win tiers) now drive the single Web Audio manager directly.
 * Every method is a safe no-op until `unlock()`, so no cue is a "silent donor
 * name" — each is a real Piggy Workers cue id from cues.json.
 */
const HAT_LAND_CUES = ['hat_land_1', 'hat_land_2', 'hat_land_3'];
const SYM_LAND_CUES = ['sym_land_1', 'sym_land_2', 'sym_land_3'];
let symLandRR = 0;
const UI_CLICK_CUES = ['ui_click', 'ui_click_2', 'ui_click_3'];

// ---- the hat lane (2026-09-19) ------------------------------------------------------------------
// Two hats on ONE reel land on the same frame, and contract 7.6 ("hats land in groups") makes that the
// norm. Their two hatLand() calls arrived inside the 20-30 ms coalesce window, so the SECOND hat's bonk
// and, worse, its HIGHER ladder rung were merged away: measured on a real round, the ear heard rungs
// 1-2-3 while the eye saw five hats (`coalesce hat_ladder_4` in window.__pwAudio.log). The lane gives
// hats that arrive together a short stagger, so every hat sounds and the group climbs as a quick roll.
//   - a quiet lane fires at once: an ordinary single hat gains no latency;
//   - bounded: at most three hats per reel, so the last one is <= 170 ms late;
//   - Super Turbo keeps its single merged hit;
//   - a throw in here can never reach a caller (audio is never allowed to break a presentation).
const HAT_STAGGER_MS = 85;
let hatLaneFreeAt = 0;
const hatLane = (fire: () => void, gapMs = HAT_STAGGER_MS): void => {
	const run = () => {
		try {
			fire();
		} catch {
			/* swallowed on purpose */
		}
	};
	if (audioManager.turboLevel >= 2 || typeof performance === 'undefined') return run();
	const now = performance.now();
	const at = Math.max(now, hatLaneFreeAt);
	hatLaneFreeAt = at + gapMs;
	if (at - now < 4) run();
	else setTimeout(run, at - now);
};

export const gameSound = {
	/** Spin button / spacebar. (The HUD also routes its own press through the
	 *  `sfxCues.spinPress` bridge; call this from a game-side press only.) */
	spinPress(): void {
		audioManager.playCue('spin_start');
	},
	/** Generic UI tick — round-robin the three alternates so repeated taps never
	 *  machine-gun the same sample (ui_click / _2 / _3). */
	uiClick(): void {
		audioManager.playRoundRobin('ui', UI_CLICK_CUES, { coalesceMs: 40 });
	},
	/** Hat-anticipation ladder rung (base hat landings that build tension):
	 *  rung 1..5 → hat_ladder_1..5 (rising). Clamped; safe before unlock. */
	hatLadder(rung: number): void {
		const n = Math.min(5, Math.max(1, Math.round(rung)));
		audioManager.playCue(`hat_ladder_${n}`, { family: 'hatladder', coalesceMs: 20 });
	},
	/** The final spin of a sequence (last free/extra spin) — one-shot accent. */
	lastSpin(): void {
		audioManager.playCue('last_spin');
	},
	/** A reel stops with construction symbols on it (owner, 2026-09-19: "an audible clunk ... whenever
	 *  a construction symbol lands"): one of three timber/steel clunks, round-robin, coalesced so five
	 *  stops read as a ladder of knocks; at Super Turbo the single stop gets one clunk. Hats keep their bonk. */
	symbolLand(reelIndex: number): void {
		const id = SYM_LAND_CUES[(symLandRR + reelIndex) % SYM_LAND_CUES.length];
		symLandRR = (symLandRR + 1) % SYM_LAND_CUES.length;
		audioManager.playCue(id, { family: 'symland', coalesceMs: 60, rate: 0.97 + 0.02 * Math.min(4, reelIndex) });
	},
	/** Reel-stop ladder: reel 0..4 → reel_stop_1..5 (rising). */
	reelStop(reelIndex: number): void {
		const rung = Math.min(5, Math.max(1, Math.round(reelIndex) + 1));
		if (audioManager.turboLevel >= 2) {
			audioManager.playCue('reel_stop_3', { family: 'reel', coalesceMs: 260 });
			return;
		}
		audioManager.playCue(`reel_stop_${rung}`, { family: 'reel', coalesceMs: 15 });
	},
	/** A hard hat lands. `count` is how many hats the spin shows so far: the landing escalates — light
	 *  bonks for the first three, then the heavy bonk pitched up a step per hat, with the rising
	 *  pentatonic ladder on top, so a 4-5-6 hat group audibly climbs toward the trigger. */
	hatLand(count = 1): void {
		hatLane(() => {
			const coalesceMs = audioManager.turboLevel >= 2 ? 160 : 30;
			if (count <= 3) {
				audioManager.playRoundRobin('hat', HAT_LAND_CUES, { coalesceMs });
			} else {
				audioManager.playCue('hat_land_heavy', { family: 'hat', coalesceMs: 30, rate: 1 + 0.06 * Math.min(4, count - 4) });
			}
			if (count >= 2) this.hatLadder(Math.min(5, count - 1));
		});
	},
	/** A GOLDEN hat's ladder rung, in the same lane as the plain hats so a mixed group still climbs in order. */
	goldenHatRung(count: number): void {
		hatLane(() => {
			if (count >= 2) this.hatLadder(Math.min(5, count - 1));
		});
	},
	/** The 6th hat has landed on the reels: the trigger is real. Queued BEHIND any hats still rolling out
	 *  of the lane, so the fanfare never speaks over the hat that earned it. */
	triggerFanfare(): void {
		hatLane(() => {
			audioManager.duck({ holdMs: 1400 });
			audioManager.playCue('trigger_fanfare');
		}, 60);
	},
	/** Reels are travelling: a soft wooden ratchet loop from spin start to the last stop. Skipped in
	 *  Super Turbo, where a round is shorter than the loop's fade. */
	reelsStart(superTurbo = false): void {
		// The HUD only sounds the press for a button click; a Space / autoplay round starts here. Both
		// paths may fire — the cues' 300 ms cooldown keeps it to one lever pull.
		audioManager.playCue('spin_start');
		audioManager.playCue('spin_whoosh');
		if (superTurbo) return;
		audioManager.startSfxLoop('reel_spin_loop', 90);
	},
	reelsStop(): void {
		audioManager.stopSfxLoop('reel_spin_loop', 140);
	},
	/** One ways win is being shown: the winning symbol's own sound (bulldozer rev, jackhammer, paper,
	 *  clang, splat, bricks, planks; the pig for an all-wild way). */
	symbolWin(symbol: string): void {
		// H1 is the hero pig worker now (2026-09-19): he reads as the pig, so his way-win is the pig's
		// cue with the jackhammer under it, not the retired bulldozer rev
		if (symbol === 'H1') {
			audioManager.playCue('sym_win_w', { family: 'symwin', coalesceMs: 140 });
			audioManager.playCue('sym_win_h2', { family: 'symwin2', coalesceMs: 140 });
			return;
		}
		audioManager.playCue(`sym_win_${String(symbol).toLowerCase()}`, { family: 'symwin', coalesceMs: 140 });
	},
	/** Opening jingle of a winning spin, sized by the total (x100 of the base amount). Returns below the
	 *  amount played get no jingle — the symbol sounds are enough (no fanfare for a net loss). */
	waysWin(totalWin: number, betUnits = 100): void {
		if (totalWin < betUnits) return;
		audioManager.playCue(totalWin >= betUnits * 3 ? 'way_win_mid' : 'way_win_small');
	},
	/** A reel has gone into anticipation: the riser. */
	/** `hatsShowing` is how many hats the board shows as this reel is held (4 or 5). One short of the trigger
	 *  plays the riser a step higher and a touch louder: HONEST scaling, from what the player can already see. */
	anticipationRiser(hatsShowing = 4): void {
		const close = hatsShowing >= 5;
		audioManager.playHeld('antic_riser', { rate: close ? 1.08 : 1, level: close ? 1.12 : 1 });
	},
	/** The anticipated reel has stopped: a hit lands, a miss lets the air out. */
	anticipationResolve(hit: boolean): void {
		// the riser ENDS with the outcome: nothing keeps rising after a miss, or over the fanfare after a hit
		audioManager.stopHeld('antic_riser', hit ? 140 : 90);
		// A HIT plays nothing of its own: in the base game a hit IS six hats, which always brings the trigger
		// fanfare, and a second sting beside it was both redundant and (queued behind it in the hat lane) 62 ms
		// LATE. The riser hands straight over to the fanfare. A MISS gets the base game's own short neutral
		// release (antic_miss); until that cue exists the Build or Bust one it used to borrow stands in.
		if (hit) return;
		audioManager.playCue(audioManager.hasCue('antic_miss') ? 'antic_miss' : 'tension_miss');
	},
	/** A spin that returns nothing settles with a soft thump instead of dead air. */
	deadSpin(): void {
		audioManager.playCue('dead_spin_settle');
	},
	/** A GOLDEN hard hat lands on the reels: its own impact, then a glint on the shine. */
	goldenHatLand(): void {
		audioManager.playCue('ghat_land', { family: 'ghat', coalesceMs: 60 });
		setTimeout(() => audioManager.playCue('ghat_glint', { family: 'ghatglint', coalesceMs: 120 }), 180);
	},
	/** A WILD (Master Bao) symbol lands on the reels. */
	wildLand(): void {
		audioManager.playCue('pig_thud', { family: 'wild', coalesceMs: 80 });
	},
	/** Base/ante win presentation stinger, sized by win level. No bed change —
	 *  the base bed is owned by the presentation director. */
	win(winLevelData: { type?: string; level?: number; alias?: string } | undefined): void {
		if (!winLevelData || winLevelData.alias === 'zero') return;
		const level = winLevelData.level ?? 0;
		// below the amount played: the symbols' own sounds were the whole celebration
		if (level <= 2) return;
		const cue =
			winLevelData.type === 'big'
				? level >= 10 // the MAX WIN fanfare is the cap's alone (winLevelMap 10 = max); EPIC (9) is a big total
					? 'win_max'
					: level >= 7
						? 'total_win_big'
						: 'total_win_mid'
				: winLevelData.type === 'medium'
					? 'total_win_mid'
					: 'total_win_small';
		audioManager.playCue(cue);
	},
	/** Spin/anticipation tension layer under the base bed (no bed swap). */
	anticipationOn(): void {
		presentationDirector.anticipationOn();
	},
	anticipationOff(): void {
		presentationDirector.anticipationOff();
	},
	/** Insufficient-balance alert. Caller must fire exactly once per alert entry
	 *  (the manifest caps it, but the call site owns the once-per-entry gate). */
	alertInsufficient(): void {
		audioManager.playCue('alert_insufficient');
	},
};

// The subset of emitter events this bridge consumes. Kept structural so the
// bridge does not depend on the game's full EmitterEvent union type.
interface BridgeEmitter {
	subscribeOnMount(map: Record<string, (e: never) => unknown>): void;
}

let bridged = false;

/**
 * Register the emitter → manager bridge. MUST be called during a Svelte
 * component's init (it uses `subscribeOnMount`); Splash owns the call. Handles
 * only events that reach this manager exclusively or where the donor sound
 * system is silent (name mismatch), so it introduces no double playback.
 */
export function subscribeGameAudio(emitter: BridgeEmitter): void {
	if (bridged) return;
	bridged = true;
	emitter.subscribeOnMount({
		// Build or Bust — these events reach only this bridge.
		buildOrBustAnticipate: (_e: { outcome: string }) => {
			presentationDirector.anticipationOn();
			audioManager.playCue('build_or_bust_anticipation');
		},
		buildOrBustBust: () => {
			audioManager.playCue('bust_settle');
			presentationDirector.anticipationOff();
		},
		// HUD button sounds: the HUD broadcasts `soundOnce` with our sfxCues
		// (real Piggy cue ids: spin_start / ui_click). The donor Sound.svelte is
		// retired, so this manager is the ONLY handler — no double playback.
		soundOnce: (e: { name: string }) => {
			if (!audioManager.isUnlocked) return;
			audioManager.playCue(e.name);
			// the spin press is a lever pull: click + whoosh
			if (e.name === 'spin_start') audioManager.playCue('spin_whoosh');
		},
	} as Record<string, (e: never) => unknown>);
}
