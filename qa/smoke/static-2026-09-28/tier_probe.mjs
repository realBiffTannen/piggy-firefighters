// v1.3.1 probe: the ONE tier table, driven with the shipped module — proves which modals a round of each mode can raise.
const { roundTier, smallWinMaxBooked, rungFloorsBooked } = await import(new URL('../../../apps/piggy_firefighters/src/game/roundTier.ts', import.meta.url).href);
const modes = { base: 1, ante: 3, super_ante: 5, alarm_call: 15, rescue: 25, backdraft_spins: 50, inferno: 100 };
const rows = [];
for (const [mode, cost] of Object.entries(modes)) {
	const first = rungFloorsBooked(cost)[0] / 100;
	rows.push({ mode, cost, no_sign_up_to_x: first - 0.01, first_sign_BIG_at_x: first, countup_plaque_above_x: smallWinMaxBooked(cost) / 100, tier_of_2x_cost: roundTier(cost * 2 * 100, cost, false) });
}
console.table(rows);
