/**
 * PIGGY FIREFIGHTERS — presentation-state AUDIO director.
 *
 * Drives the music beds over the round's authoritative presentation states:
 *
 *   base ─▶ anticipation ─▶ bonusIntro ─▶ rescueSpins | infernoRescue ─▶ returnToBase ─▶ base
 *
 * Natural triggers, direct buys and Alarm Call awards all reach the SAME destination beds through the same methods,
 * so there is never a duplicate bed start. Every method is idempotent: entering a state whose bed is already primary
 * is a no-op, and a skip / teardown collapses back to `base` exactly once. The manager preloads/decodes the next bed
 * before each transition and schedules the crossfade on the audio clock (phase-aligned, equal-power).
 *
 * Cue ids are the audio lane's (docs/AUDIO_MAP.md): beds base_loop_a / base_loop_b, rescue_loop, inferno_loop; entry
 * flourishes rescue_enter / inferno_enter; the tension stem anticipation_layer; the Station 13 ambience
 * ambient_station_loop. This module knows nothing about the book — it is called by `audioDirector` (the feature seam)
 * and by `gameSound` (anticipation).
 */
import { audioManager } from './audioManager';
import type { BonusKind } from '../typesBookEvent';

export type PresentationState = 'base' | 'anticipation' | 'bonusIntro' | 'rescueSpins' | 'infernoRescue' | 'returnToBase';

const BONUS_BED: Record<BonusKind, string> = { rescue: 'rescue_loop', inferno: 'inferno_loop' };
const ENTRY_FLOURISH: Record<BonusKind, string> = { rescue: 'rescue_enter', inferno: 'inferno_enter' };
const AMBIENCE = 'ambient_station_loop';

const normBonus = (b: BonusKind | string): BonusKind => (String(b).toLowerCase() === 'inferno' ? 'inferno' : 'rescue');

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

	// The base game has TWO tunes by the same band (base_loop_a / base_loop_b). They alternate: every return from a
	// feature comes back on the other one, and a long base session swaps after two passes — so ten minutes of base
	// play is not one loop heard nine times.
	private baseBeds = ['base_loop_a', 'base_loop_b'];
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
		audioManager.startSfxLoop(AMBIENCE, 1500);
		this.set('base');
	}

	/** Alarm anticipation: ADD a tension stem under base, no bed swap. Idempotent. */
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
	 * Base → Rescue Spins / Inferno Rescue. Keep the groove through the trigger, duck it under the entry flourish, then
	 * start the bonus bed on the grid with a shaped equal-power crossfade. The flourish is an SFX one-shot so it
	 * overlaps the musical handoff.
	 */
	async bonusIntro(bonus: BonusKind | string): Promise<void> {
		const kind = normBonus(bonus);
		const bed = BONUS_BED[kind];
		const bonusState: PresentationState = kind === 'inferno' ? 'infernoRescue' : 'rescueSpins';
		audioManager.stopSfxLoop(AMBIENCE, 900); // the burning block has its own, busier world
		// already on the bonus bed (resume re-entrancy): don't restart
		if (audioManager.currentBed === bed) {
			this.set(bonusState);
			return;
		}
		this.set('bonusIntro');
		await audioManager.ensureDecoded([bed, ENTRY_FLOURISH[kind]]);
		audioManager.removeLayer('anticipation_layer');
		// duck the outgoing base under the flourish (entry cue → duck 3–6 dB)
		audioManager.duck({ holdMs: 350 });
		audioManager.playCue(ENTRY_FLOURISH[kind]);
		// start the bonus bed on the downbeat with a 600 ms equal-power crossfade
		audioManager.crossfadeToBed(bed, 600);
		this.set(bonusState);
	}

	/**
	 * Feature → base. Fade back over ~900 ms at a phrase point onto the OTHER base tune (toBase alternates).
	 */
	returnToBase(): void {
		if (this._state === 'returnToBase' || (this._state === 'base' && this.isBaseBed(audioManager.currentBed))) return;
		this.set('returnToBase');
		this.toBase(900);
	}

	/** Skip / route teardown / new round: collapse to base exactly once. */
	teardown(): void {
		audioManager.teardownToBase();
		this.set('base');
	}
}

export const presentationDirector = new PresentationDirector();
