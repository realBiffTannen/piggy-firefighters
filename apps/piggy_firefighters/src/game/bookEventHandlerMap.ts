import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { sequence } from 'utils-shared/sequence';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { gameSound } from './audio';
import { isSuperTurbo } from './stateSpeed.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import * as rescueDirector from './rescue/rescueDirector';
import { stateRescue, stateBackdraftSpins } from './rescue/stateRescue.svelte';
import { rollWinMeterTo, finishWinMeter, winRollMs } from './reels/winMeter';
import { MAX_WIN_LEVEL } from './roundTier';

// Win presentation sound is the single Web Audio manager (game/audio). Base and Ante wins play a tier-sized
// stinger; the base bed itself is owned by the presentation director and never swapped here.
const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	gameSound.win(winLevelData);
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcastAsync({ type: 'uiShow' });
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
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		gameSound.waysWin(bookEvent.totalWin);
		await sequence(bookEvent.wins, async (win) => {
			gameSound.symbolWin(win.symbol);
			eventEmitter.broadcast({ type: 'paylineShow', lineIndex: win.meta.lineIndex, positions: win.positions, symbol: win.symbol });
			eventEmitter.broadcast({ type: 'symbolWinFx', symbol: win.symbol, positions: win.positions });
			eventEmitter.broadcast({
				type: 'linePop',
				lineIndex: win.meta.lineIndex,
				positions: win.positions,
				amount: win.win,
				multiplier: win.meta.globalMult > 1 ? win.meta.globalMult : undefined,
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
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		// Inside a feature a CAPPED spin is celebrated once, at the feature end (freeSpinEnd / backdraftSpinsEnd climb to
		// MAX with the capped round total), never twice.
		if (inFeature() && bookEvent.winLevel >= MAX_WIN_LEVEL) return;

		// BIG WIN and above climb the win rungs (components/WinRungs.svelte); smaller wins keep the plain amount /
		// coin count-up overlay.
		if (bookEvent.winLevel >= 6) {
			await eventEmitter.broadcastAsync({
				type: 'winRungs',
				amount: bookEvent.amount,
				level: bookEvent.winLevel,
				scale: 'standard',
			});
			return;
		}

		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		finishWinMeter(); // the round's figure is final by STATE, whatever the clock says
		gameSound.reelsStop();
		// a spin that returned nothing and showed no alarms still gets a soft settle, not dead air
		if (!bookEvent.amount && stateGame.gameType === 'basegame' && stateGame.scatterCounter === 0) gameSound.deadSpin();
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

		// A resume inside a bonus is rewound to its start event (game/utils.ts), so the only state to restore ahead of
		// the remaining events is the running round total.
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
	},
};
