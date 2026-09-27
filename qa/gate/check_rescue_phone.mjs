#!/usr/bin/env node
/**
 * Rescue Spins / Inferno Rescue on a PHONE (stacked layout) reads instantly (owner 2026-09-26: "This view is not clear
 * at all"): the pure rules of game/rescue/rescuePhone.ts under the real art geometry (artMeta.generated.ts), plus the
 * two ordering rules the director and the scene must keep (they regressed silently once: no jets on any douse, a
 * five-jet burst at a building change, Trotters re-shown in the saved building).
 *   node qa/gate/check_rescue_phone.mjs     (node >= 22.18: TypeScript type stripping)
 */
import { readFileSync } from 'node:fs';

const APP = new URL('../../apps/piggy_firefighters/src/', import.meta.url);
const M = await import(new URL('game/rescue/rescuePhone.ts', APP).href);
const { frameMeta, roomsMeta, propsMeta } = await import(new URL('game/artMeta.generated.ts', APP).href);
const { RESCUE_RAIL_CELLS, rescueBandCells, createRoomsSeen, forgetRooms, roomOneShots, rescueBannerText, phoneRescueBand, phoneDropPath, phoneDropSlot, fitWidth, createDropGate, trotterSlot, phoneDropPose, phoneBannerRail, BANNER_FULL, plaqueAlpha, runningTotal } = M;
const { WIN_CAP_BOOKED } = await import(new URL('game/roundTier.ts', APP).href);

const problems = [];
const expect = (label, ok, detail = '') => {
	if (!ok) problems.push(`${label}${detail ? `: ${detail}` : ''}`);
};
let cases = 0;
const is = (label, got, want) => {
	cases += 1;
	expect(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const ok = (label, cond, detail) => {
	cases += 1;
	expect(label, cond, detail);
};

// ---- the band: +0.75 cell info rail on phones only ----------------------------------------------------------------
const S = 120; // SYMBOL_SIZE
const W = 5 * S;
const H = 3 * S * 1.3; // stacked rows are 1.3 cells tall
const pitch = roomsMeta.pitch_px;
const facadeBoxH = roomsMeta.facade.box[3] - roomsMeta.facade.box[1];
const BUILDING_BAND_CELLS = Math.round(((facadeBoxH - roomsMeta.rooms[0].box_in_facade[1]) / pitch + 0.06) * 100) / 100;
is('rail cells', RESCUE_RAIL_CELLS, 0.75);
is('desktop band unchanged', rescueBandCells(BUILDING_BAND_CELLS, false), BUILDING_BAND_CELLS);
is('phone band = facade band + rail', rescueBandCells(BUILDING_BAND_CELLS, true), Math.round((BUILDING_BAND_CELLS + 0.75) * 100) / 100);

// ---- the one-shot watcher: one spray per booked spray, nothing at a building change --------------------------------
{
	const seen = createRoomsSeen();
	const shots = (rooms) => {
		const s = roomOneShots(rooms, seen);
		return { sprays: s.sprays.map((x) => `${x.reel}:${x.fireAfter}`), rescues: s.rescues };
	};
	let rooms = [0, 1, 2, 3, 4].map((reel) => ({ reel, fire: 2, start: 2, sprayed: 0, rescued: false }));
	is('feature start plays nothing', shots(rooms), { sprays: [], rescues: [] });
	rooms[0].sprayed = 1;
	rooms[0].fire = 1;
	is('a douse spray (in place) plays one jet', shots(rooms), { sprays: ['0:1'], rescues: [] });
	is('no change, no jet', shots(rooms), { sprays: [], rescues: [] });
	rooms[0].sprayed = 2;
	rooms[0].fire = 0;
	is('second spray on the room, fire out (steam)', shots(rooms), { sprays: ['0:0'], rescues: [] });
	rooms[0].rescued = true;
	is('the rescue plays once', shots(rooms), { sprays: [], rescues: [0] });
	rooms[3].sprayed = 1;
	rooms[3].fire = 0;
	rooms[3].rescued = true;
	is('spray + rescue in one pass', shots(rooms), { sprays: ['3:0'], rescues: [3] });
	rooms = rooms.map((room) => ({ ...room, fire: room.start, rescued: false }));
	is('building change (a new rooms array, sprayed counts kept): no burst', shots(rooms), { sprays: [], rescues: [] });
	rooms[2].sprayed = 1;
	rooms[2].fire = 1;
	is('first spray in the new building', shots(rooms), { sprays: ['2:1'], rescues: [] });
	rooms[4].sprayed = 3;
	is('a jump of several counts is still ONE jet', shots(rooms), { sprays: ['4:2'], rescues: [] });
	forgetRooms(seen);
	rooms = [0, 1, 2, 3, 4].map((reel) => ({ reel, fire: reel === 0 ? 0 : 1, start: 1, sprayed: 0, rescued: reel === 0 }));
	is('a new feature whose room starts safe: no slide', shots(rooms), { sprays: [], rescues: [] });
}

// ---- the prize is said ONCE on a phone: the sill plaque, not the reel banner too -------------------------------------
is('phone banner: no amount', rescueBannerText('$5.00', true), 'RESCUED!');
is('desktop banner keeps the amount', rescueBannerText('$5.00', false), 'RESCUED! +$5.00');
is('no prize', rescueBannerText(null, false), 'RESCUED!');

// ---- phone band geometry under the real art (the RescueScene formulas) ---------------------------------------------
const kf = S / pitch;
const post = 0.34; // FRAME_POST_STACKED
const frameTopCells = (frameMeta.open_px.y0 / frameMeta.open_px.x0) * post + 0.04;
const bandCells = rescueBandCells(BUILDING_BAND_CELLS, true);
const frameTop = -frameTopCells * S;
const bandTop = -(frameTopCells + bandCells) * S;
const bandH = bandCells * S;
const facadeH = facadeBoxH * kf;
const facadeTop = bandTop + bandH - facadeH - S * 0.03;
const REEL_PADDING = 0.53;
const mid = roomsMeta.rooms[2].box_in_facade;
const facadeLeft = (2 + REEL_PADDING) * S - (mid[0] + (mid[2] - mid[0]) / 2) * kf;
const windows = roomsMeta.rooms.map((r) => {
	const [x0, y0, x1, y1] = r.window_in_facade;
	return { x: facadeLeft + x0 * kf, y: facadeTop + y0 * kf, w: (x1 - x0) * kf, h: (y1 - y0) * kf };
});
const smokeTop = facadeTop + Math.min(...roomsMeta.rooms.map((r) => r.box_in_facade[1])) * kf;
const [pw, ph] = propsMeta.props.spins_plate_blank.size;
const [bw, bh] = propsMeta.props.badge_blank.size;
const band = phoneRescueBand({ S, W, bandTop, smokeTop, frameTop, windows, plateAspect: pw / ph, badgeAspect: bh / bw });

const box = (c) => ({ x0: c.x - c.w / 2, x1: c.x + c.w / 2, y0: c.y - c.h / 2, y1: c.y + c.h / 2 });
const overlap = (a, b) => {
	const p = box(a);
	const q = box(b);
	return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
};
const r1 = (v) => Math.round(v * 10) / 10;
const CELL_390 = 390 / 5; // a stacked cell is width-bound: 5 cells across (measured 78 px at 390x844 with this band)
const CELL_375 = 69.3; // 375x667 is height-bound with this band (measured)
const px = (units, cell = CELL_390) => (units * cell) / S;

const rail = { building: band.building, total: band.total, badge: band.badge };
for (const [name, c] of Object.entries(rail)) {
	const b = box(c);
	ok(`rail ${name} inside the band top`, b.y0 >= bandTop - 0.01, `top ${r1(b.y0)} < band top ${r1(bandTop)}`);
	ok(`rail ${name} off the cornice (flames / smoke show)`, b.y1 <= smokeTop + 0.01, `bottom ${r1(b.y1)} > smoke top ${r1(smokeTop)}`);
	ok(`rail ${name} on the board`, b.x0 >= 0 && b.x1 <= W, `x ${r1(b.x0)}..${r1(b.x1)}`);
	for (const w of windows) ok(`rail ${name} off every window`, b.y1 <= w.y, `bottom ${r1(b.y1)} > window top ${r1(w.y)}`);
}
ok('rail building / total apart', !overlap(band.building, band.total));
ok('rail total / badge apart', !overlap(band.total, band.badge));
ok('rail building / badge apart', !overlap(band.building, band.badge));
ok('the badge swell (x1.28) stays on screen', band.badge.x + (band.badge.w / 2) * 1.28 <= W, `right ${r1(band.badge.x + (band.badge.w / 2) * 1.28)}`);

band.plaques.forEach((p, i) => {
	const w = windows[i];
	const b = box(p);
	ok(`plaque ${i} centred on its window`, Math.abs(p.x - (w.x + w.w / 2)) < 0.01, `${r1(p.x)} vs ${r1(w.x + w.w / 2)}`);
	ok(`plaque ${i} under the sill`, b.y0 >= w.y + w.h - 0.01, `top ${r1(b.y0)} < sill ${r1(w.y + w.h)}`);
	ok(`plaque ${i} above the header beam`, b.y1 <= frameTop + 0.01, `bottom ${r1(b.y1)} > beam ${r1(frameTop)}`);
	if (i > 0) ok(`plaques ${i - 1}/${i} apart`, !overlap(band.plaques[i - 1], p));
});
ok('plaque figure >= 14 px at 390x844', px(band.font.plaque) >= 14, `${r1(px(band.font.plaque))} px`);
// '+$10.00' keeps >= 14 px after the fit to its plaque at 390x844 (its width in the sign face, 3.85 em, measured on a
// 390x844 capture: 78.6 units wide at a 0.81 fit of a 25.2-unit font)
{
	const fill = band.plaques[2].w * M.PLAQUE_TEXT_FILL;
	const need = 3.85 * band.font.plaque;
	const shown = px(band.font.plaque) * Math.min(1, fill / need);
	ok("'+$10.00' on its plaque >= 14 px at 390x844", shown >= 14, `${r1(shown)} px`);
}
ok('TOTAL figure >= 14 px at 390x844', px(band.font.total) >= 14, `${r1(px(band.font.total))} px`);
ok('BUILDING >= 14 px at 390x844', px(band.font.building) >= 14, `${r1(px(band.font.building))} px`);

const bn = box(band.banner);
ok('banner rides the rail, above the windows', bn.y1 <= Math.min(...windows.map((w) => w.y)), `bottom ${r1(bn.y1)}`);
ok('banner clear of the reels (middle row untouched)', bn.y1 < 0 && !(bn.y1 > H / 3 && bn.y0 < (2 * H) / 3));
ok('banner leaves the xN badge showing', !overlap(band.banner, band.badge));
ok('the badge at peak swell (x1.28) stays off the banner', !overlap(band.banner, { ...band.badge, w: band.badge.w * 1.28, h: band.badge.h * 1.28 }), `banner right ${r1(box(band.banner).x1)} vs badge left ${r1(band.badge.x - band.badge.w * 0.64)}`);
ok('banner on the board', bn.x0 >= 0 && bn.x1 <= W, `x ${r1(bn.x0)}..${r1(bn.x1)}`);
ok('banner figure >= 14 px at 390x844 when fitted to 80 %', px(band.font.banner * 0.8) >= 14, `${r1(px(band.font.banner * 0.8))} px`);

// ---- the drop: the rescued Trotter leaves its OWN window straight down, at window size, and is gone at the beam -----
const pigH = 77; // the window Trotter (pf_rescued fitted to a window slot)
const slot = phoneDropSlot({ S, W, windows, frameTop });
ok('drop slot ends at the header beam (the mask hides the landing)', Math.abs(slot.y + slot.h - frameTop) < 0.01, `${r1(slot.y + slot.h)} vs ${r1(frameTop)}`);
windows.forEach((w, i) => {
	const feet = { x: w.x + w.w / 2, y: w.y + w.h * 0.86 };
	const path = phoneDropPath(feet, frameTop, pigH);
	ok(`drop ${i} straight down its column`, path.from.x === feet.x && path.to.x === feet.x);
	ok(`drop ${i} starts at the window`, path.from.y === feet.y);
	ok(`drop ${i} ends wholly under the beam`, path.to.y - pigH * 1.2 >= frameTop, `head ${r1(path.to.y - pigH * 1.2)} vs beam ${r1(frameTop)}`);
	ok(`drop ${i} starts inside the slot, head and all`, feet.x - S * 0.45 >= slot.x && feet.x + S * 0.45 <= slot.x + slot.w && feet.y - pigH * 1.2 >= slot.y);
});

// ---- EVERY rescue beat on a phone gives its Trotter one visible exit. The rig runtime slides only the FIRST rescue of a
// douse (it queues the rest 1.8 s apart and the next spin cancels them; super turbo / reduced motion slide nothing), so
// the scene drops a snapshot of every other rescued Trotter down its own column (reduced motion: fades it in place).
{
	const douseExits = (n, motion) => {
		const gate = createDropGate();
		gate.douse();
		return Array.from({ length: n }, () => gate.rescue(motion));
	};
	const normal = { reduced: false, speedTier: 0 };
	is('single rescue: the rig drop', douseExits(1, normal), ['rig']);
	is('double rescue: the rig drops the first, the scene drops the second', douseExits(2, normal), ['rig', 'drop']);
	is('three in one douse: one rig, two scene drops', douseExits(3, normal), ['rig', 'drop', 'drop']);
	// turbo holds are 0.4x while the rig slide is 0.8 s: the NEXT BUILDING / next spin beat would cut it mid-fall
	is('turbo: the scene drops every one (never cut mid-fall)', douseExits(2, { reduced: false, speedTier: 1 }), ['drop', 'drop']);
	is('super turbo: the rig slides nothing, the scene drops every one', douseExits(2, { reduced: false, speedTier: 2 }), ['drop', 'drop']);
	is('reduced motion: every Trotter fades in its window', douseExits(2, { reduced: true, speedTier: 0 }), ['fade', 'fade']);
	for (const motion of [normal, { reduced: false, speedTier: 2 }, { reduced: true, speedTier: 0 }]) {
		const exits = douseExits(5, motion);
		ok(`every rescue beat has exactly one visible exit (${JSON.stringify(motion)})`, exits.length === 5 && exits.every((e) => e === 'rig' || e === 'drop' || e === 'fade'));
		ok(`at most one rig drop per douse (${JSON.stringify(motion)})`, exits.filter((e) => e === 'rig').length <= 1);
	}
	const gate = createDropGate();
	gate.douse();
	gate.rescue(normal);
	gate.douse();
	is('the next douse starts with the rig drop again', gate.rescue(normal), 'rig');
	is('the landing (behind the beam) hides the rig host on a phone', gate.landed(true), true);
	is('wide layouts never hide it', gate.landed(false), false);
	// the scene's own drop: from the Trotter's feet straight down its column, a small hop, then gone under the beam
	const from = { x: 200, y: -300 };
	const to = { x: 200, y: -60 };
	const at = (p) => phoneDropPose(p, from, to, S);
	ok('scene drop starts at the window Trotter', at(0).x === from.x && Math.abs(at(0).y - from.y) < 0.01);
	ok('scene drop ends at the path end', Math.abs(at(1).y - to.y) < 0.01 && at(1).x === to.x);
	ok('scene drop stays in its own column', [0.1, 0.3, 0.5, 0.8].every((p) => at(p).x === from.x));
	ok('scene drop hops up a little first', at(0.08).y < from.y && from.y - at(0.08).y <= S * 0.12);
	const ys = [0.2, 0.35, 0.5, 0.65, 0.8, 0.95, 1].map((p) => at(p).y);
	ok('scene drop falls monotonically after the hop', ys.every((y, k) => k === 0 || y >= ys[k - 1]));
}

// ---- the phone Trotter stands lower and smaller in its window, so the fire behind it shows; wide layouts unchanged ----
{
	const wr = { x: 10, y: 20, w: 100, h: 80 };
	is('wide Trotter slot unchanged', trotterSlot(wr, false), { x: 10, y: 12, w: 100, h: 84 });
	const t = trotterSlot(wr, true);
	ok('phone Trotter slot starts low in the window (flames above it show)', t.y >= wr.y + wr.h * 0.25, `${t.y}`);
	ok('phone Trotter slot is narrower and shorter', t.w <= wr.w * 0.8 && t.h <= wr.h * 0.8);
	ok('phone Trotter slot centred on the window', Math.abs(t.x + t.w / 2 - (wr.x + wr.w / 2)) < 0.01);
}

// ---- the phone banner and the rail plates are never on screen together (no overlapped lettering) ------------------
{
	let both = 0;
	for (let k = 0; k <= 1000; k += 1) {
		const a = phoneBannerRail(k / 1000);
		if (a.banner > 0.001 && a.rail > 0.001) both += 1;
		if (a.banner < 0 || a.banner > 1 || a.rail < 0 || a.rail > 1) both += 1000;
	}
	is('banner and rail never cross-fade', both, 0);
	is('no banner: the rail shows', phoneBannerRail(1), { banner: 0, rail: 1 });
	is('the rail is still up the frame the banner starts', phoneBannerRail(0).rail, 1);
	is('the banner holds fully in its middle', phoneBannerRail(0.5), { banner: 1, rail: 0 });
	is('a replacing banner restarts fully in', phoneBannerRail(BANNER_FULL), { banner: 1, rail: 0 });
	const railBack = phoneBannerRail(0.95);
	ok('the rail comes back only after the banner is gone', railBack.banner === 0 && railBack.rail > 0);
}

// ---- a plaque appears only after its Trotter has dropped past it (never "swallowed" by its own prize) ---------------
is('plaque hidden at the rescue', plaqueAlpha(0, 1), 0);
is('plaque hidden while the drop passes', plaqueAlpha(850, 1), 0);
is('plaque fully in a little later', plaqueAlpha(1400, 1), 1);
ok('plaque fades in (no pop)', plaqueAlpha(1000, 1) > 0 && plaqueAlpha(1000, 1) < 1);
is('turbo shortens the wait', plaqueAlpha(900, 0.6), 1);

// ---- the rail TOTAL takes each prize in at its rescue (no TOTAL that disagrees with the plaques), never past the cap --
is('running total adds the prize', runningTotal(0, 500, WIN_CAP_BOOKED), 500);
is('running total clamps at 15,000x', runningTotal(WIN_CAP_BOOKED - 100, 500, WIN_CAP_BOOKED), WIN_CAP_BOOKED);
is('no prize, no change', runningTotal(1100, undefined, WIN_CAP_BOOKED), 1100);

is('fitWidth shrinks only', [fitWidth(200, 100), fitWidth(50, 100), fitWidth(0, 100)], [0.5, 1, 1]);

// ---- ordering rules in the sources (both shipped wrong once) ---------------------------------------------------------
const src = (p) => readFileSync(new URL(p, APP), 'utf8');
const body = (text, head) => {
	const at = text.indexOf(head);
	if (at < 0) return '';
	const next = text.indexOf('\nexport const ', at + head.length);
	return text.slice(at, next < 0 ? undefined : next);
};
const director = src('game/rescue/rescueDirector.ts');
const douse = body(director, 'export const douse');
const lastAt = douse.indexOf('stateRescue.lastRescue = rescue.reel');
ok('director: the rescued room is published before its rescue beat', lastAt >= 0 && lastAt < douse.indexOf("beat: 'rescue'"));
ok('director: a phone TOTAL takes the prize in at its rescue', /stacked[\s\S]{0,80}runningTotal\(stateRescue\.total, rescue\.prize, WIN_CAP_BOOKED\)/.test(douse));
const cleared = body(director, 'export const buildingCleared');
const holdAt = cleared.indexOf('await beat(900)');
const resetAt = cleared.indexOf('stateRescue.rooms = ');
const clearedBeatAt = cleared.indexOf("beat: 'buildingCleared'");
// the beat cancels the rig's queued ladder drops and starts the crew's celebrate WITH the banner (rigLogic); it must not
// wait out the hold (a queued Trotter then showed at the ladder top over BUILDING 1, and the celebrate was cut short)
ok('director: the buildingCleared beat fires with the banner, before the hold', clearedBeatAt >= 0 && holdAt > clearedBeatAt && resetAt > holdAt);

const scene = src('components/rescue/RescueScene.svelte');
const watchAt = scene.indexOf('roomOneShots(');
const effectAt = scene.lastIndexOf('$effect(', watchAt);
// code only: a comment that names the fields must not pass for a read
const tracked = scene.slice(effectAt, scene.indexOf('untrack(', effectAt)).replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok('scene: the spray / rescue watcher TRACKS each room field (read outside untrack)', watchAt > 0 && /\.sprayed/.test(tracked) && /\.rescued/.test(tracked));
// the beat above re-shows every room Trotter while the saved building is still up: the scene keeps the saved windows empty
// until the director replaces the rooms (the new building)
ok('scene: the saved windows stay empty through the NEXT BUILDING hold', /clearedRooms\s*=\s*stateRescue\.rooms/.test(scene) && /clearedRooms\s*===\s*stateRescue\.rooms/.test(scene));
ok('scene: a phone rescue that the rig does not slide gets the scene drop', /dropGate\.rescue\(/.test(scene) && /snapshotExit\(/.test(scene) && /generateTexture\(/.test(scene));
const steamAt = scene.indexOf('(steamNode = node)');
const firstPlateAt = scene.indexOf("<BaseSprite texture={tex('rescue_spins_plate')}");
ok('scene: steam draws under the plates (never over BUILDING / TOTAL)', steamAt > 0 && firstPlateAt > steamAt);
const plaqueHostAt = scene.indexOf('plaqueNodes[room.reel] = node');
const ladderHostAt = scene.indexOf('(dropNode = node)');
ok('scene: the drop draws over the prize plaques', plaqueHostAt > 0 && ladderHostAt > plaqueHostAt);

const stateGame = src('game/stateGame.svelte.ts');
ok('layout: the Rescue band is chosen per layout (phones get the rail)', /stateRescue\.active\s*\?\s*\(?\s*stacked\s*\?\s*BUILDING_BAND_CELLS_STACKED\s*:\s*BUILDING_BAND_CELLS/.test(stateGame));

if (problems.length) {
	console.error('FAIL check_rescue_phone');
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(
	`OK check_rescue_phone: ${cases} cases (band ${BUILDING_BAND_CELLS} -> ${bandCells} cells on phones; plaque ${r1(px(band.font.plaque))} px / TOTAL ${r1(px(band.font.total))} px at 390x844, plaque ${r1(px(band.font.plaque, CELL_375))} px at 375x667)`,
);
