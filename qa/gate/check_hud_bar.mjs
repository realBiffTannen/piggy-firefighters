#!/usr/bin/env node
/** The HUD bar top the mascots and the shutter stand on (game/hudBar.ts): the HUD's own measurement wins, the mirror
 *  stands in until it exists.   node qa/gate/check_hud_bar.mjs */
const { hudBarTop } = await import(new URL('../../apps/piggy_firefighters/src/game/hudBar.ts', import.meta.url).href);
const cases = [
	// [canvas h, measured css, mirror reserve, want, why]
	[844, 0, 78.38, 765.62, 'not measured yet: the mirror stands in'],
	[844, 147, 78.38, 697, '390x844 two-row phone bar: the measurement wins'],
	[900, 96, 96, 804, 'desktop: measurement and mirror agree'],
	[844, -5, 78.38, 765.62, 'a negative measurement is treated as none'],
	[100, 400, 78, 0, 'never above the canvas top'],
];
const problems = [];
for (const [ch, css, mirror, want, why] of cases) {
	const got = Math.round(hudBarTop(ch, css, mirror) * 100) / 100;
	if (got !== want) problems.push(`hudBarTop(${ch}, ${css}, ${mirror}) = ${got}, want ${want} (${why})`);
}
// Ember's ground on a stacked layout (screen px): the bar top, or the top of the HUD's ante chip when it covers her
const { emberGround } = await import(new URL('../../apps/piggy_firefighters/src/game/hudBar.ts', import.meta.url).href);
const emberCases = [
	// [bar top, chip {left, top, width} | null, ember left, ember right, want, why]
	[697, null, 280, 370, 697, 'no chip measured: she stands on the bar'],
	[697, { left: 195, top: 650, width: 180 }, 280, 370, 650, '390 px phone: the chip covers her ground, she sits on it'],
	[697, { left: 380, top: 650, width: 100 }, 280, 370, 697, 'chip clear of her: the bar'],
	[697, { left: 195, top: 720, width: 180 }, 280, 370, 697, 'a chip below the bar top never lowers her'],
];
for (const [bar, chip, l, r, want, why] of emberCases) {
	const got = emberGround(bar, chip, l, r);
	if (got !== want) problems.push(`emberGround(${bar}, ${JSON.stringify(chip)}, ${l}, ${r}) = ${got}, want ${want} (${why})`);
}
if (problems.length) {
	console.error(`check_hud_bar: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log(`check_hud_bar: PASS (${cases.length + emberCases.length} cases)`);
