#!/usr/bin/env node
/**
 * WIN RUNG PACING + LOOK (game/rungPacing.ts, the pure half of components/WinRungs.svelte), checked on every rung:
 *   - the count is ONE monotone climb that never passes the booked amount and lands exactly on it;
 *   - every rung gets real time (a segment-weighted log ramp, NOT ganja's single linear ramp, which with PF's
 *     15 / 30 / 50 / 100x floors and a 15,000x cap would put every BIG..EPIC crossing in the first ~1% of the count);
 *   - each crossing lands on its floor; MAX shows its sign BEFORE the figure reaches the cap and then lands on it;
 *   - turbo / super turbo scale by stateSpeed speedFactor() (0.5 / 0.3), the max-win card fade included;
 *   - reduced motion: no shake, no expanding ring, no slide-out, no ray spin, no travel (a plain fade);
 *   - the look escalates per rung (MAX the brightest gold and the biggest sign, EPIC's light distinct from HUGE's);
 *   - the piece budget reserves room so the crossing and landing bursts always fit beside the side rain, and the MAX
 *     card keeps its own coin storm;
 *   - the sign is sized and centred from the visible view (~70% of a wide screen at MAX, ~94% of a phone);
 *   - the light gathers at the sign on every mood plate (>= 1.6x the edge under the plank; HUGE warm core, MEGA blue);
 *   - the watchdog scales with the timeline (a slow device never loses the MAX card);
 *   - no handover shows two titles at once (reduced-motion board swap, MAX sign -> max-win card), the crossing volley
 *     never throws one symbol over and over from an edge, and the desktop plate chief keeps his whole hose and
 *     stands on something (fix round 2).
 *   node qa/gate/check_rung_pacing.mjs     (node >= 22.18: TypeScript type stripping)
 */
const SRC = new URL('../../apps/piggy_firefighters/src/game/', import.meta.url).href;
const { RUNG_FLOORS_BOOKED, WIN_CAP_BOOKED, BASE_BET_BOOKED } = await import(SRC + 'roundTier.ts');
const P = await import(SRC + 'rungPacing.ts');

const problems = [];
const fail = (msg) => problems.push(msg);
const X = (x) => Math.round(x * BASE_BET_BOOKED); // base-bet multiple -> booked units

// ---- the count ---------------------------------------------------------------------------------------------------------
// [amount x, final rung index 0 BIG .. 4 MAX]
const rounds = [
	[15, 0],
	[20, 0],
	[29.9, 0],
	[30, 1],
	[40, 1],
	[50, 2],
	[70, 2],
	[100, 3],
	[500, 3],
	[2000, 3],
	[14999, 3],
	[15000, 4],
	// inconsistent data never breaks the climb: a rung whose floor sits above the booked amount holds the figure
	[90, 3],
];
const MIN_RUNG_MS = 900; // every rung the climb passes is on screen at least this long (normal speed)
const STEP = 4;
for (const [ax, finalIdx] of rounds) {
	const amount = X(ax);
	for (const speed of [1, 0.5, 0.3]) {
		const plan = P.planCount(amount, finalIdx, RUNG_FLOORS_BOOKED, speed);
		const tag = `${ax}x rung ${finalIdx} @${speed}`;
		if (!(plan.totalMs > 0)) fail(`${tag}: totalMs ${plan.totalMs}`);
		let prev = -1;
		let prevRung = 0;
		const rungFirst = new Map();
		const rungLast = new Map();
		for (let ms = 0; ms <= plan.totalMs + 50; ms += STEP) {
			const { value, rung } = P.countAt(plan, ms);
			if (!Number.isInteger(value)) fail(`${tag}: value ${value} at ${ms} ms is not a whole booked unit`);
			if (value < prev) fail(`${tag}: count went DOWN ${prev} -> ${value} at ${ms} ms`);
			if (value > amount) fail(`${tag}: ${value} passes the booked ${amount} at ${ms} ms`);
			if (rung < prevRung) fail(`${tag}: rung went down ${prevRung} -> ${rung} at ${ms} ms`);
			if (rung > finalIdx) fail(`${tag}: rung ${rung} passes the landed rung ${finalIdx}`);
			if (rung > prevRung + 1) fail(`${tag}: rung skipped ${prevRung} -> ${rung} at ${ms} ms`);
			if (!rungFirst.has(rung)) rungFirst.set(rung, ms);
			rungLast.set(rung, ms);
			prev = value;
			prevRung = rung;
		}
		// a crossing below MAX happens exactly at its floor (clamped to the booked amount): the rung changes at the
		// segment boundary and the figure there IS the floor
		for (const seg of plan.segs) {
			if (seg.rung === 0) continue;
			const at = P.countAt(plan, seg.startMs);
			const before = P.countAt(plan, seg.startMs - 0.5);
			if (at.rung !== seg.rung || before.rung !== seg.rung - 1) fail(`${tag}: rung ${seg.rung} boundary shows ${before.rung} -> ${at.rung}`);
			if (seg.rung < 4) {
				const floor = Math.min(amount, RUNG_FLOORS_BOOKED[seg.rung]);
				if (at.value !== floor) fail(`${tag}: crossed to rung ${seg.rung} at ${at.value}, floor ${floor}`);
			}
		}
		const end = P.countAt(plan, plan.totalMs);
		if (end.value !== amount) fail(`${tag}: lands on ${end.value}, want exactly ${amount}`);
		if (end.rung !== finalIdx) fail(`${tag}: lands on rung ${end.rung}, want ${finalIdx}`);
		const late = P.countAt(plan, plan.totalMs * 3);
		if (late.value !== amount || late.rung !== finalIdx) fail(`${tag}: after the count ${late.value} / rung ${late.rung}`);
		const start = P.countAt(plan, 0);
		if (start.rung !== 0) fail(`${tag}: starts on rung ${start.rung}, want BIG (0)`);
		// every rung gets real time
		for (let r = 0; r <= finalIdx; r += 1) {
			if (!rungFirst.has(r)) {
				fail(`${tag}: rung ${r} never shown`);
				continue;
			}
			const shown = (r === finalIdx ? plan.totalMs : rungLast.get(r)) - rungFirst.get(r);
			if (shown < MIN_RUNG_MS * speed - STEP * 2) fail(`${tag}: rung ${r} on screen ${shown} ms < ${MIN_RUNG_MS * speed}`);
		}
		// MAX: the sign is up while the figure is still below the cap, and it lands exactly on the cap
		if (finalIdx === 4) {
			const at = rungFirst.get(4);
			const v = P.countAt(plan, at).value;
			if (!(v < WIN_CAP_BOOKED * 0.5)) fail(`${tag}: MAX sign comes up at ${v}, not before the cap`);
			if (plan.totalMs - at < 2000 * speed) fail(`${tag}: MAX sign up only ${plan.totalMs - at} ms before the cap lands`);
			// the old equal split spent ~60% of the count below 100x and raced 100x -> 15,000x in 1.6 s
			let below = 0;
			for (let ms = 0; ms <= plan.totalMs; ms += STEP) if (P.countAt(plan, ms).value < X(100)) below += STEP;
			if (below / plan.totalMs > 0.5) fail(`${tag}: ${Math.round((100 * below) / plan.totalMs)}% of the count is spent below 100x`);
		}
	}
	// speed scales the whole count
	const n = P.planCount(amount, finalIdx, RUNG_FLOORS_BOOKED, 1).totalMs;
	for (const s of [0.5, 0.3]) {
		const t = P.planCount(amount, finalIdx, RUNG_FLOORS_BOOKED, s).totalMs;
		if (Math.abs(t - n * s) > 2) fail(`${ax}x: count at speed ${s} is ${t} ms, want ${n * s}`);
	}
}
// a log ramp, not a linear one: halfway through an EPIC 2000x count the figure is far below half the amount
{
	const plan = P.planCount(X(2000), 3, RUNG_FLOORS_BOOKED, 1);
	const mid = P.countAt(plan, plan.totalMs / 2).value;
	if (!(mid < X(2000) * 0.25)) fail(`2000x: halfway figure ${mid} looks linear (want < 25% of the amount)`);
	const rungMs = [0, 1, 2, 3].map((r) => plan.segs.filter((s) => s.rung === r).reduce((a, s) => a + s.endMs - s.startMs, 0));
	if (Math.max(...rungMs) > 3 * Math.min(...rungMs)) fail(`2000x: rung times ${rungMs.join('/')} are lopsided`);
}
// the normal-speed MAX count stays a presentation, not a wait
{
	const t = P.planCount(WIN_CAP_BOOKED, 4, RUNG_FLOORS_BOOKED, 1).totalMs;
	if (t < 7000 || t > 11500) fail(`MAX count ${t} ms at normal speed (want 7.0 .. 11.5 s)`);
	const e = P.planCount(X(500), 3, RUNG_FLOORS_BOOKED, 1).totalMs;
	if (e < 4500 || e > 8000) fail(`EPIC 500x count ${e} ms at normal speed (want 4.5 .. 8 s)`);
}

// ---- timeline ----------------------------------------------------------------------------------------------------------
{
	const n = P.rungTimeline(1, false);
	for (const s of [0.5, 0.3]) {
		const t = P.rungTimeline(s, false);
		for (const k of ['enterMs', 'dropMs', 'swapMs', 'flareMs', 'holdMs', 'maxHoldMs', 'cardFadeMs', 'cardHoldMs', 'outMs']) {
			if (!(n[k] > 0)) fail(`timeline ${k} = ${n[k]} at normal speed`);
			if (Math.abs(t[k] - n[k] * s) > 1) fail(`timeline ${k} at speed ${s} = ${t[k]}, want ${n[k] * s} (the card fade speeds up too)`);
		}
	}
	const r = P.rungTimeline(1, true);
	if (r.dropMs !== 0) fail(`reduced motion: the sign still drops (${r.dropMs} ms)`);
	if (r.slideOut !== false || n.slideOut !== true) fail(`reduced motion must not slide the sign out (plain fade)`);
	const plan = P.planCount(WIN_CAP_BOOKED, 4, RUNG_FLOORS_BOOKED, 1);
	const w = P.watchdogMs(plan, n, true);
	const need = n.enterMs + n.dropMs + plan.totalMs + n.maxHoldMs + n.cardFadeMs + n.cardHoldMs + n.outMs;
	// the ticker's step is capped (FRAME_STEP_CAP_MS), so a device below 1000 / cap fps runs the presentation clock
	// slower than wall time: the ceiling scales WITH the timeline (judge 2026-09-26: +4 s cut a 15 fps MAX card short)
	if (!(w >= need * 1.5 + 2000 && w <= need * 2.2 + 4000)) fail(`watchdog ${w} ms for a MAX climb needing ${need} ms (want >= 1.5x + 2 s)`);
	if (!(P.FRAME_STEP_CAP_MS >= 100)) fail(`frame step cap ${P.FRAME_STEP_CAP_MS} ms: the clock must keep wall time down to 10 fps`);
	// at 15 fps the capped clock still finishes a MAX climb inside the watchdog
	const slow = need * Math.max(1, 1000 / 15 / P.FRAME_STEP_CAP_MS);
	if (!(w > slow)) fail(`watchdog ${w} ms fires before a 15 fps MAX climb (${Math.round(slow)} ms) ends`);
}

// ---- look + fx per rung ------------------------------------------------------------------------------------------------
const lum = (c) => {
	const ch = [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const hue = (c) => {
	const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
	const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
	if (d === 0) return 0;
	let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return (h * 60 + 360) % 360;
};
const L = P.RUNG_LOOK;
if (!Array.isArray(L) || L.length !== 5) fail(`RUNG_LOOK has ${L?.length} rungs, want 5`);
else {
	const keys = L.map((l) => l.key).join(',');
	if (keys !== 'big,huge,mega,epic,max') fail(`RUNG_LOOK keys ${keys}`);
	const glow = (l) => lum(l.light) * l.bloom;
	for (let i = 0; i < 4; i += 1) if (!(glow(L[4]) > glow(L[i]))) fail(`MAX light is not the brightest (vs ${L[i].key})`);
	const dh = Math.abs(hue(L[3].light) - hue(L[1].light));
	if (Math.min(dh, 360 - dh) < 18) fail(`EPIC light hue ${hue(L[3].light).toFixed(0)} too close to HUGE ${hue(L[1].light).toFixed(0)}`);
	const h4 = hue(L[4].light);
	if (!(h4 >= 38 && h4 <= 56)) fail(`MAX light hue ${h4.toFixed(0)} is not gold`);
	for (let i = 1; i < 5; i += 1) if (!(L[i].grow > L[i - 1].grow)) fail(`sign does not grow ${L[i - 1].key} -> ${L[i].key}`);
	if (!(L[4].grow - L[3].grow >= 0.05)) fail(`MAX sign (${L[4].grow}) is not clearly bigger than EPIC (${L[3].grow})`);
	for (const l of L) if (!(l.scrim >= 0.1 && l.scrim <= 0.25)) fail(`${l.key} scrim ${l.scrim} outside the light 0.10..0.25 band`);
}
for (const q of ['high', 'mid', 'low']) {
	const b = P.pieceBudget(q);
	if (b.rain + b.crossing + b.landing > b.cap) fail(`${q}: rain ${b.rain} + bursts ${b.crossing}+${b.landing} exceed the cap ${b.cap}`);
	if (!(b.crossing >= 4 && b.landing >= 6)) fail(`${q}: bursts ${b.crossing}/${b.landing} too small to read`);
	// the MAX card keeps a coin storm over it (judge 2026-09-26: the card was a frozen poster), inside the same cap as
	// the rain it overlaps; it scales with the tier
	if (!(b.card >= 8)) fail(`${q}: max-win card storm ${b.card} coins is too thin to read as alive`);
	if (b.rain + b.card > b.cap) fail(`${q}: rain ${b.rain} + card storm ${b.card} exceed the cap ${b.cap}`);
	if (q !== 'high' && !(b.card < P.pieceBudget('high').card)) fail(`${q}: card storm ${b.card} does not scale down from high`);
	let last;
	for (let r = 0; r < 5; r += 1) {
		const f = P.rungFx(r, q, false);
		const g = P.rungFx(r, q, true);
		if (f.rain > b.rain) fail(`${q} rung ${r}: rain ${f.rain} over its budget ${b.rain}`);
		if (!(f.raySpeed > 0 && f.shakePx > 0 && f.sparkRing > 0 && f.rain > 0 && f.embers > 0)) fail(`${q} rung ${r}: fx missing ${JSON.stringify(f)}`);
		if (last && !(f.raySpeed > last.raySpeed && f.rayWidth >= last.rayWidth && f.shakePx > last.shakePx && f.rain >= last.rain)) fail(`${q} rung ${r}: fx does not escalate`);
		for (const k of ['raySpeed', 'shakePx', 'sparkRing', 'rain', 'embers', 'volley', 'breath', 'sway', 'ringScale']) if (g[k] !== 0) fail(`${q} rung ${r} reduced motion: ${k} = ${g[k]}, want 0`);
		if (!(g.rays > 0)) fail(`${q} rung ${r} reduced motion: the rays should stay (static), got ${g.rays}`);
		last = f;
	}
	const hi = P.rungFx(4, 'high', false), lo = P.rungFx(4, q, false);
	for (const k of ['rays', 'embers', 'rain', 'volley', 'sparkRing']) if (lo[k] > hi[k]) fail(`${q}: ${k} ${lo[k]} above high's ${hi[k]}`);
}
{
	const hi = P.rungFx(4, 'high', false), lo = P.rungFx(4, 'low', false);
	if (!(lo.rain < hi.rain && lo.embers < hi.embers)) fail(`quality tiers do not scale the MAX counts (low ${lo.rain}/${lo.embers}, high ${hi.rain}/${hi.embers})`);
	const br = P.rungFx(0, 'high', false).breath;
	if (!(br >= 0.04 && br <= 0.1)) fail(`breath ${br}: want the sign to breathe ~1.0 <-> 1.05..1.1`);
}

// ---- the sign's size and place come from the VISIBLE view, not the board layout ---------------------------------------
// (judge 2026-09-26: in the Rescue layout the board shrinks under the building band, so every sign came out small and
// low — MAX at 55% of the width, smaller than the base game's EPIC). Ganja's banner is ~70% of a wide screen.
{
	const aspect = 728 / 1200; // winrungs/signs: every rung shares one 1200 x 728 plate layout
	const BOARD_OF_TEX = 1139.4 / 1200; // the title board's share of the texture width
	for (const q of ['high', 'mid', 'low']) {
		const peak = 1 + P.rungFx(4, q, false).breath;
		for (const [W, H, bar] of [[1440, 900, 810], [1920, 1080, 990], [1280, 720, 640], [1024, 768, 680]]) {
			const L = P.signLayout({ y: 0, w: W, bottom: bar, stacked: false, aspect, q });
			const maxPeak = (L.w0 * P.signGrow(4, false) * peak) / W;
			const heightBound = L.w0 * aspect * L.growTop >= bar * 0.9 - 1;
			if (!heightBound && !(maxPeak >= 0.66 && maxPeak <= 0.78)) fail(`${W}x${H} ${q}: MAX at its breath peak spans ${(100 * maxPeak).toFixed(0)}% of the width (want ~70%)`);
			if (!((L.w0 * BOARD_OF_TEX) / W >= (heightBound ? 0.4 : 0.52))) fail(`${W}x${H} ${q}: BIG board only ${((100 * L.w0 * BOARD_OF_TEX) / W).toFixed(0)}% of the width`);
			const top = L.centreY - (aspect / 2) * L.w0 * L.growTop;
			const bottom = L.centreY + (aspect / 2) * L.w0 * L.growTop;
			if (top < -1 || bottom > bar + 1) fail(`${W}x${H} ${q}: MAX sign ${top.toFixed(0)}..${bottom.toFixed(0)} leaves the band 0..${bar}`);
			if (!(L.centreY >= bar * 0.4 && L.centreY <= bar * 0.52)) fail(`${W}x${H} ${q}: sign centre ${L.centreY.toFixed(0)} is not centred in the band (0..${bar})`);
		}
		// phones: ~94% of the width at MAX's peak (ganja), BIG well over 80%, the sign lower than the top third
		for (const [W, H, bar] of [[390, 844, 690], [360, 640, 520], [430, 932, 780]]) {
			const L = P.signLayout({ y: 0, w: W, bottom: bar, stacked: true, aspect, q });
			const maxPeak = (L.w0 * P.signGrow(4, true) * peak) / W;
			if (!(maxPeak <= 1.0 && maxPeak >= 0.9)) fail(`${W}x${H} ${q}: phone MAX peak ${(100 * maxPeak).toFixed(0)}% of the width (want 90..100%)`);
			if (!((L.w0 * BOARD_OF_TEX) / W >= 0.78)) fail(`${W}x${H} ${q}: phone BIG board only ${((100 * L.w0 * BOARD_OF_TEX) / W).toFixed(0)}% of the width`);
			if (!(L.centreY >= bar * 0.46 && L.centreY <= bar * 0.56)) fail(`${W}x${H} ${q}: phone sign centre ${L.centreY.toFixed(0)} not at ~0.5 of the band 0..${bar}`);
		}
	}
	for (const st of [false, true]) {
		for (let r = 1; r < 5; r += 1) if (!(P.signGrow(r, st) > P.signGrow(r - 1, st))) fail(`${st ? 'phone' : 'wide'}: the sign does not grow at rung ${r}`);
		if (!(P.signGrow(4, st) - P.signGrow(3, st) >= 0.04)) fail(`${st ? 'phone' : 'wide'}: MAX is not clearly bigger than EPIC`);
	}
}

// ---- the light gathers at the sign on EVERY plate (look rule) -----------------------------------------------------------
// Judge 2026-09-26, Station 13's bright red plate: the band under the plank was only +1..+32 luma over the screen edge
// (HUGE's siren red vanished on the red door; MEGA's additive blue went magenta). Ganja's is +75 (2.1x). A modelled
// estimate of that band vs the edge at the same height, from the numbers WinRungs draws with (P.stageLight):
//   centre = plate under the sign, under the navy scrim, recoloured by the normal-blend light pool, plus the additive
//            bloom (tinted `core`), the hot core, the ray fan and the sign's glow halo;
//   edge   = plate edge, under the scrim and both vignette passes, plus the rays' faint tail.
// The texture samples at those two points follow the sprite geometry in WinRungs.svelte (bloom / pool radii vs the
// plank, the vignette's corner ramp) and are calibrated against 1440 x 900 base_win captures (P.LIGHT_SAMPLES).
{
	const luma = (c) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
	const sat = (c) => {
		const v = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
		const mx = Math.max(...v), mn = Math.min(...v);
		return mx === 0 ? 0 : (mx - mn) / mx;
	};
	const S = P.LIGHT_SAMPLES;
	const NAVY = luma(0x0b1226), VIG = luma(0x05070f);
	if (!Array.isArray(P.MOODS) || P.MOODS.join(',') !== 'base,backdraft,rescue,inferno') fail(`MOODS ${P.MOODS}`);
	for (const mood of P.MOODS ?? []) {
		const plate = P.PLATE_LUM[mood];
		for (let r = 0; r < 5; r += 1) {
			const s = P.stageLight(r, mood);
			let c = plate.under * (1 - s.scrim) + NAVY * s.scrim;
			const pa = s.poolAlpha * S.poolAt;
			c = c * (1 - pa) + luma(s.pool) * pa;
			c = Math.min(255, c + luma(s.core) * s.bloom * S.bloomAt + luma(s.accent) * s.coreAlpha * S.coreAt + luma(s.light) * (s.rayAlpha * S.rayAt + s.glow * S.glowAt));
			let e = plate.edge * (1 - s.scrim) + NAVY * s.scrim;
			const d = 1 - (1 - S.vigAt * s.vignette) * (1 - S.vigAt * s.vignette2);
			e = e * (1 - d) + VIG * d + luma(s.light) * s.rayAlpha * S.rayEdge;
			const tag = `${mood} ${L[r]?.key}`;
			// the goal on screen is >= 1.6x; the model runs high at low light (the pre-fix look scores 1.55..1.91 here but
			// measured 1.0..1.4 on screen), so it must clear 2.0x
			if (!(c / e >= 2.0)) fail(`${tag}: modelled light under the sign ${c.toFixed(0)} vs edge ${e.toFixed(0)} = ${(c / e).toFixed(2)}x (want >= 2.0x model, 1.6x on screen)`);
			if (!(e >= 28)) fail(`${tag}: edge ${e.toFixed(0)} — the station must stay readable, not blacked out`);
			if (!(s.scrim >= 0.1 && s.scrim <= 0.25)) fail(`${tag}: scrim ${s.scrim}`);
			if (mood === 'base' || mood === 'backdraft') {
				if (r <= 2 && !(s.bloom >= 0.6 && s.rayAlpha >= 0.3)) fail(`${tag}: bright plate needs bloom >= 0.6 and rays >= 0.3 (got ${s.bloom.toFixed(2)} / ${s.rayAlpha.toFixed(2)})`);
				if (!(s.vignette >= 0.95)) fail(`${tag}: bright plate vignette ${s.vignette} (want ~1)`);
			}
		}
	}
	// HUGE: a warm-white core (the siren red stays on the rays and rim) so it separates from the red door
	const huge = P.stageLight(1, 'base');
	const hh = hue(huge.core);
	if (!(sat(huge.core) <= 0.4 && hh >= 15 && hh <= 50)) fail(`HUGE core ${huge.core.toString(16)} is not warm white`);
	if (!(hue(huge.light) <= 12 || hue(huge.light) >= 348)) fail(`HUGE rays ${huge.light.toString(16)} are not siren red`);
	// MEGA: a true blue — the pool recolours the plate blue and the core is a cool white, never additive blue over red
	const mega = P.stageLight(2, 'base');
	if (!(hue(mega.pool) >= 215 && hue(mega.pool) <= 250 && sat(mega.pool) >= 0.6)) fail(`MEGA pool ${mega.pool.toString(16)} is not a deep blue`);
	if (!(hue(mega.core) >= 200 && hue(mega.core) <= 235 && sat(mega.core) <= 0.35)) fail(`MEGA core ${mega.core.toString(16)} is not a cool white`);
	if (!(mega.poolAlpha >= 0.45)) fail(`MEGA pool alpha ${mega.poolAlpha} too weak to turn the red door blue`);
}

// ---- handovers never show two titles at once (judge 2026-09-26, fix round 2) --------------------------------------------
// Reduced-motion crossings cross-faded (MEGA WIN legible through EPIC WIN) and the MAX sign -> card handover was a
// 420 ms cross-dissolve ('WIN' next to 'MAX WIN', '$15,000.00' over '15,000x'). Both are now sequenced.
{
	const T = typeof P.boardSwapAlpha === 'function' && typeof P.cardHandover === 'function';
	if (!T) fail('rungPacing.ts: boardSwapAlpha / cardHandover missing');
	for (const reduced of T ? [false, true] : []) {
		let pb = -1, po = 2;
		for (let i = 0; i <= 400; i += 1) {
			const p = i / 400;
			const s = P.boardSwapAlpha(p, reduced);
			const tag = `board swap ${reduced ? 'reduced' : 'normal'} p=${p.toFixed(3)}`;
			if (!(s.board >= 0 && s.board <= 1 && s.old >= 0 && s.old <= 1)) fail(`${tag}: alpha out of range ${JSON.stringify(s)}`);
			if (s.board < pb - 1e-9 || s.old > po + 1e-9) fail(`${tag}: not monotone`);
			pb = s.board;
			po = s.old;
			// normal motion: the new board is solid from its first frame and the old one fades BEHIND it (it is drawn under
			// the new board), so a title is never seen through another; reduced motion: never both at once
			if (!reduced && s.board !== 1) fail(`${tag}: the new board must be solid from its first frame (got ${s.board})`);
			if (reduced && s.board > 0 && s.old > 0) fail(`${tag}: both boards visible (${s.old.toFixed(2)} old, ${s.board.toFixed(2)} new)`);
		}
		const end = P.boardSwapAlpha(1, reduced);
		if (!(end.board === 1 && end.old === 0)) fail(`board swap ${reduced}: does not end on the new board alone ${JSON.stringify(end)}`);
		if (!(P.boardSwapAlpha(0, reduced).old === 1)) fail(`board swap ${reduced}: the old board does not start solid`);
		if (!(P.boardSwapAlpha(0.34, false).old === 0 || reduced)) fail('board swap: the old board lingers past a third of the swap');
		for (const speed of [1, 0.5, 0.3]) {
			const tl = P.rungTimeline(speed, reduced);
			const tag = `card handover ${reduced ? 'reduced' : 'normal'} @${speed}`;
			let ps = 2, pc = -1, legibleMs = 0;
			for (let ms = 0; ms <= tl.cardFadeMs * 1.4; ms += 0.5) {
				const h = P.cardHandover(ms, tl.cardFadeMs, reduced);
				for (const k of ['sign', 'card', 'flash', 'land']) if (!(h[k] >= 0 && h[k] <= 1)) fail(`${tag} ${ms}ms: ${k} ${h[k]}`);
				if (h.sign > ps + 1e-9 || h.card < pc - 1e-9) fail(`${tag} ${ms}ms: not monotone`);
				ps = h.sign;
				pc = h.card;
				const both = Math.min(h.sign, h.card);
				if (reduced) {
					if (both > 0) fail(`${tag} ${ms}ms: sign ${h.sign.toFixed(2)} and card ${h.card.toFixed(2)} share a frame`);
					if (h.flash !== 0 || h.land !== 1) fail(`${tag}: reduced motion adds a flash / an overshoot`);
				} else {
					// a faint trace under a full flash is allowed for a frame; two readable titles never
					if (both > 0.12) fail(`${tag} ${ms}ms: sign ${h.sign.toFixed(2)} and card ${h.card.toFixed(2)} both legible`);
					if (both > 0 && h.flash < 0.2) fail(`${tag} ${ms}ms: the overlap is not covered by the flash (${h.flash.toFixed(2)})`);
					if (both > 0.05) legibleMs += 0.5;
				}
			}
			if (!reduced && legibleMs > 40) fail(`${tag}: sign and card overlap for ${legibleMs} ms`);
			const at = (f) => P.cardHandover(tl.cardFadeMs * f, tl.cardFadeMs, reduced);
			if (!(at(1).card === 1 && at(1).sign === 0)) fail(`${tag}: the fade does not end on the card alone`);
			if (!reduced && !(at(0.4).card === 1 && at(0.3).sign === 0)) fail(`${tag}: the card must land (full alpha) early, the sign clear first`);
			if (!reduced && !(at(0).land === 0 && at(1.24).land === 1)) fail(`${tag}: the card's landing overshoot runs 0..1 from its entry to 1.24x the fade`);
			if (!reduced && !(Math.max(...[0.1, 0.15, 0.2, 0.25].map((f) => at(f).flash)) >= 0.22)) fail(`${tag}: no covering flash`);
			// ...but a flashbulb, not a white-out: the MAX stage is already the brightest (measured mean luma 124 -> 201 at 0.36)
			if (!reduced && !(Math.max(...Array.from({ length: 101 }, (_, i) => at(i / 100).flash)) <= 0.3)) fail(`${tag}: the handover flash burns the screen out`);
		}
	}
}

// ---- the crossing volley: no screen edge throws one symbol over and over (judge 2026-09-26, fix round 2) -----------------
// keys[i % n] with edge = i % 4 and 4 keys (BIG L1..L4, EPIC H4..H1) gave every tile from one edge the same symbol.
if (typeof P.volleyKey !== 'function') fail('rungPacing.ts: volleyKey missing');
else {
	for (let n = 1; n <= 8; n += 1) {
		for (let count = 1; count <= 24; count += 1) {
			for (let offset = 0; offset < 6; offset += 1) {
				const edges = [[], [], [], []];
				for (let i = 0; i < count; i += 1) {
					const k = P.volleyKey(i, n, offset);
					if (!(Number.isInteger(k) && k >= 0 && k < n)) fail(`volley n=${n}: key ${k} out of range`);
					edges[i % 4].push(k);
				}
				edges.forEach((ks, e) => {
					const want = Math.min(n, ks.length);
					if (new Set(ks.slice(0, n)).size !== Math.min(n, ks.slice(0, n).length)) fail(`volley n=${n} count=${count} off=${offset}: edge ${e} repeats a symbol within its first ${n} tiles (${ks})`);
					if (n >= 2) for (let j = 1; j < ks.length; j += 1) if (ks[j] === ks[j - 1]) fail(`volley n=${n}: edge ${e} throws ${ks[j]} twice in a row`);
					if (new Set(ks).size !== want) fail(`volley n=${n} count=${count}: edge ${e} shows ${new Set(ks).size} symbols, want ${want}`);
				});
			}
		}
	}
}

// ---- the desktop plate chief: whole hose, feet on something (judge 2026-09-26, fix round 2) ------------------------------
// The slot mask cut his hose tail and, lifted over the ALARM BOOST chip, he stood ~20 px up in mid-air.
if (typeof P.widenPlateSlot !== 'function' || typeof P.plateStand !== 'function') fail('rungPacing.ts: widenPlateSlot / plateStand missing');
else {
	const { fitRigInSlot } = await import(SRC + 'anim/rigLogic.ts');
	const chief = { x: -171.06, y: -1.47, width: 287.94, height: 423.83 }; // pf_chief.json skeleton bounds
	for (const [w, h] of [[260, 330], [300, 390], [180, 400], [420, 240], [90, 120]]) {
		const slot = { x: 1000, w, h };
		const fit = (sw) => fitRigInSlot(chief, sw, h, 1).scale;
		const wide = P.widenPlateSlot(slot, fit, P.PLATE_HOSE_REACH);
		const before = fitRigInSlot(chief, w, h, 1);
		const after = fitRigInSlot(chief, wide.w, h, wide.scale);
		const tag = `plate slot ${w}x${h}`;
		if (!(P.PLATE_HOSE_REACH >= 0.25)) fail(`PLATE_HOSE_REACH ${P.PLATE_HOSE_REACH}: too little room for the hose`);
		if (!(wide.w >= w * (1 + 2 * P.PLATE_HOSE_REACH) - 1e-6 && wide.x <= slot.x - w * P.PLATE_HOSE_REACH + 1e-6)) fail(`${tag}: the mask is not widened`);
		if (Math.abs(wide.x + after.x - (slot.x + before.x)) > 1e-6) fail(`${tag}: the chief moves (${slot.x + before.x} -> ${wide.x + after.x})`);
		if (Math.abs(after.scale - before.scale) > 1e-9) fail(`${tag}: the chief changes size (${before.scale} -> ${after.scale})`);
		if (Math.abs(after.y - before.y) > 1e-9) fail(`${tag}: the chief's feet move`);
	}
	const none = P.widenPlateSlot({ x: 5, w: 100, h: 100 }, null, P.PLATE_HOSE_REACH);
	if (!(none.x === 5 && none.w === 100 && none.scale === 1)) fail('plate slot: no rig bounds must leave the slot as it is');
	// the step fills the gap between his soles and the support (chip top / HUD bar top), and is skipped when he stands on it
	const st = P.plateStand(700, 720, 1300, 180);
	if (!(st && st.y === 700 && st.h === 20 && st.x === 1210 && st.w === 180)) fail(`plateStand: ${JSON.stringify(st)}`);
	if (P.plateStand(718, 720, 1300, 180) !== null) fail('plateStand: a 2 px gap needs no step');
	if (P.plateStand(730, 720, 1300, 180) !== null) fail('plateStand: soles below the support need no step');
}

// the crossing volley flies IN from the four screen edges: every launch point sits on (or just outside) an edge, each
// edge gets its share, no two tiles share a launch point, and every tile heads into the view
{
	if (typeof P.volleyLaunch !== 'function') fail('volleyLaunch: missing (the tiles were never positioned: all born at the stage origin)');
	else
		for (const view of [{ x: 0, y: 0, w: 1440, h: 900 }, { x: 0, y: 0, w: 390, h: 844 }]) {
			const n = 12, size = 60, cx = view.w / 2, cy = view.h * 0.4;
			const pts = [];
			const perEdge = [0, 0, 0, 0];
			for (let i = 0; i < n; i += 1) {
				const l = P.volleyLaunch(i, n, view, cx, cy, size, 2, 0.5, 0.5, 0.5);
				pts.push(l);
				const tag = `volleyLaunch ${view.w}x${view.h} #${i}`;
				const onLeft = l.x0 <= view.x + 1e-6, onRight = l.x0 >= view.x + view.w - 1e-6;
				const onTop = l.y0 <= view.y + 1e-6, onBottom = l.y0 >= view.y + view.h - 1e-6;
				if (!(onLeft || onRight || onTop || onBottom)) fail(`${tag}: launch (${l.x0.toFixed(0)}, ${l.y0.toFixed(0)}) is not on a screen edge`);
				perEdge[onLeft ? 0 : onRight ? 1 : onTop ? 2 : 3] += 1;
				const into = (cx - l.x0) * l.vx + (cy - l.y0) * l.vy;
				if (!(into > 0)) fail(`${tag}: does not head into the view`);
				if (![l.x0, l.y0, l.vx, l.vy].every(Number.isFinite)) fail(`${tag}: non-finite`);
			}
			if (perEdge.some((k) => k < Math.floor(n / 4))) fail(`volleyLaunch ${view.w}x${view.h}: edges uneven ${perEdge}`);
			for (let a = 0; a < n; a += 1)
				for (let b = a + 1; b < n; b += 1)
					if (Math.hypot(pts[a].x0 - pts[b].x0, pts[a].y0 - pts[b].y0) < 0.05 * Math.min(view.w, view.h))
						fail(`volleyLaunch ${view.w}x${view.h}: tiles ${a} and ${b} share a launch point`);
		}
}

if (problems.length) {
	console.error(`FAIL check_rung_pacing: ${problems.length} problem(s)`);
	for (const p of problems.slice(0, 40)) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_rung_pacing: ${rounds.length} climbs x 3 speeds, timeline, watchdog, reduced motion, rung look, light per mood, sign size, piece budget, handovers, volley and plate chief`);
