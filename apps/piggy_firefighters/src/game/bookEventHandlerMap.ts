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
import * as buildDirector from './build/buildDirector';
import * as expandDirector from './build/expandDirector';
import { stateBuild } from './build/stateBuild.svelte';
import { rollWinMeterTo, finishWinMeter, winRollMs } from './reels/winMeter';

// Win presentation sound is now the single Web Audio manager (game/audio). Base
// and Ante wins play a tier-sized stinger; the base bed itself is owned by the
// presentation director and never swapped here (no donor bgm_main / bgm_freespin).
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

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		stateGame.gameType = bookEvent.gameType;
		// overlay hats from the previous spin's gust / delivery leave with the old board
		eventEmitter.broadcast({ type: 'featureDropsClear' });
		// Hard Hat Delivery announces itself as the reels start: this spin WILL trigger (contract §3b)
		const delivery = bookEvents.find((e) => e.type === 'hatDelivery') as
			| BookEventOfType<'hatDelivery'>
			| undefined;
		if (delivery) {
			eventEmitter.broadcast({
				type: 'featureDeliveryCall',
				golden: delivery.hats.some((hat) => hat.golden),
			});
		}
		gameSound.reelsStart(isSuperTurbo());
		await stateGameDerived.enhancedBoard.spin({ revealEvent: bookEvent });
		gameSound.reelsStop();
		stateGame.scatterCounter = 0;
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		gameSound.waysWin(bookEvent.totalWin);
		await sequence(bookEvent.wins, async (win) => {
			gameSound.symbolWin(win.symbol);
			eventEmitter.broadcast({ type: 'symbolWinFx', symbol: win.symbol, positions: win.positions });
			// each way names its own amount over its own symbols (single-way spins already show the total)
			if (bookEvent.wins.length > 1) {
				eventEmitter.broadcast({ type: 'wayWinPop', positions: win.positions, amount: win.win });
			}
			await animateSymbols({ positions: win.positions });
		});
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		// The HUD WIN meter ROLLS to the round total instead of snapping (game/reels/winMeter.ts). The HUD
		// hides its meter while the on-board number owns the win, so this is the moment it comes back:
		// a short roll (the on-board figure has already done the long count), awaited so the round's
		// figure is final before the round is. Inside a bonus the build director owns the meter, so the
		// value is set as before.
		if (stateGame.gameType !== 'basegame' || stateBuild.active) {
			finishWinMeter();
			stateBet.winBookEventAmount = bookEvent.amount;
			return;
		}
		await rollWinMeterTo(bookEvent.amount, Math.min(winRollMs(bookEvent.amount), 380));
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];

		// BIG WIN and above climb the win rungs (components/WinRungs.svelte); smaller wins keep the
		// plain amount / coin count-up overlay.
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
		// a spin that returned nothing and showed no hats still gets a soft settle, not dead air
		if (!bookEvent.amount && stateGame.gameType === 'basegame' && stateGame.scatterCounter === 0) gameSound.deadSpin();
	},
	// ---- Hold & Build / Golden Build (docs/GAME_CONTRACT.md sections 4-5) ----
	// Handlers stay thin: they route each booked event to the build director,
	// which owns presentation, generation tokens, skip/turbo/reduced-motion and
	// the HUD win-ownership seam. B2 owns the Build-or-Bust card; here it routes.
	buildOrBust: async (bookEvent: BookEventOfType<'buildOrBust'>) => {
		await buildDirector.buildOrBust(bookEvent);
	},
	buildStart: async (bookEvent: BookEventOfType<'buildStart'>) => {
		// NATURAL TRIGGER ONLY: the hats that just won the feature celebrate as a left-to-right wave (gold ring
		// + stars on every hat cell, components/BoardFx.svelte) under the fanfare, before the shutter comes down.
		// Fire-and-forget broadcasts on timers: nothing here is awaited, so it can never hold the round. The
		// starting houses ARE the hat cells for a natural trigger (contract 4); rows are 0-based here and BoardFx
		// expects the padded reel row, hence +1. Bought rounds have no reel board showing, so they skip this.
		// A GOLDEN trigger uses the golden flourish on EVERY cell: `houses` does not say which hat was the golden
		// one, so singling out a cell would be a guess; the trigger as a whole is what is golden.
		if (bookEvent.source === 'base') {
			const golden = bookEvent.bonus === 'goldenBuild';
			[...bookEvent.houses]
				.sort((a, b) => a.reel - b.reel || a.row - b.row)
				.forEach((h, i) => {
					setTimeout(() => {
						try {
							eventEmitter.broadcast({ type: 'symbolWinFx', symbol: golden ? 'GHAT' : 'HAT', positions: [{ reel: h.reel, row: h.row + 1 }] });
						} catch {
							/* presentation only */
						}
					}, i * 70);
				});
		}
		await buildDirector.buildStart(bookEvent);
	},
	buildSpin: async (bookEvent: BookEventOfType<'buildSpin'>) => {
		await buildDirector.buildSpin(bookEvent);
	},
	doorReveal: async (bookEvent: BookEventOfType<'doorReveal'>) => {
		await buildDirector.doorReveal(bookEvent);
	},
	grandOpening: async (bookEvent: BookEventOfType<'grandOpening'>) => {
		await buildDirector.grandOpening(bookEvent);
	},
	buildEnd: async (bookEvent: BookEventOfType<'buildEnd'>, { bookEvents }: BookEventContext) => {
		await buildDirector.buildEnd(bookEvent, bookEvents);
	},
	// ---- EXPANDED HOLD & BUILD / GOLDEN EXPANDED (contract 7.2-7.4) ----
	// doorReveal / streetBonus / grandOpening carry `board` in an expanded round and
	// are routed per board by the build director itself.
	expandStart: async (bookEvent: BookEventOfType<'expandStart'>) => {
		await expandDirector.expandStart(bookEvent);
	},
	expandSpin: async (bookEvent: BookEventOfType<'expandSpin'>, { bookEvents }: BookEventContext) => {
		await expandDirector.expandSpin(bookEvent, bookEvents);
	},
	expandEnd: async (bookEvent: BookEventOfType<'expandEnd'>, { bookEvents }: BookEventContext) => {
		await expandDirector.expandEnd(bookEvent, bookEvents);
	},
	wincap: async (_bookEvent: BookEventOfType<'wincap'>) => {
		buildDirector.wincap();
	},
	// ---- base / Ante side features (contract §3a, §3b) — components/FeatureDrops.svelte ----
	gust: async (bookEvent: BookEventOfType<'gust'>) => {
		await eventEmitter.broadcastAsync({
			type: 'featureGust',
			hats: bookEvent.hats,
			triggers: bookEvent.totalHats >= 6,
			reelHats: bookEvent.reelHats, // the landing sound of each blown-in hat counts on from here
		});
	},
	hatDelivery: async (bookEvent: BookEventOfType<'hatDelivery'>) => {
		await eventEmitter.broadcastAsync({ type: 'featureDelivery', hats: bookEvent.hats, reelHats: bookEvent.reelHats });
	},
	streetBonus: async (bookEvent: BookEventOfType<'streetBonus'>) => {
		await buildDirector.streetBonus(bookEvent);
	},
	// customised
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as
				| BookEventOfType<T>
				| undefined;
		}

		// A resume inside a build bonus is rewound to its `buildStart` (game/utils.ts), so the only state
		// to restore ahead of the remaining events is the running round total.
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
	},
};
