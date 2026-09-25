/**
 * LUCKY rules sheet content for the studio HUD.
 *
 * Mechanics: docs/GAME_CONTRACT.md §1–7 (donor, still true) as amended for LUCKY (25,000x cap, the ninth mode
 * `golden_four`: docs/coordination/codex-math-core.md). Names: docs/LUCKY_THEME.md §3–§5, through game/names.ts.
 * Every figure is read from `config` (paytable, mode costs, max win), from game/prizes.ts (door tables PER MODE),
 * or is a frequency in MEASURED below, measured on Codex's LUCKY production books.
 *
 * Wording comes in two variants. Social casinos (Stake.US) may not show cash vocabulary, so each
 * sentence is written once as `std` and once as `social`; the social text never says bet, pay, buy,
 * purchase, cost, wager, cash or credit. Player copy never uses the word "jackpot" (contract §4).
 */
import type { RulesSection, RulesBlock, PayRow } from '@crashgalaxy/hud';
import { stateConfig, stateUrlDerived } from 'state-shared';

import config from './config';
import generatedConfig from './generatedConfig';
import { isSweepsWallet } from './socialFloor';
import { FEATURE, MECHANIC, MODE_TITLE, SYMBOL_NAME, TIER_NAME } from './names';
import { prizesFor, fmtX, fmtValues } from './prizes';

/** Live general-disclaimer text; re-verify against the platform's template at every submission.
 *  The platform is "Engine" in player copy (renamed 2026-09-07), never the older two-word name. */
export const generalDisclaimer = {
	std: 'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',
	social:
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',
} as const;

/**
 * FREQUENCIES — MEASURED on LUCKY's production books (1,000,000 per mode, 25,000x cap), Codex publisher PASS
 * 2026-09-23. Source: docs/coordination/codex-final-math-copy.md (raw values from
 * math/reports/lucky-production-20260923/publication.log; LUT-weighted, measure.py). Each line names its JSON field and
 * the raw value; the display is the handoff's rounding. Base / ordinary-Ante scope unless the key says otherwise
 * (Dragon Ante has its own figures, e.g. a breath completes 80.5% there — never reuse the 45% for it).
 * Re-measure and update whenever the books are regenerated.
 */
export const MEASURED = {
	holdBase: '1 in 270', // measured: base hold_1_in = 270
	holdAnte: '1 in 54', // measured: ante hold_1_in = 54
	goldenBase: '1 in 13,000', // measured: base gold_1_in = 13000
	goldenAnte: '1 in 2,600', // measured: ante gold_1_in = 2600
	gustBase: '1 in 274', // measured: base gust_1_in = 274
	gustAnte: '1 in 55', // measured: ante gust_1_in = 55
	gustCompletes: '45%', // measured: base 0.4528 / ante 0.4521 gust_trigger_share (share of rounds WITH a breath)
	deliveryBase: '1 in 1,251', // measured: base delivery_1_in = 1251
	deliveryAnte: '1 in 252', // measured: ante delivery_1_in = 252
	// contract 7.6: lanterns land in groups
	hatGroupBase: '1 in 21', // measured: base hat_counts.four_five_1_in = 21.06
	hatGroupAnte: '1 in 7.5', // measured: ante hat_counts.four_five_1_in = 7.51
	rtp: '96.70%', // measured: all nine modes rtp = 0.967 (cost-normalised); printed to 2 dp (seat A roster item 22)
	// Fortune or Bust (100x): 4% / 1% / 10% are owner-fixed routes; the other two are solver-pinned.
	bobGolden: '10%', // measured: build_or_bust outcome_share.goldenBuild = 0.1 (of ALL rounds)
	bobHold: '55%', // measured: build_or_bust outcome_share.holdAndBuild = 0.55
	bobExpanded: '4%', // measured: build_or_bust outcome_share.expandedHoldAndBuild = 0.04
	bobGoldenExpanded: '1%', // measured: build_or_bust outcome_share.goldenExpanded = 0.01
	bobBust: '30%', // measured: build_or_bust outcome_share.bust = 0.3
	boards: '2 districts 60%, 3 districts 30%, 4 districts 10%', // measured: expanded_hold_and_build expanded.board_share 0.6 / 0.3 / 0.1 (NOT for the direct Golden buys: 2 and 4 fixed)
	// Dragon Ante (super_ante) — its own measured figures (codex-final-math-copy.md, "SuperAnte additions"); the
	// 25x / 10x chance multipliers stay the generator pins stated in BET MODES, never re-derived from these.
	holdSuperAnte: '1 in 11', // measured: super_ante hold_1_in = 11
	goldenSuperAnte: '1 in 1,300', // measured: super_ante gold_1_in = 1300
	gustSuperAnte: '1 in 20', // measured: super_ante gust_1_in = 20
	gustCompletesSuperAnte: '80.5%', // measured: super_ante gust_trigger_share = 0.805
	deliverySuperAnte: '1 in 52', // measured: super_ante delivery_1_in = 52
	hatGroupSuperAnte: '1 in 6', // measured: super_ante hat_counts.four_five_1_in = 6.04
} as const;

/** Launch flag, the jurisdiction answer, or a sweeps wallet — any one turns social wording on. The
 *  same floor raises the HUD's own strings (game/socialFloor.ts), so the two never disagree. */
export const isSocial = (): boolean =>
	stateUrlDerived.social() || stateConfig.jurisdiction.socialCasino || isSweepsWallet();

type Entry = { std: string; social: string };

const PAY_SYMBOLS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3'];

const payRow = (symbol: string): PayRow => {
	const symbols = config.symbols as unknown as Record<
		string,
		{ paytable: ReadonlyArray<Readonly<Record<string, number>>> | null }
	>;
	const entries = symbols[symbol].paytable ?? [];
	// contract stores 3/4/5 ascending; the grid reads best-first.
	const tiers: [string, string][] = [...entries]
		.map((e) => Object.entries(e)[0] as [string, number])
		.sort((a, b) => Number(b[0]) - Number(a[0]))
		.map(([count, value]) => [count, `${value}×`] as [string, string]);
	return { symbol, tiers };
};

const modeCost = (key: string): number => {
	const modes = generatedConfig.betModes as unknown as Record<string, { costMultiplier?: number; cost?: number }>;
	const m = modes[key] ?? modes[key.toUpperCase()];
	return Number(m?.costMultiplier ?? m?.cost ?? 0);
};

/** The one maximum win, read from the mode table (25,000x in every mode). */
const maxWinText = (): string => fmtX(Number(config.betModes.base.max_win));

export const rulesSections = (): RulesSection[] => {
	const social = isSocial();
	const t = (e: Entry) => (social ? e.social : e.std);
	const unit = social ? 'play' : 'bet';
	const full = prizesFor('base');
	const four = prizesFor('golden_four');
	const tier = (n: number) => `Tier ${n} ${TIER_NAME[n]}`;

	const howTo: RulesSection = {
		id: 'how_to_play',
		title: 'HOW TO PLAY',
		blocks: [
			{
				kind: 'para',
				text: t({
					std: 'Choose your bet with the − and + buttons, then press the spin button. Space also spins. Every win is a multiple of the base bet.',
					social: 'Choose your play amount with the − and + buttons, then press the spin button. Space also spins. Every win is a multiple of the base play amount.',
				}),
			},
			{
				kind: 'para',
				text: 'The speed button cycles normal speed, Turbo and Super Turbo. Autoplay plays the number of rounds you confirm and can be stopped at any time. The menu holds sound, music and these rules. Press during a win count to skip to the total.',
			},
			{
				kind: 'para',
				text: t({
					std: `The ante chip switches ${FEATURE.ante} or ${FEATURE.superAnte} on and off. GET BONUS opens the feature cards. Every feature purchase asks for confirmation first.`,
					social: `The ante chip switches ${FEATURE.ante} or ${FEATURE.superAnte} on and off. PLAY FEATURE opens the feature cards. Every feature entry asks for confirmation first.`,
				}),
			},
		] as RulesBlock[],
	};

	const symbols: RulesSection = {
		id: 'symbols',
		title: t({ std: 'SYMBOLS & PAYS', social: 'SYMBOLS & WINS' }),
		blocks: [
			{
				kind: 'para',
				text: t({
					std: 'LUCKY pays 243 ways on 5 reels and 3 rows. Matching symbols pay left to right on adjacent reels starting from the leftmost reel, three or more of a kind. Pays are multiples of the base bet; the numbers below are for 5, 4 and 3 of a kind. Wins on different ways are added together.',
					social: 'LUCKY has 243 ways to win on 5 reels and 3 rows. Matching symbols win left to right on adjacent reels starting from the leftmost reel, three or more of a kind. Wins are multiples of the base play amount; the numbers below are for 5, 4 and 3 of a kind. Wins on different ways are added together.',
				}),
			},
			{
				kind: 'para',
				text: `From highest to lowest: ${PAY_SYMBOLS.map((id) => SYMBOL_NAME[id]).join(', ')}.`,
			},
			{ kind: 'pays', rows: PAY_SYMBOLS.map(payRow) },
			{
				kind: 'specials',
				items: [
					{ symbol: 'W', label: `WILD (${SYMBOL_NAME.W} with his WILD banner) appears on reels 2, 3 and 4 and substitutes for every symbol in the table above. It does not substitute for lanterns and never counts toward a feature.` },
					{
						symbol: 'HAT',
						label: t({
							std: `${SYMBOL_NAME.HAT.toUpperCase()} pays nothing on its own. Lanterns tend to land in groups: 6 or more anywhere on one spin start ${FEATURE.holdAndBuild}.`,
							social: `${SYMBOL_NAME.HAT.toUpperCase()} has no win of its own. Lanterns tend to land in groups: 6 or more anywhere on one spin start ${FEATURE.holdAndBuild}.`,
						}),
					},
					{ symbol: 'GHAT', label: `${SYMBOL_NAME.GHAT.toUpperCase()} counts as a red lantern. If at least one of the 6 or more triggering lanterns is a Golden Lantern, ${FEATURE.goldenBuild} starts instead of ${FEATURE.holdAndBuild}.` },
				],
			},
		] as RulesBlock[],
	};

	const baseFeatures: RulesSection = {
		id: 'base_features',
		title: 'STREET EVENTS',
		blocks: [
			{ kind: 'heading', text: MECHANIC.gust.toUpperCase() },
			{
				kind: 'para',
				text: `On a base, ${FEATURE.ante} or ${FEATURE.superAnte} spin that stops with 3, 4 or 5 red lanterns, the Golden Dragon may breathe 1 to 3 extra lanterns onto the board. Ways wins are counted first, on the board as the reels left it. If the lanterns then total 6 or more, the feature starts. About ${MEASURED.gustCompletes} of breaths complete a trigger in the base game and with ${FEATURE.ante} (about ${MEASURED.gustCompletesSuperAnte} with ${FEATURE.superAnte}). ${MECHANIC.gust} happens about ${MEASURED.gustBase} spins (${MEASURED.gustAnte} with ${FEATURE.ante}, ${MEASURED.gustSuperAnte} with ${FEATURE.superAnte}).`,
			},
			{ kind: 'heading', text: MECHANIC.delivery.toUpperCase() },
			{
				kind: 'para',
				text: `When the ${MECHANIC.delivery} is called as the reels start, that spin is certain to start a feature. After the reels stop the cart arrives over the board and unloads lanterns so the board holds 6 to 9 lanterns. A Golden Lantern in the cart starts ${FEATURE.goldenBuild}. The ${MECHANIC.delivery} comes about ${MEASURED.deliveryBase} spins (${MEASURED.deliveryAnte} with ${FEATURE.ante}, ${MEASURED.deliverySuperAnte} with ${FEATURE.superAnte}).`,
			},
			{
				kind: 'note',
				text: `${FEATURE.holdAndBuild} triggers about ${MEASURED.holdBase} spins (${MEASURED.holdAnte} with ${FEATURE.ante}, ${MEASURED.holdSuperAnte} with ${FEATURE.superAnte}) and ${FEATURE.goldenBuild} about ${MEASURED.goldenBase} spins (${MEASURED.goldenAnte} with ${FEATURE.ante}, ${MEASURED.goldenSuperAnte} with ${FEATURE.superAnte}), counting every route: reels, ${MECHANIC.gust} and ${MECHANIC.delivery}. Lanterns land in groups: a group of 4 or 5 lanterns shows about ${MEASURED.hatGroupBase} spins (${MEASURED.hatGroupAnte} with ${FEATURE.ante}, ${MEASURED.hatGroupSuperAnte} with ${FEATURE.superAnte}), and a single lantern on its own is rare.`,
			},
		] as RulesBlock[],
	};

	const hold: RulesSection = {
		id: 'hold_and_build',
		title: MODE_TITLE.hold_and_build,
		blocks: [
			{
				kind: 'para',
				text: t({
					std: `Every triggering lantern becomes a ${tier(1)} on its own cell, and any ways win on the trigger spin is paid as usual. The feature starts with 6 spins on the same 15 cells.`,
					social: `Every triggering lantern becomes a ${tier(1)} on its own cell, and any ways win on the trigger spin is awarded as usual. The feature starts with 6 spins on the same 15 cells.`,
				}),
			},
			{
				kind: 'para',
				text: `On every spin each cell may catch a red lantern. A lantern on an empty cell builds a new Tier 1 building. A lantern on a building upgrades that building by one tier. A lantern on a ${tier(5)} cannot upgrade it, but still counts as a landed lantern.`,
			},
			{
				kind: 'accentStack',
				texts: [1, 2, 3, 4, 5].map((n) => `Tier ${n} — ${TIER_NAME[n]}`),
			},
			{
				kind: 'para',
				// math/games/lucky/game_executables.py (_play_board): `while spins_left > 0 and len(houses) < len(cells)` —
				// a board ends when its spins run out OR all 15 cells are built (Codex copy audit, 2026-09-23)
				text: `When 2 or more lanterns land on one spin, a ${MECHANIC.luckySpin} adds +1 spin (never more than +1 per spin). Buildings never move or disappear. The feature ends when the spins run out or when all 15 cells hold a building, whichever comes first.`,
			},
			{ kind: 'heading', text: 'DOORS' },
			{
				kind: 'para',
				text: t({
					std: 'When the feature ends every building opens its door on one prize from its final tier, as a multiple of the base bet:',
					social: 'When the feature ends every building opens its door on one prize from its final tier, as a multiple of the base play amount:',
				}),
			},
			// Every value a door can open on, per tier (approval guideline: list all obtainable values of a prize
			// symbol). Award rows are single-line in the HUD sheet; the six-value lists are checked at phone width.
			...full.tiers.map((values, i) => ({ kind: 'award', label: `TIER ${i + 1}`, text: fmtValues(values) })),
			{
				kind: 'para',
				text: 'Instead of its ordinary prize, a Tier 3 door can hold a MINOR, MAJOR or GRAND prize, and a Tier 4 or Tier 5 door can hold a MAJOR or GRAND prize.',
			},
			{ kind: 'heading', text: 'FIXED PRIZES' },
			{ kind: 'award', label: 'MINOR', text: `${fmtX(full.minor)} ${unit}` },
			{ kind: 'award', label: 'MAJOR', text: `${fmtX(full.major)} ${unit}` },
			{ kind: 'award', label: 'GRAND', text: `${fmtX(full.grand)} ${unit}` },
			{
				kind: 'note',
				text: `A MINOR, MAJOR or GRAND prize replaces that door’s ordinary prize. MINOR appears only behind Tier 3 doors. At most one GRAND prize per board. Higher tiers hold the fixed prizes more often. These are the figures in every mode except ${MODE_TITLE.golden_four}, whose doors are worth half (see ${MODE_TITLE.expanded_hold_and_build}).`,
			},
			{ kind: 'heading', text: MECHANIC.street.toUpperCase() },
			{
				kind: 'para',
				text: t({
					std: `A horizontal row whose five cells all hold a building is a ${MECHANIC.street}: every door in that row pays ×2, fixed prizes included.`,
					social: `A horizontal row whose five cells all hold a building is a ${MECHANIC.street}: every door in that row is worth ×2, fixed prizes included.`,
				}),
			},
			{ kind: 'heading', text: MECHANIC.festival.toUpperCase() },
			{
				kind: 'para',
				text: `If all 15 cells hold a building when the feature ends, the ${MECHANIC.festival} multiplies the total of every door, after any ${MECHANIC.street}, by ×10.`,
			},
		] as RulesBlock[],
	};

	const golden: RulesSection = {
		id: 'golden_build',
		title: MODE_TITLE.golden_build,
		blocks: [
			{
				kind: 'para',
				text: `${FEATURE.goldenBuild} follows the ${FEATURE.holdAndBuild} rules with these differences:`,
			},
			{
				kind: 'accentStack',
				texts: [
					'Starting buildings each begin at Tier 3, 4 or 5',
					`A lantern on an empty cell builds a ${tier(3)}`,
					`Some lanterns are GOLDEN: +2 tiers, or a ${tier(4)} on an empty cell`,
				],
			},
			{
				kind: 'para',
				text: t({
					std: `A golden lantern counts as one landed lantern for the ${MECHANIC.luckySpin}. ${FEATURE.goldenBuild} starts from the base game when a Golden Lantern is among the triggering lanterns, from ${FEATURE.buildOrBust}, or by buying it. Doors, fixed prizes, ${MECHANIC.street} and ${MECHANIC.festival} work exactly as in ${FEATURE.holdAndBuild}.`,
					social: `A golden lantern counts as one landed lantern for the ${MECHANIC.luckySpin}. ${FEATURE.goldenBuild} starts from the base game when a Golden Lantern is among the triggering lanterns, from ${FEATURE.buildOrBust}, or by entering it directly. Doors, fixed prizes, ${MECHANIC.street} and ${MECHANIC.festival} work exactly as in ${FEATURE.holdAndBuild}.`,
				}),
			},
		] as RulesBlock[],
	};

	const expanded: RulesSection = {
		id: 'expanded',
		title: MODE_TITLE.expanded_hold_and_build,
		blocks: [
			{
				kind: 'para',
				text: `The city grows into 2, 3 or 4 districts at once (${MEASURED.boards}). Every district is its own complete ${FEATURE.holdAndBuild} board: its own starting buildings, its own 6 spins, its own ${MECHANIC.luckySpin} when 2 or more lanterns land on that district, its own doors, its own ${MECHANIC.street} and its own ${MECHANIC.festival}. The ${MECHANIC.decree} at the start of the round shows how many districts open.`,
			},
			{
				kind: 'para',
				text: 'All districts spin together. A district finishes when its spins run out or when all 15 of its cells hold a building, and then waits while the others continue. The feature ends when every district has finished; the round total is the sum of all districts.',
			},
			{
				kind: 'para',
				text: t({
					std: `${MODE_TITLE.expanded_golden_build} plays the same way with ${FEATURE.goldenBuild} districts. It is awarded by ${FEATURE.buildOrBust} (2, 3 or 4 districts), or entered directly for ${modeCost('expanded_golden_build')}× bet (always 2 districts).`,
					social: `${MODE_TITLE.expanded_golden_build} plays the same way with ${FEATURE.goldenBuild} districts. It is awarded by ${FEATURE.buildOrBust} (2, 3 or 4 districts), or entered directly for ${modeCost('expanded_golden_build')}× play amount (always 2 districts).`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.golden_four },
			{
				kind: 'para',
				text: t({
					std: `Entered directly for ${modeCost('golden_four')}× bet, it always opens 4 ${FEATURE.goldenBuild} districts. Every door in this mode is worth half the ${FEATURE.holdAndBuild} figure:`,
					social: `Entered directly for ${modeCost('golden_four')}× play amount, it always opens 4 ${FEATURE.goldenBuild} districts. Every door in this mode is worth half the ${FEATURE.holdAndBuild} figure:`,
				}),
			},
			// Golden boards start at Tier 3: only Tiers 3-5 are obtainable here (game/prizes.ts FIRST_TIER).
			...four.tiers
				.map((values, i) => ({ kind: 'award', label: `TIER ${i + 1}`, text: fmtValues(values) }))
				.slice(four.firstTier - 1),
			{ kind: 'award', label: 'MINOR', text: `${fmtX(four.minor)} ${unit}` },
			{ kind: 'award', label: 'MAJOR', text: `${fmtX(four.major)} ${unit}` },
			{ kind: 'award', label: 'GRAND', text: `${fmtX(four.grand)} ${unit}` },
			{
				kind: 'note',
				text: `${MECHANIC.street} ×2 and ${MECHANIC.festival} ×10 work as everywhere else, on those figures.`,
			},
		] as RulesBlock[],
	};

	const modes: RulesSection = {
		id: 'modes',
		title: t({ std: 'BET MODES', social: 'PLAY MODES' }),
		blocks: [
			{ kind: 'heading', text: MODE_TITLE.ante },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('ante')}× bet per spin. 5× the chance to trigger ${FEATURE.holdAndBuild} and 5× the chance to trigger ${FEATURE.goldenBuild}. Wins remain multiples of the base bet. A toggle: switch it off between rounds at any time.`,
					social: `${modeCost('ante')}× play amount per spin. 5× the chance to trigger ${FEATURE.holdAndBuild} and 5× the chance to trigger ${FEATURE.goldenBuild}. Wins remain multiples of the base play amount. A toggle: switch it off between rounds at any time.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.super_ante },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('super_ante')}× bet per spin. 25× the chance to trigger ${FEATURE.holdAndBuild} and 10× the chance to trigger ${FEATURE.goldenBuild}. Wins remain multiples of the base bet. A toggle: switch it off between rounds at any time. ${FEATURE.ante} and ${FEATURE.superAnte} cannot be on together.`,
					social: `${modeCost('super_ante')}× play amount per spin. 25× the chance to trigger ${FEATURE.holdAndBuild} and 10× the chance to trigger ${FEATURE.goldenBuild}. Wins remain multiples of the base play amount. A toggle: switch it off between rounds at any time. ${FEATURE.ante} and ${FEATURE.superAnte} cannot be on together.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.build_or_bust },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('build_or_bust')}× bet. One card is turned: ${MEASURED.bobHold} ${FEATURE.holdAndBuild}, ${MEASURED.bobGolden} ${FEATURE.goldenBuild}, ${MEASURED.bobExpanded} ${FEATURE.expandedHoldAndBuild}, ${MEASURED.bobGoldenExpanded} ${FEATURE.goldenExpanded}, ${MEASURED.bobBust} no feature. The no-feature card pays nothing.`,
					social: `${modeCost('build_or_bust')}× play amount. One card is turned: ${MEASURED.bobHold} ${FEATURE.holdAndBuild}, ${MEASURED.bobGolden} ${FEATURE.goldenBuild}, ${MEASURED.bobExpanded} ${FEATURE.expandedHoldAndBuild}, ${MEASURED.bobGoldenExpanded} ${FEATURE.goldenExpanded}, ${MEASURED.bobBust} no feature. The no-feature card wins nothing.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.hold_and_build },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('hold_and_build')}× bet. Starts ${FEATURE.holdAndBuild} directly with 6 to 9 Tier 1 buildings.`,
					social: `${modeCost('hold_and_build')}× play amount. Starts ${FEATURE.holdAndBuild} directly with 6 to 9 Tier 1 buildings.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.expanded_hold_and_build },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('expanded_hold_and_build')}× bet. Starts ${FEATURE.expandedHoldAndBuild} directly with 2, 3 or 4 districts.`,
					social: `${modeCost('expanded_hold_and_build')}× play amount. Starts ${FEATURE.expandedHoldAndBuild} directly with 2, 3 or 4 districts.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.golden_build },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('golden_build')}× bet. Starts ${FEATURE.goldenBuild} directly with 6 to 9 buildings of Tier 3 or higher.`,
					social: `${modeCost('golden_build')}× play amount. Starts ${FEATURE.goldenBuild} directly with 6 to 9 buildings of Tier 3 or higher.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.expanded_golden_build },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('expanded_golden_build')}× bet. Starts ${FEATURE.goldenExpanded} directly and always with 2 ${FEATURE.goldenBuild} districts.`,
					social: `${modeCost('expanded_golden_build')}× play amount. Starts ${FEATURE.goldenExpanded} directly and always with 2 ${FEATURE.goldenBuild} districts.`,
				}),
			},
			{ kind: 'heading', text: MODE_TITLE.golden_four },
			{
				kind: 'para',
				text: t({
					std: `${modeCost('golden_four')}× bet. Starts ${FEATURE.goldenExpanded} directly and always with 4 ${FEATURE.goldenBuild} districts, every door at half value (MINOR ${fmtX(four.minor)}, MAJOR ${fmtX(four.major)}, GRAND ${fmtX(four.grand)}).`,
					social: `${modeCost('golden_four')}× play amount. Starts ${FEATURE.goldenExpanded} directly and always with 4 ${FEATURE.goldenBuild} districts, every door at half value (MINOR ${fmtX(four.minor)}, MAJOR ${fmtX(four.major)}, GRAND ${fmtX(four.grand)}).`,
				}),
			},
			{
				kind: 'note',
				text: `A feature started from ${FEATURE.buildOrBust} follows exactly the same rules as the same feature entered directly.`,
			},
		] as RulesBlock[],
	};

	const everyMode = `base game, ${FEATURE.ante}, ${FEATURE.superAnte}, ${FEATURE.holdAndBuild}, ${FEATURE.buildOrBust}, ${FEATURE.expandedHoldAndBuild}, ${FEATURE.goldenBuild}, ${FEATURE.goldenExpanded} and ${FEATURE.goldenFour}`;
	const limits: RulesSection = {
		id: 'limits',
		title: 'RETURN & MAXIMUM WIN',
		blocks: [
			{
				kind: 'para',
				text: `The theoretical return to player (RTP) is ${MEASURED.rtp} in every mode: ${everyMode}.`,
			},
			{
				kind: 'accent',
				// "reached only with a Grand Festival": confirmed on the production books — the semantic gate
				// (math/reports/lucky-production-20260923/semantic.log) reports capped == cap->grandOpening == cap->wincap
				// in every one of the nine modes (e.g. base 500 / 500 / 500), and contract §8 rejects any other capped round.
				text: t({
					std: `Maximum win: ${maxWinText()} the base bet, in every mode. It is reached only with a ${MECHANIC.festival} (all 15 buildings standing on one board). A round that reaches the maximum ends there and pays ${maxWinText()}.`,
					social: `Maximum win: ${maxWinText()} the base play amount, in every mode. It is reached only with a ${MECHANIC.festival} (all 15 buildings standing on one board). A round that reaches the maximum ends there and awards ${maxWinText()}.`,
				}),
			},
		] as RulesBlock[],
	};

	const general: RulesSection = {
		id: 'general',
		title: 'GENERAL INFORMATION',
		blocks: [{ kind: 'para', text: t(generalDisclaimer) }] as RulesBlock[],
	};

	return [howTo, symbols, baseFeatures, hold, golden, expanded, modes, limits, general];
};
