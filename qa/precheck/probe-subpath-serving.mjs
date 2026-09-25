#!/usr/bin/env node
/**
 * PROBE base-path-assumed-to-be-site-root (ported from piggy-christmas tools/sec7walk/probe-subpath-serving.mjs,
 * 2026-08-30): serve the STAGED BUILD one directory deep, the way Stake mounts a game (/v70/), boot it against this
 * lane's mock RGS, pass the splash gate, and prove every same-origin request stays inside the mount and comes back
 * < 400, and that every declared @font-face family reports `loaded`.
 *
 *   node qa/precheck/probe-subpath-serving.mjs [--dir apps/piggy_firefighters/build] [--mount /v70] [--port 3062]
 *        [--rgs 127.0.0.1:3061] [--canary]
 *
 * --canary re-injects the pre-fix shape (an inline @font-face with surplus parent hops) into index.html and passes only
 * if the failure REAPPEARS — a probe that cannot fail is not evidence.
 * Verdict: qa/precheck/evidence/subpath-serving[-canary].json. Exit 0/1/2 (2 = could not run).
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

const CANARY_STYLE = `<style>
@font-face{font-family:'InterCanary';font-style:normal;font-weight:500;font-display:swap;src:url(../../../assets/fonts/InterVariable.woff2) format('woff2');}
</style><script>document.fonts.load("500 16px InterCanary");</script>`;

const srv = await serveSubpath({
	dir: DIR,
	mount: MOUNT,
	port: PORT,
	rewriteIndex: CANARY ? (html) => html.replace('</head>', CANARY_STYLE + '</head>') : undefined,
});

const verdict = {
	probe: 'subpath-serving',
	canary: CANARY,
	dir: DIR,
	mount: MOUNT,
	target: srv.base,
	rgs: RGS,
	requests: { total: 0, failed: [], escapedMount: [], external: [] },
	fonts: null,
	boot: null,
	checks: {},
	pass: false,
};

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const rgsOrigin = `http://${RGS}`;
page.on('response', (r) => {
	// blob:/data: object URLs never touch the network; their pathname is the inner URL and would read as an escape.
	if (/^(blob|data):/.test(r.url())) return;
	const u = new URL(r.url());
	if (u.origin === rgsOrigin) return; // the mock RGS is not the artefact under test
	if (u.origin !== srv.origin) {
		verdict.requests.external.push(`${r.status()} ${u.href}`);
		return;
	}
	verdict.requests.total += 1;
	if (r.status() >= 400) verdict.requests.failed.push(`${r.status()} ${u.pathname}`);
	if (!u.pathname.startsWith(MOUNT + '/')) verdict.requests.escapedMount.push(`${r.status()} ${u.pathname}`);
});
page.on('requestfailed', (r) => {
	if (/^(blob|data):/.test(r.url())) return;
	const u = new URL(r.url());
	if (u.origin !== srv.origin) return;
	verdict.requests.failed.push(`FAILED ${u.pathname} (${r.failure()?.errorText})`);
});

try {
	const url = `${srv.base}?sessionID=subpath-${Date.now()}&rgs_url=${RGS}&device=desktop`;
	await page.goto(url, { waitUntil: 'load' });
	await page.waitForSelector('.splash .press', { timeout: 90000 });
	await sleep(400);
	await page.mouse.click(720, 450);
	await page.waitForFunction(() => document.documentElement.dataset.splashShutter === 'done', null, { timeout: 30000 });
	verdict.boot = 'splash passed';
	await sleep(3000);
	verdict.fonts = await page.evaluate(`(async () => {
		const want = [['Inter', '500 16px "Inter"'], ['Inter', '900 16px "Inter"'], ['StationSign', '400 16px "StationSign"'], ['Lilita One', '400 16px "Lilita One"'], ['InterCanary', '500 16px "InterCanary"']];
		const out = {};
		for (const [family, spec] of want) {
			try { await document.fonts.load(spec); } catch (e) {}
			const faces = Array.from(document.fonts).filter((f) => f.family.replace(/^['"]|['"]$/g, '') === family);
			out[spec] = { faces: faces.length, statuses: faces.map((f) => f.status), check: document.fonts.check(spec) };
		}
		return out;
	})()`);
} catch (e) {
	verdict.error = String(e && e.message ? e.message : e).slice(0, 300);
}
await page.screenshot({ path: path.join(EVID, `subpath-serving${CANARY ? '-canary' : ''}.png`) }).catch(() => {});
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
srv.close();

const loaded = (spec) => {
	const f = verdict.fonts && verdict.fonts[spec];
	return !!(f && f.faces > 0 && f.statuses.includes('loaded'));
};
if (CANARY) {
	verdict.checks.canaryEscapedMount = verdict.requests.escapedMount.length > 0;
	verdict.checks.canaryFaceDidNotLoad = !loaded('500 16px "InterCanary"');
} else {
	verdict.checks.booted = verdict.boot === 'splash passed';
	verdict.checks.noFailedRequests = verdict.requests.failed.length === 0;
	verdict.checks.nothingEscapedMount = verdict.requests.escapedMount.length === 0;
	verdict.checks.noExternalOrigins = verdict.requests.external.length === 0;
	verdict.checks.interLoaded = loaded('500 16px "Inter"') && loaded('900 16px "Inter"');
	verdict.checks.stationSignLoaded = loaded('400 16px "StationSign"');
	verdict.checks.lilitaLoaded = loaded('400 16px "Lilita One"');
	verdict.checks.gotRequests = verdict.requests.total > 5;
}
verdict.pass = Object.values(verdict.checks).every(Boolean);
const out = path.join(EVID, `subpath-serving${CANARY ? '-canary' : ''}.json`);
fs.writeFileSync(out, JSON.stringify(verdict, null, 2));
console.log(JSON.stringify({ ...verdict, requests: { ...verdict.requests, total: verdict.requests.total } }, null, 2));
console.log(`SUBPATH-SERVING ${verdict.error && !CANARY ? 'WONT-RUN' : verdict.pass ? 'PASS' : 'FAIL'}${CANARY ? ' (canary)' : ''} -> ${out}`);
process.exit(verdict.error && !CANARY ? 2 : verdict.pass ? 0 : 1);
