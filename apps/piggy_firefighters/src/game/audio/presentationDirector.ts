/**
 * Piggy Workers — presentation-state AUDIO director.
 *
 * Drives the music beds over the round's authoritative presentation states:
 *
 *   base ─▶ anticipation ─▶ bonusIntro ─▶ holdAndBuild | goldenBuild
 *        ─▶ doorReveal ─▶ collect ─▶ returnToBase ─▶ base
 *
 * Natural triggers, direct buys and Build-or-Bust awards all reach the SAME
 * destination beds through the same methods, so there is never a duplicate bed
 * start. Every method is idempotent: entering a state whose bed is already
 * primary is a no-op, and a skip / teardown collapses back to `base` exactly
 * once. The manager preloads/decodes the next bed before each transition and
 * schedules the crossfade on the audio clock (phase-aligned, equal-power).
 *
 * This module knows nothing about the book — it is called by `audioDirector`
 * (the bonus scene seam) and by the emitter bridge (Build-or-Bust).
 */
import { audioManager } from './audioManager';
import type { BonusKind } from '../typesBookEvent';

export type PresentationState =
	| 'base'
	| 'anticipation'
	| 'bonusIntro'
	| 'holdAndBuild'
	| 'goldenBuild'
	| 'doorReveal'
	| 'collect'
	| 'returnToBase';

type BedKind = 'HOLD_BUILD' | 'GOLDEN_BUILD' | 'EXPANDED' | 'GOLDEN_EXPANDED';
const BONUS_BED: Record<BedKind, string> = {
	HOLD_BUILD: 'hold_build_loop',
	GOLDEN_BUILD: 'golden_build_loop',
	// contract v2.4: the multi-board features have their own, bigger beds
	EXPANDED: 'expanded_build_loop',
	GOLDEN_EXPANDED: 'golden_expanded_loop',
};
const ENTRY_FLOURISH: Record<BedKind, string> = {
	HOLD_BUILD: 'bonus_entry_hold',
	GOLDEN_BUILD: 'bonus_entry_golden',
	EXPANDED: 'expand_stinger',
	GOLDEN_EXPANDED: 'golden_expand_stinger',
};

const normBonus = (b: BonusKind | string): BedKind => {
	const s = String(b).toUpperCase();
	if (s.includes('EXPAND')) return s.includes('GOLDEN') ? 'GOLDEN_EXPANDED' : 'EXPANDED';
	return s.includes('GOLDEN') ? 'GOLDEN_BUILD' : 'HOLD_BUILD';
};

class PresentationDirector {
	private _state: PresentationState = 'base';
	get state(): PresentationState {
		return this._state;
	}
	private set(next: PresentationState) {
		if (this._state === next) return;
		this._state = next;
		if (typeof window !== 'undefined') audioManager.log.push({ t: Math.round(performance.now()), kind: 'state', detail: next });
	}

	// The base game has TWO tunes by the same band (base_loop / base_loop_b, 32 composed bars each). They
	// alternate: every return from a feature comes back on the other one, and a long base session swaps
	// after two passes — so ten minutes of base play is not one loop heard nine times.
	private baseBeds = ['base_loop', 'base_loop_b'];
	private baseIdx = 0;
	private baseSince = 0;
	private baseTimer: ReturnType<typeof setInterval> | undefined;
	private isBaseBed = (id: string | null) => !!id && this.baseBeds.includes(id);
	/** Arms the long-session swap (idempotent). Called on unlock and on every return to base. */
	watchBase() {
		if (this.baseTimer || typeof window === 'undefined') return;
		this.baseSince = performance.now();
		this.baseTimer = setInterval(() => {
			if (this._state !== 'base' || !this.isBaseBed(audioManager.currentBed)) return;
			if (performance.now() - this.baseSince < 2 * 66899 - 1500) return;
			this.baseIdx = (this.baseIdx + 1) % this.baseBeds.length;
			const next = this.baseBeds[this.baseIdx];
			void audioManager.ensureDecoded([next]).then(() => {
				if (this._state === 'base') audioManager.crossfadeToBed(next, 3000);
			});
			this.baseSince = performance.now();
		}, 4000);
	}

	/** Base groove. Started by unlock(); this only ensures we are on it. */
	toBase(fadeMs = 800): void {
		this.watchBase();
		if (this._state === 'base' && this.isBaseBed(audioManager.currentBed)) return;
		audioManager.removeLayer('anticipation_layer');
		if (!this.isBaseBed(audioManager.currentBed)) {
			// coming back from a feature: the other tune
			this.baseIdx = (this.baseIdx + 1) % this.baseBeds.length;
			const next = this.baseBeds[this.baseIdx];
			void audioManager.ensureDecoded([next]).then(() => audioManager.crossfadeToBed(next, fadeMs));
			this.baseSince = typeof performance !== 'undefined' ? performance.now() : 0;
		}
		audioManager.startSfxLoop('ambient_site_loop', 1500);
		this.set('base');
	}

	/** Build-or-Bust / scatter anticipation: ADD a tension stem under base, no
	 *  bed swap. Idempotent. */
	anticipationOn(): void {
		if (this._state === 'base' || this._state === 'anticipation') {
			audioManager.addLayer('anticipation_layer');
			this.set('anticipation');
		}
	}
	anticipationOff(): void {
		audioManager.removeLayer('anticipation_layer');
		if (this._state === 'anticipation') this.set('base');
	}

	/**
	 * Base → bonus. Keep the groove through the trigger, duck it under the entry
	 * flourish, then start the bonus bed on the grid with a shaped equal-power
	 * crossfade (400–900 ms). The flourish is an SFX one-shot so it overlaps the
	 * musical handoff. The next bed (`reveal_bed`) is preloaded for the doors.
	 */
	async bonusIntro(bonus: BonusKind | string): Promise<void> {
		const kind = normBonus(bonus);
		const bed = BONUS_BED[kind];
		const bonusState: PresentationState = kind.startsWith('GOLDEN') ? 'goldenBuild' : 'holdAndBuild';
		audioManager.stopSfxLoop('ambient_site_loop', 900); // the bonus scenes have their own, busier world
		// already on the bonus bed (direct buy re-entrancy / resume): don't restart
		if (audioManager.currentBed === bed) {
			this.set(bonusState);
			return;
		}
		this.set('bonusIntro');
		await audioManager.ensureDecoded([bed, ENTRY_FLOURISH[kind], 'reveal_bed']);
		audioManager.removeLayer('anticipation_layer');
		// duck the outgoing base under the flourish (entry cue → duck 3–6 dB)
		audioManager.duck({ holdMs: 350 });
		audioManager.playCue(ENTRY_FLOURISH[kind]);
		// start the bonus bed on the downbeat with a 600 ms equal-power crossfade
		audioManager.crossfadeToBed(bed, 600);
		this.set(bonusState);
	}

	/** Base-game "square trace" reel-tension layer, sized by the resulting tier
	 *  (1..5). `turbo` picks the shortened `_turbo` variant so super/turbo speeds
	 *  read faster. Fired by the board as the ways square traces closed; the
	 *  director owns it so it ducks/mixes with the active bed. Safe before unlock. */
	squareTrace(tier: number, turbo = false): void {
		const t = Math.min(5, Math.max(1, Math.round(tier)));
		audioManager.playCue(`square_trace_t${t}${turbo ? '_turbo' : ''}`, {
			family: 'squaretrace',
			coalesceMs: 20,
		});
	}

	/** Bonus → door reveals: thin the busy rhythm to the reveal bed. Idempotent
	 *  (door latches call this once per door). */
	doorReveal(): void {
		if (this._state === 'doorReveal' || audioManager.currentBed === 'reveal_bed') {
			this.set('doorReveal');
			return;
		}
		audioManager.crossfadeToBed('reveal_bed', 500);
		this.set('doorReveal');
	}

	/** Collection count-up: stay on the reveal bed; the resolve chord + duck are
	 *  cued by audioDirector.total(). */
	collect(): void {
		if (this._state === 'collect') return;
		this.set('collect');
	}

	/**
	 * Collection → base. Let the final chord connect to a compatible base entry
	 * and fade back over 600–1200 ms at a phrase point (no conspicuous intro
	 * restart). The `bonus_exit` one-shot is cued by audioDirector.bonusOutro().
	 */
	returnToBase(): void {
		if (this._state === 'returnToBase' || (this._state === 'base' && audioManager.currentBed === 'base_loop')) return;
		this.set('returnToBase');
		audioManager.crossfadeToBed('base_loop', 900);
		this.set('base');
	}

	/** Skip / route teardown / new round: collapse to base exactly once. */
	teardown(): void {
		audioManager.teardownToBase();
		this.set('base');
	}
}

export const presentationDirector = new PresentationDirector();
