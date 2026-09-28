#!/usr/bin/env node
/**
 * Contract §8 (v1.3.1) win-tier rule, checked on the client's ONE implementation (game/roundTier.ts):
 * tier 0 whenever W <= S (precedence), then COST-unit floors 15 / 30 / 50 / 100 x S (owner 2026-09-28: no display
 * modals for small wins — a 16x line on a 5x spin is ordinary), MAX only on cap evidence.
 *   node qa/gate/check_round_tier.mjs     (node >= 22.18: TypeScript type stripping)
 */
const { roundTier, rungLevelOfTier, RUNG_FLOORS_BOOKED, rungFloorsBooked, smallWinMaxBooked, WIN_CAP_BOOKED } = await import(
	new URL('../../apps/piggy_firefighters/src/game/roundTier.ts', import.meta.url).href
);
const x = (v) => Math.round(v * 100); // booked units
const cases = [
	// [W x, S x, capped, tier, why]
	[0, 1, false, 0, 'no win'],
	[0.6, 1, false, 0, 'sub-hit base'],
	[1, 1, false, 0, 'W = S is tier 0'],
	[1.2, 3, false, 0, '1.2x on a 3x ante spin'],
	[1.2, 1, false, 1, 'ordinary base win'],
	[14.9, 1, false, 1, 'just under BIG'],
	[15, 1, false, 2, 'BIG floor (base, 1x)'],
	[30, 1, false, 3, 'HUGE floor'],
	[50, 1, false, 4, 'MEGA floor'],
	[100, 1, false, 5, 'EPIC floor'],
	[16, 5, false, 1, '16x line on a 5x FIVE-ALARM spin (3.2x the stake): ordinary, no sign'],
	[74.9, 5, false, 1, 'just under BIG on a 5x spin'],
	[75, 5, false, 2, 'BIG at 15x the 5x cost'],
	[45, 3, false, 2, 'BIG at 15x the 3x ante cost'],
	[28, 25, false, 1, '28x on a 25x Rescue buy (1.12x the stake): ordinary'],
	[145.7, 25, false, 1, 'rescue_buy 145.7x (5.8x the stake): ordinary'],
	[375, 25, false, 2, 'BIG at 15x the 25x Rescue cost'],
	[750, 25, false, 3, 'HUGE at 30x the 25x cost'],
	[60, 100, false, 0, '60x on a 100x Inferno buy'],
	[101, 100, false, 1, 'break-even Inferno buy is an ordinary win, never EPIC'],
	[1500, 100, false, 2, 'BIG at 15x the 100x Inferno cost'],
	[10000, 100, false, 5, 'EPIC at 100x the 100x cost'],
	[100, 100, false, 0, 'W = S on Inferno'],
	[60, 50, false, 1, '60x on a 50x Backdraft Spins buy: ordinary'],
	[2500, 50, false, 4, 'MEGA at 50x the 50x cost'],
	[20, 50, false, 0, 'under the Backdraft Spins cost'],
	[15, 15, false, 0, 'Alarm Call W = S'],
	[225, 15, false, 2, 'BIG at 15x the 15x Alarm Call cost'],
	[20000, 1, true, 6, 'the cap'],
	[20000, 1, false, 5, 'no cap evidence: EPIC, never MAX'],
	[20000, 100, true, 6, 'the cap on a 100x buy'],
	[0.5, 1, true, 0, 'stake check precedes the cap flag'],
];

const problems = [];
for (const [w, s, capped, want, why] of cases) {
	const got = roundTier(x(w), s, capped);
	if (got !== want) problems.push(`roundTier(${w}x, S ${s}x, capped ${capped}) = ${got}, want ${want} (${why})`);
}
const levels = [0, 1, 2, 3, 4, 5, 6].map(rungLevelOfTier).join(',');
if (levels !== '0,0,6,7,8,9,10') problems.push(`rungLevelOfTier 0..6 = ${levels}, want 0,0,6,7,8,9,10`);
if (RUNG_FLOORS_BOOKED.join(',') !== [1500, 3000, 5000, 10000, WIN_CAP_BOOKED].join(',')) problems.push(`RUNG_FLOORS_BOOKED = ${RUNG_FLOORS_BOOKED}`);
// v1.3.1: the sign's climb floors and the small-win ceiling scale with the round's charged cost
if (rungFloorsBooked(5).join(',') !== [7500, 15000, 25000, 50000, WIN_CAP_BOOKED].join(',')) problems.push(`rungFloorsBooked(5) = ${rungFloorsBooked(5)}`);
if (rungFloorsBooked(25).join(',') !== [37500, 75000, 125000, 250000, WIN_CAP_BOOKED].join(',')) problems.push(`rungFloorsBooked(25) = ${rungFloorsBooked(25)}`);
if (rungFloorsBooked(0).join(',') !== RUNG_FLOORS_BOOKED.join(',')) problems.push('rungFloorsBooked(0) must read as the 1x base spin');
for (const [cost, want] of [[1, 2000], [3, 6000], [5, 10000], [25, 50000], [100, 200000], [0, 2000]]) {
	if (smallWinMaxBooked(cost) !== want) problems.push(`smallWinMaxBooked(${cost}) = ${smallWinMaxBooked(cost)}, want ${want}`);
}
// owner re-price 2026-09-28 (contract v1.3): the cap is 20,000x in every mode
if (WIN_CAP_BOOKED !== 2000000) problems.push(`WIN_CAP_BOOKED = ${WIN_CAP_BOOKED}, want 2000000 (20,000x)`);
if (problems.length) {
	console.error('FAIL check_round_tier');
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_round_tier: ${cases.length} cases, rung levels and floors per contract §8`);
