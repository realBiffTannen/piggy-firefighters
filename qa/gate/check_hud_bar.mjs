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
if (problems.length) {
	console.error(`check_hud_bar: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log(`check_hud_bar: PASS (${cases.length} cases)`);
