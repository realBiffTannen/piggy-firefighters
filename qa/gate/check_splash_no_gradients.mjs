#!/usr/bin/env node
/** The splash draws its furniture with painted art, never CSS gradients (panel 2026-09-26, craft rung +0.67).
 *    node qa/gate/check_splash_no_gradients.mjs */
import { readFileSync } from 'node:fs';
const files = ['apps/piggy_firefighters/src/components/splash/SplashDeck.svelte', 'apps/piggy_firefighters/src/components/Splash.svelte'];
const ROOT = new URL('../..', import.meta.url).pathname;
const hits = [];
for (const f of files) {
	readFileSync(ROOT + f, 'utf8').split('\n').forEach((line, i) => {
		if (/gradient\(/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
	});
}
if (hits.length) {
	console.error(`check_splash_no_gradients: FAIL (${hits.length})\n  ${hits.join('\n  ')}`);
	process.exit(1);
}
console.log('check_splash_no_gradients: PASS');
