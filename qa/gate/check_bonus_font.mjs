#!/usr/bin/env node
/** The HUD bonus tile (GET BONUS / PLAY FEATURE) is set in the owner-supplied Lilita One (2026-09-26): the shipped file
 *  is that exact binary, registered under its own family so the HUD package's bundled copy (a different build) cannot
 *  win the cascade, and the tile's face names it first.   node qa/gate/check_bonus_font.mjs */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const ROOT = new URL('../..', import.meta.url).pathname;
const OWNER_SHA = '4444c23631884f411aa7f2fee35061b1756a9927940c62d2a5572acf470b3ffa';
const FILE = 'apps/piggy_firefighters/static/assets/fonts/LilitaOne/LilitaOne-Regular.ttf';
const problems = [];
const sha = createHash('sha256').update(readFileSync(ROOT + FILE)).digest('hex');
if (sha !== OWNER_SHA) problems.push(`${FILE} sha256 ${sha.slice(0, 12)}… is not the owner-supplied Lilita One (${OWNER_SHA.slice(0, 12)}…)`);
const html = readFileSync(ROOT + 'apps/piggy_firefighters/src/app.html', 'utf8');
if (!/font-family:\s*'PF Bonus Lilita';[\s\S]{0,200}LilitaOne\/LilitaOne-Regular\.ttf/.test(html)) problems.push("app.html: no @font-face 'PF Bonus Lilita' -> assets/fonts/LilitaOne/LilitaOne-Regular.ttf");
if (!/html body \.hud-bonus__copy\s*\{[^}]*font-family:\s*'PF Bonus Lilita'/.test(html)) problems.push("app.html: the bonus tile (.hud-bonus__copy) does not name 'PF Bonus Lilita' first");
if (!/rel="preload"[^>]*LilitaOne\/LilitaOne-Regular\.ttf/.test(html)) problems.push('app.html: the bonus face is not preloaded (the tile would mount in a fallback face)');
if (problems.length) {
	console.error(`check_bonus_font: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log('check_bonus_font: PASS');
