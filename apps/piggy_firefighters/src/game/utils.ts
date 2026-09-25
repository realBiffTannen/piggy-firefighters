import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils, checkIsMultipleRevealEvents } from 'utils-book';
import { createGetEmptyPaddedBoard } from 'utils-slots';

import { SYMBOL_SIZE, REEL_PADDING, SYMBOL_INFO_MAP, BLAZE_SYMBOL_INFO, BOARD_DIMENSIONS } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEvent, BookEventOfType } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import type { RawSymbol, SymbolState } from './types';

// general utils
export const { getEmptyBoard } = createGetEmptyPaddedBoard({ reelsDimensions: BOARD_DIMENSIONS });
export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });
export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

// round lifecycle
/** Book events that open a feature scene. A round carrying any of them is a MULTI-STEP round.
 *
 *  The SDK decides when `/wallet/end-round` is sent from `checkIsBonusGame`: a "bonus" round stays OPEN on the RGS
 *  until its whole presentation has played and is settled afterwards; anything else is settled right after
 *  `/wallet/play`. The SDK's own test is "more than one `reveal`", which covers a natural Rescue trigger and every
 *  bonus with spins. The explicit entry events keep a bought / Alarm Call round open even in the edge case of a
 *  bonus whose book carried a single reveal (docs/GAME_CONTRACT.md §7-§8), so a mid-feature reload always resumes. */
const FEATURE_ENTRY_EVENT_TYPES = new Set<string>(['freeSpinTrigger', 'rescueStart', 'alarmCall', 'backdraftSpinsStart']);

export const isFeatureRound = (bookEvents: Pick<BookEvent, 'type' | 'index'>[]) =>
	checkIsMultipleRevealEvents({ bookEvents }) ||
	bookEvents.some((bookEvent) => FEATURE_ENTRY_EVENT_TYPES.has(bookEvent.type));

// resume bet
/** Kept for the snapshot (bookEventHandlerMap createBonusSnapshot): the running total, and the last reveal board (+ its
 *  Backdraft) so a rewound natural trigger rings its alarms on the book's board, not on the boot board. */
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = ['setTotalWin', 'reveal', 'backdraft'];

/** Where an active round is resumed from: the `event` cursor `/authenticate` returned, if it is a
 *  usable index into the book, else the first event. The cursor is whatever the RGS stored from
 *  `/bet/event` (`null` when nothing was recorded), and the wire type is a string. A missing or
 *  malformed cursor must never erase an active round's book. */
export const resolveResumeIndex = (event: unknown, eventCount: number) => {
	const cursor = Number(event);
	return Number.isInteger(cursor) && cursor >= 0 && cursor < eventCount ? cursor : 0;
};

/** Events that OPEN a bonus scene; a resume inside the bonus rewinds to the last of them. */
const BONUS_START_TYPES = new Set<string>(['rescueStart', 'backdraftSpinsStart', 'alarmCall']);
/** Events that CLOSE it: past one of these the bonus has been shown to its end. */
const BONUS_END_TYPES = new Set<string>(['rescueEnd', 'freeSpinEnd', 'backdraftSpinsEnd']);

export const convertTorResumableBet = (betToResume: Bet) => {
	let resumingIndex = resolveResumeIndex(betToResume.event, betToResume.state.length);
	// A round interrupted inside a bonus replays that bonus from its start event (`alarmCall` for an Alarm Call round,
	// `rescueStart` for Rescue / Inferno, `backdraftSpinsStart` for Backdraft Spins): the rooms, the multiplier and the
	// spins counter are built up event by event, so there is no honest mid-bonus state to jump into. A NATURAL trigger
	// rewinds one step further, to its `freeSpinTrigger`, so the trigger celebration and the covered transition play
	// again. The book is fixed, so the replayed bonus pays exactly what it was always going to pay.
	const lastStart = _.findLastIndex(
		betToResume.state,
		(bookEvent, eventIndex) => eventIndex < resumingIndex && BONUS_START_TYPES.has(bookEvent.type),
	);
	if (lastStart >= 0) {
		const bonusEnded = betToResume.state.some(
			(bookEvent, eventIndex) => eventIndex > lastStart && eventIndex < resumingIndex && BONUS_END_TYPES.has(bookEvent.type),
		);
		if (!bonusEnded) {
			const previous = betToResume.state[lastStart - 1];
			resumingIndex = previous?.type === 'freeSpinTrigger' ? lastStart - 1 : lastStart;
			// an Alarm Call round is replayed from its card, so the award is shown before the bonus it opens
			const call = _.findLastIndex(betToResume.state, (bookEvent, eventIndex) => eventIndex < resumingIndex && bookEvent.type === 'alarmCall');
			if (call >= 0) resumingIndex = call;
		}
	}
	const bookEventsBeforeResume = betToResume.state.filter((_, eventIndex) => eventIndex < resumingIndex);
	const bookEventsAfterResume = betToResume.state.filter((_, eventIndex) => eventIndex >= resumingIndex);

	const bookEventToCreateSnapshot: BookEventOfType<'createBonusSnapshot'> = {
		index: 0,
		type: 'createBonusSnapshot',
		bookEvents: bookEventsBeforeResume.filter((bookEvent) =>
			BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT.includes(bookEvent.type),
		),
	};

	const stateToResume = [bookEventToCreateSnapshot, ...bookEventsAfterResume];

	return { ...betToResume, state: stateToResume };
};

// other utils
export const getSymbolX = (reelIndex: number) => SYMBOL_SIZE * (reelIndex + REEL_PADDING);
export const getSymbolY = (symbolIndexOfBoard: number) => (symbolIndexOfBoard + 0.5) * SYMBOL_SIZE;

export const getSymbolInfo = ({
	rawSymbol,
	state,
}: {
	rawSymbol: RawSymbol;
	state: SymbolState;
}) => {
	if (rawSymbol.blaze) return BLAZE_SYMBOL_INFO[state];
	return SYMBOL_INFO_MAP[rawSymbol.name][state];
};
