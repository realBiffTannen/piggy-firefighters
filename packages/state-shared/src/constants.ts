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
		maxWin: 8888,
	},
	ANTE: {
		mode: 'ANTE',
		costMultiplier: 1.2,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage:
				'',
			dialogVolatility:
				'',
			volatility:
				'',
			button:
				'',
			bannerText: 'example banner text',
		},
		text: {
			title: 'DOUBLE BOOST',
			dialog:
				'Double the chance to trigger the FREE SPINS round when activated for 1.2x the player bet amount. DOUBLE BOOST remains active until disabled by the player.',
			description: 'Greatly increase your chance of landing a bonus symbol each spin.',
			button: 'ACTIVATE',
			betAmountLabel: 'DOUBLE BOOST',
			tickerIdle: 'DOUBLE BOOST IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	SUPERANTE: {
		mode: 'SUPERANTE',
		costMultiplier: 5,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage:
				'',
			dialogVolatility:
				'',
			volatility:
				'',
			button:
				'',
		},
		text: {
			title: 'SUPER BOOST',
			dialog:
				'1 in 20 chance to trigger the FREE SPINS round when activated for 5x the player bet amount. Guarantees 1 or more Scatter symbols every spin. SUPER BOOST remains active until disabled by the player.',
			description: 'Guaranteed to land at least 1+ bonus symbol each spin.',
			button: 'ACTIVATE',
			betAmountLabel: 'SUPER BOOST',
			tickerIdle: 'SUPER BOOST IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	SUPERSPIN: {
		mode: 'SUPERSPIN',
		costMultiplier: 25,
		type: 'activate',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage:
				'',
			dialogVolatility:
				'',
			volatility:
				'',
			button:
				'',
		},
		text: {
			title: 'SAMURAI SPIN',
			dialog:
				'All game features are boosted when activated for 25x the player bet amount. SAMURAI SPIN remains active until disabled by the player.',
			description: 'SAMURAI SPIN is AWESOME! ',
			button: 'ACTIVATE',
			betAmountLabel: 'SAMURAI SPIN',
			tickerIdle: 'SAMURAI SPIN IS ACTIVE',
			tickerSpin: 'GOOD LUCK',
			bannerText: 'example banner text',
		},
	},
	BONUS: {
		mode: 'BONUS',
		costMultiplier: 100,
		type: 'buy',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage:
				'',
			dialogVolatility:
				'',
			volatility:
				'',
			button:
				'',
		},
		text: {
			title: 'BONUS',
			dialog:
				'Triggers FREE SPINS feature when activated for 100x the player bet amount. The Global Multiplier can reach up to 64x and remains active for the duration of FREE SPINS.',
			description: 'Each spin may have a random multiplier applied to winning lines.',
			button: 'BUY',
			tickerIdle: 'PLACE YOUR BET',
			tickerSpin: 'BONUS BUY ACTIVATED',
			bannerText: 'example banner text',
		},
	},
	SUPER: {
		mode: 'SUPER',
		costMultiplier: 200,
		type: 'buy',
		parent: '',
		children: '',
		assets: {
			icon: '',
			dialogImage:
				'',
			dialogVolatility:
				'',
			volatility:
				'',
			button:
				'',
		},
		text: {
			title: 'SUPER BONUS',
			dialog:
				'Triggers FREE SPINS feature when activated for 200x the player bet amount. The Global Multiplier can reach up to 256x and remains active for the duration of FREE SPINS.',
			description: 'Enter the mothership! Land values and multiply them with action symbols.',
			button: 'BUY',
			tickerIdle: 'PLACE YOUR BET',
			tickerSpin: 'SUPER BONUS BUY ACTIVATED',
			bannerText: 'example banner text',
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
