// The donor template's sample bet modes (another game's titles, dialog copy, tickers and
// placeholder banner text, none of it std/social gated) used to live here. This game's modes are published into
// stateMeta.betModeMeta by the studio HUD at boot, from the math-exported config (the same table the rules sheet and
// the feature cards read), so this default is only ever read before that effect runs: it keeps a blank BASE so
// activeBetMode() is never null for the resting key, and carries no other mode and no copy — nothing here may reach
// the shipped bundle as bytes (sweep 2026-09-25).
const DEFAULT_BET_MODE_META = {
	BASE: {
		mode: 'BASE',
		costMultiplier: 1.0,
		type: 'default',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage: '',
			dialogVolatility: '',
			volatility: '',
			button: '',
		},
		text: {
			title: '',
			dialog: '',
			button: '',
			betAmountLabel: '',
			tickerIdle: '',
			tickerSpin: '',
			bannerText: '',
		},
	},
};

// The donor template's sample rules (another game's modes, RTP and max win) used to live here. This
// game's rules are game/rulesContent.ts, rendered by the studio HUD; nothing reads this default, so it
// is empty rather than stale copy that contradicts the real rules.
const DEFAULT_GAME_RULE_META = {
	payTable: [],
	gameRules: [],
	splashScreen: [],
};

export { DEFAULT_BET_MODE_META, DEFAULT_GAME_RULE_META };
