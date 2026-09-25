import { mergeMessagesMaps } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import en from './en';

// ENGLISH ONLY, ON PURPOSE (review 2026-09-20, all three seats). `zh` used to be offered with one translated string
// (`HOME`) here and two more in the shared UI catalogues, so `?lang=zh` ACTIVATED a locale that translated nothing:
// three Chinese words in an otherwise English game. A locale is offered complete or not at all; English-only is
// compliant. LoadI18n falls back to 'en' for any tag the merged map does not own, so removing the key here is the
// whole fix. (The donor's partial `zh.ts` was not carried over.)
const messagesMapGame = {
	en,
};

// the shared catalogues are partial per locale by design (the filter below keeps only what this game offers)
const merged = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml] as unknown as Parameters<typeof mergeMessagesMaps>[0]);
// the shared UI packages carry partial catalogues of their own; only a locale this GAME translates is offered
const messagesMap = Object.fromEntries(Object.entries(merged).filter(([lang]) => Object.hasOwn(messagesMapGame, lang))) as typeof merged;

export default messagesMap;
