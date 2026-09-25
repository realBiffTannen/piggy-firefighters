export default {
	HOME: 'HOME',
	// LUCKY player title (game/names.ts GAME_TITLE is the code constant; app.html / +layout <title> say the same)
	GAME_TITLE: 'LUCKY',
	// NO override for the SDK's insufficient-balance sentence (components-ui-html i18nDerived `insufficientFunds`), on
	// purpose. Lingui keys are the source text, so an override here would be the ONLY place that cash-worded literal
	// still ships: the SDK modal that translated it is no longer mounted (components/Game.svelte mounts ModalError
	// alone) and the game-owned notice (components/notice/PlayNotice.svelte) never looks it up. Jurisdiction sweep r1.
	// Splash deck copy lives in components/splash/copy.ts FALLBACK (the splash mounts before i18n loads); a key
	// added here wins over it. SPLASH_CARD_GOLDEN_FOUR_TITLE / _BODY are defined there.
};
