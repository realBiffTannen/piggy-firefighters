/**
 * LUCKY game config. Internal id `lucky`; the player-facing title is LUCKY (game/names.ts GAME_TITLE,
 * app.html, +layout.svelte).
 *
 * `betModes` and `symbols` mirror docs/GAME_CONTRACT.md §2/§3 (donor mechanics) as amended for LUCKY
 * (docs/LUCKY_THEME.md §5, docs/coordination/codex-math-core.md): nine modes, max win 25,000x in every
 * mode (owner override 2026-09-23). The paytable values are the contract's 3/4/5 columns (unchanged).
 * `game/generatedConfig.ts` is the view the studio HUD consumes (BetModeTable shape), derived from this.
 * Every row must match Codex's `math/publish/index.json` (costs) once it is published.
 */
export default {
	providerName: 'fable',
	gameName: 'lucky',
	gameID: 'lucky',
	rtp: 0.967,
	numReels: 5,
	numRows: [3, 3, 3, 3, 3],
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 25000 },
		ante: { cost: 3.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 25000 },
		// 2026-09-20 (owner request): SUPER ANTE, a second ante tier (docs/GAME_CONTRACT.md 7.11). A spin mode like Ante:
		// 10x the bet, Hold & Build EXACTLY 25x base (1 in 10.8), Golden Build 10x base (1 in 1,300). Offered through the
		// shared HUD's opt-in `features.anteTiers` (hud.config.ts); without that flag the HUD ignores it.
		super_ante: { cost: 10.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 25000 },
		// contract v2.4 (docs/GAME_CONTRACT.md §7.1): Hold & Build 50x, Build or Bust 100x, EXPANDED 250x
		hold_and_build: { cost: 50.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
		build_or_bust: { cost: 100.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
		expanded_hold_and_build: { cost: 250.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
		golden_build: { cost: 500.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
		// 2026-09-20: the top-end buy, TWO Golden boards GUARANTEED. It replaces BOTH the 1250x random
		// 2-4 board buy and the 2000x four-board buy, which the Stake 2 Star cost-multiplier cap (1000x)
		// ruled out. 1000x is DERIVED, like every buy here: 2 boards x 483.5x = 967x, / 0.967 = 1000x
		// exactly (math/games/lucky/game_config.py). 1000x is also the FLOOR for this product —
		// any Golden Expanded round pays at least two Golden boards.
		// Must match math/publish/index.json exactly.
		expanded_golden_build: { cost: 1000.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
		// LUCKY (2026-09-23, owner): GOLDEN DRAGON CITY x4 — FOUR Golden boards GUARANTEED at the 1000x buy cap.
		// Codex's interface (docs/coordination/codex-math-core.md): `expandStart{bonus: goldenExpanded, source: buy,
		// boards: 4, prizeScale: 0.5}`; every door / prize / jackpot amount in the book is ALREADY scaled, so the
		// client displays the book and never multiplies by prizeScale. HUD key GOLDEN_FOUR.
		golden_four: { cost: 1000.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 25000 },
	},
	symbols: {
		// Wild — Master Bao with his WILD banner; reels 2-4, substitutes for H/L (contract §3).
		W: {
			paytable: null,
			special_properties: ['wild'],
		},
		// Scatter — player name RED LANTERN (theme §3). Non-paying; 6+ trigger Fortune Build.
		HAT: {
			paytable: null,
			special_properties: ['scatter'],
		},
		// Golden scatter — player name GOLDEN LANTERN. Non-paying; counts with HAT toward the 6+ trigger,
		// and >=1 GHAT routes into Golden Dragon Build (math/game_executables.py).
		GHAT: {
			paytable: null,
			special_properties: ['scatter'],
		},
		H1: { paytable: [{ '3': 1 }, { '4': 3 }, { '5': 10 }] },
		H2: { paytable: [{ '3': 0.8 }, { '4': 2.5 }, { '5': 8 }] },
		H3: { paytable: [{ '3': 0.6 }, { '4': 2 }, { '5': 5 }] },
		H4: { paytable: [{ '3': 0.5 }, { '4': 1.5 }, { '5': 4 }] },
		L1: { paytable: [{ '3': 0.3 }, { '4': 0.8 }, { '5': 2 }] },
		L2: { paytable: [{ '3': 0.2 }, { '4': 0.5 }, { '5': 1.5 }] },
		L3: { paytable: [{ '3': 0.1 }, { '4': 0.3 }, { '5': 1 }] },
	},
	// DECORATIVE spin padding (what streams past while the reels travel; game/reels/spinReels.svelte.ts).
	// These are the math reel strips themselves, one string per reel, one character per stop
	// (math/games/lucky/reels/BR0.csv -> basegame, BRA.csv -> antegame), so every symbol
	// streams at exactly its strip frequency: W only on reels 2-4, hard hats never more often than the
	// strip carries them. Legend: 1-4 = H1-H4, a/b/c = L1-L3, W = wild, h = HAT, g = GHAT.
	// The board that STOPS is always the book's board; padding never decides anything.
	paddingReels: {
		basegame: [
			'a1cbaabcc23ch1cbac433a32c12cb4aa4hcbcc4acca22h3b12c2c1hhca4bcbahc4abbccc4a23bcahcbc2hacabc4bcbaa24c434bbcb44ab321habc1cb4cb1ccccaghbb343b2bh4aachbcc4ahcba3cbb1baca2bh3ahb4c32b433b3cbccbhch4hcc4bccbhc3aa324hhcbabbb3ca21aaaa2bh41hh3b3cca14aabbbbga4bcac',
			'a43acbba12aach4h4bb2bcbbaaba43chcbba43c1hh31a2c4342chaa344b1hbc1bbcbc34abc3Wg4bbcbb1h2ac4c3cb14bac1acbaacaa2chh3ca422hb2bccbhcaacc3c4cc2ac4acb4acab14bc4hcbc3bb2bcaachaah4c3cW31h3hbc34Wh3bb2ghhbbabbacc4aabba3cccacbcc2bhbabcba3c2c43ccc344bchahbac1h12c2',
			'babca323cah3b4bb4h3acha3h3Waba1a414cbbb12cccac243cacc1bchba4baabcabc4ah42cacbh3bc3h2b4hcc44hbab2bc11bbbh3ccccghcac1bab1cca4hh3c4bhbb2a2caa4ahc4142achcbbahbg1abhbccb42c3c42ccbccac31acbh3bc3ccaaccb32b4bbaa44aca4b3h2W4chcbbahcWb3a3b23bbc4hcc1a3b2acaa24c',
			'bc3cg3c442h3bh1hbb443cc42c3h4bhcac3cbbhc12h4abbbcb3baa3bhacccacb22bbah4cac3abcacc3a14bcbaac3b1a2c41bb1a2a422bbccabab4chb11a4achhcb4acbcbWcbbb14acb1caW4a4hab1abhhb1b3h2Wc2242baca3ch3ca2h43chbbc3bhc4acacabhbhac44gbcabhh3ac4aaa3c3a2cbcccccc42ca3a43cccbb',
			'aa4a322cbh1ba2a3ccacaabc23ahccac4h2bbab1cb4bcb2bbcb4c4caccbcb4cacc1344b3ba2bch1baa4bbbh4b1hc3cbcga4gbachhahb33c2accbcc44cb2bbaaa2ba4abc4hch3cacbh4ccb33cach324h14hb3bbacc31bbb2c4a32cc1aac3b33aabacc424c3bcc2ba1ba4ah422hbhcchhcbbabab3hc4ccb1c314cchhah1a',
		],
		antegame: [
			'2gbbbhc1ahahab3ha4bccab4cc43bchhahcahahcac42bc3242bbbbbaa4bcbahaahhcc2cb241aaa33bb12c4cc11hc433achc3h2hhccbcbbbbaab4baahbbh44c1cccb1c1bbbhh3ahgccc4chh24hccaac3bcaachaa3acbbc3c4bb2ca4hhbbh3a44c1b2bhac3a1abcccccb33a2ahcbbaa32b4cabachcah4ccbcbcc4a2bcbcb',
			'bhWcbab3b2cWha4h3c4hahWbcb41bachhWcbcc2ababb2cchaa4b23cah4bW2a4bbbhcWhc4Wa2hhc1aca3ach2haWhba4bW3h4cW222aacch44Wb2cb4Wbaa4Wh1hWbbbaabcccbbcbaahh1ccac1ch41ghWc3bcca4cbb3bbhc4baW2baaacabbcabb3ahhaWccb3bhccccch4accc3bca31bh44c3h1cgba3ccch1Waac3WbhbW43c3',
			'Waaahhbb212c443cchh4W42hh2bhhbbWbcc3cWWhbaccabW1b2ahca4c1acccbhaacgc1bahhbbhWcba33ahcbcb44bba4Wcgbc1cbccb4cbbcab4cbbhb3Wcbc432bbc2Wca2b4abab4c4bh3c4b2cchcaa3bbhah3hcahbba4bahac23aWba1Wa1aW33Wcb4c2c3cWhahaWbcc3bha3cccab14cahWc14hch34Wa2bcWccahhahcahWa',
			'acW4bahcbb3hWahW2ccccabba23cbcahba3bcchcac41hbb4bbc23bhg2ca2bc34c2hcab4Waaac3WWhchWhb3cWhbbc4ccbabb44h1b3bcacahbWcaW2h1a3abhahhc4Wc4hWa4W4c3cahWhchbWbWcbbbbcb3caWchh1abagabhh4acab44bca4cca2a3bcWh1c3acbc1bccba2hababcabW24h432bh4c33acb2c1chcachbh41acW1',
			'gcbcccchhccbb1bb2bh33bbbbh3hahc3bbcacccch1caaacbbbacacc4cbcbhhhh1hh4baahccah4ab4bhb4cb3aa44cab24cc1bba3caccbcaca43aaa4a3c23babcc3hhb2c4ab3aac42234bccb3a12h3b3acah3hcc2cch2ccc4hcbac21aaabhhhcahc4bb14g12cbb2ccaa1hcbabcbb3aa4h4bccb2a1haab4b42ccbh4habhbb',
		],
		freegame: [],
		superspingame: [],
	},
} as const;
