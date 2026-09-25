import type { BaseBet } from 'utils-bet';
import { stateConfig } from './stateConfig.svelte';
import { stateMeta } from './stateMeta.svelte';

export type Currency = string;
export type BetToResume = BaseBet | null;
export type BetModeKey = string;

export const stateBet = $state({
	currency: 'USD' as Currency,
	balanceAmount: 0,
	betAmount: 1,
	wageredBetAmount: 1,
	betToResume: null as BetToResume,
	activeBetModeKey: 'BASE' as BetModeKey,
	winBookEventAmount: 0,
	autoSpinsLoss: 0,
	autoSpinsCounter: 0,
	autoSpinsLossLimitAmount: Infinity,
	autoSpinsSingleWinLimitAmount: Infinity,
	isSpaceHold: false,
	isTurbo: false,
	// REPEAT BUY — opt-in per game, then toggleable by the player.
	//
	// By default the SDK drops `activeBetModeKey` back to 'BASE' the moment a
	// bought round is over, so replaying the same feature costs three taps
	// (buy menu → card → confirm). A game that sets `repeatBuyAvailable` keeps
	// the bought mode ARMED instead: the next spin repeats the same purchase,
	// and the buy menu grows a switch that writes `repeatBuyEnabled`.
	//
	// `repeatBuyAvailable` stays false here so every other app keeps the
	// original one-shot behaviour untouched.
	repeatBuyAvailable: false,
	repeatBuyEnabled: true,
});

const correctBetAmount = (value: number) => {
	const options = stateConfig.betAmountOptions;
	if (options.includes(value)) return value;
	if (options.includes(stateBet.betAmount)) return stateBet.betAmount;
	return options[0] ?? 0;
};

const setBetAmount = (value: number) => {
	stateBet.betAmount = correctBetAmount(value);
};

const updateBetAmount = (update: (value: number) => number) => {
	stateBet.betAmount = correctBetAmount(update(stateBet.betAmount));
};

let isTurboLocked = false;

const updateIsTurbo = (value: boolean, options: { persistent: boolean }) => {
	const { persistent } = options;

	if (!persistent && isTurboLocked) return;
	if (persistent) isTurboLocked = value;

	stateBet.isTurbo = value;
};

const activeBetMode = () =>
	stateMeta.betModeMeta?.[stateBet.activeBetModeKey.toUpperCase()] ??
	stateMeta.betModeMeta?.[stateBet.activeBetModeKey.toLowerCase()] ??
	null;
const isContinuousBet = () => stateBet.autoSpinsCounter > 1 || stateBet.isSpaceHold;
const timeScale = () => (stateBet.isTurbo ? 2 : 1);
/** Is the current 'buy' mode held for the next spin instead of falling back to BASE? */
const isBuyModeArmed = () =>
	stateBet.repeatBuyAvailable &&
	stateBet.repeatBuyEnabled &&
	stateBetDerived.activeBetMode()?.type === 'buy';
// An armed buy mode charges its costMultiplier on every spin with no dialog in
// between, exactly like an 'activate' ante mode — so it has to price like one.
// Leaving it at 1 would show a bet of $1 in the HUD while the round debits
// $250, and would let the spin button stay enabled on a balance that cannot
// cover the purchase.
const betCostMultiplier = () =>
	stateBetDerived.activeBetMode().type === 'activate' || isBuyModeArmed()
		? stateBetDerived.activeBetMode().costMultiplier
		: 1;
const betCost = () => stateBet.betAmount * betCostMultiplier();
const isBetAmountOption = () => stateConfig.betAmountOptions.includes(stateBet.betAmount);
const isBetCostAvailable = () =>
	isBetAmountOption() && betCost() > 0 && betCost() <= stateBet.balanceAmount;
const assertBetCanBeSubmitted = () => {
	if (!isBetAmountOption()) {
		throw new Error(`Bet amount ${stateBet.betAmount} is not an RGS bet level`);
	}
	if (!isBetCostAvailable()) {
		throw new Error('Bet cost is unavailable for the current balance');
	}
};
const hasAutoBetCounter = () => stateBet.autoSpinsCounter !== 0;

export const stateBetDerived = {
	setBetAmount,
	updateBetAmount,
	updateIsTurbo,
	activeBetMode,
	isContinuousBet,
	isBuyModeArmed,
	timeScale,
	betCost,
	isBetAmountOption,
	isBetCostAvailable,
	assertBetCanBeSubmitted,
	hasAutoBetCounter,
};
