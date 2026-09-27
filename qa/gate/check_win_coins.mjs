#!/usr/bin/env node
/**
 * The in-feature win count-up (components/Win.svelte + components/WinCoins.svelte, pure logic in game/winCoinFountain.ts):
 *   - the fountain coins TUMBLE: a V3 emitter config (so particle-emitter's upgradeConfig passes it through unchanged)
 *     whose texture behaviour is `animatedRandom` over the 32-frame coin turntable, every anim a full loop from its own
 *     start phase, both spin directions, ~24 fps real time; never textureRandom / textureSingle (one frozen frame each:
 *     the "sticker" bug);
 *   - alpha falls off, scale varies (depth), the launch fans up and out from the plaque's top edge, per-tier caps hold,
 *     and the apex stays under the coin ceiling (below the Rescue plate row and the rescued pigs' windows);
 *   - the figure's REAL ink (the gold font's glyph boxes, read from interGold.xml: the '$' rises above the digits, the
 *     comma's tail drops below them) sits inside the plaque's field with a margin, centred; digits >= 7:1 contrast;
 *   - the landing punch never pushes the plaque past 95 % of the viewport (phone edge-to-edge board);
 *   - the count is capped (a per-spin win inside a feature is not a 20 s wait) and lands without a cents-only stall;
 *   - layering: the figure's wrapper is a zIndexed DIRECT child of the FadeContainer, above the dimmer and the coins
 *     (pixi-svelte appends late mounts, so source order alone never fixed it); the figure is gone before the overlay's
 *     fade-out starts, so no ghost plaque rides over the next spin.
 *   node qa/gate/check_win_coins.mjs     (node >= 22.18: TypeScript type stripping)
 */
import { readFileSync } from 'node:fs';

const APP = new URL('../../apps/piggy_firefighters/src/', import.meta.url);
const M = await import(new URL('game/winCoinFountain.ts', APP).href);
const problems = [];
const fail = (s) => problems.push(s);

const FRAMES = Array.from({ length: 32 }, (_, i) => `coin_${String(i).padStart(2, '0')}`);
const TIERS = ['high', 'mid', 'low'];
const CAPS = { high: 60, mid: 30, low: 16 };
const CELL = 120; // SYMBOL_SIZE
const BOARD = { w: 600, h: 360 }; // BOARD_SIZES (5 x 3 cells)
const FIG_FONT = CELL * 1.5; // Win.svelte fontSize for a coin win

// ---- the gold font, straight from the shipped XML ----------------------------------------------------------------
const xml = readFileSync(new URL('../../apps/piggy_firefighters/static/assets/fonts/interGold/interGold.xml', import.meta.url), 'utf8');
const attr = (tag, name) => Number(new RegExp(`\\b${name}="(-?[\\d.]+)"`).exec(tag)?.[1]);
const info = /<info [^>]*>/.exec(xml)?.[0] ?? '';
const common = /<common [^>]*>/.exec(xml)?.[0] ?? '';
const FONT = { size: attr(info, 'size'), lineHeight: attr(common, 'lineHeight'), baseLineOffset: attr(common, 'lineHeight') - attr(common, 'base'), chars: {} };
for (const m of xml.matchAll(/<char [^>]*>/g)) {
	const t = m[0];
	FONT.chars[String.fromCodePoint(attr(t, 'id'))] = {
		xOffset: attr(t, 'xoffset'),
		yOffset: attr(t, 'yoffset'),
		width: attr(t, 'width'),
		height: attr(t, 'height'),
		xAdvance: attr(t, 'xadvance'),
	};
}
if (!(FONT.size > 0 && FONT.lineHeight > 0 && FONT.chars.$ && FONT.chars[','])) fail(`interGold.xml: could not read the font (${JSON.stringify({ ...FONT, chars: Object.keys(FONT.chars).length })})`);
/** Pixi 8 BitmapText layout width (single line, no kerning in this font): the sum of xAdvance, scaled. */
const layoutW = (text, fontSize) => ([...text].reduce((s, c) => s + (FONT.chars[c] ?? FONT.chars[' ']).xAdvance, 0) * fontSize) / FONT.size;
/** Independent ink extents (label-local, anchor 0.5): Pixi draws glyph c at y = baseLineOffset + yOffset, shifted up by
 *  half of (lineHeight + baseLineOffset). */
const inkRef = (text, fontSize) => {
	const k = fontSize / FONT.size;
	const originY = FONT.baseLineOffset - (FONT.lineHeight + FONT.baseLineOffset) / 2;
	const glyphs = [...new Set([...text, ...'0123456789'])].map((c) => FONT.chars[c]).filter(Boolean);
	return {
		top: (originY + Math.min(...glyphs.map((g) => g.yOffset))) * k,
		bottom: (originY + Math.max(...glyphs.map((g) => g.yOffset + g.height))) * k,
	};
};
const DOLLAR_H = (FONT.chars.$?.height ?? 0) / FONT.size; // '$' ink height per fontSize

const TEXTS = ['$21.00', '$94.60', '$946.20', '$3,000.00', '$6,500.00', '$15,000.00', '€1.234,56', '£2,000.00', 'kr10.00'];
const VIEWS = [
	{ name: 'phone 390 px (edge-to-edge board)', viewW: 600 },
	{ name: 'tablet', viewW: 760 },
	{ name: 'desktop 1440 px', viewW: 1329 },
];

// ---- ink box + plaque: the figure fits its plaque ------------------------------------------------------------------
const plaques = []; // realistic plaques for the fountain checks below
for (const text of TEXTS) {
	const lw = layoutW(text, FIG_FONT);
	const ink = M.inkBoxOf(text, lw, FIG_FONT, FONT);
	const ref = inkRef(text, FIG_FONT);
	if (Math.abs(ink.top - ref.top) > 0.5 || Math.abs(ink.bottom - ref.bottom) > 0.5)
		fail(`inkBoxOf('${text}'): top/bottom ${ink.top.toFixed(1)}/${ink.bottom.toFixed(1)}, the font says ${ref.top.toFixed(1)}/${ref.bottom.toFixed(1)}`);
	if (!(ink.w > lw)) fail(`inkBoxOf('${text}'): ink width ${ink.w.toFixed(1)} not wider than the layout ${lw.toFixed(1)} (the outline overhangs both ends)`);
	if (/^\$[\d.,]+$/.test(text)) {
		// the fallback (no font object at hand) is the '$' + comma box: it matches a '$d,ddd' figure and encloses the rest
		const fb = M.inkBoxOf(text, lw, FIG_FONT, null);
		if (text.includes(',')) {
			for (const k of ['top', 'bottom', 'w'])
				if (Math.abs(fb[k] - ink[k]) > Math.abs(ink[k]) * 0.01 + 0.5) fail(`inkBoxOf('${text}') fallback ${k} ${fb[k].toFixed(1)} vs font ${ink[k].toFixed(1)} (GOLD_INK_FALLBACK is stale)`);
		} else if (fb.top > ink.top + 0.5 || fb.bottom < ink.bottom - 0.5) fail(`inkBoxOf('${text}') fallback ${fb.top.toFixed(1)}..${fb.bottom.toFixed(1)} does not enclose the font's ${ink.top.toFixed(1)}..${ink.bottom.toFixed(1)}`);
	}
	for (const view of VIEWS) {
		const maxW = M.plaqueMaxW(BOARD.w, view.viewW);
		const b = M.plaqueFor(ink, maxW);
		const where = `plaqueFor('${text}', ${view.name}, maxW ${maxW.toFixed(0)})`;
		if (!(b.fit > 0 && b.fit <= 1)) fail(`${where}: fit ${b.fit}`);
		if (b.w > maxW + 1e-6) fail(`${where}: plaque ${b.w.toFixed(1)} wider than ${maxW.toFixed(1)}`);
		const field = b.h - 2 * b.rimW;
		const inkH = (ink.bottom - ink.top) * b.fit;
		// the judge's rule: the field clears the '$' (the tallest glyph) with 4 % to spare, and the whole ink box too
		if (text.includes('$') && !(field >= DOLLAR_H * FIG_FONT * b.fit * 1.04)) fail(`${where}: field ${field.toFixed(1)} < 1.04 x the '$' ink ${(DOLLAR_H * FIG_FONT * b.fit).toFixed(1)}`);
		const top = b.labelY + ink.top * b.fit;
		const bottom = b.labelY + ink.bottom * b.fit;
		const margin = inkH * 0.04;
		if (top < -field / 2 + margin - 1e-6) fail(`${where}: ink top ${top.toFixed(1)} crosses the top rim (field top ${(-field / 2).toFixed(1)})`);
		if (bottom > field / 2 - margin + 1e-6) fail(`${where}: ink bottom ${bottom.toFixed(1)} crosses the bottom rim (field bottom ${(field / 2).toFixed(1)})`);
		if (Math.abs((top + bottom) / 2) > b.h * 0.01) fail(`${where}: ink centre ${((top + bottom) / 2).toFixed(1)} off the plaque centre`);
		// every scale the count uses (0.9..1 x fit) keeps the ink centred when the label is placed with labelAt
		for (const s of [0.9, 0.95, 1]) {
			const at = M.labelAt(ink, b.fit * s);
			const mid = at.y + ((ink.top + ink.bottom) / 2) * b.fit * s;
			if (Math.abs(mid) > 0.5) fail(`${where}: labelAt(${s} x fit) leaves the ink ${mid.toFixed(2)} off centre`);
		}
		const left = b.labelX + (ink.cx - ink.w / 2) * b.fit;
		const right = b.labelX + (ink.cx + ink.w / 2) * b.fit;
		if (left < -b.w / 2 + b.rimW + b.h * 0.2 || right > b.w / 2 - b.rimW - b.h * 0.2) fail(`${where}: ink ${left.toFixed(1)}..${right.toFixed(1)} crowds the plaque ends (w ${b.w.toFixed(1)})`);
		for (const r of b.rivets ?? []) if (Math.abs(r.x) - b.rivetR < Math.max(Math.abs(left), Math.abs(right)) + b.h * 0.02) fail(`${where}: rivet at x ${r.x.toFixed(1)} overlaps the ink`);
		if (!(b.r > 0 && b.r <= b.h / 2)) fail(`${where}: corner radius ${b.r}`);
		// the landing punch: plaque + outer ink at the punch peak stays inside 95 % of the viewport
		const peakW = (b.w + 2 * b.ink) * M.PUNCH_PEAK;
		if (peakW > view.viewW * 0.95 + 1e-6) fail(`${where}: at the punch peak the plaque spans ${peakW.toFixed(0)} of ${view.viewW} (over 95 %)`);
		if (view.viewW === 1329 || view.viewW === 600) plaques.push({ text, view: view.name, w: b.w, h: b.h });
	}
}
// PUNCH_PEAK is the real peak of the landing punch
let peak = 1;
for (let p = 0; p <= 1; p += 0.001) peak = Math.max(peak, M.punchScale(p));
if (Math.abs(peak - M.PUNCH_PEAK) > 0.002) fail(`PUNCH_PEAK ${M.PUNCH_PEAK} but punchScale peaks at ${peak.toFixed(4)}`);
const ratio = M.contrastRatio(M.DIGIT_FACE, M.PLAQUE_STYLE.fill);
if (!(ratio >= 7)) fail(`digit face vs plaque contrast ${ratio.toFixed(2)}:1, want >= 7:1`);
if (!(M.PLAQUE_STYLE.fillAlpha >= 0.95)) fail(`plaque fill alpha ${M.PLAQUE_STYLE.fillAlpha}: coins behind it would show through the digits`);

// ---- tumble anims ------------------------------------------------------------------------------------------------
const anims = M.coinTumbleAnims(FRAMES);
if (!Array.isArray(anims) || anims.length < 6) fail(`coinTumbleAnims: ${anims?.length} anims, want >= 6 start phases`);
const starts = new Set();
let fwd = 0;
let rev = 0;
for (const [i, a] of (anims ?? []).entries()) {
	if (a.loop !== true) fail(`anim ${i}: loop ${a.loop}, want true`);
	if (!(a.framerate >= 18 && a.framerate <= 30)) fail(`anim ${i}: framerate ${a.framerate}, want 18..30 (real-time fps)`);
	if (a.textures.length !== FRAMES.length) fail(`anim ${i}: ${a.textures.length} frames, want the full ${FRAMES.length}-frame turntable`);
	if (new Set(a.textures).size !== FRAMES.length) fail(`anim ${i}: repeats or drops frames`);
	const k = FRAMES.indexOf(a.textures[0]);
	starts.add(k);
	const isFwd = a.textures.every((t, j) => t === FRAMES[(k + j) % FRAMES.length]);
	const isRev = a.textures.every((t, j) => t === FRAMES[(k - j + FRAMES.length * 2) % FRAMES.length]);
	if (isFwd) fwd += 1;
	else if (isRev) rev += 1;
	else fail(`anim ${i}: not a contiguous turntable loop`);
	// consecutive captures ~100 ms apart must show a different face
	for (let t = 0; t < 3; t += 0.05) {
		if (M.frameAt(a, t) === M.frameAt(a, t + 0.1)) {
			fail(`anim ${i}: same frame at ${t.toFixed(2)} s and +100 ms`);
			break;
		}
	}
}
if (starts.size < 6) fail(`only ${starts.size} distinct start phases, want >= 6`);
if (!fwd || !rev) fail(`spin directions: ${fwd} forward, ${rev} reversed; want both`);

// ---- emitter configs ---------------------------------------------------------------------------------------------
const byType = (cfg, type) => cfg.behaviors.filter((b) => b.type === type);
const one = (cfg, type, where) => {
	const list = byType(cfg, type);
	if (list.length !== 1) fail(`${where}: ${list.length} '${type}' behaviours, want 1`);
	return list[0]?.config;
};
const deg = (a) => (a * Math.PI) / 180;
// the coin ceiling: desktop (square rows) and stacked (rows 1.3 x taller). On desktop the Rescue plate row sits ~1.5 cells
// above the reels' top edge and the rescued pigs' windows end ~0.85 cells above it (judge_coins/mw_d/u1_c10.png).
const CEILINGS = [
	{ name: 'desktop', rowPitch: 1 },
	{ name: 'stacked', rowPitch: 1.3 },
];
for (const c of CEILINGS) {
	c.y = M.coinCeiling(BOARD.h, c.rowPitch);
	const reelTop = -(BOARD.h / 2) * c.rowPitch;
	const above = (reelTop - c.y) / CELL;
	if (!(above >= 0.3 && above <= 0.8)) fail(`coinCeiling(${c.name}): ${above.toFixed(2)} cells above the reels' top edge, want 0.3..0.8 (under the windows and the plate row)`);
}
if (plaques.length < 4) fail(`only ${plaques.length} realistic plaques to fly coins from`);

for (const tier of TIERS) {
	const budget = M.COIN_BUDGET[tier];
	if (!budget) {
		fail(`COIN_BUDGET.${tier} missing`);
		continue;
	}
	let capSum = 0;
	for (const side of [-1, 1]) {
		for (const [pi, plaque] of plaques.entries()) {
			for (const ceil of CEILINGS) {
				const where = `${tier} side ${side} '${plaque.text}' ${plaque.view} ${ceil.name} (plaque ${plaque.w.toFixed(0)}x${plaque.h.toFixed(0)})`;
				const cfg = M.coinFountainConfig(FRAMES, side, plaque, budget, ceil.y);
				if (!Array.isArray(cfg.behaviors)) {
					fail(`${where}: no 'behaviors' (a V1 config goes through upgradeConfig -> textureRandom)`);
					continue;
				}
				if ('emit' in cfg && cfg.emit === false) fail(`${where}: emit false would never start`);
				for (const banned of ['textureRandom', 'textureSingle', 'textureOrdered', 'animatedSingle'])
					if (byType(cfg, banned).length) fail(`${where}: has '${banned}' (one fixed start frame / sticker)`);
				const ar = one(cfg, 'animatedRandom', where);
				if (ar && ar.anims.length < 6) fail(`${where}: animatedRandom has ${ar.anims.length} anims`);
				if (!(cfg.frequency > 0)) fail(`${where}: frequency ${cfg.frequency}`);
				if (!(cfg.lifetime?.min > 0.8 && cfg.lifetime.max <= 2.6 && cfg.lifetime.min <= cfg.lifetime.max))
					fail(`${where}: lifetime ${JSON.stringify(cfg.lifetime)} (real seconds, want 0.8..2.6)`);
				if (pi === 0 && ceil === CEILINGS[0]) capSum += cfg.maxParticles;

				const alpha = one(cfg, 'alpha', where);
				const al = alpha?.alpha?.list ?? [];
				if (al.length < 2 || al[0].value < 0.95 || al[al.length - 1].value > 0.05) fail(`${where}: alpha ${JSON.stringify(al)} (want 1 -> 0 falloff)`);
				for (let j = 1; j < al.length; j += 1) if (al[j].time < al[j - 1].time) fail(`${where}: alpha times not ascending`);

				const scale = one(cfg, 'scale', where);
				if (!(scale?.minMult >= 0.4 && scale.minMult <= 0.75)) fail(`${where}: scale minMult ${scale?.minMult} (depth range 0.4..0.75)`);

				const move = one(cfg, 'moveAcceleration', where);
				if (!move) continue;
				if (move.rotate !== false) fail(`${where}: moveAcceleration.rotate must be false (the coin keeps its own spin, not the heading)`);
				if (!(move.accel.y > 0 && move.accel.x === 0)) fail(`${where}: gravity ${JSON.stringify(move.accel)}`);
				if (!(move.minStart > 0 && move.minStart < move.maxStart)) fail(`${where}: launch speed ${move.minStart}..${move.maxStart}`);
				one(cfg, 'noRotation', where);

				const rot = one(cfg, 'rotation', where);
				if (!rot) continue;
				const lo = side < 0 ? [215, 285] : [255, 325];
				if (!(rot.minStart >= lo[0] && rot.maxStart <= lo[1] && rot.minStart < rot.maxStart))
					fail(`${where}: launch angles ${rot.minStart}..${rot.maxStart}, want within ${lo} (up and ${side < 0 ? 'left' : 'right'})`);
				if (Math.abs(rot.minSpeed) > 120 || Math.abs(rot.maxSpeed) > 120) fail(`${where}: spin ${rot.minSpeed}..${rot.maxSpeed} deg/s (a wobble, not a sticker spin)`);

				const spawn = one(cfg, 'spawnShape', where);
				if (!spawn) continue;
				if (spawn.type !== 'polygonalChain') fail(`${where}: spawn shape ${spawn.type}`);
				const pts = (Array.isArray(spawn.data?.[0]) ? spawn.data.flat() : spawn.data) ?? [];
				if (pts.length < 2) fail(`${where}: spawn chain has ${pts.length} points`);
				for (const p of pts) {
					// born BEHIND the plaque (inside its box) on this side's half, near the top edge: they rise out from behind it
					if (Math.abs(p.x) > plaque.w / 2 || Math.abs(p.y) > plaque.h / 2) fail(`${where}: spawn (${p.x}, ${p.y}) outside the plaque`);
					if (p.x * side < 0) fail(`${where}: spawn x ${p.x} on the wrong half`);
					if (p.y > 0) fail(`${where}: spawn y ${p.y} below the plaque's middle`);
				}
				// kinematics: from every spawn extreme at every launch extreme (and straight up), the coin leaves the plaque box
				// through its TOP edge (never through the face the digits sit on), clears the plaque by >= 0.5 cells, and its
				// apex never passes the ceiling (the Rescue plate row / windows)
				const angles = [rot.minStart, rot.maxStart];
				if (rot.minStart <= 270 && rot.maxStart >= 270) angles.push(270);
				for (const p of pts)
					for (const a of angles)
						for (const v of [move.minStart, move.maxStart]) {
							let x = p.x;
							let y = p.y;
							const vx = Math.cos(deg(a)) * v;
							let vy = Math.sin(deg(a)) * v;
							let left = false;
							let apex = y;
							for (let t = 0; t < cfg.lifetime.max; t += 1 / 240) {
								vy += move.accel.y / 240;
								x += vx / 240;
								y += vy / 240;
								apex = Math.min(apex, y);
								const inside = Math.abs(x) <= plaque.w / 2 && Math.abs(y) <= plaque.h / 2;
								if (!inside && !left) {
									left = true;
									if (y > -plaque.h / 2 + 1e-6) fail(`${where}: coin from (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) at ${a} deg / ${v.toFixed(0)} leaves through the side or bottom (${x.toFixed(0)}, ${y.toFixed(0)})`);
								}
							}
							const rise = (-plaque.h / 2 - apex) / CELL;
							if (rise < 0.5) fail(`${where}: apex only ${rise.toFixed(2)} cells above the plaque (want >= 0.5)`);
							if (apex < ceil.y - 0.5) fail(`${where}: apex ${apex.toFixed(0)} above the ceiling ${ceil.y.toFixed(0)} (at ${a} deg / ${v.toFixed(0)})`);
						}
			}
		}
	}
	if (capSum > CAPS[tier]) fail(`${tier}: the two fountains cap at ${capSum} coins, over the tier's ${CAPS[tier]}`);
}

// ---- count pacing ------------------------------------------------------------------------------------------------
const roll = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3); // game/reels/winMeter.ts winRollEase
for (const present of [0, 600, 2000, 6000, 18000, 20000, 32000])
	for (const turbo of [false, true]) {
		const ms = M.countMs(present, turbo);
		const cap = turbo ? 3000 : 6000;
		if (!(ms > 0 && ms <= cap)) fail(`countMs(${present}, turbo ${turbo}) = ${ms}, want 0 < ms <= ${cap} (a per-spin win in a feature)`);
		const lead = M.countLeadMs(ms);
		if (!(lead >= 0 && lead <= ms * 0.25 && lead <= M.WIN_FADE_MS)) fail(`countLeadMs(${ms}) = ${lead}`);
	}
// no cents-only stall: at 60 fps the figure lands within ~0.35 s of the display's last big move, and the landing jump is small
for (const amount of [2100, 50000, 300000, 650000, 1500000]) {
	const ms = M.countMs(20000, false);
	let landedAt = -1;
	let lastV = 0;
	for (let t = 0; t <= ms + 1; t += 1000 / 60) {
		const v = Math.floor(amount * roll(t / ms));
		if (M.countLands(v, amount) || t >= ms) {
			landedAt = t;
			break;
		}
		lastV = v;
	}
	const jump = (amount - lastV) / amount;
	if (landedAt < 0) fail(`countLands(${amount}): never lands`);
	if (jump > 0.002) fail(`countLands(${amount}): lands with a ${(jump * 100).toFixed(2)} % jump (too early)`);
	const tStall = (() => {
		for (let t = 0; t <= ms; t += 1000 / 60) if (amount - Math.floor(amount * roll(t / ms)) <= amount * 0.0005) return t;
		return ms;
	})();
	if (landedAt - tStall > 350) fail(`countLands(${amount}): the last 0.05 % takes ${(landedAt - tStall).toFixed(0)} ms (a stall)`);
}

// ---- layering + lifecycle (source) ----------------------------------------------------------------------------------
const L = M.WIN_LAYER;
if (!(L.figure > L.coins && L.coins > L.dimmer)) fail(`WIN_LAYER ${JSON.stringify(L)}: want figure > coins > dimmer`);
const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const win = strip(readFileSync(new URL('components/Win.svelte', APP), 'utf8'));
const fade = win.slice(win.indexOf('<FadeContainer'), win.lastIndexOf('</FadeContainer>'));
if (!/<Container zIndex=\{WIN_LAYER\.figure\}>\s*<MainContainer/.test(fade)) fail('Win.svelte: the figure MainContainer is not wrapped in <Container zIndex={WIN_LAYER.figure}>');
if (!/<Container zIndex=\{WIN_LAYER\.dimmer\}[^>]*>\s*<CanvasSizeRectangle/.test(fade)) fail('Win.svelte: the dimmer is not wrapped in <Container zIndex={WIN_LAYER.dimmer}>');
if (!/<Container zIndex=\{WIN_LAYER\.coins\}[^>]*>\s*<WinCoins/.test(fade)) fail('Win.svelte: WinCoins is not wrapped in <Container zIndex={WIN_LAYER.coins}>');
// the wrappers must be DIRECT children of the FadeContainer (depth 1): count open/close Containers before each
const depthAt = (needle) => {
	const i = fade.indexOf(needle);
	if (i < 0) return -1;
	const before = fade.slice(0, i);
	return (before.match(/<Container[\s>]/g) ?? []).length - (before.match(/<\/Container>/g) ?? []).length;
};
for (const k of ['figure', 'dimmer', 'coins']) {
	const d = depthAt(`<Container zIndex={WIN_LAYER.${k}}`);
	if (d !== 0) fail(`Win.svelte: the ${k} wrapper is nested ${d} Containers deep inside the FadeContainer (want a direct child)`);
}
if (/GOLD_INK_DY/.test(win)) fail('Win.svelte: still places the figure with the nominal GOLD_INK_DY (use the real ink box: inkBoxOf / labelAt)');
if (!/inkBoxOf\(/.test(win) || !/plaqueFor\(/.test(win) || !/labelAt\(/.test(win)) fail('Win.svelte: the plaque is not sized and the figure not centred from the real ink box (inkBoxOf + plaqueFor + labelAt)');
if (!/plaqueMaxW\(/.test(win)) fail('Win.svelte: the plaque width is not limited by the viewport (plaqueMaxW), so the punch can reach the screen edges');
if (!/countMs\(/.test(win) || !/countLands\(/.test(win)) fail('Win.svelte: the count is not paced by countMs / countLands');
if (!/badge\.alpha\s*=\s*0;[\s\S]{0,160}oncomplete\(\)/.test(win)) fail('Win.svelte: the figure is not gone (badge.alpha = 0) before the round resumes (ghost plaque over the next spin)');
const coins = strip(readFileSync(new URL('components/WinCoins.svelte', APP), 'utf8'));
if (/particleConfig/.test(coins)) fail('WinCoins.svelte still reads the V1 constants-shared fountain config');
if (!/coinFountainConfig\([^)]*ceiling/.test(coins)) fail('WinCoins.svelte does not pass the coin ceiling to coinFountainConfig');
if (!/emitSpeed=\{COIN_TIME_SCALE\}/.test(coins)) fail('WinCoins.svelte: the emitter must run in real seconds (emitSpeed={COIN_TIME_SCALE})');

if (problems.length) {
	console.error('FAIL check_win_coins');
	for (const p of problems.slice(0, 40)) console.error('  ' + p);
	if (problems.length > 40) console.error(`  ... and ${problems.length - 40} more`);
	process.exit(1);
}
console.log(
	`OK check_win_coins: ${anims.length} tumble phases, ${TIERS.length} tiers x 2 fountains x ${plaques.length} plaques x ${CEILINGS.length} ceilings, ` +
		`${TEXTS.length} figures x ${VIEWS.length} views fit their plaque (the '$' + comma ink from interGold.xml), punch peak ${M.PUNCH_PEAK.toFixed(3)}, contrast ${ratio.toFixed(1)}:1, pacing, layering`,
);
