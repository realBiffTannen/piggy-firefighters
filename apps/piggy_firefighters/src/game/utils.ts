import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils, checkIsMultipleRevealEvents } from 'utils-book';
import { createGetEmptyPaddedBoard } from 'utils-slots';

import { SYMBOL_SIZE, REEL_PADDING, SYMBOL_INFO_MAP, BOARD_DIMENSIONS } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet, BookEventOfType } from './typesBookEvent';
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
 *  The SDK decides when `/wallet/end-round` is sent from `checkIsBonusGame`: a "bonus" round stays
 *  OPEN on the RGS until its whole presentation has played and is settled afterwards; anything else
 *  is settled right after `/wallet/play`, before the reels even land. The SDK's own test is "more
 *  than one `reveal`", written for free-spin games. This game's features are not reels: a Hold &
 *  Build, an Expanded board or a Build-or-Bust card is booked as `buildStart` / `expandStart` /
 *  `buildOrBust` after AT MOST one `reveal` (bought rounds carry none), so that test said "no
 *  bonus" for every book and every feature round was closed on the RGS the instant it began. A
 *  reload mid-feature then found the round `active: false`: nothing resumed, the bonus was never
 *  shown to its end, and the bet fell back to `defaultBetLevel` (Stake review, 2026-09-22).
 *
 *  A feature round is now what it is on the RGS's terms: open until it has been watched to the end.
 *  A `buildOrBust` that busts pays 0 and is auto-completed by the RGS, so it needs no end-round
 *  either way. */
const FEATURE_ENTRY_EVENT_TYPES = new Set<string>(['buildStart', 'expandStart', 'buildOrBust']);

export const isFeatureRound = (bookEvents: Pick<BookEvent, 'type'>[]) =>
	checkIsMultipleRevealEvents({ bookEvents }) ||
	bookEvents.some((bookEvent) => FEATURE_ENTRY_EVENT_TYPES.has(bookEvent.type));

// resume bet
const BOOK_EVENT_TYPES_TO_RESERVE_FOR_SNAPSHOT = ['setTotalWin'];

/** Where an active round is resumed from: the `event` cursor `/authenticate` returned, if it is a
 *  usable index into the book, else the first event. The cursor is whatever the RGS stored from
 *  `/bet/event` (`null` when nothing was recorded, and this game records nothing for a single-reveal
 *  book), and the wire type is a string. `Number(null)` is 0, but `Number(undefined)`, `Number('')`
 *  and a malformed value are NaN or off the end of the book, and every comparison below is then
 *  false: the resumed round would carry NO events, play nothing and be ended on the RGS without ever
 *  being shown. A missing or malformed cursor must never erase an active round's book. */
export const resolveResumeIndex = (event: unknown, eventCount: number) => {
	const cursor = Number(event);
	return Number.isInteger(cursor) && cursor >= 0 && cursor < eventCount ? cursor : 0;
};

export const convertTorResumableBet = (betToResume: Bet) => {
	let resumingIndex = resolveResumeIndex(betToResume.event, betToResume.state.length);
	// A round interrupted inside a build bonus replays that bonus from its `buildStart`: the board of
	// houses is built up event by event, so there is no honest mid-bonus state to jump into. The book
	// is fixed, so the replayed bonus pays exactly what it was always going to pay.
	const lastBuildStart = _.findLastIndex(
		betToResume.state,
		(bookEvent, eventIndex) =>
			eventIndex < resumingIndex && (bookEvent.type === 'buildStart' || (bookEvent.type as string) === 'expandStart'),
	);
	if (lastBuildStart >= 0) {
		const bonusEnded = betToResume.state.some(
			(bookEvent, eventIndex) =>
				eventIndex > lastBuildStart &&
				eventIndex < resumingIndex &&
				(bookEvent.type === 'buildEnd' || (bookEvent.type as string) === 'expandEnd'),
		);
		if (!bonusEnded) resumingIndex = lastBuildStart;
	}
	const bookEventsBeforeResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex < resumingIndex,
	);
	const bookEventsAfterResume = betToResume.state.filter(
		(_, eventIndex) => eventIndex >= resumingIndex,
	);

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
	return SYMBOL_INFO_MAP[rawSymbol.name][state];
};
