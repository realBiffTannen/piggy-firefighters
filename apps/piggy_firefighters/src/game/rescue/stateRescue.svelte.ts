/**
 * RESCUE / INFERNO RESCUE and the other feature presentations — the ONE state the feature scene reads.
 *
 * Single writer: game/rescue/rescueDirector.ts (driven by the book, docs/GAME_CONTRACT.md §5-§8). The components
 * (components/rescue/*) only READ it, so a later art lane can replace every picture without touching the flow.
 */
import type { AlarmCallOutcome, BonusKind, BonusSource } from '../typesBookEvent';

export type RoomState = {
	reel: number;
	/** current fire level (2 / 1 roaring..smouldering, 0 = rescued) */
	fire: number;
	/** the level every room of this building started at (2 Rescue, 1 Inferno) */
	start: number;
	rescued: boolean;
	/** Inferno: the instant prize the rescued pig carried (booked units), shown on the sill */
	prize?: number;
	/** bumps whenever this room is sprayed, so the scene can play a one-shot spray on change */
	sprayed: number;
};

export const stateRescue = $state({
	/** the Rescue scene is up (rooms above the reels, multiplier badge, meters) */
	active: false,
	bonus: 'rescue' as BonusKind,
	source: 'natural' as BonusSource,
	rooms: [] as RoomState[],
	multiplier: 1,
	/** 1-based building number */
	building: 1,
	rescued: 0,
	spinsLeft: 0,
	/** running ROUND total (booked units) as the book's setTotalWin states it */
	total: 0,
	/** a transient banner over the scene: '+1 SPIN', 'NEXT BUILDING · +5 SPINS', 'RESCUE COMPLETE' */
	banner: '' as string,
	bannerSeq: 0,
	/** the book hit the 15,000x cap */
	capped: false,
	/** stop / skip pressed during the feature: every hold collapses (never the event order) */
	skip: false,
});

/** BACKDRAFT SPINS (contract §7): the base scene with a header plate and the 5-spin counter. */
export const stateBackdraftSpins = $state({
	active: false,
	spins: 0,
	spinsLeft: 0,
	total: 0,
});

/** ALARM CALL card (contract §7). `phase` walks idle -> ringing -> revealed. */
export const stateAlarmCall = $state({
	active: false,
	phase: 'idle' as 'idle' | 'ringing' | 'revealed',
	outcome: null as AlarmCallOutcome | null,
});

/** Any feature presentation currently owns the play area and the input (HUD `ownsInput`). */
export const featureOwnsInput = () => stateRescue.active || stateAlarmCall.active || stateBackdraftSpins.active;

export const resetRescueState = () => {
	stateRescue.active = false;
	stateRescue.rooms = [];
	stateRescue.multiplier = 1;
	stateRescue.building = 1;
	stateRescue.rescued = 0;
	stateRescue.spinsLeft = 0;
	stateRescue.total = 0;
	stateRescue.banner = '';
	stateRescue.capped = false;
	stateRescue.skip = false;
	stateBackdraftSpins.active = false;
	stateBackdraftSpins.spins = 0;
	stateBackdraftSpins.spinsLeft = 0;
	stateBackdraftSpins.total = 0;
	stateAlarmCall.active = false;
	stateAlarmCall.phase = 'idle';
	stateAlarmCall.outcome = null;
};
