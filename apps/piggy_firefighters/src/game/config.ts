/**
 * PIGGY FIREFIGHTERS game config. Internal id `piggy_firefighters`; the player-facing title is PIGGY FIREFIGHTERS
 * (game/names.ts GAME_TITLE, app.html, +layout.svelte).
 *
 * `betModes`, `symbols` and `paylines` mirror docs/GAME_CONTRACT.md §2/§3 (v1.2.2): six modes, 20 fixed lines, max
 * win 15,000x in every mode, RTP 96.7% in every mode. Mode costs are the FROZEN math's (tag math-freeze-v1,
 * `math/games/piggy_firefighters/game_config.py` MODE_COSTS): base 1x, ante 1.5x, alarm_call 12x, rescue 18x,
 * backdraft_spins 50x, inferno 90x. Once `math/publish/index.json` exists every row must match it byte for byte;
 * `qa/gate/check_mode_costs.mjs` fails the build gate on any difference. `game/generatedConfig.ts` is the view the
 * studio HUD consumes (BetModeTable shape), derived from this.
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
		// the four buy cards, cost-ascending (contract v1.2.1 §2 HUD order: Alarm Call, Rescue, Backdraft, Inferno)
		alarm_call: { cost: 12.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		rescue: { cost: 18.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		backdraft_spins: { cost: 50.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
		inferno: { cost: 90.0, feature: false, buyBonus: true, rtp: 0.967, max_win: 15000 },
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
	// GENERATED from the frozen reel CSVs by tools/reels/make_padding.py (`--check` verifies); do not hand-edit.
	// spinReels.paddingFor picks the set from the reveal's gameType + the active bet mode / bonus.
	paddingReels: {
		// basegame <- math/games/piggy_firefighters/reels/BR0.csv (tools/reels/make_padding.py)
		basegame: [
			'111bdccbada1dacc4b1dbcb44dcbbd2dcbacbadbdaabb22bbdb23aaccbabdd4cdaabcbdcd2acbc4cc4bdcbdc3c2bcac4ccbd4d4b3d2bba3c43dda3cbcb3bbaa2abddaadbb4cddda2adbc2cc3dc3ab2b4adds4bab3c2acsd43ab4bd3aa24bacb331cacda23badd3babdcasd2ddd2bc3d4d2dbba2dddc222bbbba4d324cbcs3bdbdb32c4cdccda1d2d3aabdabga14db4abd2cc41ab34bascdb444adba2d4dd1ad3ba323ddd1ddd14d4adadcdbab4b43d4c1bbbas4daaabb2ddcdcacdsa133s44dac33aabadbbab41bc4dacabd2ddddbbcadddb4b32dc2bbdbbdcdbadb4ccdddd42d3ds2b4acdbb2addbd44ccb2dcsacbd4dbadsbacdbbcdcb2dc2bcd41d43ababb',
			'111b42acd3ccccc4bb4d3a4abddd4cc4abc4cba3cc3a2ddbdadbd23dc3bb4dcbac323cadcadbddbad4abdsab4bc1babbbdaab3cbca14gccbbdbdabddaabWdb3c1ddc3dacc1232aa34cc3sbdcabb3acbddadcWd3b1db2cbccbcbc412ac4a3bd2acdc3dcdccbacacs3dbcbbbb2bdacc1cbdbd4daWdad4cd4adc1dcdd3ccc34sWdbbdc4cc3sd1cbdd3ddcbabaaddbdbb3adbacacadda4adbddaada13b43d4cacc142cc334cbc4ba4asdc3444dcbdcsbddbdcdacaaba2cs44bbba4dcccbbcdcbcbdcddddcddccc4b3cd4d3dddabb3ab444d33aba33c4dca422aWc23aacddbsbbcca42cd23ca43dda4dcbcs44ababcabscdc43cdacbab3d4bac4da3dcaddc3ccbaaaa',
			'1112bdca4ca1abdc41bbdacbb2csa3dc2d33324bWd3c2a4dsd1cdbbaccadd32sbac2cd13cbcbaacdcddbc3cb2bbda2dbaccbaa44c14babdd4bbcasb3dca243d244caa43bd3c4ccb22cdbdaadabb4cbc13db3a3adbcbdb4bdbdbabbdcd1dbcd3cagc4b4ba3aa1ba21adb3acs3d3cddac4db4dcababadbb3bbccdccd44W3cc1dbcadbbdda4b4aa2daca3cd4d21cdcdac42Waadabd4bsacdbbdccadbcc3daWcba32bda4cccd2cabcb1abdb4cdd42a1ddbcbacddc21a43cdb4acd4bab33caa3bcs2cb4dbcb3d3dcac3cbabdda4a3addbdbb2adsd1abdccdaabbs1cdcac4dsdcdaadab2abacc44b2b3dcd3a3dccddaacbadbc34a4cd4cccaWcbdas3413d2db1ba4bdd',
			'111c2dcdd4cb22cabddd24a1bbaacdd4d4cabc1cdcaWcc4cg1bccb1c3ac3dcbbad33d4cc1ccbdsddc4db3bd4acac4dd41bdaad4bbbdadd3bccaaba14aacba2bdadbbada44bcbbbcc3bcccbddbcdba4cdcbcdd2aba4ddcscbbsddbb3bcc4acdcadbdsa3cccb3dbad2cdbs44cb4dddbab3acdd24c3cacacd1cbsdccs4cbbd4b4d3adacaabdcadcabcaddbbdccbbbcacbdcbb2ddcd2cdbcc3cacddcascaabadcsbdaccac24bb3bcbbb4bbdbb23b3s3344adbdccbab2badc3cabccc3s3bddb14dc2cac2dacd3cb4bccddcc4bWa33d3b41bbdbac4cbc432c2bc4a4cb2da2ca4ccabd31dbca323c4dcaaWaWcad4bc3ccdad3bb3bddbbbbbcdb12adbbbcaWcaaadbdc4c',
			'11134adbabbbdbcdc24b4cb31bbdccc4gcb14bc4bcbd4d143b43d24a4dd4adbadc3sdbb3cdddbb32cad3dbas4a32dc324adbc2asba4caad1aa4b444dabW3c422d2d2W33cb433c4dabb2db2ad2ccacddddbbcbbb44asbccdac3acacacd1b1dacabdaadcd14baaaWbdaabdd4dsabdbba2acb1ab1aaa2c2dd4bdb3c2dcads44ccdbd1bc2dcbbbcdba4bddb344cd2bcbdaa3bcbddbccddd3cdWddc14cbcc4cdbdd44bdbcd44ac2c1babcba32bbcda3db4aacbbbbccdc44accccdcad4aaadbcaab314accdb4a3dcddbb4cdbdsb2cbcadb3d4c3b4bbba3cbb1cc4a3asa431cd3cdW1bcsadd4sa44cda3ac34cccbab3ccdcbccdds24bcd3aa34ccdada1b3bc1dabc4dbc',
		],
		// antegame <- math/games/piggy_firefighters/reels/BRA.csv (tools/reels/make_padding.py)
		antegame: [
			'1114dd4dbcdc3d3bbdbc4bc3c4ccb44bdd3cacc2cdcbacbbbcd34ba3dac4bscc4scd4dbdabb2bab4d3ddcaddddcdcbdabdac4d43bbb4a3bddcbd1dcca4bcbdbccsb3ad331c3cacacd12cccdc2ds3babddscbc2sdc4a4a4a34saa4d3bc3cadbddca3a4c2cb43bc4aa2c1cb4aab343dcc4ccac3cbc2gb23bddc3ddcddcb1bb333cabcdab4d334bdbddbccbdbcdaddddcbcaacababd3bcbbbdbcbccascd3bbbbd23b33aaadbbcb4ca3d3ba31acc1aas1b3cb44baddbbc1bdacda1cabsc14ac24c2cab42c2dbb1sdcddcd2bsbc4bd24cd4ddacddbsabddcc4sbabdad23s4dbbb33da4c3bdd43ad1cca4c4acca4acb4ac13baccab2bdbsd42sbcccb2daaab3bcaa1ba',
			'1114abaa42ab43dbb244bdcbbbcbbbd4cdd23abc4dadaacbcbbcsdacc14c4d32abdbcba2aacbbd3dd31dcdc44c4caW23a4b3cb1aaabdbcdbca42dcbdbd4d3c4aca3accd24adddabcdbdbdWcc1caddadcgd4c1dcac3b2c234ddda4acca2dadcabdbcd44s4a3cba4c33s3cabcbsccbc44da4c3bbbdcd3cda4dd23aadbaadd2dc1a2d4adbdd4dcadb14cW14bddddsb2bddcaaa4abaWdc3cddbccabdcbdbbbbbdcacdadbdba2bsba4bcd4dad44cbd4babc4bdccs3cacbb2addbdbaaacaasab3c4ddsac44ccdsa44sa1dbdbdbds2bc21dcb34sabsb134bddd34ab3d3bb3d2ac3cccbb2bs4d33cbcbds4csb4dd1dd31dcb4cd3b4c4caa3cda4ca3a4ad3dcW44cdca4b3',
			'111bad4babcaab4dc1cdaaa44caa3ddccd2d3d4ca4dcacd4a4c3dbcc2abcccbb2cba4bbbccsabb3d4aacbcb1acccbcb4gddbcddadaadbbabsda34ccbccsca42dddc4sb2d4b2bbcd3cadc3ab2acab3dddcb4abcbb4bcbd1ddcbcadcbadbcadc44c2bc4dadasb4dbbdcdbdabaca4a4dbbdad2a4ddd3badbbd2d3cd4adaa2b3adadacsab2c23bdabd3ad4d3234cb4c14a4bdc2bbcbW44c4cabaccWaca4bccd2bsbbd2ab14bdcb43b22babsabcbs433d3c3cc1cbccb2dsadca4aba4bbb34a42332d3c43b3da4bdbcabc32sc4d3b1ccsbb324cbccabWccdddb13cabsc4dcd4bdsabbb24a1adcdaaadbcWcd4ac4cbabcdsd4b34Wbs3dddscc3acccbcdbccadacddbcda',
			'111bccdb4ba4ccdabccdddbbcbabbcdab32Wabbccd2dddd4b222bc4acdba21b4dc1csacb1a3dbd12cadd3ad4b4bcbbbcbc2c2adcba333csc3c44dd4ddb4bdbbca3dd43sa31asdbbaaacbcc4324cdadbd3baac4d3cca3ccabddbacab4acbd4bcbd3Wbbaa4caaada3cd4cdb4sbasbac3bc2bs423bcaWd3b13daccaabca1ca21s2d4b3cd2s4d42db4ddbb4c4cscdc2132dbdb44b4441dcbbbd1cb1dada4adbccdbaa4ascb2W3sac4bb14bccd2bdbbaddcbdd1bda1bccb44dcdc3142cbccbbcgacb4dabbd3d1daa23bs3csccabd4b2ad1cca4sabbbabacsbdabbadcddc41cbcd4d3acb4Wbcda3dac1dcaca44b4bdddaba1da3dd1csda1bb4dcbcbbbbbc1bddcdaa1a',
			'111db3d3cdcddcaaabaaddad4abcab4da4ddabsba2sa4dabdbbbaW4cbcbdaddbddcdcbas2acacaadb4cadddb4dcaaacdddadsdbd3d2cd2bbccsc33bdccbba4da4caabbacc4bddacc4d4b3ad4db4ad3b3b4dca4ddb3b2bad3c1a3bcb1dasbcs4bcdaaca2csaddWbabbdcbcdbdc4cc4ad4aadc3b4ccaca2babsbcddcdb13cbWbWc4dac3ab3ccdca3aadc4d2aa21d4dcd4bcdddc3c2bsaddc3dd2dd1dcbb4da1bb3a11adc4c2d4aacacda34acdddcdcbbb3cdccsbbdbagaabd1ddcbaaccacda4cdaabdcc2aWa3c42ddbaadbdcba4adcd32s4aaa2s1d3d34a42dbc44cdbbbdca4caacdbbabdcdbacacdbb3dcddcabdb44d44s2cbs24sd1dad22ddcd2s34badbaa1d4',
		],
		// freegame <- math/games/piggy_firefighters/reels/FR0.csv (tools/reels/make_padding.py)
		freegame: [
			'111ddabcWW1b44cb4acb2cW3WccW4a4b33bWbabacb4dbcc44a31cb43331cadbacd4aadca3Wdbda4c213cd1c4aadbc43bddWd31acdad4cdb4a3b4aad4bdb2323cb4d4b4a23dadad1b4cddb2adddWb33cddccaa323aadcbbdbbc4caabcbbbcddb1cbd2Wb4d2bbW1b2cdbb3caW24adbadbdbWadbb4dbb43c44Wbd12a42bbad3dddcdcbccd42dd3Wdaa432bd1ca4aa3c1ba2b33dcbaabaac4WWcacdddadb4aaa4d1aa2abcW2cdab1cbcbbbdcdWc4bdbbbddacdb33d2dadbacbaWdcdacdacdcda4aba23Wd4cc24dW34ba2d2cbbc3d2a2ccdcbadW2c44adcda4bcbdd3cdbad4aabd4caad2cdbccbc2c3cddda2b3cacbd4ccW2c4a2dcddcacdcdca3WdbdW1344bcd4dcd',
			'11143caaWW142b3c4dacbbdc3addaacac4a1baccddc4W32b3dWd4ccdc2d34dWacbadbc2a4acbbd4bbd3cbcabdaccbcWaccdb4cbda443a3d3bc4dbcd4c24dWaWacdaabdc2c4db34d4b4d4adc4dddbaacdabcbb2Wd4caWaadbdc43c2b42dcbdd42a4ca4dbbcdacdc4cbaa343acWbW3bbccWdda4aaabb2a44bcc2c3W3Wdabdd3acbaaa33cbbdcbWacdacdbcbW2W44d4bad3babadbWcacb4cdacc3b2a3bcbbdWcdcbc22ba4acaa3aaadbb3accba2ac34daa34bcc23ddbWb44dWda2aa1acdabbWd3d444b2c43Wdd4c3bbdbccabdbabc4ad1cad333ac4bWW2d1dc4dbbba3cd1dbcb34ccdbbc34ddbbcad4c4a32aabbcbbbcdca4dacdcdacbbbbcabdbbccabbdaac4cad',
			'111a3adbWW1da4d3bcWdddcbcdab1cab3d4dab3a2aWadaWaaWab14cdc43d3W4cadWadbb43ccca24b2daba22bc32bad4dc13bc4bac3b24db32d4cbbb3bb1ab44c21cdb1dcWdcababdba3bd3cbWaaccccWacccdcd3abad4cW2Wda4Wa3daddba4ca3c3dddbdcbbcdbaacdabbbddbcac14abc42ccbcdabdd4ccd3Wdca1dddadc3aa4dac1dac2dcb3dbWdcb4dc2ddaWW2c4d31addd2c2ba1d3aca3ddcacc3a23cc1bcbbddcdc2cbd3cbbccdddWba4ccbbd4cabW4cc4aWd33c4ac4acadd2cdcbba4c4cb222bWdabc44dbcddccaddadd1cd34dbbc432b1WaWad3dbdcdbcb4b4acbb34b4Wbda2dcccbcaca4W4da3c4dd4d1ac443d3dccbdbbca234ccabbd4ac3cab2bc4d',
			'111adcc3WW1dbdbaaa1ccacddbdda3aWaccbdbdbdbd2d13bc4c3cbdWcb3bbb2bb3a4ccbc4adbdcacbdW3dccb3c3Wdaaaddb4W4bWda22Wbd4d33Wc2cd4W4a41bcccaaab1da3a4adaaccbacb1bdcacWad2cab1d4c4cdbc4d33dbcaW2Wcaac4bbcccdaadacd33cab2d1da3d234b3ccbdbdbcW1dcdddbdadb4bcabaaWbdd2aWddW2Wb4babc4c34cd3ddacbbc32caacb2ca4caddd3bacbaddadad4adb42dd4cbccd3Wacac42dcbddbbdbcba4acWbaWdca31cc2cabWbccdb4ccbcdcb32bbabcbbb2a4bbadbbadbc144abc4bdbdcdbb444d2abcdaa1d1cbc2a4Wdbc32db3bbccddWba2ddc34bWcac3ccdcbbc3b2abdddb4dccd3cbbb2bdaa4da4c3bdadcaad2aaa4d3cd',
			'111dda31WW12a4bd4Wddccbd4c41dc4cadcWbcababbdcdcba43dcbcabb244WbabcbW2d3cbbba3ba3c4ad4cab3cacbda4ddcc3dc4c3acc2dabd3cdbbacdb3caccdc33bb4bbacabaccd31cW42dddca2cbbb32b3adbccWcc2dcWccad3bbdb4bba3d334dcaddddcd1abacacc2bd3bd3acbb3a3ba4adab3dd31d4Wa1c14dcbca3db2dccdd3cdbb1Wbcabb3aca3bd4a322abccad3ccbc1cddcbb43cabWbcdb3abaac2ddcaddbccWcb3cdWW4bbcdbadc32443bdccdab34ddaaacabdcdaa2c2ab3abWab344cacb4c4cWbd4cb3d41dbd224abacbabb24b4bacccWb4ccd4ddcbcac1a4c2dcbdacacdbd4W12bWbbcacWcdW2dWdbcbdcddacbbWa4cW2a33b4Wada4b3b444add',
		],
		// backdraftgame <- math/games/piggy_firefighters/reels/BRB.csv (tools/reels/make_padding.py)
		backdraftgame: [
			'111da4c24addcbad3dcdcbac42dd4dcbd4ad24c2a2daa3cdab3bb2d1acbaabacccaab2aaadbdda2dcaca4cac2d3bcd3dcad3bad3bbdadd24accd3adddccb2abdbc4a3d1c4dbc3dddbd3ba2b2daa3aabcabbbdb4bdb34b4dbba4babdcddac3b33da4444aaaca3bbbd4db344adacc1b34cc32dad4cc2add2bccbdc2bdaabc4bbb3a4dacbad23ac3d4ababddadacaa3ccabb24bcbd4da1c4abcd4da4dbc23d43d4adbcbbcd44bdd3dc3d4b4bcdb44bc43d21dcb3cbdcd2db3bb244cdddc4b4d4dbd432cbcd342b4dbcccd2ccb43dbbcdbcdbddbdbdbc2dadb4b3dacd4cbdacaa4a43dab3bdcdbd3c3a4d4abc4dcadbdcd4acd3aca334cc4bbc41cbd4db4b3dadbbc',
			'1114db324b44d4a4accdddc3W44a1bbdc4bc1caccabb4cdc33bababa14bccaa44d1addcdbdaaWddcbcc3344c4addcb4b4cda3c433c4c3cbdccc4a4c2ac4ad2a43dcbbad4b41abcba3caa2c2aaa4ddccac2db44adcca2bcbb4b4c4ab3dd3bd4cb23cdcbcc2cb24bba4d2d2baa3bcd3dc4ccddbb3bd3ba443a1aabab3b4a1db4bb4bdca3c4cdaab1b2acW3badbccdcd2ac3a32dbbcb41db2dd2d1b4d2b342c44adca4bbd43ba1ac4a2b22c23bc31ab3ddb2dbda1d41bb3bcb3caacWbcbc3ccdbaddcab24bcc4dbbca43cd3cdcb14ad3abaabd42c3W1b3dbc4abdb2bc4dbdc43cdca4d1dcadbac4cb34d4bdca3dc4cb4bcc33bdda444baba3dda4b4433cd2c3a224',
			'111bc4dddaabbacaacc1dddbddda24b3dbaadcadcadd434c33a33dcada344b21ab3bbbcc4c1bWcacdc4bc12acdc3adacbbbc2d4dc4dbcb4dbcbcdacddc3cW33cc13cddcdba4cd33bdcadbccc3cbd21a4cb32dd2caddcbbdabad21a4bcdd2ab3abcb234ccdbc244d4b3a43bc3ad44bd3ca3bbad4cc2ddaaa2cd4d3daac3ca3cdbcccc12baddb42ccbadbbdc2cb3dadabcbcc4d2abdcdaa442bd4dbdcbcaaabbdbc12ddcbbda4addccc3ac3bb3cabbd44cdccddc4aacc32adc4c4bba4bc2dab4db3dc4add2242Wa34dcb1abb2c3cc32a4dccad33Wcdb34dccbbabWacd4c3ccdbadbcd4d42abc32cdacdcccdddbb4a2c2bcccccbdddbdc4acdc4babdc2c4c4a2dbc',
			'111bcbc4ccbbdddbaWdbdbabab4daa2aca1aba1cb3d4bbc2abdaa4ddc3ac2ddd4cd1cc3ccbcdad4bddbb4d4cbacacd4bd4dcd2a3cddbdbb4c4cbcdd3b424bdcccbddbdbcabdd4acd42dc4a42dcaabadbdcb4ccbcc44abd4c23acccaad4a4a22dbd4b44d42bbc42b3c4d3caadb13d143cbd3dca3aab43bda4a3cad4ccdbddc32abca3b441cd1cddddbbbcccbaac3abcccc132aac4d42cd3bab34c3cdcabbaa423cddbacdcc2bd2dcd2a34ccd3abd2cbdccd4b4d444b2cdcaa44d4ddbcb12ccdWd3b3aa4dabaddacca412dbbba4cc4dbdcabbcddcWa13bdb2a4bc3c4a3ccdb3adcdcW323bbdd3c33aaa3bdaadb3da4d344acc4ddaacacccdd4W3da4c24db4adbc3',
			'1112d4bbbcb3cdb4d2d4cacabdbbbbcbbccabdbaW32bdc2db1aac24b4Wccb32b2d4cdddaaacdbcdb4dcc3c3dddabbb3cc23c1c4dc44b4d2bbcb3cc3ccd4b2b4cdacdcbadacaabd24cab43baccdd1acaacdbaaaddc23dda4ccabbd2d4accab3abbcbca4ba4db3cccdab3b4dda223cd3aacaa3bWddc2ddcb2b1d14bbbcc3a2b2ccac2c4b2cc42bccdbWbccdcad34bbdd3a3dddb4cbbdccddd43bbabbab2cd3cdc3dcb44dba2a14bbcccb4bbacd33cdaab123dbabddbaddd2223cdbb4dacadad4ab3bbd2ab3b4bacbccabdda34d34aa4d4d1dc3dabc4dbac4d3babbcWcc4adbd3ab3bcddacacc3cb43bcc2a4c2bbd1bdc3cbbdd3c2accca3ddacc4cacddcd4c2bdc',
		],
		// infernogame <- math/games/piggy_firefighters/reels/FRI.csv (tools/reels/make_padding.py)
		infernogame: [
			'111aabadWW1bbbcdbaca43bbdad1ccWdWbba43d2132cbdabaccdcdcb3a2acacc3bbac1d41bbdddddd3dacb2cad4aWb33dc1cbada4db33d3aabbda1db4abcb4c44bb3bbabcc44c4Wb1cdacca3cbd4cdbddW2c4c4Wdadbaaccbd1d23dbdc4ddd3babcbac3ca2dWd4bdabd32b1cbaa4d4da2cdWWabd2ad2ca34d4cca12bbdcadbbddbbdc3aa2bdb3abdd1dc3dbb2bbddbba232dd43abddcacbdWddcc3da33343a3dd1cdcdadc3bd2cb4Wdab33acca3d1dccacbdbcbcdbdbc4dccaacaaa4b43dd3cadcddcba4dcbbda2bc414bcdWc3d4ccbbdbbb41WcadacbdbcWdabdbc3cdbaac32cabbacaadbaacdcba413ada4d4cdb3cdcdcb3aa4dabbcb413cda23c3d2cc23bb',
			'111b3c34WW1d3dcb4adW2cacc1badbddbddc2add24d4ba4abd4cc4d2b2ccbdac32W44abc4dbbdc2dddaWddbbada24bW13443acc2ac3bcbdW3a3cdbW3dbbdadb3a2cd3d3dcb3db4b3dbb2daab3accd4bd2aa331abcdcWadcd4bbccWdddaa3dcd22bdb4a1ac1adc3bdacad2dab1ad43aaca3bada44cbadd4dabb3baa2adbW31b34dbcb2cda3cddbWda1ad3da4cbc434abd43c3aabbdbddbb1bbbbd32cc4a3ddbbcWbcdcdaac4c4dcdabaac2c1cdbWbac23cbdc443a4dbadc4ac1dc141caad4db4b4c4b44b1ad4cbdcaab4d4acabbcccdcd3dd3c2db31cadcW32a42badbdacabaabbd2cdb431a34ddcaadadcacbbdc3dcb13c41abcccd4cWbbdbb422cddb3244a4c',
			'111dbbbdWW12bcca3b3aadbd2bab3cd3bcdb23baaaabb3abcadbbdbW333Wbccbab2cda1bd3aab3WWcabc4ddbdd3cdc4daWddcbdb3ddbdcb234d32W4b3d1ddccd4cccbd4W31bdb4d4dcc3d3abb1bdcc4c1dbdabbdc2bc2dbcbb4d3ddbacdbdcdddbaabcaaabdbacbbaaca2bcbd3cacbcbd3ba1ac4daaaaa4caWacc4b2baadbbdcacWb14bd4W33ba3cb43b33abdcdcddb42ba2bacd2b324b3ccccad34ddcbdb32ddccaac234ddcbbdWbdda114a2aa43Wc3bddd41bccbaa1bbddcaaaa2dbbbbaWacd4aaccaabda3bcbdbWcbcacacda32cdb3cb4dc2cddac4bc3cb3bdad3ddcd4ddddacccd3bbba3b4ba34baadcdd4db24c23d2c34badac2d32ccd44db4bdbdbac3d',
			'111cdd1dWW1baa3dca4d33b3ddbcbdbW4a3ddd4bcabadbccdd1abWa1dbbc3dda2c4344bdabdcbdb3bbbddb1db323ddaaccdbbcc2aba2a4d4adcbabdb4aaaaddabcca2dcbba2b3ad2bdcddccdcdbW3bcb43bb3b3dad3baccacc4bccd3dba2aacba3dd1b3cbabd44acd3cddWc3bada2WbdddbWbc3a1ac3d34Wab3dadda34dcacbc4babd1bbac3c4c1b4adbbcab2cWd3bc2dabbccaa2d2bccba4cccdb2d4dbac2a3cdc21aba44c23a22ccddWb2bccdaacdcbabacabb42c3bcc3a3bcc2ddbc33da3b4bdcc2bbcacadcbdbb4abbbcc4ddddcc3babbd3cccbcc1dbcdbddcbc4baac4c1abc44ad111cd42a3Wd33b3cd4dcadccaadcb4Wbcb4d3dd2WdWb3d2cdbbWcdcda',
			'1113dca4WW1ddc4aa32bc4bcb1bbccdc44a3cW34c1a3ddddcbcbb3bcdcbdb4dcbda3342bcbc4caaddbd3ccdc23cdabd23cb3dWb3dadbabd4a4cdddadabcaadWbb3cabddWcca4c4bdd2cb4dcbdcbdd3dc2aadacbbbbdb234abcbcabdddcb3adc3bbb4b2cdd4bcbcbbd34da3c4c44dc3cacccaaab3bc4cdbad4d4cb1add33a2dcc3cd3c2dbab2bbabb4dbdbdb4ddad4bbacdW32bWdcbb3dbccaa4bdcccbabbccccdaddcd2bcc4bbdada1ca3cd2cb1b3cddcdaab22a42Wda2dbd4Wbcabbdc2W3ac43ccbaabdaba4cc4db444dba3d4c4b32caccbdac4dbdb324WdcdWdc33Wcc2aadbb32dcbddb2da333accd3413d2ca1d4abadbdbbbWad4dWd1ddddd3ccb34cbcd4d',
		],
	},
} as const;
