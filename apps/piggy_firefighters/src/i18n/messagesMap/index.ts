import { mergeMessagesMaps } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import en from './en';

// ENGLISH ONLY, ON PURPOSE (review 2026-09-20, all three seats). `zh` used to be offered with one translated string
// (`HOME`) here and two more in the shared UI catalogues, so `?lang=zh` ACTIVATED a locale that translated nothing:
// three Chinese words in an otherwise English game. A locale is offered complete or not at all; English-only is
// compliant. LoadI18n falls back to 'en' for any tag the merged map does not own, so removing the key here is the
// whole fix. `zh.ts` stays on disk as the seed for a real translation and is simply not imported.
const messagesMapGame = {
	en,
};

const merged = mergeMessagesMaps([messagesMapGame, messagesMapUiPixi, messagesMapUiHtml]);
// the shared UI packages carry partial catalogues of their own; only a locale this GAME translates is offered
const messagesMap = Object.fromEntries(Object.entries(merged).filter(([lang]) => Object.hasOwn(messagesMapGame, lang))) as typeof merged;

export default messagesMap;
