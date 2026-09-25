/**
 * PIGGY FIREFIGHTERS — feature-scene AUDIO seam.
 *
 * The rescue director, the bay-door shutter and the feature cards call ONLY this object for sound. Every id below is a
 * delivered cue of the audio lane (docs/AUDIO_MAP.md, game/audio/cueManifest.ts; qa/gate/check_cue_ids.mjs checks
 * that every literal id exists). `play` still resolves the first id that exists, so a seam never throws. If audio
 * never unlocked, every call is a no-op. Celebration cues obey the contract §8 tier: `total(0)` plays nothing.
 */
import { audioManager, presentationDirector } from '../audio';
import { CUES } from '../audio/cueManifest';
import type { BonusKind } from '../typesBookEvent';

const firstCue = (...ids: string[]): string | null => ids.find((id) => id in CUES) ?? null;
/** The `_turbo` variant while a turbo speed is on, when the audio lane shipped one (docs/AUDIO_MAP.md). */
const turbo = (id: string): string => {
	try {
		return audioManager.turboLevel >= 1 && `${id}_turbo` in CUES ? `${id}_turbo` : id;
	} catch {
		return id;
	}
};
const play = (opts: { family?: string; coalesceMs?: number } | undefined, ...ids: string[]) => {
	try {
		const id = firstCue(...ids);
		if (id) audioManager.playCue(id, opts ?? {});
	} catch {
		/* audio never breaks a presentation */
	}
};

export type AudioDirector = {
	/** The bay door's bar hits the sill (first impact only). */
	shutterSlam: () => void;
	/** One of the three hauls as the door rattles back up (1..3). */
	shutterHaul: (n: number) => void;
	/** Covered transition into Rescue Spins / Inferno Rescue (bed + entry flourish). */
	bonusIntro: (bonus: BonusKind) => void;
	/** Back to Station 13. */
	bonusOutro: () => void;
	/** Backdraft: whoosh + flame roar + a bright chord (theme §6). */
	backdraft: () => void;
	/** A cell bursts into a Blaze Wild (n = 0-based order). */
	blazeIgnite: (n: number) => void;
	/** The water jet leaves the nozzle (components/rescue/RescueScene.svelte spray FX): the hose opens and runs. */
	sprayStart: () => void;
	/** The jet ends: the hose shuts off. */
	sprayEnd: () => void;
	/** Steam where a fire goes out or on a rescued room. */
	steam: () => void;
	/** A room is rescued: the two-note brass "ta-da", stepping up with the multiplier. */
	rescue: (multiplier: number) => void;
	/** Inferno: the rescued pig's instant prize (coin shower). */
	prize: () => void;
	/** +N spins awarded. */
	extraSpin: () => void;
	/** All five rooms rescued: the siren and the next building. */
	buildingCleared: () => void;
	/** The spins counter reaches its last spin. */
	lastSpin: () => void;
	/** Alarm Call: the dispatch bell rings. */
	alarmRing: () => void;
	/** Alarm Call: the card turns to its outcome. */
	alarmReveal: (outcome: string) => void;
	/** Final feature total, sized by the round's contract §8 tier (0 = W <= S: NO stinger; `win_max` is the cap's). */
	total: (tier: number, bonus?: BonusKind | 'backdraftSpins') => void;
	/** Backdraft Spins bookends (the header plate / the end plate). */
	backdraftSpinsStart: () => void;
	backdraftSpinsEnd: () => void;
	/** Feature-entry blast reveal (only with the optional `fx_transition` rig): vacuum, impact, reveal. */
	blastStart?: () => void;
	blastImpact?: () => void;
	blastReveal?: () => void;
};

export const audioDirector: AudioDirector = {
	shutterSlam: () => {
		try {
			audioManager.duck({ db: 4, holdMs: 220, releaseMs: 380 });
		} catch {
			/* no audio */
		}
		play(undefined, turbo('shutter_slam'));
	},
	shutterHaul: (n) => play({ family: 'shutter', coalesceMs: 60 }, turbo(`shutter_haul_${Math.min(3, Math.max(1, n))}`)),
	bonusIntro: (bonus) => {
		try {
			void presentationDirector.bonusIntro(bonus);
		} catch {
			/* no audio */
		}
	},
	bonusOutro: () => {
		play(undefined, turbo('siren_pass'));
		try {
			presentationDirector.returnToBase();
		} catch {
			/* no audio */
		}
	},
	backdraft: () => {
		play({ family: 'backdraft', coalesceMs: 400 }, turbo('backdraft_whoosh'));
		setTimeout(() => play({ family: 'backdraft2', coalesceMs: 400 }, turbo('backdraft_roar')), 120);
		setTimeout(() => play({ family: 'backdraft3', coalesceMs: 400 }, turbo('backdraft_chord')), 320);
	},
	blazeIgnite: (n) => play({ family: 'blaze', coalesceMs: 60 }, n <= 0 ? 'blaze_ignite' : `blaze_ignite_${Math.min(5, n + 1)}`, 'blaze_ignite'),
	sprayStart: () => {
		play({ family: 'douse', coalesceMs: 80 }, turbo('hose_start'));
		try {
			audioManager.startSfxLoop('hose_loop', 120);
		} catch {
			/* no audio */
		}
	},
	sprayEnd: () => {
		try {
			audioManager.stopSfxLoop('hose_loop', 160);
		} catch {
			/* no audio */
		}
		play({ family: 'douse_end', coalesceMs: 80 }, turbo('hose_end'));
	},
	steam: () => play({ family: 'steam', coalesceMs: 120 }, turbo('steam')),
	rescue: (multiplier) => play({ family: 'rescue', coalesceMs: 120 }, turbo(`rescue_tada_${Math.min(8, Math.max(1, Math.round(multiplier)))}`)),
	prize: () => play({ family: 'prize', coalesceMs: 60 }, turbo('prize_coins')),
	extraSpin: () => play(undefined, turbo('spins_added')),
	buildingCleared: () => {
		play(undefined, turbo('building_cleared'));
		setTimeout(() => play(undefined, turbo('siren_pass')), 500);
	},
	lastSpin: () => play(undefined, turbo('last_spin')),
	alarmRing: () => play(undefined, turbo('alarm_call_ring')),
	alarmReveal: (outcome) => {
		play(undefined, turbo('alarm_card_flip'));
		const id = outcome === 'falseAlarm' ? 'alarm_outcome_false' : outcome === 'inferno' ? 'alarm_outcome_inferno' : 'alarm_outcome_rescue';
		setTimeout(() => play(undefined, turbo(id)), 160);
	},
	blastStart: () => play({ family: 'blast', coalesceMs: 400 }, turbo('backdraft_whoosh')),
	blastImpact: () => play({ family: 'blast', coalesceMs: 120 }, turbo('shutter_slam')),
	blastReveal: () => undefined,
	backdraftSpinsStart: () => {
		play(undefined, turbo('backdraft_spins_start'));
		try {
			audioManager.addLayer('backdraft_spins_layer');
		} catch {
			/* no audio */
		}
	},
	backdraftSpinsEnd: () => {
		try {
			audioManager.removeLayer('backdraft_spins_layer');
		} catch {
			/* no audio */
		}
		play(undefined, turbo('backdraft_spins_end'));
	},
	total: (tier, bonus) => {
		const t = Math.round(tier);
		if (t <= 0) return; // contract §8: no celebration at or below the charged cost
		if (t >= 6) return play(undefined, turbo('win_max'));
		const size = t >= 4 ? 'big' : t >= 2 ? 'mid' : 'small';
		if (bonus === 'rescue' || bonus === 'inferno') return play(undefined, turbo(`${bonus}_total_${size}`), turbo(`total_win_${size}`));
		play(undefined, turbo(`total_win_${size}`));
	},
};
