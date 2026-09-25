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
	[145.7, 18, false, 5, 'rescue_buy 145.7x = EPIC'],
	[25, 18, false, 2, '20-49x Rescue total gets BIG'],
	[35, 18, false, 3, '30-49x Rescue total gets HUGE'],
	[60, 90, false, 0, '60x on a 90x Inferno buy'],
	[54.3, 90, false, 0, 'inferno_buy dev fixture'],
	[90, 90, false, 0, 'W = S on Inferno'],
	[95, 90, false, 4, '95x on Inferno = MEGA'],
	[20, 50, false, 0, 'under the Backdraft Spins cost'],
	[12, 12, false, 0, 'Alarm Call W = S'],
	[15000, 1, true, 6, 'the cap'],
	[15000, 1, false, 5, 'no cap evidence: EPIC, never MAX'],
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
if (WIN_CAP_BOOKED !== 1500000) problems.push(`WIN_CAP_BOOKED = ${WIN_CAP_BOOKED}, want 1500000 (15,000x)`);
if (problems.length) {
	console.error('FAIL check_round_tier');
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_round_tier: ${cases.length} cases, rung levels and floors per contract §8`);
