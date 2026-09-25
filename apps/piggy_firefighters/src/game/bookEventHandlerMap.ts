import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { sequence } from 'utils-shared/sequence';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { gameSound } from './audio';
import { isSuperTurbo } from './stateSpeed.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import * as rescueDirector from './rescue/rescueDirector';
import { stateRescue, stateBackdraftSpins } from './rescue/stateRescue.svelte';
import { rollWinMeterTo, finishWinMeter, winRollMs } from './reels/winMeter';
import { rungLevelOfTier, type WinTier } from './roundTier';
import { roundStakeOf, continuesIntoFeature } from './roundStake';

/** The Win overlay's pacing only (coin count-up length above 20x): never a celebration tier. The tier is contract §8's
 *  roundTier (game/roundTier.ts); the SDK `winLevel` is never read for presentation. */
const paceOf = (amount: number) => winLevelMap[amount >= 5000 ? 8 : amount >= 3000 ? 7 : amount >= 1500 ? 6 : amount >= 500 ? 5 : 3];

/** The ordinary win presentation: the win figure (components/Win.svelte), plus the tier-sized stinger when `stinger`
 *  is given (tier 0 plays nothing: no celebration at or below the stake). */
const showOrdinaryWin = async (amount: number, stinger?: WinTier) => {
	eventEmitter.broadcast({ type: 'winShow' });
	if (stinger !== undefined) gameSound.win(stinger);
	await eventEmitter.broadcastAsync({ type: 'winUpdate', amount, winLevelData: paceOf(amount) });
	eventEmitter.broadcast({ type: 'winHide' });
};

/** Alarms (ALARM + GALARM) on the visible rows of the book's last reveal. */
const alarmsOnLastReveal = (bookEvents: readonly BookEvent[]) => {
	for (let i = bookEvents.length - 1; i >= 0; i -= 1) {
		const event = bookEvents[i];
		if (event.type !== 'reveal') continue;
		return event.board.reduce((n, reel) => n + reel.slice(1, 4).filter((s) => s.name === 'ALARM' || s.name === 'GALARM').length, 0);
	}
	return 0;
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({
		type: 'boardWithAnimateSymbols',
		symbolPositions: positions,
	});
};

/** A feature scene (Rescue / Backdraft Spins) owns the round total meter. */
const inFeature = () => stateRescue.active || stateBackdraftSpins.active;

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		// the reveal names its own game type; spinReels.paddingFor streams that set's strips while the reels travel
		stateGame.gameType = bookEvent.gameType;
		// the previous spin's line paths / pops leave with the old board
		eventEmitter.broadcast({ type: 'paylinesClear' });
		gameSound.reelsStart(isSuperTurbo());
		await stateGameDerived.enhancedBoard.spin({ revealEvent: bookEvent });
		gameSound.reelsStop();
		stateGame.scatterCounter = 0;
	},
	/**
	 * LINE WINS (contract §3). Each win in book order: its line path lights through the cell centres
	 * (components/Paylines.svelte, from `config.paylines[lineIndex - 1]`), its amount pops over the line
	 * (components/LinePop.svelte), its symbols play their win (every one of them completes: the round waits on it),
	 * then every paying line is shown together once. Speed tiers only shorten; the order never changes.
	 */
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>, { bookEvents }: BookEventContext) => {
		// contract §8: a tier-0 round (W <= S) keeps its line highlights and amounts but gets no win jingles
		const { tier } = roundStakeOf(bookEvents, stateRescue.capped);
		gameSound.linesWin(bookEvent.totalWin, tier);
		await sequence(bookEvent.wins, async (win) => {
			gameSound.symbolWin(win.symbol, tier);
			eventEmitter.broadcast({ type: 'paylineShow', lineIndex: win.meta.lineIndex, positions: win.positions, symbol: win.symbol });
			eventEmitter.broadcast({ type: 'symbolWinFx', symbol: win.symbol, positions: win.positions });
			eventEmitter.broadcast({
				type: 'linePop',
				lineIndex: win.meta.lineIndex,
				positions: win.positions,
				amount: win.win,
				// the whole multiplier this line was paid at: Rescue global x Blaze Wild sum (contract v1.1 §7)
				multiplier: win.meta.multiplier > 1 ? win.meta.multiplier : undefined,
			});
			await animateSymbols({ positions: win.positions });
			eventEmitter.broadcast({ type: 'paylineHide', lineIndex: win.meta.lineIndex });
		});
		if (bookEvent.wins.length > 1) {
			// every paying line together, one beat
			await eventEmitter.broadcastAsync({ type: 'paylinesAll', lines: bookEvent.wins.map((win) => win.meta.lineIndex) });
		}
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		// The HUD WIN meter ROLLS to the round total instead of snapping (game/reels/winMeter.ts). Inside a feature the
		// scene owns the meter (claimWin), so the value is set and the scene's own total follows it.
		if (stateGame.gameType !== 'basegame' || inFeature()) {
			finishWinMeter();
			stateBet.winBookEventAmount = bookEvent.amount;
			rescueDirector.setFeatureTotal(bookEvent.amount);
			return;
		}
		await rollWinMeterTo(bookEvent.amount, Math.min(winRollMs(bookEvent.amount), 380));
	},
	/**
	 * CONTRACT §8 (v1.2.2). The SDK `winLevel` is never read. Per-spin wins inside a bonus, and the base win of a spin
	 * whose round continues into a bonus, get the ORDINARY win presentation (the figure; no rungs, no stinger): the
	 * rungs play once, on the round total (freeSpinEnd / backdraftSpinsEnd). A base / ante round without a bonus is
	 * celebrated here at its round tier: 0 (W <= S) = the figure only, 1 = the figure + a small stinger, 2+ = the win
	 * rungs (BIG 15x, HUGE 30x, MEGA 50x, EPIC 100x, MAX = the cap).
	 */
	setWin: async (bookEvent: BookEventOfType<'setWin'>, { bookEvents }: BookEventContext) => {
		if (inFeature() || continuesIntoFeature(bookEvents, bookEvent.index)) {
			await showOrdinaryWin(bookEvent.amount);
			return;
		}
		const round = roundStakeOf(bookEvents, stateRescue.capped);
		const level = rungLevelOfTier(round.tier);
		// the rig beat (docs/ANIMATION_CONTRACT.md animBeat winTier), same 0..6 numbering
		eventEmitter.broadcast({ type: 'animBeat', beat: 'winTier', tier: round.tier, amount: round.total, x: round.total / 100 });
		if (level) {
			if (round.tier >= 6) void eventEmitter.broadcastAsync({ type: 'uiHide' });
			await eventEmitter.broadcastAsync({ type: 'winRungs', amount: Math.max(bookEvent.amount, round.total), level, tier: round.tier });
			if (round.tier >= 6) void eventEmitter.broadcastAsync({ type: 'uiShow' });
			return;
		}
		await showOrdinaryWin(bookEvent.amount, round.tier);
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>, { bookEvents }: BookEventContext) => {
		finishWinMeter(); // the round's figure is final by STATE, whatever the clock says
		gameSound.reelsStop();
		// a spin that returned nothing and showed no alarms still gets a soft settle, not dead air (the alarms are
		// counted on the book's board: the live counter is zeroed as soon as the reels stop)
		if (!bookEvent.amount && stateGame.gameType === 'basegame' && alarmsOnLastReveal(bookEvents) === 0) gameSound.deadSpin();
		// DEV ONLY (stripped from production builds): the smoke driver (qa/smoke/port/smoke.mjs) waits on this
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const w = window as unknown as { __pffFinalWins?: number[] };
			(w.__pffFinalWins ??= []).push(bookEvent.amount);
		}
	},
	wincap: async (_bookEvent: BookEventOfType<'wincap'>) => {
		rescueDirector.wincap();
	},

	// ---- Backdraft (contract §4): after `reveal`, before `winInfo` --------------------------------------------------
	backdraft: async (bookEvent: BookEventOfType<'backdraft'>) => {
		await rescueDirector.backdraft(bookEvent);
	},

	// ---- Rescue Spins / Inferno Rescue (contract §5-§6, §8) ----------------------------------------------------------
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		await rescueDirector.freeSpinTrigger(bookEvent);
	},
	rescueStart: async (bookEvent: BookEventOfType<'rescueStart'>) => {
		await rescueDirector.rescueStart(bookEvent);
	},
	douse: async (bookEvent: BookEventOfType<'douse'>) => {
		await rescueDirector.douse(bookEvent);
	},
	buildingCleared: async (bookEvent: BookEventOfType<'buildingCleared'>) => {
		await rescueDirector.buildingCleared(bookEvent);
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		rescueDirector.updateFreeSpin(bookEvent);
	},
	rescueEnd: async (bookEvent: BookEventOfType<'rescueEnd'>) => {
		await rescueDirector.rescueEnd(bookEvent);
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>, { bookEvents }: BookEventContext) => {
		await rescueDirector.freeSpinEnd(bookEvent, bookEvents);
	},

	// ---- Alarm Call / Backdraft Spins (contract §7) -------------------------------------------------------------------
	alarmCall: async (bookEvent: BookEventOfType<'alarmCall'>) => {
		await rescueDirector.alarmCall(bookEvent);
	},
	backdraftSpinsStart: async (bookEvent: BookEventOfType<'backdraftSpinsStart'>) => {
		await rescueDirector.backdraftSpinsStart(bookEvent);
	},
	backdraftSpinsEnd: async (bookEvent: BookEventOfType<'backdraftSpinsEnd'>, { bookEvents }: BookEventContext) => {
		await rescueDirector.backdraftSpinsEnd(bookEvent, bookEvents);
	},

	// customised
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as BookEventOfType<T> | undefined;
		}

		// A resume inside a bonus is rewound to its start event (game/utils.ts). Restored ahead of the remaining events:
		//  - the board of the last reveal before the rewind point (a natural trigger's alarms ring on THIS board, not on
		//    whatever the boot board showed), with the Blaze Wilds of a Backdraft that followed it;
		//  - the running round total.
		const lastReveal = findLastBookEvent('reveal' as const);
		if (lastReveal) {
			try {
				stateGameDerived.enhancedBoard.settle(lastReveal.board);
				stateGame.gameType = lastReveal.gameType;
				const backdraft = _.findLast(bookEvents, (e) => e.type === 'backdraft' && e.index > lastReveal.index) as BookEventOfType<'backdraft'> | undefined;
				backdraft?.cells.forEach(rescueDirector.igniteCell);
			} catch {
				/* the board is presentation only */
			}
		}
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
	},
};
