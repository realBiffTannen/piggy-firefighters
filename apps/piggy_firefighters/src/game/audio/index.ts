/**
 * PIGGY FIREFIGHTERS — audio public surface.
 *
 * ONE manager (`audioManager`, a Web Audio graph implementing the HUD `Sfx`
 * interface), ONE presentation director (`presentationDirector`), and the
 * wiring seams the rest of the game uses:
 *
 *   - `gameAudioSfx`  → pass as `HudConfig.sfx` so the burger sliders + M-key
 *                       mute drive this manager's buses.
 *   - `HUD_SFX_CUES`  → pass as `HudConfig.sfxCues` so the HUD's own button
 *                       broadcasts name real cue ids (docs/AUDIO_MAP.md).
 *   - `unlockAudio()` → call inside the splash-dismiss gesture.
 *   - `subscribeGameAudio(emitter)` → register the emitter bridge from a
 *                       component's init (Splash) so HUD button broadcasts
 *                       reach the manager.
 *
 * Every literal cue id in this file exists in `cueManifest.ts` CUES (checked by
 * qa/gate/check_cue_ids.mjs). `game/fx/audioDirector.ts` is the feature seam.
 */
import { audioManager } from './audioManager';
import { presentationDirector } from './presentationDirector';
import type { Sfx } from '@crashgalaxy/hud';
import type { WinTier } from '../roundTier';

export { audioManager } from './audioManager';
export { presentationDirector } from './presentationDirector';
export type { PresentationState } from './presentationDirector';

/** The HUD's `Sfx` port — the burger sliders + mute talk to the manager. */
export const gameAudioSfx: Sfx = audioManager;

/** Real cue ids for the HUD's own button sounds (`HudConfig.sfxCues`). */
export const HUD_SFX_CUES = { spinPress: 'spin_start', general: 'ui_click_1' } as const;

/** Unlock + resume the context on the initial user gesture and start the base
 *  bed. Safe, idempotent, never throws — the game plays on if audio cannot start. */
export function unlockAudio(): void {
	void audioManager.unlock();
	presentationDirector.watchBase();
}

/** Start downloading every short cue while the splash is still up (no gesture needed to FETCH), so
 *  the unlock gesture only has decoding left to do. Idempotent. */
export function prefetchGameAudio(): void {
	audioManager.prefetch(['base_loop_a', ...audioManager.shortCueIds()]);
}

/** The `_turbo` variant of a cue while a turbo speed is on (docs/AUDIO_MAP.md), when the audio lane shipped one. */
const turboCue = (id: string): string => {
	const t = `${id}_turbo`;
	return audioManager.turboLevel >= 1 && audioManager.hasCue(t) ? t : id;
};

/**
 * Base-game audio seam — the ONE place the base/ante board talks to the manager.
 * Every method is a safe no-op until `unlock()`.
 */
const UI_CLICK_CUES = ['ui_click_1', 'ui_click_2', 'ui_click_3'];

// ---- the alarm lane --------------------------------------------------------------------------------
// Two alarms on ONE reel land on the same frame. Their two alarmLand() calls would arrive inside the manager's
// coalesce window and the SECOND alarm's (higher) ladder rung would be merged away, so alarms that arrive together
// get a short stagger: every alarm sounds and the group climbs as a quick roll.
//   - a quiet lane fires at once: an ordinary single alarm gains no latency;
//   - bounded: at most three alarms per reel, so the last one is <= 170 ms late;
//   - Super Turbo keeps its single merged hit;
//   - a throw in here can never reach a caller (audio is never allowed to break a presentation).
const ALARM_STAGGER_MS = 85;
let alarmLaneFreeAt = 0;
const alarmLane = (fire: () => void, gapMs = ALARM_STAGGER_MS): void => {
	const run = () => {
		try {
			fire();
		} catch {
			/* swallowed on purpose */
		}
	};
	if (audioManager.turboLevel >= 2 || typeof performance === 'undefined') return run();
	const now = performance.now();
	const at = Math.max(now, alarmLaneFreeAt);
	alarmLaneFreeAt = at + gapMs;
	if (at - now < 4) run();
	else setTimeout(run, at - now);
};

/** The trigger fanfare plays ONCE per round: at the landing of the alarm that reaches the trigger, or (a resumed
 *  round, which replays from `freeSpinTrigger` without its reveal) at the trigger ring. Re-armed by reelsStart(). */
let fanfarePlayed = false;

export const gameSound = {
	/** Spin button / spacebar. (The HUD also routes its own press through the
	 *  `sfxCues.spinPress` bridge; call this from a game-side press only.) */
	spinPress(): void {
		audioManager.playCue(turboCue('spin_start'));
	},
	/** Generic UI tick — round-robin the three alternates so repeated taps never
	 *  machine-gun the same sample (ui_click_1 / _2 / _3). */
	uiClick(): void {
		audioManager.playRoundRobin('ui', UI_CLICK_CUES, { coalesceMs: 40 });
	},
	/** The final spin of a sequence (last free/extra spin) — one-shot accent. */
	lastSpin(): void {
		audioManager.playCue('last_spin');
	},
	/** Reel-stop ladder: reel 0..4 → reel_stop_1..5 (rising); one short stop in turbo. */
	reelStop(reelIndex: number): void {
		const rung = Math.min(5, Math.max(1, Math.round(reelIndex) + 1));
		if (audioManager.turboLevel >= 2) {
			audioManager.playCue('reel_stop_turbo', { family: 'reel', coalesceMs: 260 });
			return;
		}
		if (audioManager.turboLevel >= 1) {
			audioManager.playCue('reel_stop_turbo', { family: 'reel', coalesceMs: 15 });
			return;
		}
		audioManager.playCue(`reel_stop_${rung}`, { family: 'reel', coalesceMs: 15 });
	},
	/** A FIRE ALARM lands. `count` is how many alarms (ALARM + GALARM) the spin shows so far: the landing climbs a
	 *  rising ladder alarm_land_1..5, so a 1-2-3 group audibly climbs toward the trigger (3 alarms, contract §4). */
	alarmLand(count = 1): void {
		alarmLane(() => {
			const n = Math.min(5, Math.max(1, Math.round(count)));
			audioManager.playCue(turboCue(`alarm_land_${n}`), { family: 'alarm', coalesceMs: audioManager.turboLevel >= 2 ? 160 : 30 });
		});
	},
	/** A GOLDEN ALARM lands: it is an alarm in every way (its ladder rung, in the same lane so a mixed group climbs in
	 *  order), plus the gold glint on its shine. */
	galarmLand(count = 1): void {
		this.alarmLand(count);
		setTimeout(() => {
			try {
				audioManager.playCue(turboCue('galarm_glint'), { family: 'galarmglint', coalesceMs: 120 });
			} catch {
				/* audio never breaks a presentation */
			}
		}, 180);
	},
	/** The trigger is real (3+ alarms). Queued BEHIND any alarms still rolling out of the lane, so the fanfare never
	 *  speaks over the alarm that earned it. Once per round. */
	triggerFanfare(): void {
		if (fanfarePlayed) return;
		fanfarePlayed = true;
		alarmLane(() => {
			audioManager.duck({ holdMs: 1400 });
			audioManager.playCue(turboCue('trigger_fanfare'));
		}, 60);
	},
	/** Reels are travelling: a soft ratchet loop from spin start to the last stop. Skipped in Super Turbo, where a
	 *  round is shorter than the loop's fade. */
	reelsStart(superTurbo = false): void {
		fanfarePlayed = false;
		// The HUD only sounds the press for a button click; a Space / autoplay round starts here. Both
		// paths may fire — the cues' 300 ms cooldown keeps it to one lever pull.
		audioManager.playCue(turboCue('spin_start'));
		audioManager.playCue(turboCue('spin_whoosh'));
		if (superTurbo) return;
		audioManager.startSfxLoop('reel_spin_loop', 90);
	},
	reelsStop(): void {
		audioManager.stopSfxLoop('reel_spin_loop', 140);
	},
	/** One line win is being shown: the winning symbol's own sound. Tier 0 rounds (W <= S, contract §8) stay neutral:
	 *  line highlights and amounts, no symbol fanfare. */
	symbolWin(symbol: string, tier: WinTier): void {
		if (tier <= 0) return;
		audioManager.playCue(turboCue(`sym_win_${String(symbol).toLowerCase()}`), { family: 'symwin', coalesceMs: 140 });
	},
	/** Opening jingle of a spin's line wins, sized by the spin's line total (x100 of the base bet). None at tier 0. */
	linesWin(totalWin: number, tier: WinTier): void {
		if (tier <= 0 || totalWin <= 0) return;
		audioManager.playCue(turboCue(totalWin >= 300 ? 'line_win_mid' : 'line_win_small'));
	},
	/** `alarmsShowing` is how many alarms the board shows as this reel is held: 2 = one short of the trigger (the
	 *  riser); 3 or more = the trigger is in and a bigger award (4 / 5 alarms) is still possible (the higher riser).
	 *  HONEST scaling, from what the player can already see. */
	anticipationRiser(alarmsShowing = 2): void {
		const id = alarmsShowing >= 3 ? 'antic_riser_2' : 'antic_riser';
		audioManager.playHeld(turboCue(id), { rate: 1, level: alarmsShowing >= 3 ? 1.08 : 1 });
	},
	/** The anticipated reel has stopped: a hit lands, a miss lets the air out. */
	anticipationResolve(hit: boolean): void {
		// the riser ENDS with the outcome: nothing keeps rising after a miss, or over the fanfare after a hit
		audioManager.stopHeld('antic_riser', hit ? 140 : 90);
		audioManager.stopHeld('antic_riser_2', hit ? 140 : 90);
		audioManager.stopHeld('antic_riser_turbo', hit ? 140 : 90);
		audioManager.stopHeld('antic_riser_2_turbo', hit ? 140 : 90);
		// A hit that reached the trigger hands straight over to the trigger fanfare; a hit after the trigger was already
		// in (a 4th / 5th alarm) gets the short hit accent. A MISS gets the short neutral release.
		if (hit) {
			if (fanfarePlayed) audioManager.playCue(turboCue('antic_hit'));
			return;
		}
		audioManager.playCue(turboCue('antic_miss'));
	},
	/** A spin that returns nothing settles with a soft thump instead of dead air. */
	deadSpin(): void {
		audioManager.playCue('dead_spin_settle');
	},
	/** A WILD (Chief Hamm) lands on the reels. */
	wildLand(): void {
		audioManager.playCue(turboCue('wild_land'), { family: 'wild', coalesceMs: 80 });
	},
	/** Base/ante round-total stinger, sized by the round's contract §8 tier. Tier 0 (W <= S) plays NOTHING; tiers 2+
	 *  are normally celebrated by the win rungs, whose own cues then carry the moment. No bed change. */
	win(tier: WinTier): void {
		if (tier <= 0) return;
		const cue = tier >= 6 ? 'win_max' : tier >= 4 ? 'total_win_big' : tier >= 2 ? 'total_win_mid' : 'total_win_small';
		audioManager.playCue(turboCue(cue));
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
 * only events that reach this manager exclusively, so it introduces no double
 * playback.
 */
export function subscribeGameAudio(emitter: BridgeEmitter): void {
	if (bridged) return;
	bridged = true;
	emitter.subscribeOnMount({
		// HUD button sounds: the HUD broadcasts `soundOnce` with our sfxCues
		// (spin_start / ui_click_1). This manager is the ONLY handler — no double playback.
		soundOnce: (e: { name: string }) => {
			if (!audioManager.isUnlocked) return;
			audioManager.playCue(e.name);
			// the spin press is a lever pull: click + whoosh
			if (e.name === 'spin_start') audioManager.playCue(turboCue('spin_whoosh'));
		},
	} as Record<string, (e: never) => unknown>);
}
