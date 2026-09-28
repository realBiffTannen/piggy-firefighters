#!/usr/bin/env node
/**
 * Contract §8 (v1.2.2) win-tier rule, checked on the client's ONE implementation (game/roundTier.ts):
 * tier 0 whenever W <= S (precedence), then base-bet floors 15 / 30 / 50 / 100, MAX only on cap evidence.
 *   node qa/gate/check_round_tier.mjs     (node >= 22.18: TypeScript type stripping)
 */
const { roundTier, rungLevelOfTier, RUNG_FLOORS_BOOKED, WIN_CAP_BOOKED } = await import(
	new URL('../../apps/piggy_firefighters/src/game/roundTier.ts', import.meta.url).href
);
const x = (v) => Math.round(v * 100); // booked units
const cases = [
	// [W x, S x, capped, tier, why]
	[0, 1, false, 0, 'no win'],
	[0.6, 1, false, 0, 'sub-hit base'],
	[1, 1, false, 0, 'W = S is tier 0'],
	[1.2, 1.5, false, 0, '1.2x on a 1.5x ante spin'],
	[1.2, 1, false, 1, 'ordinary base win'],
	[14.9, 1, false, 1, 'just under BIG'],
	[15, 1, false, 2, 'BIG floor'],
	[30, 1, false, 3, 'HUGE floor'],
	[50, 1, false, 4, 'MEGA floor'],
	[100, 1, false, 5, 'EPIC floor'],
	[145.7, 25, false, 5, 'rescue_buy 145.7x = EPIC'],
	[28, 25, false, 2, '26-29x Rescue total gets BIG (above the 25x cost)'],
	[35, 25, false, 3, '30-49x Rescue total gets HUGE'],
	[60, 100, false, 0, '60x on a 100x Inferno buy'],
	[54.3, 100, false, 0, 'inferno_buy dev fixture'],
	[100, 100, false, 0, 'W = S on Inferno'],
	[60, 50, false, 4, '60x on a 50x Backdraft Spins buy = MEGA'],
	[20, 50, false, 0, 'under the Backdraft Spins cost'],
	[15, 15, false, 0, 'Alarm Call W = S'],
	[20000, 1, true, 6, 'the cap'],
	[20000, 1, false, 5, 'no cap evidence: EPIC, never MAX'],
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
// owner re-price 2026-09-28 (contract v1.3): the cap is 20,000x in every mode
if (WIN_CAP_BOOKED !== 2000000) problems.push(`WIN_CAP_BOOKED = ${WIN_CAP_BOOKED}, want 2000000 (20,000x)`);
if (problems.length) {
	console.error('FAIL check_round_tier');
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_round_tier: ${cases.length} cases, rung levels and floors per contract §8`);
