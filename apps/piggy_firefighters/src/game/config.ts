/**
 * PIGGY FIREFIGHTERS game config. Internal id `piggy_firefighters`; the player-facing title is PIGGY FIREFIGHTERS
 * (game/names.ts GAME_TITLE, app.html, +layout.svelte).
 *
 * `betModes`, `symbols` and `paylines` mirror docs/GAME_CONTRACT.md §2/§3 (v1.0): six modes, 20 fixed lines, max
 * win 15,000x in every mode, RTP 96.7% in every mode. Buy costs marked *(tuned)* in the contract (25x / 40x / 60x /
 * 300x) are the contract's current figures; every row must match the math lane's `math/publish/index.json` once it
 * is published. `game/generatedConfig.ts` is the view the studio HUD consumes (BetModeTable shape), derived from this.
 */
export default {
	providerName: 'fable',
	gameName: 'piggy_firefighters',
	gameID: 'piggy_firefighters',
	rtp: 0.967,
	numReels: 5,
	numRows: [3, 3, 3, 3, 3],
	betModes: {
		base: { cost: 1.0, feature: true, buyBonus: false, rtp: 0.967, max_win: 15000 },
		// ALARM BOOST (activate toggle): reel set BRA, exactly 2x the chance of each bonus (contract §2)
		ante: { cost: 1.5, feature: true, buyBonus: false, rtp: 0.967, max_win: 15000 },
		// the four buy cards, cost-ascending (contract §2 HUD order)
		backdraft_spins: { cost: 25.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		alarm_call: { cost: 40.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		rescue: { cost: 60.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		inferno: { cost: 300.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
	},
	/**
	 * The 20 fixed lines (contract §3), left to right. Entry `i` is line `i + 1` (the math's `meta.lineIndex`); each
	 * line lists the ROW (0 = top, 2 = bottom) it crosses on reels 1..5. Must stay byte-identical to the math model's
	 * line table (math/games/piggy_firefighters/game_config.py `paylines`).
	 */
	paylines: [
		[1, 1, 1, 1, 1],
		[0, 0, 0, 0, 0],
		[2, 2, 2, 2, 2],
		[0, 1, 2, 1, 0],
		[2, 1, 0, 1, 2],
		[0, 0, 1, 0, 0],
		[2, 2, 1, 2, 2],
		[1, 0, 0, 0, 1],
		[1, 2, 2, 2, 1],
		[0, 1, 1, 1, 0],
		[2, 1, 1, 1, 2],
		[1, 0, 1, 0, 1],
		[1, 2, 1, 2, 1],
		[0, 1, 0, 1, 0],
		[2, 1, 2, 1, 2],
		[1, 1, 0, 1, 1],
		[1, 1, 2, 1, 1],
		[0, 0, 2, 0, 0],
		[2, 2, 0, 2, 2],
		[0, 2, 0, 2, 0],
	] as number[][],
	symbols: {
		// Chief Hamm WILD: substitutes for every paying symbol and pays as H1 on a line of its own (contract §3).
		// Reels 2-5 in base / ante / Backdraft Spins, all five reels in the bonus reel sets. A Backdraft's Blaze Wilds
		// are ordinary W in the evaluated board (the client draws them on fire).
		W: {
			paytable: [{ '3': 1.5 }, { '4': 5 }, { '5': 25 }],
			special_properties: ['wild'],
		},
		// Fire Alarm: scatter, non-paying; 3 / 4 / 5 trigger 10 / 12 / 15 Rescue Spins (contract §4).
		ALARM: {
			paytable: null,
			special_properties: ['scatter'],
		},
		// Golden Alarm: counts as an ALARM in every way; >= 1 among a trigger routes it to Inferno Rescue.
		GALARM: {
			paytable: null,
			special_properties: ['scatter'],
		},
		// line pays, x the TOTAL bet per line, 3 / 4 / 5 of a kind (contract §3, *(tuned)*)
		H1: { paytable: [{ '3': 1.5 }, { '4': 5 }, { '5': 25 }] },
		H2: { paytable: [{ '3': 1 }, { '4': 3 }, { '5': 12 }] },
		H3: { paytable: [{ '3': 0.6 }, { '4': 2 }, { '5': 8 }] },
		H4: { paytable: [{ '3': 0.5 }, { '4': 1.5 }, { '5': 5 }] },
		L1: { paytable: [{ '3': 0.3 }, { '4': 0.8 }, { '5': 2.5 }] },
		L2: { paytable: [{ '3': 0.2 }, { '4': 0.6 }, { '5': 2 }] },
		L3: { paytable: [{ '3': 0.2 }, { '4': 0.5 }, { '5': 1.5 }] },
		L4: { paytable: [{ '3': 0.1 }, { '4': 0.4 }, { '5': 1.2 }] },
	},
	// DECORATIVE spin padding (what streams past while the reels travel; game/reels/spinReels.svelte.ts). One string
	// per reel, one character per stop. Legend: 1-4 = H1-H4, a-d = L1-L4, W = wild, s = ALARM, g = GALARM.
	// The board that STOPS is always the book's board; padding never decides anything.
	//
	// TODO(math lane): these are PLAUSIBLE PLACEHOLDER strips written by the frontend port (W only on reels 2-5 in
	// base / ante / Backdraft Spins, W on all reels and no alarms in the bonus). Replace each set from the frozen reel
	// CSVs, one char per stop, when they exist:
	//   basegame      <- math/games/piggy_firefighters/reels/BR0.csv
	//   antegame      <- math/games/piggy_firefighters/reels/BRA.csv
	//   backdraftgame <- math/games/piggy_firefighters/reels/BRB.csv   (Backdraft Spins, gameType "freegame")
	//   freegame      <- math/games/piggy_firefighters/reels/FR0.csv   (Rescue Spins)
	//   infernogame   <- math/games/piggy_firefighters/reels/FRI.csv   (Inferno Rescue; placeholder = the FR0 strips)
	// spinReels.paddingFor picks the set from the reveal's gameType + the active bet mode / bonus.
	paddingReels: {
		basegame: [
			'b4d4dadc3db1b1caad13adbcbaaacdd133bd4badcc4dcscds22dd4424cbadbd3b3dadadcbdgadabc24cd24acaa',
			'd4cdd3ca4cc23c4b44aaac1aa43d34c2cccb4dda33bc33cccW3gcd1bb41b2adcccbd2Wa43dc3acds3d3b4cd3bc',
			'dc2dba2bb2bs44dbdW3b3cada4bs24dd3bcb2g4ccb2a3b4113cbsb3a3ddgcaa33gbad32bgc243c2c23dac2ad3d',
			'dc12b23s222cs4cdWccbab3a3agd4sd3acdcd332b4ba4bs1c22cd44c1bs3abdscba1d43bWaabds11dca31bd4ba',
			'ddbdcdaaadabddb22a41cc124ccb4c344Wb1b21daba3cc32dbcd3adaa4caaa1sdsd2b1a2dbaccbccd232bcaWab',
		],
		antegame: [
			'b1442aca4bc44cbccd1csbdd4bag421bsaa2c4bcb221ccsddb2bdad4d2ccc2cdddcddgacdc4dsadccaaa3342ca',
			'ccddaddsc2ba2dsaaa4d24cdb1dc43bgbd422d4cd4d4s3sad3ad3dbsa1aab3acsccsbdbbscc3bs14caaddbaaba',
			'adsca4ad3cab3bbs3cdgdad1344sbscb341d44Wdccs2333a41acdbc32bg42s3dcWbba4Wsbcdc31bdcd4cWbd3c4',
			'4sd1bacaa4cdda1332ddb242d4cc2dc4bbab2c34cdsdabcccd1dddbcccbcs2dWaa1s4aaacdsb4bcda4bb3cabb3',
			'3sdsbcd31caadcac4WaWd4bd3c242aab4cdaddWdbd2sa3a2ba3sb4dWcs3b1bdbdba4caas3bc4ac24db3dbabbcd',
		],
		freegame: [
			'4dbddd4badd1aaa31cdcdcaddcc42dca2a2c3dabcad3acdc4cda4ac2d2acb3acbda2cWaa2cWddccbcdbd23c4dd',
			'b34dWbddcc43dbdad4144bacbbadaac3W4da2cda3111bcaccbcb2dca1dcd44dbdd3b3Wddb4aWcbb2bca2baa4c4',
			'ac132dd3d4cb4caWdccdW2bdd43a42W4c4a3a24dc2ccbdW1abdd23adbb4W3b4cbc3ada142babb22adaW4WbccWc',
			'da1bdda4cadabWc3d4aa214ccdbdc3Wdb42adcWdcdbWdccb4cc2W1a4ba3aa343ddc4Wd2adcccdWd3cddc4ca44c',
			'b1422d242cb3ad3ab22bbb4cbad22b3c3a4b3dc2Wcd44a4cb2dcddbb2daaWdW1a4Wddc4cabc42bddadb11dcd33',
		],
		backdraftgame: [
			'da4b14cccabdbbcada244acbc33db2acdd111c1cbccd3d2b41cabdd1bd4ccdd2dad3ddac4b121cabad12acdd44',
			'c1cc424a32da2d43cadc1b1caaadc4ba34Wb1d1cdad2d1dWaccdddadc2Wdc33dc43a4ada12dca2badd31a2dd42',
			'3dbdd4aWbcbcab4a2aWbc3c33cb4ddb2bd13bacbcddbada4bc4Wa4bbaab3ad4cd233dc3d42badcbaca322bb3aa',
			'dacd24acddbcdcbaba3b4323cca22d1bda4b4bbcbdbbbd1b13cd4ac1babdbd31d2bd1ad34bdc441d2bccd223Wa',
			'cbcbb3d34a1cW1cc341adba4Wab2132a342abac2cd2Wd4bWdd2cacdbacb42cbdda421ddaaaa3a423ac34b3d3ba',
		],
		infernogame: [
			'4dbddd4badd1aaa31cdcdcaddcc42dca2a2c3dabcad3acdc4cda4ac2d2acb3acbda2cWaa2cWddccbcdbd23c4dd',
			'b34dWbddcc43dbdad4144bacbbadaac3W4da2cda3111bcaccbcb2dca1dcd44dbdd3b3Wddb4aWcbb2bca2baa4c4',
			'ac132dd3d4cb4caWdccdW2bdd43a42W4c4a3a24dc2ccbdW1abdd23adbb4W3b4cbc3ada142babb22adaW4WbccWc',
			'da1bdda4cadabWc3d4aa214ccdbdc3Wdb42adcWdcdbWdccb4cc2W1a4ba3aa343ddc4Wd2adcccdWd3cddc4ca44c',
			'b1422d242cb3ad3ab22bbb4cbad22b3c3a4b3dc2Wcd44a4cb2dcddbb2daaWdW1a4Wddc4cabc42bddadb11dcd33',
		],
	},
} as const;
