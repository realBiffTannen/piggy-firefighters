import { fromPromise } from 'xstate';

import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet, stateBetDerived, stateConfig, stateUrlDerived, stateModal } from 'state-shared';
import { requestBet, requestEndRound } from 'rgs-requests';

import type { BaseBet } from './types';

/**
 * THE JURISDICTION'S PACING FLOOR, AT THE ONE PLACE EVERY ROUND STARTS.
 *
 * `/authenticate` can carry `jurisdiction.minimumRoundDuration` (ms). The HUD enforces it only on a manual SPIN
 * press (a press inside the floor is ignored). Autoplay rounds and feature buys start rounds without that press:
 * measured on the shipped bundle with a 5,000 ms floor, manual starts were 5,128 ms apart but autoplay starts
 * 2,409-2,421 ms apart. Every new round passes through `newGame`, so the /wallet/play request is held here until
 * the floor has elapsed since the previous one was sent. A floor of 0 (the default) changes nothing.
 */
let lastPlayRequestAt = 0;

const holdForMinimumRoundDuration = async () => {
	const floor = Math.max(0, Number(stateConfig.jurisdiction?.minimumRoundDuration) || 0);
	const wait = lastPlayRequestAt + floor - Date.now();
	if (floor > 0 && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
	lastPlayRequestAt = Date.now();
};

const handleRequestBet = async ({ onError }: { onError: () => void }) => {
	try {
		// UI controls disable an unavailable play; this final boundary also
		// prevents a stale or forged state from sending a non-RGS level.
		stateBetDerived.assertBetCanBeSubmitted();
		await holdForMinimumRoundDuration();
		const data = await requestBet({
			rgsUrl: stateUrlDerived.rgsUrl(),
			sessionID: stateUrlDerived.sessionID(),
			currency: stateBet.currency,
			mode: stateBet.activeBetModeKey,
			amount: stateBet.betAmount,
		});

		if (data?.error) {
			throw data;
		}

		if (data?.round?.state && data?.round?.state?.length > 0) {
			stateBet.wageredBetAmount = stateBet.betAmount;

			return data;
		} else {
			throw {
				error: 'Empty state in data.round',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		onError();
		stateBet.autoSpinsCounter = 0;
		stateModal.modal = { name: 'error', error };
		console.error(error);
		throw error;
	}
};

const handleRequestEndRound = async () => {
	if (stateUrlDerived.replay()) return;

	try {
		const data = await requestEndRound({
			sessionID: stateUrlDerived.sessionID(),
			rgsUrl: stateUrlDerived.rgsUrl(),
		});

		if (data?.error) {
			throw data;
		}

		if (data?.balance?.amount !== undefined) {
			return data;
		} else {
			throw {
				error: 'Empty amount in data.balance',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		console.error(error);
	}
};

const handleUpdateBalance = ({ balanceAmountFromApi }: { balanceAmountFromApi: number }) => {
	stateBet.balanceAmount = balanceAmountFromApi / API_AMOUNT_MULTIPLIER;
};

type Options<TBet extends BaseBet> = {
	onResumeGameActive: (betToResume: TBet) => TBet;
	onResumeGameInactive: (betToResume: TBet) => void;
	onNewGameStart: () => Promise<void> | undefined;
	onNewGameError: () => any;
	onPlayGame: (bet: TBet) => Promise<void>;
	checkIsBonusGame: (bet: TBet) => boolean;
};

function createPrimaryMachines<TBet extends BaseBet>(options: Options<TBet>) {
	const {
		onResumeGameActive,
		onResumeGameInactive,
		onNewGameStart,
		onNewGameError,
		onPlayGame,
		checkIsBonusGame,
	} = options;

	let balanceAmountFromApiHolder: null | number = null;

	const BET_TYPE_METHODS_MAP = {
		noWin: {
			newGame: async () => undefined,
			endGame: async () => undefined,
		},
		singleRoundWin: {
			newGame: async () => {
				const endRoundData = await handleRequestEndRound();
				if (endRoundData?.balance) {
					balanceAmountFromApiHolder = endRoundData.balance.amount;
				}
			},
			endGame: async () => {
				if (balanceAmountFromApiHolder !== null) {
					handleUpdateBalance({ balanceAmountFromApi: balanceAmountFromApiHolder });
					balanceAmountFromApiHolder = null;
				}
			},
		},
		bonusWin: {
			newGame: async () => undefined,
			endGame: async () => {
				const data = await handleRequestEndRound();
				if (data?.balance) {
					handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
					balanceAmountFromApiHolder = null;
				}
			},
		},
	} as const;

	const getBetType: (args: { bet: TBet }) => keyof typeof BET_TYPE_METHODS_MAP = ({ bet }) => {
		const isBonusGame = checkIsBonusGame(bet);

		if (bet.active === true) {
			if (isBonusGame) return 'bonusWin';
		}

		if (bet.payoutMultiplier && bet.payoutMultiplier > 0) {
			if (isBonusGame) return 'bonusWin';
			return 'singleRoundWin';
		}

		return 'noWin';
	};

	// newGame
	const newGame = fromPromise(async () => {
		await onNewGameStart();

		const data = await handleRequestBet({ onError: onNewGameError });

		if (data) {
			if (data.balance) {
				handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
			}

			const bet = data.round as TBet;
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet };
		}

		return { bet: null };
	});

	// resumeGame
	const resumeGame = fromPromise(async () => {
		const betToResume = stateBet.betToResume as TBet;

		if (betToResume && betToResume.active) {
			// Optional chaining doesn't work here with build-node. 🤷‍♂️
			stateBet.betToResume = null;

			//End Round resumed active bet
			const bet = betToResume as TBet;
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet: onResumeGameActive(betToResume), rawBet: betToResume };
		}

		if (betToResume && betToResume.state && betToResume.state.length > 0) {
			onResumeGameInactive(betToResume);
		}

		throw new Error('inactive Bet');
	});

	// playGame
	const playGame = fromPromise<void, { bet: TBet | null }>(async ({ input }) => {
		if (input.bet) await onPlayGame(input.bet); // context.bet is hydrated from newGame
	});

	// endGame
	const endGame = fromPromise<void, { bet: TBet | null; rawBet: TBet | null }>(
		async ({ input }) => {
			const targetBet = input.rawBet || input.bet;
			if (targetBet) {
				const betType = getBetType({ bet: targetBet });
				await BET_TYPE_METHODS_MAP[betType].endGame();
			}
		},
	);

	return {
		newGame,
		playGame,
		endGame,
		resumeGame,
	};
}

export { createPrimaryMachines };
