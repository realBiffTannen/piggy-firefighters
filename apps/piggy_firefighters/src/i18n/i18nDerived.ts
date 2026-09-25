import { stateI18nDerived } from 'state-shared';

import { i18nDerived as i18nDerivedUiPixi } from 'components-ui-pixi';

// The components-ui-html set is NOT merged in (jurisdiction sweep r1): it carries the SDK's cash-worded
// insufficient-balance sentence, nothing in LUCKY reads those keys through the context, and merging it here was the
// one reference that kept that literal in the shipped bundle after the SDK modal was replaced
// (components/notice/PlayNotice.svelte).
export const i18nDerived = {
	...i18nDerivedUiPixi,
	home: () => stateI18nDerived.translate('HOME'),
	notTranslated: () => stateI18nDerived.translate('NOT TRANSLATED'),
};
