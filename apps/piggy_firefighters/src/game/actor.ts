import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet, isFeatureRound } from './utils';
import { stateGameDerived } from './stateGame.svelte';
import { teardownBuild } from './build/buildDirector';
import { gameSound } from './audio';
import { isSuperTurbo } from './stateSpeed.svelte';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastRevealEvent = _.findLast(
			betToResume.state,
			(emitterEvent) => emitterEvent?.type === 'reveal',
		);

		if (lastRevealEvent) stateGameDerived.enhancedBoard.settle(lastRevealEvent.board);
	},
	onNewGameStart: async () => {
		// Guarantee any interrupted Hold & Build round releases its HUD win
		// ownership and feature-spins before a new round begins (never double-award).
		teardownBuild();
		gameSound.reelsStart(isSuperTurbo());
		// Super Turbo never waits for the old board to clear before asking for the round: the reveal's own
		// spin drops it out, so the request leaves on the press (the largest single saving in the tier).
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold || isSuperTurbo()) return;
		stateBet.winBookEventAmount = 0;
		await stateGameDerived.enhancedBoard.preSpin({});
	},
	onNewGameError: () => {
		gameSound.reelsStop();
		stateGameDerived.enhancedBoard.settle();
	},
	onPlayGame: async (bet) => await playBet(bet),
	// Decides WHEN `/wallet/end-round` is sent (utils-xstate createPrimaryMachines, BET_TYPE_METHODS_MAP):
	// a feature round is settled AFTER it has been fully presented and stays resumable until then. The
	// SDK's multi-reveal test alone never matched a book of this game — see `isFeatureRound`.
	checkIsBonusGame: (bet) => isFeatureRound(bet.state),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
