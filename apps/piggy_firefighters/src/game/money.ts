/**
 * Money authority for the game's own Pixi surfaces (win overlay, win rungs, bonus totals).
 *
 * One law for every figure on screen: the studio HUD's reviewed formatter (`defaultMoney`), which the
 * host drives from `/authenticate` (`setCurrency` / `setSocialMode`). The SDK's `Intl` helper rounds
 * half up and knows nothing of social mode, so a board readout could disagree with the bar on
 * precision and print a cash symbol on a social session. Importing the same singleton makes the board
 * agree with the bar and truncate, never overstate.
 */
import { defaultMoney, type MoneyAdapter } from '@crashgalaxy/hud';
import { stateBet } from 'state-shared';
import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

import { applySocialFloor, isSweepsWallet } from './socialFloor';

const MICRO = 1_000_000;

type CurrencyRule = { symbol: string; placement: 'prefix' | 'suffix'; decimals: number };

/**
 * The game's corrections to the HUD's currency table, applied here because the HUD package is a protected donor.
 *
 * ISK: Stake's published RGS currency table renders ISK as "kr10.00" (prefix `kr`, 2 decimals), the same label
 * it gives NOK; re-checked against the live stake-engine.com/docs/rgs page for the r1 jurisdiction sweep
 * (family jurisdiction review r1, violation 4). The HUD prints "ISK 10.00".
 */
const CURRENCY_OVERRIDES: Record<string, CurrencyRule> = {
	ISK: { symbol: 'kr', placement: 'prefix', decimals: 2 },
};
let override: CurrencyRule | null = null;

export const hudMoney: MoneyAdapter = {
	// An explicit argument from a caller still wins; only the wallet's own defaults are replaced.
	formatMicro: (micro, symbol, decimals, placement, fixedPlaces) =>
		override
			? defaultMoney.formatMicro(micro, symbol ?? override.symbol, decimals ?? override.decimals, placement ?? override.placement, fixedPlaces)
			: defaultMoney.formatMicro(micro, symbol, decimals, placement, fixedPlaces),
	// Wallet figures (balance, bet): the currency's own decimals, never widened — the held width does exactly that.
	formatMicroFixed: (micro) =>
		override
			? defaultMoney.formatMicro(micro, override.symbol, override.decimals, override.placement, override.decimals)
			: defaultMoney.formatMicroFixed(micro),
	setCurrency: (code) => {
		override = CURRENCY_OVERRIDES[String(code ?? '').trim().toUpperCase()] ?? null;
		defaultMoney.setCurrency(code);
		// a sweeps code arriving after the last jurisdiction sync must still raise the floor
		if (isSweepsWallet(code)) hudMoney.setSocialMode(true);
	},
	setSocialMode: (on) => defaultMoney.setSocialMode(applySocialFloor(on)),
};

/** A book amount (hundredths of the base bet: 100 = 1x) as integer micro-units of the wagered
 *  currency, against the bet the round was actually placed at. */
export const bookAmountToMicro = (bookEventAmount: number): number =>
	Math.round((Math.round(stateBet.wageredBetAmount * MICRO) * bookEventAmount) / BOOK_AMOUNT_MULTIPLIER);

/** A book amount as the HUD's reviewed result string. */
export const formatBookAmount = (bookEventAmount: number): string =>
	hudMoney.formatMicro(bookAmountToMicro(bookEventAmount));

/** A book amount as a MULTIPLE of the base bet ("42×", "42.50×").
 *
 *  FRAMED CARDS SHOW THE MULTIPLE, NEVER A CURRENCY FIGURE (owner rule). A card is a picture of the
 *  result, and the player's bet is not knowable from it — the max-win card states the 15,000× cap flat for
 *  the same reason (components/WinRungs.svelte). Use this for anything drawn inside the signature
 *  dark-brown frame (game/fx/signPanel.ts); use `formatBookAmount` for meters, the HUD WIN field
 *  and the rung sign, which are tied to the round the player actually placed. */
export const formatBookMultiple = (bookEventAmount: number): string => {
	const m = Math.round(bookEventAmount) / BOOK_AMOUNT_MULTIPLIER;
	return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}×`;
};
