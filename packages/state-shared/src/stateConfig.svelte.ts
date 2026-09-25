export const stateConfig = $state({
	jurisdiction: {
		socialCasino: false,
		disabledFullscreen: false,
		disabledTurbo: false,
		disabledSuperTurbo: false,
		disabledAutoplay: false,
		disabledSlamstop: false,
		disabledSpacebar: false,
		disabledBuyFeature: false,
		displayNetPosition: false,
		displayRTP: false,
		displaySessionTimer: false,
		minimumRoundDuration: 0,
	},
	// PLACEHOLDER ONLY. Every field below is overwritten by the betting
	// parameters `/authenticate` returns; these values exist so the HUD has
	// something to lay out against before the response lands, and so
	// Storybook and the tests have a ladder without an RGS. Nothing may treat
	// them as game configuration.
	betAmountOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
	betMenuOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
	// `minBet` / `maxBet` / `stepBet` from the RGS, in display units. The
	// stepper clamps to the first two; the third is the granularity a custom
	// amount has to sit on.
	minBetAmount: 0,
	maxBetAmount: Infinity,
	stepBetAmount: 0,
});
