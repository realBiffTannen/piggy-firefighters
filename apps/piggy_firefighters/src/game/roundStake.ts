/**
 * The round the book describes, for presentation: its booked total W, its charged cost S (x the base bet), whether it
 * was capped, and its celebration tier (game/roundTier.ts, contract §8).
 *
 * S comes from `config.betModes[mode].cost`. The mode is read from the BOOK first (a bought round opens with its own
 * entry event: `alarmCall` -> alarm_call, `backdraftSpinsStart` -> backdraft_spins, `rescueStart {source: buy}` ->
 * rescue / inferno) and from the SDK's `activeBetModeKey` for base vs ALARM BOOST (the HUD keeps the round's key until
 * the round is idle, and a resumed round keeps its own); a reveal on reel set `BRA` also says ante.
 */
import { stateBet } from 'state-shared';

import config from './config';
import { roundTier, type WinTier } from './roundTier';
import type { BookEvent } from './typesBookEvent';

type ModeKey = keyof typeof config.betModes;
const MODES = config.betModes as Record<string, { cost: number }>;

const costOf = (mode: string): number => Number(MODES[mode]?.cost ?? MODES.base.cost);

/** The bet mode a book was played in. */
export const roundModeOf = (bookEvents: readonly BookEvent[]): ModeKey => {
	for (const event of bookEvents) {
		if (event.type === 'createBonusSnapshot') continue;
		if (event.type === 'alarmCall') return 'alarm_call';
		if (event.type === 'backdraftSpinsStart') return 'backdraft_spins';
		if (event.type === 'rescueStart') {
			if (event.source === 'alarmCall') return 'alarm_call';
			if (event.source === 'buy') return event.bonus === 'inferno' ? 'inferno' : 'rescue';
		}
		if (event.type === 'reveal' && event.reelSet === 'BRA') return 'ante';
		if (event.type === 'reveal' || event.type === 'freeSpinTrigger' || event.type === 'rescueStart') break;
	}
	const key = String(stateBet.activeBetModeKey ?? '').toLowerCase();
	return key in MODES ? (key as ModeKey) : 'base';
};

/** The round total the plate shows: the book's last finalWin, else its last setTotalWin. */
export const roundTotalOf = (bookEvents: readonly BookEvent[]): number => {
	for (let i = bookEvents.length - 1; i >= 0; i -= 1) {
		const event = bookEvents[i];
		if (event.type === 'finalWin') return event.amount;
	}
	for (let i = bookEvents.length - 1; i >= 0; i -= 1) {
		const event = bookEvents[i];
		if (event.type === 'setTotalWin') return event.amount;
	}
	return 0;
};

export type RoundStake = { mode: ModeKey; cost: number; total: number; capped: boolean; tier: WinTier };

export const roundStakeOf = (bookEvents: readonly BookEvent[], cappedHint = false): RoundStake => {
	const mode = roundModeOf(bookEvents);
	const cost = costOf(mode);
	const total = roundTotalOf(bookEvents);
	const capped = cappedHint || bookEvents.some((event) => event.type === 'wincap');
	return { mode, cost, total, capped, tier: roundTier(total, cost, capped) };
};

/** Feature entry events: a book carrying one after `index` continues into a bonus. */
const FEATURE_ENTRY = new Set<string>(['freeSpinTrigger', 'rescueStart', 'alarmCall', 'backdraftSpinsStart']);
export const continuesIntoFeature = (bookEvents: readonly BookEvent[], index: number) =>
	bookEvents.some((event) => event.index > index && FEATURE_ENTRY.has(event.type));
