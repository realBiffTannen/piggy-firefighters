/**
 * THE WALLET-DERIVED SOCIAL FLOOR (studio pattern, first shipped in candy_town).
 *
 * The HUD host decides social vocabulary from `/authenticate`'s `jurisdiction.socialCasino` and the
 * launch link's `?social=true` only; the wallet code is never consulted. XSC / XGC / XEC are issued by
 * a social casino and by nothing else, so a sweeps wallet is a sound one-directional FLOOR: it can only
 * ever turn social vocabulary ON. Without it a sweeps launch that lacks both flags (a replay never
 * authenticates) renders "BET" next to an SC balance while the rules sheet already speaks social.
 *
 * Applied through the documented `HudConfig.money` / `HudConfig.strings` seams. No HUD bytes touched.
 */
import { createStrings, stateHud, type StringEntry, type StringsAdapter } from '@crashgalaxy/hud';
import { stateBet, stateUrlDerived } from 'state-shared';

const SWEEPS = /^(XSC|XGC|XEC)$/;

/** Both sources are tested: `/authenticate`'s answer and the URL (a replay's only source). */
export const walletCodes = (): string[] =>
	[stateUrlDerived.currency(), stateBet.currency].map((c) => (c || '').trim().toUpperCase());

export const isSweepsWallet = (...codes: string[]): boolean =>
	(codes.length ? codes : walletCodes()).some((c) => SWEEPS.test((c || '').trim().toUpperCase()));

let hudStrings: StringsAdapter | null = null;

/** Built here rather than by the host so the floor holds a reference to the same instance. */
export const makeHudStrings = (overrides: Record<string, StringEntry>): StringsAdapter =>
	(hudStrings = createStrings({ overrides }));

/** Raise every social flag the host owns. Called from the money adapter's `setSocialMode`, which the
 *  host invokes last in both sync paths, before the rules sheet and buy roster are rebuilt. */
export const applySocialFloor = (on: boolean): boolean => {
	const social = on || isSweepsWallet();
	if (social) {
		stateHud.social = true;
		if (hudStrings) hudStrings.state.social = true;
	}
	return social;
};
