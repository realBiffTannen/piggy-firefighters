#!/usr/bin/env node
/**
 * PIGGY FIREFIGHTERS — low-end performance harness (Playwright + CDP), lane H.
 *
 * Serves the STAGED build (apps/piggy_firefighters/build) one directory deep on :3070 the way Stake mounts a game,
 * starts its own fixtures-only mock RGS on :3071, and drives the game through muted headless Chromium under two
 * emulated profiles:
 *
 *   phone-lowend   390x844 @ dsf 3, isMobile + hasTouch, CPU throttle 6x, ?device=mobile
 *   laptop-old     1366x768 @ dsf 1,                      CPU throttle 4x, ?device=desktop
 *
 * Every scenario is a FRESH page + sessionID, with the mock pinned by POST /control/fixture before the round
 * (the static build has no ?fixture= hook; that module is DEV-only):
 *
 *   boot                 navigation -> '.splash .press' -> shutter done (ms, requests, transfer bytes by type),
 *                        plus the 3 s right after the shutter (audio warmAll decode burst)
 *   base_win             one Space press, round to /wallet/end-round
 *   base_backdraft_win   one Space press, round to /wallet/end-round
 *   backdraft_spins      full feature at normal speed (no DEV turbo on a static build)
 *   inferno_buy          full feature at normal speed, wait capped at 240 s
 *   idle                 10 s on the inferno_buy page after its round, nothing happening
 *
 * The sampler (page.addInitScript, installed before any game script runs) records: rAF delta histogram (p50 / p95 /
 * max, frames > 33 ms), PerformanceObserver longtask (count, total, longest), performance.memory.usedJSHeapSize once
 * a second, and — because the app exposes no __PIXI_APP__ — hooks HTMLCanvasElement.getContext to wrap the WebGL
 * texture calls (texImage2D / texStorage2D / compressedTexImage2D / texSubImage2D / deleteTexture / generateMipmap)
 * so resident texture count + bytes and upload traffic are REAL, not guessed. The task's fallback estimate (every
 * image resource re-decoded through <img> and sized at w*h*4) is also produced on the boot page for comparison.
 *
 *   PLAYWRIGHT_MODULE=... PLAYWRIGHT_BROWSERS_PATH=... node qa/perf/measure.mjs --label baseline
 *        [--profiles phone-lowend,laptop-old] [--scenarios boot,base_win,...] [--dir apps/piggy_firefighters/build]
 *        [--port 3070] [--mock-port 3071] [--mount /v70]
 *
 * Output: qa/perf/<label>.json + a compact table on stdout. Exit 0 when every scenario ran, 1 otherwise.
 * Both servers it starts are stopped at the end; nothing else on the machine is touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from '../precheck/lib/pw.mjs';
import { serveSubpath } from '../precheck/lib/serve-subpath.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv;
const flag = (name, fallback) => {
	const i = argv.indexOf(name);
	return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const LABEL = flag('--label', 'baseline');
const DIR = path.resolve(REPO, flag('--dir', 'apps/piggy_firefighters/build'));
const MOUNT = flag('--mount', '/v70');
const PORT = Number(flag('--port', '3070'));
const MOCK_PORT = Number(flag('--mock-port', '3071'));
const RGS = `127.0.0.1:${MOCK_PORT}`;
const OUT = path.join(HERE, `${LABEL}.json`);

const PROFILES = {
	'phone-lowend': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, cpuThrottle: 6, device: 'mobile' },
	'laptop-old': { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 4, device: 'desktop' },
};
// fixture: what the mock serves on the Space press; roundTimeout: cap on waiting for /wallet/end-round
const SCENARIOS = {
	boot: { fixture: null, round: false },
	base_win: { fixture: 'base_win', round: true, roundTimeout: 120_000 },
	base_backdraft_win: { fixture: 'base_backdraft_win', round: true, roundTimeout: 120_000 },
	backdraft_spins: { fixture: 'backdraft_spins', round: true, roundTimeout: 240_000 },
	inferno_buy: { fixture: 'inferno_buy', round: true, roundTimeout: 240_000, idleAfter: 10_000 },
};
const profileNames = flag('--profiles', Object.keys(PROFILES).join(',')).split(',').filter((p) => PROFILES[p]);
const scenarioNames = flag('--scenarios', Object.keys(SCENARIOS).join(',')).split(',').filter((s) => SCENARIOS[s]);

// ---------------------------------------------------------------------------------------------------------------------
// The in-page sampler. Runs before any game script (addInitScript). No closures over Node state.
// ---------------------------------------------------------------------------------------------------------------------
function sampler() {
	if (globalThis.__perf) return;
	const P = performance;
	try {
		P.setResourceTimingBufferSize(4000);
	} catch {
		/* ignore */
	}
	// ---- rAF cadence (timestamp + delta ring) ----
	const CAP = 60_000;
	const frT = new Float64Array(CAP);
	const frD = new Float32Array(CAP);
	let frN = 0;
	let last = -1;
	const tick = (t) => {
		if (last >= 0 && frN < CAP) {
			frT[frN] = t;
			frD[frN] = t - last;
			frN += 1;
		}
		last = t;
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
	// ---- long tasks ----
	const lt = [];
	try {
		new PerformanceObserver((l) => {
			for (const e of l.getEntries()) lt.push([e.startTime, e.duration]);
		}).observe({ type: 'longtask', buffered: true });
	} catch {
		/* not supported */
	}
	// ---- heap, once a second ----
	const heap = [];
	const heapSample = () => {
		const m = P.memory;
		if (m) heap.push([P.now(), m.usedJSHeapSize]);
	};
	heapSample();
	setInterval(heapSample, 1000);
	// ---- boot marks: first '.splash .press' in the DOM, shutter done ----
	const marks = {};
	const mo = new MutationObserver(() => {
		if (marks.pressAt === undefined && document.querySelector('.splash .press')) marks.pressAt = P.now();
		if (marks.shutterDoneAt === undefined && document.documentElement?.dataset.splashShutter === 'done') marks.shutterDoneAt = P.now();
		if (marks.pressAt !== undefined && marks.shutterDoneAt !== undefined) mo.disconnect();
	});
	mo.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-splash-shutter', 'class'] });
	// ---- WebGL texture accounting (the app exposes no __PIXI_APP__) ----
	const gl = { contexts: 0, kind: null, tex: new Map(), bound: new Map(), uploads: { calls: 0, bytes: 0 }, allTime: { calls: 0, bytes: 0 }, peakBytes: 0, created: 0, deleted: 0 };
	const srcDims = (s) => (s ? [s.naturalWidth ?? s.videoWidth ?? s.width ?? 0, s.naturalHeight ?? s.videoHeight ?? s.height ?? 0] : [0, 0]);
	const kindOf = (s) => {
		if (s == null) return 'null';
		if (typeof HTMLImageElement !== 'undefined' && s instanceof HTMLImageElement) return 'image';
		if (typeof HTMLCanvasElement !== 'undefined' && s instanceof HTMLCanvasElement) return 'canvas';
		if (typeof OffscreenCanvas !== 'undefined' && s instanceof OffscreenCanvas) return 'canvas';
		if (typeof HTMLVideoElement !== 'undefined' && s instanceof HTMLVideoElement) return 'video';
		if (typeof ImageBitmap !== 'undefined' && s instanceof ImageBitmap) return 'bitmap';
		if (ArrayBuffer.isView(s)) return 'buffer';
		return 'other';
	};
	const total = () => {
		let b = 0;
		for (const v of gl.tex.values()) b += v.bytes;
		return b;
	};
	const bump = () => {
		const b = total();
		if (b > gl.peakBytes) gl.peakBytes = b;
	};
	const wrapCtx = (ctx, kind) => {
		if (!ctx || ctx.__perfWrapped) return ctx;
		ctx.__perfWrapped = true;
		gl.contexts += 1;
		gl.kind = kind;
		const wrap = (name, fn) => {
			const o = ctx[name];
			if (typeof o !== 'function') return;
			ctx[name] = function (...a) {
				const r = o.apply(this, a);
				try {
					fn(a, r);
				} catch {
					/* never break the game */
				}
				return r;
			};
		};
		wrap('createTexture', () => (gl.created += 1));
		wrap('bindTexture', ([target, tex]) => gl.bound.set(target, tex));
		wrap('deleteTexture', ([tex]) => {
			if (gl.tex.delete(tex)) gl.deleted += 1;
		});
		wrap('generateMipmap', ([target]) => {
			const tex = gl.bound.get(target);
			const e = tex && gl.tex.get(tex);
			if (e && !e.mip) {
				e.mip = true;
				e.bytes = Math.round((e.bytes * 4) / 3);
				bump();
			}
		});
		const traffic = (w, h) => {
			const bytes = (w || 0) * (h || 0) * 4;
			gl.uploads.calls += 1;
			gl.uploads.bytes += bytes;
			gl.allTime.calls += 1;
			gl.allTime.bytes += bytes;
			return bytes;
		};
		const alloc = (target, level, w, h, kind) => {
			const bytes = traffic(w, h);
			if (level !== 0) return;
			const tex = gl.bound.get(target);
			if (!tex) return;
			const prev = gl.tex.get(tex);
			gl.tex.set(tex, { bytes: prev?.mip ? Math.round((bytes * 4) / 3) : bytes, w, h, kind, mip: !!prev?.mip });
			bump();
		};
		wrap('texImage2D', (a) => {
			if (a[0] !== ctx.TEXTURE_2D) return;
			if (a.length >= 9) alloc(a[0], a[1], a[3], a[4], kindOf(a[8]));
			else {
				const s = a[a.length - 1];
				const [w, h] = srcDims(s);
				alloc(a[0], a[1], w, h, kindOf(s));
			}
		});
		wrap('texStorage2D', ([target, levels, , w, h]) => {
			if (target !== ctx.TEXTURE_2D) return;
			const tex = gl.bound.get(target);
			if (!tex) return;
			gl.tex.set(tex, { bytes: Math.round(w * h * 4 * (levels > 1 ? 4 / 3 : 1)), w, h, kind: 'storage', mip: levels > 1 });
			bump();
		});
		wrap('texSubImage2D', (a) => {
			if (a[0] !== ctx.TEXTURE_2D) return;
			if (a.length >= 9) traffic(a[4], a[5]);
			else {
				const [w, h] = srcDims(a[a.length - 1]);
				traffic(w, h);
			}
		});
		wrap('compressedTexImage2D', ([target, level, , w, h, , data]) => {
			if (target !== ctx.TEXTURE_2D) return;
			const tex = gl.bound.get(target);
			if (!tex || level !== 0) return;
			gl.tex.set(tex, { bytes: data?.byteLength ?? 0, w, h, kind: 'compressed', mip: false });
			bump();
		});
		return ctx;
	};
	const origGetContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
		const ctx = origGetContext.call(this, type, ...rest);
		if (ctx && /^webgl2?$/.test(String(type))) return wrapCtx(ctx, String(type));
		return ctx;
	};
	// ---- windows ----
	const windowStats = (a, b) => {
		const d = [];
		for (let i = 0; i < frN; i += 1) if (frT[i] >= a && frT[i] <= b) d.push(frD[i]);
		const sorted = d.slice().sort((x, y) => x - y);
		const q = (p) => (sorted.length ? +sorted[Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1)))].toFixed(1) : null);
		const frames = {
			n: d.length,
			p50: q(0.5),
			p95: q(0.95),
			max: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : null,
			over33: d.filter((x) => x > 33).length,
			over100: d.filter((x) => x > 100).length,
			meanFps: d.length && b > a ? +((1000 * d.length) / (b - a)).toFixed(1) : null,
		};
		const tasks = lt.filter(([s]) => s >= a && s <= b);
		const longTasks = { count: tasks.length, totalMs: Math.round(tasks.reduce((n, [, dur]) => n + dur, 0)), longestMs: Math.round(tasks.length ? Math.max(...tasks.map(([, dur]) => dur)) : 0) };
		const hs = heap.filter(([t]) => t >= a && t <= b).map(([, v]) => v);
		const mb = (v) => +(v / 1048576).toFixed(1);
		const heapS = { startMB: hs.length ? mb(hs[0]) : null, peakMB: hs.length ? mb(Math.max(...hs)) : null, endMB: hs.length ? mb(hs[hs.length - 1]) : null };
		return { fromMs: Math.round(a), toMs: Math.round(b), durationMs: Math.round(b - a), frames, longTasks, heap: heapS };
	};
	let t0 = 0;
	let u0 = { calls: 0, bytes: 0 };
	globalThis.__perf = {
		marks,
		now: () => P.now(),
		begin() {
			t0 = P.now();
			u0 = { ...gl.uploads };
			heapSample();
		},
		end() {
			heapSample();
			const s = windowStats(t0, P.now());
			s.glUploads = { calls: gl.uploads.calls - u0.calls, bytes: gl.uploads.bytes - u0.bytes };
			return s;
		},
		window(a, b) {
			return windowStats(a, b);
		},
		boot() {
			const end = marks.shutterDoneAt ?? P.now();
			const s = windowStats(0, end);
			s.pressAtMs = marks.pressAt === undefined ? null : Math.round(marks.pressAt);
			s.shutterDoneAtMs = marks.shutterDoneAt === undefined ? null : Math.round(marks.shutterDoneAt);
			s.glUploads = { ...gl.allTime };
			return s;
		},
		gl() {
			let bytes = 0;
			let count = 0;
			const byKind = {};
			const largest = [];
			for (const v of gl.tex.values()) {
				bytes += v.bytes;
				count += 1;
				const k = (byKind[v.kind] ??= { count: 0, bytes: 0 });
				k.count += 1;
				k.bytes += v.bytes;
				largest.push([v.w, v.h, v.bytes, v.kind]);
			}
			largest.sort((x, y) => y[2] - x[2]);
			return { contexts: gl.contexts, kind: gl.kind, textures: { count, bytes, MB: +(bytes / 1048576).toFixed(1), byKind, largest: largest.slice(0, 14) }, peakMB: +(gl.peakBytes / 1048576).toFixed(1), created: gl.created, deleted: gl.deleted, uploadsAllTime: { ...gl.allTime } };
		},
		resources() {
			const by = {};
			for (const e of P.getEntriesByType('resource')) {
				const ext = (e.name.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? 'other').toLowerCase();
				const k = (by[ext] ??= { count: 0, transfer: 0, decoded: 0 });
				k.count += 1;
				k.transfer += e.transferSize || 0;
				k.decoded += e.decodedBodySize || 0;
			}
			return by;
		},
		async imageEstimate(extraUrls) {
			const seen = new Set();
			const out = { count: 0, bytes: 0, largest: [] };
			const names = P.getEntriesByType('resource')
				.map((e) => e.name)
				.concat(extraUrls ?? [])
				.filter((n) => /\.(png|webp|jpe?g|avif|gif)(\?|$)/i.test(n));
			await Promise.all(
				names.map(async (name) => {
					if (seen.has(name)) return;
					seen.add(name);
					const img = new Image();
					img.src = name;
					try {
						await img.decode();
					} catch {
						return;
					}
					const b = img.naturalWidth * img.naturalHeight * 4;
					out.count += 1;
					out.bytes += b;
					out.largest.push([name.split('/').slice(-2).join('/'), img.naturalWidth, img.naturalHeight, b]);
				}),
			);
			out.largest.sort((x, y) => y[3] - x[3]);
			out.largest = out.largest.slice(0, 15);
			out.MB = +(out.bytes / 1048576).toFixed(1);
			return out;
		},
	};
}

// ---------------------------------------------------------------------------------------------------------------------
const classify = (url) => {
	const p = url.split('?')[0];
	const ext = (p.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
	if (/^(js|mjs)$/.test(ext)) return 'js';
	if (ext === 'html' || p.endsWith('/')) return 'html';
	if (ext === 'css') return 'css';
	if (/^(png|webp|jpe?g|avif|gif|svg)$/.test(ext)) return 'image';
	if (/^(m4a|ogg|mp3|wav)$/.test(ext)) return 'audio';
	if (/^(woff2?|ttf|otf)$/.test(ext)) return 'font';
	if (ext === 'json') return 'json';
	if (/^(atlas|xml|txt|skel)$/.test(ext)) return 'text';
	return 'other';
};
const sumBy = (list) => {
	const by = {};
	let total = 0;
	for (const r of list) {
		const k = (by[r.cls] ??= { count: 0, bytes: 0 });
		k.count += 1;
		k.bytes += r.bytes || 0;
		total += r.bytes || 0;
	}
	return { count: list.length, bytes: total, MB: +(total / 1048576).toFixed(2), byType: by };
};
const postFixture = async (name) => {
	const r = await fetch(`http://${RGS}/control/fixture`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
	if (!r.ok) throw new Error(`fixture pin ${name}: HTTP ${r.status}`);
};
const waitHealthy = async (deadlineMs) => {
	const t = Date.now() + deadlineMs;
	while (Date.now() < t) {
		try {
			const r = await fetch(`http://${RGS}/health`);
			if (r.ok) return;
		} catch {
			/* not up yet */
		}
		await sleep(250);
	}
	throw new Error(`mock RGS on ${RGS} did not come up`);
};
const METRIC_KEYS = ['Nodes', 'JSEventListeners', 'LayoutCount', 'RecalcStyleCount', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration', 'JSHeapUsedSize', 'JSHeapTotalSize'];
const metrics = async (cdp) => {
	try {
		const { metrics: m } = await cdp.send('Performance.getMetrics');
		return Object.fromEntries(m.filter((x) => METRIC_KEYS.includes(x.name)).map((x) => [x.name, x.value]));
	} catch {
		return null;
	}
};
const metricDelta = (a, b) => {
	if (!a || !b) return null;
	const out = {};
	for (const k of ['ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'TaskDuration']) out[`${k}Ms`] = Math.round(((b[k] ?? 0) - (a[k] ?? 0)) * 1000);
	for (const k of ['LayoutCount', 'RecalcStyleCount']) out[k] = (b[k] ?? 0) - (a[k] ?? 0);
	out.Nodes = b.Nodes;
	out.JSEventListeners = b.JSEventListeners;
	return out;
};

/** One scenario = one fresh page + session. Returns the record (never throws; errors land in rec.error). */
const runScenario = async (context, profileName, profile, scenarioName, scenario, base) => {
	const rec = { profile: profileName, scenario: scenarioName, fixture: scenario.fixture, ok: false, consoleErrors: [], consoleWarnings: 0 };
	const page = await context.newPage();
	// Request accounting goes through Playwright's page events, NOT a page-level CDP Network session: Pixi v8 fetches
	// its images inside a dedicated worker (fetch + createImageBitmap) and a page CDP session never sees those.
	const net = { list: [], pending: new Set() };
	const onFinished = (req) => {
		const url = req.url();
		if (/^(blob|data):/.test(url)) return;
		const p = (async () => {
			let bytes = 0;
			try {
				const s = await req.sizes();
				bytes = (s.responseBodySize || 0) + (s.responseHeadersSize || 0);
			} catch {
				/* sizes unavailable */
			}
			const t = req.timing()?.startTime;
			const resp = await req.response().catch(() => null);
			net.list.push({ url, wall: t > 0 ? t : Date.now(), cls: classify(url), rgs: url.includes(RGS), status: resp?.status() ?? 0, bytes });
		})();
		net.pending.add(p);
		p.finally(() => net.pending.delete(p));
	};
	page.on('requestfinished', onFinished);
	page.on('requestfailed', (req) => net.list.push({ url: req.url(), wall: Date.now(), cls: classify(req.url()), rgs: req.url().includes(RGS), status: -1, bytes: 0, failed: req.failure()?.errorText }));
	const settleNet = async () => {
		await Promise.all([...net.pending]);
	};
	const cdp = await context.newCDPSession(page);
	let shutterWall = null;
	try {
		await page.addInitScript(sampler);
		await cdp.send('Performance.enable');
		await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });
		page.on('console', (msg) => {
			if (msg.type() === 'error') rec.consoleErrors.push(msg.text().slice(0, 300));
			else if (msg.type() === 'warning') rec.consoleWarnings += 1;
		});
		page.on('pageerror', (err) => rec.consoleErrors.push(`pageerror: ${String(err?.message ?? err).slice(0, 300)}`));

		if (scenario.fixture) await postFixture(scenario.fixture);
		else await postFixture(null);

		const url = `${base}?sessionID=perf-${LABEL}-${profileName}-${scenarioName}-${Date.now()}&rgs_url=${RGS}&device=${profile.device}`;
		const tNav = Date.now();
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
		await page.waitForSelector('.splash .press', { timeout: 240_000 });
		await sleep(400);
		await page.mouse.click(Math.round(profile.viewport.width / 2), Math.round(profile.viewport.height / 2));
		await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 120_000 });
		shutterWall = Date.now();
		rec.boot = await page.evaluate(() => globalThis.__perf.boot());
		rec.boot.wallMs = shutterWall - tNav;
		// the three seconds after the shutter: audio warmAll decode burst, board settle, resumeBet pass
		const settleFrom = await page.evaluate(() => globalThis.__perf.now());
		await sleep(3000);
		rec.afterShutter3s = await page.evaluate((a) => globalThis.__perf.window(a, globalThis.__perf.now()), settleFrom);
		await settleNet();
		const bootReqs = net.list.filter((r) => !r.rgs && r.wall <= shutterWall);
		rec.boot.requests = sumBy(bootReqs);
		rec.boot.requests.bundleJsRequests = bootReqs.filter((r) => /bundle\.[A-Za-z0-9_-]+\.js/.test(r.url)).length;
		rec.boot.requests.notOk = bootReqs.filter((r) => r.status >= 400 || r.status < 0).map((r) => `${r.status} ${r.url.replace(base, '')}`);
		rec.boot.rgsRequests = net.list.filter((r) => r.rgs && r.wall <= shutterWall).length;
		rec.boot.requests.largest = bootReqs
			.slice()
			.sort((x, y) => y.bytes - x.bytes)
			.slice(0, 12)
			.map((r) => [r.url.replace(base, ''), r.bytes]);

		if (scenarioName === 'boot') {
			rec.glAfterBoot = await page.evaluate(() => globalThis.__perf.gl());
			// the task's fallback estimate: every image URL the page (or its worker) fetched, re-decoded through <img>
			const imageUrls = [...new Set(net.list.filter((r) => r.cls === 'image' && r.status === 200).map((r) => r.url))];
			rec.imageEstimate = await page.evaluate((urls) => globalThis.__perf.imageEstimate(urls), imageUrls);
			rec.resources = await page.evaluate(() => globalThis.__perf.resources());
		}

		if (scenario.round) {
			const m0 = await metrics(cdp);
			await page.evaluate(() => globalThis.__perf.begin());
			const playP = page.waitForResponse((r) => r.url().includes('/wallet/play'), { timeout: 20_000 });
			const endRoundP = page.waitForResponse((r) => r.url().includes('/wallet/end-round'), { timeout: scenario.roundTimeout }).then(() => Date.now(), () => null);
			const tPress = Date.now();
			await page.keyboard.press('Space');
			let placed = true;
			try {
				await playP;
			} catch {
				placed = false;
			}
			if (!placed) {
				// mobile HUD without a keyboard binding: press the spin button itself
				const playP2 = page.waitForResponse((r) => r.url().includes('/wallet/play'), { timeout: 20_000 });
				await page.click('#spin', { timeout: 5000 });
				await playP2;
				rec.spinVia = 'click #spin';
			} else rec.spinVia = 'Space';
			// The SDK settles /wallet/end-round right after /wallet/play (measured 44 ms on the mock), so the wire says
			// nothing about the presentation. Round end = the HUD spin button back at its idle look ('arrow', enabled)
			// and holding it for 2 s after having been busy ('stop' / 'disabled') at least once.
			await page.evaluate(() => {
				globalThis.__perfRound = { since: undefined, sawBusy: false };
			});
			await page.waitForFunction(
				(hold) => {
					const el = document.querySelector('#spin');
					const st = el?.dataset.state;
					const w = globalThis.__perfRound;
					const now = performance.now();
					if (st && st !== 'arrow') w.sawBusy = true;
					if (st === 'arrow' && el && !el.disabled) {
						w.since ??= now;
						return w.sawBusy && now - w.since >= hold;
					}
					w.since = undefined;
					return false;
				},
				2000,
				{ timeout: scenario.roundTimeout, polling: 100 },
			);
			rec.roundWallMs = Date.now() - tPress - 2000;
			const endRoundAt = await endRoundP;
			rec.endRoundAfterPressMs = endRoundAt ? endRoundAt - tPress : null;
			rec.round = await page.evaluate(() => globalThis.__perf.end());
			rec.round.cdp = metricDelta(m0, await metrics(cdp));
			await settleNet();
			rec.round.requests = sumBy(net.list.filter((r) => !r.rgs && r.wall > shutterWall));
			rec.round.betEvents = net.list.filter((r) => r.rgs && r.url.includes('/bet/event')).length;
			rec.glAfterRound = await page.evaluate(() => globalThis.__perf.gl());
		}
		if (scenario.idleAfter) {
			await sleep(2000);
			const m0 = await metrics(cdp);
			await page.evaluate(() => globalThis.__perf.begin());
			await sleep(scenario.idleAfter);
			rec.idle = await page.evaluate(() => globalThis.__perf.end());
			rec.idle.cdp = metricDelta(m0, await metrics(cdp));
		}
		rec.finalMetrics = await metrics(cdp);
		rec.ok = true;
	} catch (e) {
		rec.error = String(e?.message ?? e).split('\n')[0].slice(0, 300);
		try {
			await page.screenshot({ path: path.join(HERE, `${LABEL}-${profileName}-${scenarioName}.FAILED.png`) });
		} catch {
			/* no page */
		}
	}
	rec.consoleErrorCount = rec.consoleErrors.length;
	await cdp.detach().catch(() => {});
	await page.close().catch(() => {});
	return rec;
};

// ---------------------------------------------------------------------------------------------------------------------
const main = async () => {
	const provenance = JSON.parse(fs.readFileSync(path.join(DIR, 'provenance.json'), 'utf8'));
	const srv = await serveSubpath({ dir: DIR, mount: MOUNT, port: PORT });
	const mock = spawn(process.execPath, [path.join(REPO, 'server', 'mock-rgs.mjs')], { cwd: REPO, env: { ...process.env, PORT: String(MOCK_PORT), BOOKS_DIR: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] });
	let mockLog = '';
	mock.stdout.on('data', (d) => (mockLog += d));
	mock.stderr.on('data', (d) => (mockLog += d));
	const stop = () => {
		try {
			srv.close();
		} catch {
			/* closed */
		}
		try {
			mock.kill('SIGTERM');
		} catch {
			/* gone */
		}
	};
	process.on('SIGINT', () => {
		stop();
		process.exit(130);
	});
	let browser;
	const out = { label: LABEL, at: new Date().toISOString(), build: { dir: DIR, ...provenance }, served: srv.base, rgs: RGS, profiles: {}, results: {} };
	try {
		await waitHealthy(20_000);
		browser = await launch();
		out.chromium = browser.version();
		for (const profileName of profileNames) {
			const profile = PROFILES[profileName];
			out.profiles[profileName] = profile;
			out.results[profileName] = {};
			const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.hasTouch });
			for (const scenarioName of scenarioNames) {
				const t = Date.now();
				const rec = await runScenario(context, profileName, profile, scenarioName, SCENARIOS[scenarioName], srv.base);
				rec.scenarioWallMs = Date.now() - t;
				out.results[profileName][scenarioName] = rec;
				console.error(`  ${profileName} / ${scenarioName}: ${rec.ok ? 'ok' : 'FAILED ' + rec.error} (${Math.round(rec.scenarioWallMs / 1000)} s)`);
				fs.writeFileSync(OUT, JSON.stringify(out, null, 1)); // partial results survive a crash
			}
			await context.close().catch(() => {});
		}
	} catch (e) {
		out.error = String(e?.message ?? e).slice(0, 500);
		out.mockLog = mockLog.slice(-1500);
	} finally {
		if (browser) await browser.close().catch(() => {});
		stop();
	}
	fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
	printTable(out);
	const allOk = profileNames.every((p) => scenarioNames.every((s) => out.results[p]?.[s]?.ok));
	console.log(`PERF ${allOk ? 'DONE' : 'PARTIAL'} -> ${OUT}`);
	process.exit(allOk ? 0 : 1);
};

const printTable = (out) => {
	const pad = (s, n) => String(s ?? '-').padEnd(n);
	const num = (s, n) => String(s ?? '-').padStart(n);
	console.log(`\n${out.label} @ ${out.at}  head ${String(out.build.gitHead).slice(0, 7)}  ${out.chromium ?? ''}`);
	for (const [profileName, scenarios] of Object.entries(out.results)) {
		const p = out.profiles[profileName];
		console.log(`\n== ${profileName}  ${p.viewport.width}x${p.viewport.height}@${p.deviceScaleFactor}  cpu x${p.cpuThrottle}  device=${p.device}`);
		console.log(`${pad('scenario', 20)}${pad('window', 10)}${num('ms', 8)}${num('p50', 7)}${num('p95', 7)}${num('max', 8)}${num('>33', 5)}${num('>100', 5)}${num('LT#', 5)}${num('LTms', 7)}${num('LTmax', 7)}${num('heap0', 7)}${num('peak', 7)}${num('end', 7)}${num('texMB', 7)}${num('err', 4)}`);
		for (const [scenarioName, r] of Object.entries(scenarios)) {
			const rows = [];
			if (r.boot) rows.push(['boot', r.boot, r.glAfterBoot]);
			if (r.afterShutter3s && scenarioName === 'boot') rows.push(['+3s', r.afterShutter3s, null]);
			if (r.round) rows.push(['round', r.round, r.glAfterRound]);
			if (r.idle) rows.push(['idle', r.idle, r.glAfterRound]);
			if (!rows.length) rows.push(['-', null, null]);
			for (const [w, s, g] of rows) {
				if (scenarioName !== 'boot' && w === 'boot') continue;
				const f = s?.frames ?? {};
				const lt = s?.longTasks ?? {};
				const h = s?.heap ?? {};
				console.log(`${pad(scenarioName, 20)}${pad(w, 10)}${num(s?.durationMs, 8)}${num(f.p50, 7)}${num(f.p95, 7)}${num(f.max, 8)}${num(f.over33, 5)}${num(f.over100, 5)}${num(lt.count, 5)}${num(lt.totalMs, 7)}${num(lt.longestMs, 7)}${num(h.startMB, 7)}${num(h.peakMB, 7)}${num(h.endMB, 7)}${num(g?.textures?.MB, 7)}${num(r.consoleErrorCount, 4)}`);
			}
			if (r.round) console.log(`${pad('', 20)}round wall ${(r.roundWallMs / 1000).toFixed(1)} s via ${r.spinVia}; end-round ${r.endRoundAfterPressMs} ms after press; fetched ${r.round.requests?.count} req / ${r.round.requests?.MB} MB; GL uploads ${r.round.glUploads?.calls} calls / ${((r.round.glUploads?.bytes ?? 0) / 1048576).toFixed(1)} MB; script ${r.round.cdp?.ScriptDurationMs} ms, layout ${r.round.cdp?.LayoutCount}x/${r.round.cdp?.LayoutDurationMs} ms, style ${r.round.cdp?.RecalcStyleCount}x, nodes ${r.round.cdp?.Nodes}`);
			if (r.idle) console.log(`${pad('', 20)}idle: script ${r.idle.cdp?.ScriptDurationMs} ms, layout ${r.idle.cdp?.LayoutCount}x, style ${r.idle.cdp?.RecalcStyleCount}x, GL uploads ${r.idle.glUploads?.calls} calls / ${((r.idle.glUploads?.bytes ?? 0) / 1048576).toFixed(1)} MB`);
			if (r.error) console.log(`${pad(scenarioName, 20)}ERROR ${r.error}`);
		}
		const b = scenarios.boot?.boot;
		if (b) {
			const by = b.requests?.byType ?? {};
			const fmt = Object.entries(by)
				.sort((x, y) => y[1].bytes - x[1].bytes)
				.map(([k, v]) => `${k} ${v.count}/${(v.bytes / 1048576).toFixed(2)}MB`)
				.join('  ');
			console.log(`boot: press ${b.pressAtMs} ms, shutter ${b.shutterDoneAtMs} ms, ${b.requests?.count} req / ${b.requests?.MB} MB  [${fmt}]  bundle.js requests: ${b.requests?.bundleJsRequests}`);
			const g = scenarios.boot?.glAfterBoot;
			if (g) console.log(`textures after boot: ${g.textures.count} x ${g.textures.MB} MB (${g.kind}, peak ${g.peakMB} MB, created ${g.created}, deleted ${g.deleted}); <img> estimate ${scenarios.boot.imageEstimate?.count} x ${scenarios.boot.imageEstimate?.MB} MB`);
		}
	}
};

main().catch((e) => {
	console.error(e);
	process.exit(2);
});
