#!/usr/bin/env node
/**
 * PROBE session — the stateful, built-artefact, subpath-served end-to-end sweep the COMMON-ISSUE-LEDGER asks for.
 * Serves the STAGED BUILD at /v70/ (the way Stake mounts a game), boots it against this lane's mock RGS, and drives
 * the real HUD. Four legs, each a family or three:
 *
 *   a  console-error-budget-unowned + round-lifecycle-second-pass: boot, 10 spins, every modal, then a feature bought
 *      TWICE back to back (alarm_call_false x2, rescue_buy x2). Budget: 0 console errors, 0 pageerrors, 0 same-origin
 *      >= 400, 0 WARNINGS whose text is hard-failure vocabulary, no warning-cap notice. Matched on TEXT, never level.
 *   b  restricted-terminology-scoped-too-narrowly + currency-marker + mandatory-disclosure: `?social=true` boot, scrape
 *      the rendered text of the bar, menu, rules sheet, bet ladder, autoplay menu and buy sheet (idle + pending card),
 *      and diff it against the live stake.us prohibited-term table (closed compounds included). Rules text must carry
 *      RTP, max win, malfunction, copyright and the retrigger statement.
 *   c  reviewer-viewport-layout D1: at 330x190, 400x225, 480x270, 800x450 and 320x568 open every overlay and prove each
 *      visible control is inside the viewport and hit-testable at its centre. Screenshots for the two smallest.
 *   d  replay-mode-as-afterthought: `?replay=true` boot (own ad-hoc replay RGS on :3060 that 500s any /wallet/*): the
 *      six-row pre-roll behind START, START inside 400x225 and hittable, the round plays, PLAY AGAIN re-plays it, zero
 *      wallet traffic. Screenshot at 400x225 mid-play (R2-06).
 *
 *   node qa/precheck/probe-session.mjs --legs a,b,c,d [--dir apps/piggy_firefighters/build] [--mount /v70]
 *        [--port 3062] [--rgs 127.0.0.1:3061] [--replay-port 3060]
 * Verdict: qa/precheck/evidence/session-<leg>.json (+ screenshots). Exit 0 when every requested leg passed.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './lib/pw.mjs';
import { serveSubpath } from './lib/serve-subpath.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv;
const flag = (name, fallback) => {
	const i = argv.indexOf(name);
	return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const LEGS = flag('--legs', 'a,b,c,d').split(',');
const DIR = path.resolve(REPO, flag('--dir', 'apps/piggy_firefighters/build'));
const MOUNT = flag('--mount', '/v70');
const PORT = Number(flag('--port', '3062'));
const RGS = flag('--rgs', '127.0.0.1:3061');
const REPLAY_PORT = Number(flag('--replay-port', '3060'));
const EVID = path.join(HERE, 'evidence');
fs.mkdirSync(EVID, { recursive: true });

const HARD_WARNING_RE = /validation|invalid|does not match|failed to (load|fetch|compile|link)|out of memory|context lost/i;
const CAP_RE = /too many warnings|no more warnings will be reported/i;
// Live stake.us prohibited-term table (social=true), as supplied to this lane, plus the closed compounds the
// word-boundary matcher cannot see (paylines, paytable, payout).
const RESTRICTED = [
	'win feature', 'pay out', 'paid out', 'pays out', 'payout', 'payouts', 'payline', 'paylines', 'paytable', 'stake', 'stakes', 'betting',
	'total bet', 'bet', 'bets', 'cash', 'money', 'payer', 'pay', 'pays', 'paid', 'buy', 'buys', 'purchase', 'purchases', 'bought',
	'at the cost of', 'rebet', 'cost of', 'cost', 'costs', 'credit', 'credits', 'fund', 'funds', 'buy bonus', 'bonus buy', 'gamble',
	'gambling', 'wager', 'wagers', 'deposit', 'withdraw', 'place your bets', 'currency', 'currencies',
];
const RESTRICTED_RE = new RegExp(`(?<![A-Za-z])(${RESTRICTED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z])`, 'gi');

const srv = await serveSubpath({ dir: DIR, mount: MOUNT, port: PORT });
const rgsOrigin = `http://${RGS}`;
const browser = await launch();

// ---------------------------------------------------------------- helpers
const attachConsole = (page, rec) => {
	page.on('console', (m) => {
		const t = m.text();
		const type = m.type();
		if (type === 'error') rec.errors.push(t.slice(0, 300));
		if (type === 'warning' && HARD_WARNING_RE.test(t)) rec.hardWarnings.push(t.slice(0, 300));
		if (CAP_RE.test(t)) rec.capNotices.push(t.slice(0, 200));
		rec.allCount += 1;
	});
	page.on('pageerror', (e) => rec.pageErrors.push(String(e?.message ?? e).slice(0, 300)));
	page.on('response', (r) => {
		if (/^(blob|data):/.test(r.url())) return;
		const u = new URL(r.url());
		if (u.origin === rgsOrigin || u.port === String(REPLAY_PORT)) {
			if (r.status() >= 400) rec.rgsFailed.push(`${r.status()} ${u.pathname}`);
			if (/^\/wallet\//.test(u.pathname)) rec.walletRequests.push(`${r.status()} ${u.pathname}`);
			// Round lifecycle, keyed on the wire (the built bundle has no DEV beacons): one /wallet/play per round, one
			// /wallet/end-round for every round the RGS left active (a win or a feature).
			if (u.pathname === '/wallet/play') r.json().then((b) => rec.plays.push({ t: Date.now(), mode: b?.round?.mode ?? null, active: !!b?.round?.active, payoutMultiplier: b?.round?.payoutMultiplier ?? null })).catch(() => rec.plays.push({ t: Date.now(), mode: null, active: false }));
			if (u.pathname === '/wallet/end-round') rec.endRounds.push(Date.now());
			return;
		}
		if (u.origin !== srv.origin) {
			rec.external.push(u.href);
			return;
		}
		if (r.status() >= 400) rec.failed.push(`${r.status()} ${u.pathname}`);
	});
};
const newRec = () => ({ allCount: 0, errors: [], pageErrors: [], hardWarnings: [], capNotices: [], failed: [], rgsFailed: [], walletRequests: [], external: [], plays: [], endRounds: [] });
const budgetChecks = (rec) => ({
	zeroConsoleErrors: rec.errors.length === 0,
	zeroPageErrors: rec.pageErrors.length === 0,
	zeroHardWarnings: rec.hardWarnings.length === 0,
	noWarningCap: rec.capNotices.length === 0,
	zeroSameOrigin4xx: rec.failed.length === 0,
	zeroExternalOrigins: rec.external.length === 0,
});

const bootUrl = (extra = '') => `${srv.base}?sessionID=s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}&rgs_url=${RGS}&device=desktop${extra}`;
const boot = async (page, vw, vh, extra = '') => {
	await page.goto(bootUrl(extra), { waitUntil: 'load' });
	await page.waitForSelector('.splash .press', { timeout: 90000 });
	await sleep(400);
	await page.mouse.click(Math.round(vw / 2), Math.round(vh / 2));
	await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
	await sleep(1500);
};
const isEnabled = (sel) => `(() => { const b = document.querySelector('${sel}'); return !!b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; })()`;
const waitIdle = (page, timeout = 60000) => page.waitForFunction(`${isEnabled('#spin')} && ${isEnabled('#buy')}`, null, { timeout, polling: 200 });
const waitBusy = (page, timeout = 15000) => page.waitForFunction(`!(${isEnabled('#spin')})`, null, { timeout, polling: 50 }).catch(() => {});
const waitFor = async (pred, timeout, what) => { const t0 = Date.now(); while (!pred()) { if (Date.now() - t0 > timeout) throw new Error(`timeout waiting for ${what}`); await sleep(100); } };
/** After a press that should place a round: wait for its /wallet/play, its /wallet/end-round when the RGS left it active, then idle. */
const waitRound = async (page, rec, { playTimeout = 20000, roundTimeout = 240000 } = {}) => {
	const nPlays = rec.plays.length, nEnds = rec.endRounds.length;
	await waitFor(() => rec.plays.length > nPlays, playTimeout, '/wallet/play');
	const play = rec.plays[nPlays];
	const t0 = Date.now();
	if (play.active) await waitFor(() => rec.endRounds.length > nEnds, roundTimeout, '/wallet/end-round');
	await waitIdle(page, roundTimeout);
	return { mode: play.mode, active: play.active, payoutMultiplier: play.payoutMultiplier, ms: Date.now() - t0 };
};
const clickCentre = async (page, sel) => {
	const el = page.locator(sel).first();
	await el.waitFor({ state: 'visible', timeout: 15000 });
	await el.click({ timeout: 10000 });
};
const innerText = (page, sel) => page.evaluate((s) => Array.from(document.querySelectorAll(s)).map((e) => e.innerText).join('\n'), sel);
const pressEscape = async (page) => page.keyboard.press('Escape');

/** Every visible, enabled control under `rootSel`: its label, rect, inside-viewport and hit-test verdicts. */
const controlAudit = (page, rootSel) =>
	page.evaluate((root) => {
		const vw = window.innerWidth, vh = window.innerHeight;
		const roots = Array.from(document.querySelectorAll(root));
		const out = [];
		for (const r of roots) {
			const els = Array.from(r.querySelectorAll('button, [role="button"], a[href], input[type="range"]'));
			for (const el of els) {
				const cs = getComputedStyle(el);
				const rect = el.getBoundingClientRect();
				if (cs.display === 'none' || cs.visibility === 'hidden' || rect.width < 1 || rect.height < 1 || Number(cs.opacity) === 0) continue;
				if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
				const probe = (r) => { const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy); return { inside: r.left >= -0.5 && r.top >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5, hittable: !!hit && (hit === el || el.contains(hit)), hit }; };
				let { inside, hittable, hit } = probe(rect);
				// A control clipped by a scrolling ancestor at scrollTop 0 is not unreachable: the ledger's S1 defect is a
				// centred overlay with NO scroll path. Scroll it into view and judge again; record that a scroll was needed.
				let viaScroll = false;
				if (!inside || !hittable) {
					const scroller = (() => { let n = el.parentElement; while (n) { const o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n; n = n.parentElement; } return null; })();
					if (scroller) {
						const before = scroller.scrollTop;
						el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
						const r2 = el.getBoundingClientRect();
						const p2 = probe(r2);
						if (p2.inside && p2.hittable) { inside = true; hittable = true; hit = p2.hit; viaScroll = true; }
						scroller.scrollTop = before;
					}
				}
				const label = (el.getAttribute('aria-label') || el.innerText || el.id || el.className || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);
				out.push({ label, id: el.id || null, rect: { l: Math.round(rect.left), t: Math.round(rect.top), r: Math.round(rect.right), b: Math.round(rect.bottom) }, inside, hittable, viaScroll, hitBy: hittable ? null : (hit ? (hit.id || hit.className || hit.tagName).toString().slice(0, 40) : 'nothing') });
			}
		}
		return { vw, vh, controls: out };
	}, rootSel);

/** Open one HUD surface; returns the root selector to audit / scrape and a closer. */
const SURFACES = {
	bar: { open: async () => {}, root: '.hud, .hud-replay', close: async () => {} },
	menu: { open: async (p) => { await clickCentre(p, '#info'); await p.waitForSelector('.hud-popup', { timeout: 10000 }); await sleep(600); }, root: '.hud-popup', close: async (p) => { await pressEscape(p); await sleep(300); if (await p.locator('.hud-popup').count()) await clickCentre(p, '#info'); await sleep(300); } },
	rules: { open: async (p) => { await clickCentre(p, '#info'); await p.waitForSelector('#paytable', { timeout: 10000 }); await clickCentre(p, '#paytable'); await p.waitForSelector('#rules-close', { timeout: 10000 }); await sleep(400); }, root: '.hud-rules-scrim', close: async (p) => { await clickCentre(p, '#rules-close'); await sleep(400); } },
	bet: { open: async (p) => { await clickCentre(p, '#bet'); await p.waitForSelector('.hud-bet-ladder', { timeout: 10000 }); await sleep(300); }, root: '.hud-bet-ladder', close: async (p) => { await pressEscape(p); await sleep(300); if (await p.locator('.hud-bet-ladder').count()) await clickCentre(p, '#bet'); await sleep(300); } },
	autoplay: { open: async (p) => { await clickCentre(p, '#auto'); await p.waitForSelector('.hud-autospin-menu', { timeout: 10000 }); await sleep(300); }, root: '.hud-autospin-menu', close: async (p) => { if (await p.locator('[data-test="autoplay-cancel"]').count()) await clickCentre(p, '[data-test="autoplay-cancel"]'); else await pressEscape(p); await sleep(300); } },
	buy: { open: async (p) => { await clickCentre(p, '#buy'); await p.waitForSelector('.feature-buy', { timeout: 10000 }); await sleep(400); }, root: '.feature-buy', close: async (p) => { await clickCentre(p, '.buy-close'); await sleep(400); } },
	buyPending: { open: async (p) => { await clickCentre(p, '#buy'); await p.waitForSelector('.feature-buy', { timeout: 10000 }); await sleep(300); await clickCentre(p, '.feature-buy__card[data-mode-type="buy"] .buy-card-play'); await p.waitForSelector('.feature-buy__card--pending', { timeout: 10000 }); await sleep(300); }, root: '.feature-buy', close: async (p) => { if (await p.locator('.buy-card-cancel').count()) await clickCentre(p, '.buy-card-cancel'); await sleep(200); await clickCentre(p, '.buy-close'); await sleep(400); } },
};

const control = async (pathname, body) => {
	const res = await fetch(`${rgsOrigin}${pathname}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
	return res.json();
};

const results = {};

// ---------------------------------------------------------------- leg a
if (LEGS.includes('a')) {
	const rec = newRec();
	const v = { leg: 'a', target: srv.base, spins: 0, surfaces: [], buys: [], checks: {}, rec };
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	attachConsole(page, rec);
	try {
		await control('/control/fixture', { name: null });
		await boot(page, 1440, 900);
		await waitIdle(page);
		await clickCentre(page, '#turbo'); await sleep(200); await clickCentre(page, '#turbo'); await sleep(200); // super turbo
		v.rounds = [];
		for (let i = 0; i < 10; i++) {
			await page.keyboard.press('Space');
			v.rounds.push(await waitRound(page, rec, { roundTimeout: 120000 }));
			v.spins += 1;
		}
		for (const name of ['menu', 'rules', 'bet', 'autoplay', 'buy', 'buyPending']) {
			const s = SURFACES[name];
			try { await s.open(page); v.surfaces.push({ name, opened: true }); await s.close(page); } catch (e) { v.surfaces.push({ name, opened: false, error: String(e.message).slice(0, 160) }); }
			await waitIdle(page, 20000).catch(() => {});
		}
		// SECOND PASS — buy the same feature twice, back to back (piggy-builders R2-07).
		const buyOnce = async (cardIndex) => {
			await clickCentre(page, '#buy');
			await page.waitForSelector('.feature-buy', { timeout: 10000 });
			await sleep(300);
			const cards = page.locator('.feature-buy__card[data-mode-type="buy"]');
			const title = await cards.nth(cardIndex).locator('.feature-buy__card-title').innerText();
			await cards.nth(cardIndex).locator('.buy-card-play').click();
			await page.waitForSelector('.feature-buy__card--pending', { timeout: 10000 });
			await sleep(200);
			await page.locator('.feature-buy__card--pending .buy-card-confirm').click();
			const round = await waitRound(page, rec);
			return { title, ...round };
		};
		for (const [fixture, cardIndex] of [['alarm_call_false', 0], ['alarm_call_false', 0], ['rescue_buy', 1], ['rescue_buy', 1]]) {
			await control('/control/fixture', { name: fixture });
			const before = rec.pageErrors.length;
			try {
				const r = await buyOnce(cardIndex); // no pause between rounds: the second buy lands the instant the first is idle
				v.buys.push({ fixture, ...r, pageErrorsDuring: rec.pageErrors.length - before, ok: true });
			} catch (e) {
				v.buys.push({ fixture, ok: false, error: String(e.message).slice(0, 200), pageErrorsDuring: rec.pageErrors.length - before });
				await page.screenshot({ path: path.join(EVID, `session-a-buy-${fixture}-FAILED.png`) }).catch(() => {});
				break;
			}
		}
		await control('/control/fixture', { name: null });
		await page.screenshot({ path: path.join(EVID, 'session-a-end.png') });
	} catch (e) {
		v.error = String(e.message).slice(0, 300);
		await page.screenshot({ path: path.join(EVID, 'session-a-FAILED.png') }).catch(() => {});
	}
	await ctx.close().catch(() => {});
	v.playsSeen = rec.plays.length;
	v.endRoundsSeen = rec.endRounds.length;
	v.checks = { ...budgetChecks(rec), tenSpins: v.spins === 10 && rec.plays.length >= 10, everySurfaceOpened: v.surfaces.length === 6 && v.surfaces.every((s) => s.opened), fourBuysCompleted: v.buys.length === 4 && v.buys.every((b) => b.ok && b.pageErrorsDuring === 0 && b.active), buysWereBoughtModes: v.buys.every((b) => /ALARM_CALL|RESCUE/i.test(b.mode || '')), noLegError: !v.error };
	v.pass = Object.values(v.checks).every(Boolean);
	results.a = v;
	fs.writeFileSync(path.join(EVID, 'session-a.json'), JSON.stringify(v, null, 2));
}

// ---------------------------------------------------------------- leg b
if (LEGS.includes('b')) {
	const rec = newRec();
	const v = { leg: 'b', target: srv.base + '?social=true', texts: {}, aria: {}, restrictedHits: [], disclosures: {}, moneySamples: {}, checks: {}, rec };
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	attachConsole(page, rec);
	try {
		await boot(page, 1440, 900, '&social=true');
		await waitIdle(page);
		v.texts.bar = await innerText(page, '.hud');
		v.aria.bar = await page.evaluate(() => Array.from(document.querySelectorAll('.hud [aria-label]')).map((e) => e.getAttribute('aria-label')).join(' | '));
		for (const name of ['menu', 'rules', 'bet', 'autoplay', 'buy', 'buyPending']) {
			const s = SURFACES[name];
			try {
				await s.open(page);
				v.texts[name] = await innerText(page, s.root);
				v.aria[name] = await page.evaluate((root) => Array.from(document.querySelectorAll(`${root} [aria-label]`)).map((e) => e.getAttribute('aria-label')).join(' | '), s.root);
				if (name === 'rules') await page.screenshot({ path: path.join(EVID, 'session-b-rules-social.png') });
				if (name === 'buy') await page.screenshot({ path: path.join(EVID, 'session-b-buy-social.png') });
				await s.close(page);
			} catch (e) {
				v.texts[name] = null;
				v.error = (v.error ? v.error + '; ' : '') + `${name}: ${String(e.message).slice(0, 120)}`;
			}
			await waitIdle(page, 20000).catch(() => {});
		}
		v.moneySamples = await page.evaluate(() => ({ balance: document.querySelector('#balance')?.innerText ?? null, bet: document.querySelector('#bet')?.innerText ?? null, win: document.querySelector('#win')?.innerText ?? null }));
		await page.screenshot({ path: path.join(EVID, 'session-b-bar-social.png') });
	} catch (e) {
		v.error = String(e.message).slice(0, 300);
	}
	await ctx.close().catch(() => {});
	for (const [name, text] of Object.entries(v.texts)) {
		if (!text) continue;
		for (const m of text.matchAll(RESTRICTED_RE)) v.restrictedHits.push({ surface: name, term: m[0], context: text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' ') });
	}
	const rules = v.texts.rules || '';
	v.disclosures = {
		rtp: /96\.70\s*%|Theoretical return/i.test(rules),
		maxWin: /15,000×|maximum win/i.test(rules),
		retrigger: /cannot start again from inside|cannot start|no alarms appear/i.test(rules),
		malfunction: /Malfunction voids/i.test(rules),
		copyright: /©\s*2026\s*Engine\./.test(rules),
		noStakeEngineWording: !/Stake Engine/i.test(rules),
		modeCosts: /12×|18×|50×|90×|1\.5×/.test(rules),
	};
	v.checks = { ...budgetChecks(rec), everySurfaceScraped: ['bar', 'menu', 'rules', 'bet', 'autoplay', 'buy', 'buyPending'].every((k) => typeof v.texts[k] === 'string' && v.texts[k].length > 0), zeroRestrictedTerms: v.restrictedHits.length === 0, ...Object.fromEntries(Object.entries(v.disclosures).map(([k, b]) => ['disclosure_' + k, b])), noLegError: !v.error };
	v.pass = Object.values(v.checks).every(Boolean);
	results.b = v;
	fs.writeFileSync(path.join(EVID, 'session-b.json'), JSON.stringify(v, null, 2));
}

// ---------------------------------------------------------------- leg c
if (LEGS.includes('c')) {
	const PRESETS = flag('--presets', '330x190,400x225,480x270,800x450,320x568').split(',').map((p) => p.split('x').map(Number));
	const v = { leg: 'c', presets: [], checks: {}, failures: [] };
	for (const [w, h] of PRESETS) {
		const rec = newRec();
		const ctx = await browser.newContext({ viewport: { width: w, height: h } });
		const page = await ctx.newPage();
		attachConsole(page, rec);
		const p = { viewport: `${w}x${h}`, surfaces: {}, rec };
		try {
			await boot(page, w, h);
			await waitIdle(page);
			for (const name of ['bar', 'menu', 'rules', 'bet', 'autoplay', 'buy', 'buyPending']) {
				const s = SURFACES[name];
				try {
					await s.open(page);
					const audit = await controlAudit(page, s.root);
					if (w <= 400) await page.screenshot({ path: path.join(EVID, `session-c-${w}x${h}-${name}.png`) });
					p.surfaces[name] = { controls: audit.controls.length, viaScroll: audit.controls.filter((c) => c.viaScroll).length, bad: audit.controls.filter((c) => !c.inside || !c.hittable) };
					for (const c of p.surfaces[name].bad) v.failures.push({ viewport: p.viewport, surface: name, ...c });
					await s.close(page);
				} catch (e) {
					p.surfaces[name] = { error: String(e.message).slice(0, 160) };
					v.failures.push({ viewport: p.viewport, surface: name, error: String(e.message).slice(0, 160) });
					await page.screenshot({ path: path.join(EVID, `session-c-${w}x${h}-${name}-FAILED.png`) }).catch(() => {});
				}
				await waitIdle(page, 20000).catch(() => {});
			}
		} catch (e) {
			p.error = String(e.message).slice(0, 300);
			v.failures.push({ viewport: p.viewport, error: p.error });
		}
		await ctx.close().catch(() => {});
		v.presets.push(p);
	}
	v.checks = {
		everyPresetBooted: v.presets.every((p) => !p.error),
		everySurfaceOpened: v.presets.every((p) => Object.values(p.surfaces).every((s) => !s.error)),
		nonZeroControlsEverywhere: v.presets.every((p) => Object.values(p.surfaces).every((s) => s.error || s.controls > 0)),
		everyControlInsideAndHittable: v.failures.length === 0,
		zeroPageErrors: v.presets.every((p) => p.rec.pageErrors.length === 0),
	};
	v.pass = Object.values(v.checks).every(Boolean);
	results.c = v;
	fs.writeFileSync(path.join(EVID, 'session-c.json'), JSON.stringify(v, null, 2));
}

// ---------------------------------------------------------------- leg d
if (LEGS.includes('d')) {
	const fixture = JSON.parse(fs.readFileSync(path.join(REPO, 'server', 'fixtures', 'base_backdraft_win.json'), 'utf8'));
	const walletHits = [];
	const replaySrv = http.createServer((req, res) => {
		const hdr = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
		if (req.method === 'OPTIONS') { res.writeHead(204, hdr); res.end(); return; }
		const u = new URL(req.url, 'http://x');
		if (u.pathname.startsWith('/wallet/')) { walletHits.push(`${req.method} ${u.pathname}`); res.writeHead(500, hdr); res.end('{"error":{"message":"replay must not touch the wallet"}}'); return; }
		if (req.method === 'GET' && u.pathname.startsWith('/bet/replay/')) {
			const payoutMultiplier = fixture.payoutMultiplier / 100;
			res.writeHead(200, hdr);
			res.end(JSON.stringify({ status: { statusCode: 'SUCCESS' }, roundID: 7, amount: 1000000, payout: Math.round(1000000 * payoutMultiplier), payoutMultiplier, costMultiplier: 1, active: true, mode: 'BASE', event: null, state: fixture.events, bookID: fixture.id }));
			return;
		}
		res.writeHead(404, hdr); res.end('{}');
	});
	await new Promise((r) => replaySrv.listen(REPLAY_PORT, '127.0.0.1', r));
	const v = { leg: 'd', runs: [], walletHits, checks: {} };
	for (const [w, h] of [[1440, 900], [400, 225]]) {
		const rec = newRec();
		const ctx = await browser.newContext({ viewport: { width: w, height: h } });
		const page = await ctx.newPage();
		attachConsole(page, rec);
		const run = { viewport: `${w}x${h}`, rows: null, start: null, rec };
		try {
			const url = `${srv.base}?replay=true&game=piggy_firefighters&mode=BASE&version=1&event=7&amount=1000000&currency=USD&lang=en&rgs_url=127.0.0.1:${REPLAY_PORT}&device=desktop`;
			await page.goto(url, { waitUntil: 'load' });
			await page.waitForSelector('#start-replay', { timeout: 60000 });
			await sleep(1200);
			run.rows = await page.evaluate(() => Object.fromEntries(['mode', 'base', 'cost-mult', 'total-cost', 'payout-mult', 'total-win'].map((k) => [k, { label: document.querySelector(`[data-test="replay-label-${k}"]`)?.innerText ?? null, value: document.querySelector(`[data-test="replay-${k}"]`)?.innerText ?? null }])));
			const audit = await controlAudit(page, '.replay-preroll');
			run.start = audit.controls.find((c) => c.id === 'start-replay') ?? null;
			await page.screenshot({ path: path.join(EVID, `session-d-${w}x${h}-preroll.png`) });
			run.boardBeforeStart = await page.evaluate(() => !!document.querySelector('canvas'));
			await clickCentre(page, '#start-replay');
			await sleep(1500);
			await page.screenshot({ path: path.join(EVID, `session-d-${w}x${h}-midplay.png`) });
			// End of book: the pre-roll card comes BACK over the board (Stake review 2026-09-03) with its button relabelled
			// PLAY AGAIN; the bar's own PLAY AGAIN stays disabled while the card owns the affordance.
			const prerollAgain = `(() => { const b = document.querySelector('#start-replay'); return !!b && /again/i.test(b.innerText); })()`;
			await page.waitForFunction(`!document.querySelector('#start-replay')`, null, { timeout: 15000, polling: 100 }).catch(() => {});
			await page.waitForFunction(prerollAgain, null, { timeout: 120000, polling: 250 });
			run.ended = true;
			run.endRows = await page.evaluate(() => Object.fromEntries(['payout-mult', 'total-win'].map((k) => [k, document.querySelector(`[data-test="replay-${k}"]`)?.innerText ?? null])));
			run.endAudit = (await controlAudit(page, '.replay-preroll')).controls.find((c) => c.id === 'start-replay') ?? null;
			await page.screenshot({ path: path.join(EVID, `session-d-${w}x${h}-ended.png`) });
			// PLAY AGAIN must re-run the round: the card withdraws, the book plays, the card returns.
			await clickCentre(page, '#start-replay');
			await page.waitForFunction(`!document.querySelector('#start-replay')`, null, { timeout: 15000, polling: 100 });
			await page.waitForFunction(prerollAgain, null, { timeout: 120000, polling: 250 });
			run.playedAgain = true;
			run.barText = await innerText(page, '.hud-replay');
		} catch (e) {
			run.error = String(e.message).slice(0, 300);
			await page.screenshot({ path: path.join(EVID, `session-d-${w}x${h}-FAILED.png`) }).catch(() => {});
		}
		await ctx.close().catch(() => {});
		v.runs.push(run);
	}
	replaySrv.close();
	const rowsOk = (r) => r.rows && Object.values(r.rows).every((x) => x.label && x.value);
	v.checks = {
		sixRowsBothViewports: v.runs.every(rowsOk),
		startInsideAndHittable: v.runs.every((r) => r.start && r.start.inside && r.start.hittable),
		playAgainInsideAndHittable: v.runs.every((r) => r.endAudit && r.endAudit.inside && r.endAudit.hittable),
		roundEndedBothViewports: v.runs.every((r) => r.ended),
		playAgainReplayed: v.runs.every((r) => r.playedAgain),
		zeroWalletTraffic: walletHits.length === 0,
		zeroPageErrors: v.runs.every((r) => r.rec.pageErrors.length === 0),
		zeroConsoleErrors: v.runs.every((r) => r.rec.errors.length === 0),
		payoutMultiplierMatchesBook: v.runs.every((r) => r.rows && r.rows['payout-mult'].value === `${fixture.payoutMultiplier / 100}x`),
	};
	v.pass = Object.values(v.checks).every(Boolean);
	results.d = v;
	fs.writeFileSync(path.join(EVID, 'session-d.json'), JSON.stringify(v, null, 2));
}

await browser.close().catch(() => {});
srv.close();
for (const [leg, v] of Object.entries(results)) console.log(`LEG ${leg}: ${v.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(v.checks)}${v.error ? ' ERROR ' + v.error : ''}`);
process.exit(Object.values(results).every((v) => v.pass) ? 0 : 1);
