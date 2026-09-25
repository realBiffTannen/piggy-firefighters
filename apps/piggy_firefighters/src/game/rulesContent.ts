/**
 * PIGGY FIREFIGHTERS rules sheet content for the studio HUD.
 *
 * Mechanics: docs/GAME_CONTRACT.md §1-§8 (v1.0). Names: docs/PIGGY_FIREFIGHTERS_THEME.md §3-§5, through game/names.ts.
 * Every figure is read from `config` (paytable, 20 lines, mode costs, max win), from CONTRACT below (rules the
 * contract fixes: spin counts, multiplier steps, prize values, the 3% Inferno share of Alarm Call), or is a frequency
 * in MEASURED below.
 *
 * MEASURED TODO (frontend port, 2026-09-25): no production books exist yet (math lane, contract §9 is empty), so every
 * MEASURED entry is a placeholder string that says so. When Codex publishes, replace each value with the published
 * figure and a `// measured:` provenance comment naming the report JSON field and its raw value (the LUCKY pattern),
 * and re-measure whenever the books are regenerated. The rules sheet must never print a guessed frequency.
 *
 * Wording comes in two variants. Social casinos may not show cash vocabulary, so each sentence is written once as
 * `std` and once as `social`; the social text never says bet, pay(s), payline, paytable, buy, purchase, cost, wager,
 * cash or credit (win lines / wins / play amount / enter directly instead). Player copy never says "jackpot".
 */
import type { RulesSection, RulesBlock, PayRow } from '@crashgalaxy/hud';
import { stateConfig, stateUrlDerived } from 'state-shared';

import config from './config';
import generatedConfig from './generatedConfig';
import { isSweepsWallet } from './socialFloor';
import { FEATURE, MECHANIC, MODE_TITLE, SYMBOL_NAME, CHARACTER } from './names';
import { fmtX, fmtValues } from './format';

/** Live general-disclaimer text, VERBATIM from the donor (audited against the platform template); re-verify at every
 *  submission. The platform is "Engine" in player copy, never the older two-word name. */
export const generalDisclaimer = {
	std: 'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',
	social:
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Engine.',
} as const;

/**
 * RULES THE CONTRACT FIXES (docs/GAME_CONTRACT.md v1.0) — not frequencies, so not measured. Values marked *(tuned)*
 * in the contract (Backdraft count weights, prize weights) only change their WEIGHTS, never these lists. If the
 * contract version changes, re-read §4-§7 and update here (one place; hud.config.ts copySubs reads it too).
 */
export const CONTRACT = {
	trigger: [
		[3, 10],
		[4, 12],
		[5, 15],
	] as const, // §4: alarms -> spins
	boughtSpins: 10, // §2/§7: bought Rescue / Inferno and Alarm Call awards
	rooms: 5,
	rescueFire: 2, // §5: every room starts at fire level 2
	infernoFire: 1, // §6: level 1 (one W rescues a room)
	rescueStep: 1, // §5: +1 multiplier per rescue
	infernoStep: 2, // §6: +2 per rescue
	buildingSpins: 5, // §5: +5 spins per building cleared
	infernoPrizeValues: [5, 10, 20, 50, 100] as const, // §6: every obtainable instant prize, x the base amount
	infernoPrizes: '5×, 10×, 20×, 50× or 100×',
	backdraftSpinsMultText: '×2 to ×10',
	backdraftCells: [2, 5] as const, // §4: 2-5 cells ignite
	backdraftSpins: 5, // §7
	backdraftSpinsBlaze: [3, 5] as const, // §7: 3-5 Blaze Wilds on every Backdraft Spins spin
	backdraftSpinsMults: [2, 3, 5, 10] as const, // v1.1 §7: every Backdraft Spins Blaze Wild carries one of these
	alarmCallInferno: '3%', // §2/§7: fixed share, not solved
	anteChance: 2, // §2: exactly 2x the chance of each bonus
} as const;

/**
 * FREQUENCIES — MEASURED TODO. Placeholder strings until the math lane publishes production books (contract §9);
 * each line names the figure it must become and where it will be measured. Do not ship these placeholders.
 */
export const MEASURED = {
	// TODO(measured): base Rescue Spins trigger, "1 in N" (contract target 1 in 150-180) — report field rescue_1_in
	rescueBase: 'MEASURED TODO',
	// TODO(measured): ante Rescue Spins trigger (exactly 2x base) — report field rescue_1_in (ante)
	rescueAnte: 'MEASURED TODO',
	// TODO(measured): base Inferno Rescue trigger (target 1 in 1,800-2,500) — report field inferno_1_in
	infernoBase: 'MEASURED TODO',
	// TODO(measured): ante Inferno Rescue trigger (exactly 2x base) — report field inferno_1_in (ante)
	infernoAnte: 'MEASURED TODO',
	// TODO(measured): Backdraft rate in base / ante (target 1 in 35-50) — report field backdraft_1_in
	backdraftBase: 'MEASURED TODO',
	// TODO(measured): Alarm Call Rescue Spins share (solved, ~50%) and False Alarm share — report outcome_share
	alarmCallRescue: 'MEASURED TODO',
	alarmCallFalse: 'MEASURED TODO',
	// contract §2: 96.7% in every mode; print the LUT-exact figure to 2 dp once measured (target band 0.9665-0.9670)
	rtp: '96.70%',
} as const;

/** Launch flag, the jurisdiction answer, or a sweeps wallet — any one turns social wording on. The same floor raises
 *  the HUD's own strings (game/socialFloor.ts), so the two never disagree. */
export const isSocial = (): boolean => stateUrlDerived.social() || stateConfig.jurisdiction.socialCasino || isSweepsWallet();

type Entry = { std: string; social: string };

const PAY_SYMBOLS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4'];

const payRow = (symbol: string): PayRow => {
	const symbols = config.symbols as unknown as Record<string, { paytable: ReadonlyArray<Readonly<Record<string, number>>> | null }>;
	const entries = symbols[symbol].paytable ?? [];
	// config stores 3/4/5 ascending; the grid reads best-first.
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

/** The one maximum win, read from the mode table (15,000x in every mode). */
const maxWinText = (): string => fmtX(Number(config.betModes.base.max_win));

export const rulesSections = (): RulesSection[] => {
	const social = isSocial();
	const t = (e: Entry) => (social ? e.social : e.std);
	const lines = (config.paylines as number[][]).length;
	// contract v1.1 §4: 3 / 4 / 5 OR MORE alarms -> 10 / 12 / 15 spins
	const triggers = CONTRACT.trigger.map(([alarms, spins], i, all) => `${alarms}${i === all.length - 1 ? ' or more' : ''} alarms: ${spins} spins`).join(' · ');

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
					std: `The ante chip switches ${FEATURE.ante} on and off. GET BONUS opens the feature cards. Every feature purchase asks for confirmation first.`,
					social: `The ante chip switches ${FEATURE.ante} on and off. PLAY FEATURE opens the feature cards. Every feature entry asks for confirmation first.`,
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
					std: `${lines} fixed paylines on 5 reels and 3 rows. Wins pay left to right on adjacent reels starting from the leftmost reel, as a multiple of the total bet. Only the highest win on each line is paid; wins on different lines are added together.`,
					social: `${lines} fixed win lines on 5 reels and 3 rows. Wins are awarded left to right on adjacent reels starting from the leftmost reel, as a multiple of the total play amount. Only the highest win on each line is awarded; wins on different lines are added together.`,
				}),
			},
			{
				kind: 'para',
				text: `From highest to lowest: ${PAY_SYMBOLS.map((s) => SYMBOL_NAME[s]).join(', ')}.`,
			},
			{ kind: 'pays', rows: [payRow('W'), ...PAY_SYMBOLS.map(payRow)] },
			{
				kind: 'specials',
				items: [
					{
						symbol: 'W',
						label: t({
							std: `WILD — ${SYMBOL_NAME.W}. Substitutes for every paying symbol and pays as the ${SYMBOL_NAME.H1} on a line of its own. Reels 2 to 5 in the base game; all five reels in the features.`,
							social: `WILD — ${SYMBOL_NAME.W}. Substitutes for every symbol that wins and is worth the same as the ${SYMBOL_NAME.H1} on a line of its own. Reels 2 to 5 in the base game; all five reels in the features.`,
						}),
					},
					{
						symbol: 'ALARM',
						label: `${SYMBOL_NAME.ALARM} — the bonus symbol, on every reel in the base game. ${triggers} of ${FEATURE.rescue}. It does not form line wins.`,
					},
					{
						symbol: 'GALARM',
						label: `${SYMBOL_NAME.GALARM} — counts as a ${SYMBOL_NAME.ALARM} in every way. A trigger with at least one ${SYMBOL_NAME.GALARM} starts ${FEATURE.inferno} instead.`,
					},
				],
			},
		] as RulesBlock[],
	};

	const linesSection: RulesSection = {
		id: 'lines',
		title: t({ std: 'PAYLINES', social: 'WIN LINES' }),
		blocks: [
			{
				kind: 'para',
				text: t({
					std: `The ${lines} paylines, numbered as they light up on the reels. Each line wins from the leftmost reel.`,
					social: `The ${lines} win lines, numbered as they light up on the reels. Each line wins from the leftmost reel.`,
				}),
			},
			{ kind: 'paylines', lines: config.paylines as number[][] },
		] as RulesBlock[],
	};

	const backdraft: RulesSection = {
		id: 'backdraft',
		title: MECHANIC.backdraft.toUpperCase(),
		blocks: [
			{
				kind: 'para',
				text: `On a base game spin that does not start a feature, a ${MECHANIC.backdraft} can sweep the reels: ${CONTRACT.backdraftCells[0]} to ${CONTRACT.backdraftCells[1]} cells that do not already show a WILD or an alarm burst into ${MECHANIC.blazeWild}s, on any reel including reel 1. ${MECHANIC.blazeWild}s are WILDs in every way. Line wins are then counted once, on the board after the ${MECHANIC.backdraft}.`,
			},
			{ kind: 'note', text: `A ${MECHANIC.backdraft} happens on about ${MEASURED.backdraftBase} base game spins. It never happens on a spin that starts a feature, and never inside a feature.` },
		] as RulesBlock[],
	};

	const rescue: RulesSection = {
		id: 'rescue',
		title: MODE_TITLE.rescue,
		blocks: [
			{ kind: 'para', text: `${triggers}. Above the reels stands a burning block with ${CONTRACT.rooms} rooms, one above each reel. Every room starts at fire level ${CONTRACT.rescueFire}. WILDs appear on all five reels; no alarms appear, so the feature cannot start again from inside.` },
			{ kind: 'award', label: MECHANIC.douse, text: `Every WILD on a reel sprays the room above it and lowers its fire level by 1 (two WILDs on one reel lower it by 2). A WILD under a room that is already safe does nothing more.` },
			{ kind: 'award', label: MECHANIC.rescue, text: `A room that reaches fire level 0 is rescued: the multiplier rises by +${CONTRACT.rescueStep} (it starts at ×1) and +1 spin is added.` },
			{ kind: 'award', label: MECHANIC.buildingCleared, text: `When all ${CONTRACT.rooms} rooms are rescued the crew moves to the next building: every room is lit again, +${CONTRACT.buildingSpins} spins are added and the multiplier is kept. It never resets.` },
			{
				kind: 'para',
				text: t({
					std: "Each spin's line wins are multiplied by the multiplier after that spin's rescues. The feature ends when the spins run out or the maximum win is reached. The multiplier has no ceiling.",
					social: "Each spin's line wins are multiplied by the multiplier after that spin's rescues. The feature ends when the spins run out or the maximum win is reached. The multiplier has no ceiling.",
				}),
			},
			{ kind: 'note', text: `${FEATURE.rescue} starts on about ${MEASURED.rescueBase} base game spins (${MEASURED.rescueAnte} with ${FEATURE.ante}).` },
		] as RulesBlock[],
	};

	const inferno: RulesSection = {
		id: 'inferno',
		title: MODE_TITLE.inferno,
		blocks: [
			{ kind: 'para', text: `${FEATURE.rescue} under a red sky, started by a trigger with at least one ${SYMBOL_NAME.GALARM}, from ${FEATURE.alarmCall}, or directly. Rooms start at fire level ${CONTRACT.infernoFire}, so one WILD rescues a room.` },
			{
				kind: 'award',
				label: MECHANIC.rescue,
				text: t({
					std: `Every rescue adds +${CONTRACT.infernoStep} to the multiplier and +1 spin, and the rescued pig carries an instant prize of ${fmtValues(CONTRACT.infernoPrizeValues)} the base bet, paid at once and not multiplied.`,
					social: `Every rescue adds +${CONTRACT.infernoStep} to the multiplier and +1 spin, and the rescued pig carries an instant prize of ${fmtValues(CONTRACT.infernoPrizeValues)} the base play amount, awarded at once and not multiplied.`,
				}),
			},
			{ kind: 'para', text: `Clearing all ${CONTRACT.rooms} rooms brings the next building and +${CONTRACT.buildingSpins} spins, as in ${FEATURE.rescue}.` },
			{ kind: 'note', text: `${FEATURE.inferno} starts on about ${MEASURED.infernoBase} base game spins (${MEASURED.infernoAnte} with ${FEATURE.ante}).` },
		] as RulesBlock[],
	};

	const alarmCall: RulesSection = {
		id: 'alarm_call',
		title: MODE_TITLE.alarm_call,
		blocks: [
			{
				kind: 'para',
				text: `${CHARACTER.rookie} answers one call. It turns into ${FEATURE.rescue} (${MEASURED.alarmCallRescue}), ${FEATURE.inferno} (${CONTRACT.alarmCallInferno}) or a ${MECHANIC.falseAlarm} (${MEASURED.alarmCallFalse}). A ${MECHANIC.falseAlarm} wins nothing. An awarded feature starts with ${CONTRACT.boughtSpins} spins and plays exactly like its own card.`,
			},
		] as RulesBlock[],
	};

	const backdraftSpins: RulesSection = {
		id: 'backdraft_spins',
		title: MODE_TITLE.backdraft_spins,
		blocks: [
			{
				kind: 'para',
				text: `${CONTRACT.backdraftSpins} spins, and every spin gets a ${MECHANIC.backdraft} of ${CONTRACT.backdraftSpinsBlaze[0]} to ${CONTRACT.backdraftSpinsBlaze[1]} ${MECHANIC.blazeWild}s. No alarms appear, so ${FEATURE.rescue} cannot start. Line wins only.`,
			},
			{
				kind: 'award',
				label: 'MULTIPLIERS',
				text: `Every ${MECHANIC.blazeWild} here carries a multiplier of ${CONTRACT.backdraftSpinsMults.map((m) => `×${m}`).join(', ')}. A line that uses ${MECHANIC.blazeWild}s is multiplied by the SUM of their multipliers; a line that uses none counts ×1. WILDs from the reels carry no multiplier.`,
			},
		] as RulesBlock[],
	};

	const modeLine = (key: keyof typeof MODE_TITLE, std: string, soc: string): RulesBlock[] => [
		{ kind: 'heading', text: MODE_TITLE[key] },
		{ kind: 'para', text: t({ std: `${modeCost(key)}× the bet. ${std}`, social: `${modeCost(key)}× the play amount. ${soc}` }) },
	];

	const modes: RulesSection = {
		id: 'modes',
		title: t({ std: 'BET MODES', social: 'PLAY MODES' }),
		blocks: [
			...modeLine(
				'ante',
				`A toggle: every spin costs ${modeCost('ante')}× the base bet and has ${CONTRACT.anteChance}× the chance to start ${FEATURE.rescue} and ${CONTRACT.anteChance}× the chance to start ${FEATURE.inferno}. The ${MECHANIC.backdraft} rate is unchanged.`,
				`A toggle: every spin is played at ${modeCost('ante')}× the base play amount and has ${CONTRACT.anteChance}× the chance to start ${FEATURE.rescue} and ${CONTRACT.anteChance}× the chance to start ${FEATURE.inferno}. The ${MECHANIC.backdraft} rate is unchanged.`,
			),
			...modeLine('backdraft_spins', `Buys ${FEATURE.backdraftSpins} directly.`, `Enters ${FEATURE.backdraftSpins} directly.`),
			...modeLine('alarm_call', `Buys one ${FEATURE.alarmCall}.`, `Enters one ${FEATURE.alarmCall}.`),
			...modeLine('rescue', `Buys ${FEATURE.rescue} directly, with ${CONTRACT.boughtSpins} spins.`, `Enters ${FEATURE.rescue} directly, with ${CONTRACT.boughtSpins} spins.`),
			...modeLine('inferno', `Buys ${FEATURE.inferno} directly, with ${CONTRACT.boughtSpins} spins.`, `Enters ${FEATURE.inferno} directly, with ${CONTRACT.boughtSpins} spins.`),
		] as RulesBlock[],
	};

	const allModes = ['base game', MODE_TITLE.ante, MODE_TITLE.backdraft_spins, MODE_TITLE.alarm_call, MODE_TITLE.rescue, MODE_TITLE.inferno].join(', ');
	const limits: RulesSection = {
		id: 'limits',
		title: 'RETURN & MAXIMUM WIN',
		blocks: [
			{ kind: 'para', text: `Theoretical return: ${MEASURED.rtp} in every mode (${allModes}).` },
			{
				kind: 'para',
				text: t({
					std: `The maximum win is ${maxWinText()} the base bet in every mode. A round that reaches it ends at once and pays the maximum.`,
					social: `The maximum win is ${maxWinText()} the base play amount in every mode. A round that reaches it ends at once and awards the maximum.`,
				}),
			},
		] as RulesBlock[],
	};

	const general: RulesSection = {
		id: 'general',
		title: 'GENERAL INFORMATION',
		blocks: [{ kind: 'para', text: t(generalDisclaimer) }] as RulesBlock[],
	};

	return [howTo, symbols, linesSection, backdraft, rescue, inferno, alarmCall, backdraftSpins, modes, limits, general];
};
