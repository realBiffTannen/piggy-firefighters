#!/usr/bin/env node
/**
 * PROBE renderer-backend-untested-on-review-hardware (ported from piggy-christmas tools/sec7walk/probe-renderer-backend.mjs,
 * 2026-08-30): prove the STAGED BUILD actually paints on the backend a real player's browser selects, at the fractional
 * device pixel ratios Windows display scaling produces — served from a versioned subpath, booted against the mock RGS.
 *
 * Per (viewport x deviceScaleFactor) cell:
 *   backendIsWebGl   the Pixi canvas answers `getContext('webgl2')` with a live context (a canvas already owned by a
 *                    WebGPU context returns null there, and vice versa). The shipped preference is 'webgl' and this is
 *                    the assertion that it stayed that way. (The app exposes no `__PIXI_APP__`; Pixi's `%c`-styled hello
 *                    banner does not surface as plain console text, so the canvas itself is asked.)
 *   noGpuValidation  zero console lines matching GPU_VALIDATION_RE — matched on TEXT, Chrome reports them as warnings.
 *   boardDrawn       a compositor screenshot of the Pixi canvas is not a flat black rectangle (litFraction >= 0.25 and
 *                    mean luminance >= 8), sampled after the splash gate has been passed.
 *
 * The run is WONT-RUN (exit 2), never a pass, if requestAdapter() returns null: the machine cannot exercise WebGPU.
 * --canary serves the bundle with `preference:"webgl"` rewritten to "webgpu" and the depth-stencil guard disabled
 * (the pre-fix web-sdk configuration) and passes only if the failure REAPPEARS or WebGPU at least initialised.
 *
 *   node qa/precheck/probe-renderer-backend.mjs [--dir apps/piggy_firefighters/build] [--mount /v70] [--port 3062]
 *        [--rgs 127.0.0.1:3061] [--canary]
 */
import fs from 'node:fs';
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
const CANARY = argv.includes('--canary');
const DIR = path.resolve(REPO, flag('--dir', 'apps/piggy_firefighters/build'));
const MOUNT = flag('--mount', '/v70');
const PORT = Number(flag('--port', '3062'));
const RGS = flag('--rgs', '127.0.0.1:3061');
const EVID = path.join(HERE, 'evidence');
fs.mkdirSync(EVID, { recursive: true });

const GPU_VALIDATION_RE =
	/depth stencil attachment|does not match the size of the other attachments|Invalid CommandBuffer|While validating depthStencilAttachment|too many warnings/i;
const HELLO_RE = /PixiJS\s+[\d.]+\s*-\s*(WebGPU|WebGL\s*\d?)/i;
const SETTLE_MS = 9000;
const LIT_MIN = 0.25;
const MEAN_MIN = 8;
const CELLS = [
	{ label: '1290x911@1.1', w: 1290, h: 911, dsf: 1.1, measuredBad: true },
	{ label: '1512x945@1.25', w: 1512, h: 945, dsf: 1.25 },
	{ label: '1366x768@1.5', w: 1366, h: 768, dsf: 1.5 },
	{ label: '1440x900@1.0', w: 1440, h: 900, dsf: 1 },
	{ label: '390x844@2.0', w: 390, h: 844, dsf: 2 },
];

// The canary re-creates the pre-fix web-sdk configuration byte-wise on the served bundle: WebGPU preferred and the
// depth-stencil size guard disabled (its feature-detect looks for a method that then does not exist).
const canaryRewrite = (rel, text) => {
	if (!/\.(js|html)$/.test(rel)) return null;
	let out = text.split('preference:"webgl"').join('preference:"webgpu"');
	// the minifier emits `typeof h.ensureDepthStencilTexture!="function"` (loose inequality); disable the feature-detect
	out = out.replace(/\.ensureDepthStencilTexture!==?"function"/g, '.ensureDepthStencilTexture__disabled!="function"');
	return out;
};

const srv = await serveSubpath({ dir: DIR, mount: MOUNT, port: PORT, rewrite: CANARY ? canaryRewrite : undefined });
const verdict = { probe: 'renderer-backend', canary: CANARY, dir: DIR, target: srv.base, rgs: RGS, webgpuAdapter: null, wontRun: false, cells: [], checks: {}, pass: false };

const browser = await launch(['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU']);

const sampleCanvas = async (page, b64) =>
	page.evaluate(async (data) => {
		const img = new Image();
		img.src = 'data:image/png;base64,' + data;
		await img.decode();
		const c = document.createElement('canvas');
		c.width = img.width;
		c.height = img.height;
		const ctx = c.getContext('2d');
		ctx.drawImage(img, 0, 0);
		const d = ctx.getImageData(0, 0, c.width, c.height).data;
		let min = 255, max = 0, sum = 0, n = 0, lit = 0;
		for (let i = 0; i < d.length; i += 4 * 37) {
			const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
			if (l < min) min = l;
			if (l > max) max = l;
			sum += l;
			n++;
			if (l > 8) lit++;
		}
		return { min, max, mean: sum / n, litFraction: lit / n, w: img.width, h: img.height };
	}, b64);

const run = async (cell) => {
	const ctx = await browser.newContext({ viewport: { width: cell.w, height: cell.h }, deviceScaleFactor: cell.dsf });
	const page = await ctx.newPage();
	const gpuLines = [];
	let hello = null;
	page.on('console', (m) => {
		const t = m.text();
		if (GPU_VALIDATION_RE.test(t)) gpuLines.push(`[${m.type()}] ${t.slice(0, 240)}`);
		const h = t.match(HELLO_RE);
		if (h) hello = h[0];
	});
	const url = `${srv.base}?sessionID=rb-${cell.label}-${Date.now()}&rgs_url=${RGS}&device=desktop`;
	const result = { ...cell, url, hello: null, backendName: null, gpuLines: [], sample: null, error: null };
	try {
		await page.goto(url, { waitUntil: 'load' });
		await page.waitForSelector('.splash .press', { timeout: 90000 });
		await sleep(400);
		await page.mouse.click(Math.round(cell.w / 2), Math.round(cell.h / 2));
		await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
		await sleep(SETTLE_MS);
		result.hello = hello;
		result.canvas = await page.evaluate(() => {
			const c = document.querySelector('canvas');
			if (!c) return null;
			// A canvas can hold ONE context kind: the kind that answers is the kind Pixi initialised with.
			const gl = c.getContext('webgl2') || c.getContext('webgl');
			const gpu = gl ? null : c.getContext('webgpu');
			return { width: c.width, height: c.height, cssW: c.clientWidth, cssH: c.clientHeight, dpr: window.devicePixelRatio, backend: gl ? 'webgl' : gpu ? 'webgpu' : 'unknown', glVersion: gl ? gl.getParameter(gl.VERSION) : null };
		});
		result.backendName = result.canvas ? result.canvas.backend : null;
		const canvas = page.locator('canvas').first();
		const shot = path.join(EVID, `renderer-backend${CANARY ? '-canary' : ''}-${cell.label.replace(/[^a-z0-9]/gi, '_')}.png`);
		const buf = await canvas.screenshot({ path: shot, scale: 'css' });
		result.screenshot = path.basename(shot);
		result.sample = await sampleCanvas(page, buf.toString('base64'));
	} catch (e) {
		result.error = String(e && e.message ? e.message : e).slice(0, 300);
	}
	result.gpuLines = gpuLines.slice(0, 6);
	result.gpuLineCount = gpuLines.length;
	await ctx.close().catch(() => {});
	return result;
};

{
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await page.goto(srv.base, { waitUntil: 'domcontentloaded' }).catch(() => {});
	verdict.webgpuAdapter = await page
		.evaluate(`(async () => { if (!navigator.gpu) return 'no-navigator-gpu'; try { const a = await navigator.gpu.requestAdapter(); return a ? 'available ' + JSON.stringify({vendor:a.info?.vendor, architecture:a.info?.architecture}) : 'null-adapter'; } catch (e) { return 'threw: ' + e; } })()`)
		.catch(() => 'evaluate-failed');
	await ctx.close().catch(() => {});
}
if (!String(verdict.webgpuAdapter).startsWith('available')) {
	verdict.wontRun = true;
	verdict.note = `WebGPU adapter unavailable (${verdict.webgpuAdapter}); this run cannot exercise the class it exists to gate.`;
} else {
	for (const cell of CELLS) verdict.cells.push(await run(cell));
}
await browser.close().catch(() => {});
srv.close();

if (!verdict.wontRun) {
	const cells = verdict.cells;
	const bad = cells.find((c) => c.measuredBad) || cells[0];
	if (CANARY) {
		verdict.checks.canaryUsedWebgpu = bad.backendName === 'webgpu';
		verdict.checks.canaryReproducedFailure = bad.gpuLineCount > 0 || (bad.sample ? bad.sample.litFraction < LIT_MIN && bad.sample.mean < MEAN_MIN : false);
	} else {
		verdict.checks.backendIsWebGl = cells.every((c) => c.backendName === 'webgl');
		verdict.checks.noGpuValidation = cells.every((c) => c.gpuLineCount === 0);
		verdict.checks.boardDrawn = cells.every((c) => c.sample && c.sample.litFraction >= LIT_MIN && c.sample.mean >= MEAN_MIN);
		verdict.checks.noCellErrored = cells.every((c) => !c.error);
	}
	verdict.pass = Object.values(verdict.checks).every(Boolean);
}
const out = path.join(EVID, `renderer-backend${CANARY ? '-canary' : ''}.json`);
fs.writeFileSync(out, JSON.stringify(verdict, null, 2));
for (const c of verdict.cells) console.log(`${c.label.padEnd(15)} backend=${c.backendName} hello=${JSON.stringify(c.hello)} gpuLines=${c.gpuLineCount} lit=${c.sample?.litFraction?.toFixed(3)} mean=${c.sample?.mean?.toFixed(1)} canvas=${c.canvas ? c.canvas.width + 'x' + c.canvas.height : null} ${c.error ? 'ERROR ' + c.error : ''}`);
console.log('adapter:', verdict.webgpuAdapter, 'checks:', JSON.stringify(verdict.checks));
console.log(`RENDERER-BACKEND ${verdict.wontRun ? 'WONT-RUN' : verdict.pass ? 'PASS' : 'FAIL'}${CANARY ? ' (canary)' : ''} -> ${out}`);
process.exit(verdict.wontRun ? 2 : verdict.pass ? 0 : 1);
