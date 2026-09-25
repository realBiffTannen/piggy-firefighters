/**
 * PIGGY FIREFIGHTERS — feature-scene AUDIO seam.
 *
 * The rescue director, the bay-door shutter and the feature cards call ONLY this object for sound. Every method
 * resolves to the first cue id that exists in the manifest (a dedicated Firefighters cue first, then the closest
 * existing sound), so a seam never throws and never goes silent just because the audio lane has not authored a cue
 * yet. The audio lane owns the cue list (docs/AUDIO_DESIGN_NOTES.md, game/audio/cueManifest.ts); ids that do not
 * exist are safe no-ops. If audio never unlocked, every call is a no-op.
 */
import { audioManager, presentationDirector } from '../audio';
import { CUES } from '../audio/cueManifest';
import type { BonusKind } from '../typesBookEvent';

const firstCue = (...ids: string[]): string | null => ids.find((id) => id in CUES) ?? null;
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
	/** A W sprays its room: water rush + steam hiss. */
	douse: () => void;
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
	/** Final feature total, scaled by winLevel (`win_max` belongs to the cap only). */
	total: (winLevel: number) => void;
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
		play(undefined, 'shutter_slam', 'bay_door_slam');
	},
	shutterHaul: (n) => play({ family: 'shutter', coalesceMs: 60 }, `shutter_haul_${n}`),
	bonusIntro: (bonus) => {
		try {
			void presentationDirector.bonusIntro(bonus);
		} catch {
			/* no audio */
		}
	},
	bonusOutro: () => {
		play(undefined, 'bonus_exit');
		try {
			presentationDirector.returnToBase();
		} catch {
			/* no audio */
		}
	},
	backdraft: () => play({ family: 'backdraft', coalesceMs: 400 }, 'backdraft_whoosh', 'blast_impact', 'trigger_fanfare'),
	blazeIgnite: (n) => play({ family: 'blaze', coalesceMs: 60 }, `blaze_ignite_${Math.min(5, n + 1)}`, 'blaze_ignite', 'wild_land'),
	douse: () => play({ family: 'douse', coalesceMs: 80 }, 'hose_spray', 'douse'),
	rescue: (multiplier) => play({ family: 'rescue', coalesceMs: 120 }, `rescue_tada_${Math.min(8, Math.max(1, multiplier))}`, 'rescue_tada', 'extra_spin'),
	prize: () => play({ family: 'prize', coalesceMs: 60 }, 'rescue_prize', 'prize_small'),
	extraSpin: () => play(undefined, 'extra_spin'),
	buildingCleared: () => play(undefined, 'building_cleared', 'siren', 'total_win_mid'),
	lastSpin: () => play(undefined, 'last_spin'),
	alarmRing: () => play(undefined, 'alarm_ring', 'antic_riser'),
	alarmReveal: (outcome) => play(undefined, outcome === 'falseAlarm' ? 'false_alarm' : 'alarm_award', outcome === 'falseAlarm' ? 'tension_miss' : 'trigger_fanfare'),
	blastStart: () => play({ family: 'blast', coalesceMs: 400 }, 'blast_vacuum'),
	blastImpact: () => play({ family: 'blast', coalesceMs: 120 }, 'blast_impact', 'shutter_slam'),
	blastReveal: () => play({ family: 'blastreveal', coalesceMs: 400 }, 'blast_reveal'),
	total: (winLevel) => {
		const level = Math.round(winLevel);
		const stinger = level >= 10 ? 'win_max' : level <= 1 ? 'total_win_small' : level === 2 ? 'total_win_mid' : 'total_win_big';
		play(undefined, stinger);
	},
};
