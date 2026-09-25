#!/usr/bin/env node
/**
 * Provenance gate (ledger rule "artifact-served-is-not-artifact-tested"): the tree that is served or shipped must be
 * the tree these sources produce — proven, not assumed. tools/build_dist.sh runs this with --write at the end of every
 * build, which stamps <dir>/provenance.json with
 *   gitHead        the commit the build ran on (informational: a commit that changes no input keeps the digest),
 *   inputDigest    sha256 over the sorted "<path>\t<sha256>" lines of every build input —
 *                    apps/piggy_firefighters/src (minus src/routes/rigs, the dev-only viewer the build strips),
 *                    apps/piggy_firefighters/static, apps/piggy_firefighters/vendor (the studio HUD tarball),
 *                    the app's package.json / vite.config.js / svelte.config.js, and packages/*\/src,
 *   indexHtmlSha   sha256 of the emitted index.html after build_dist.sh's post-processing.
 * The check (the default) recomputes both — inputs against the working tree, index.html against the given tree — and
 * FAILS on a missing stamp, a changed input or an index.html that is not the stamped one.
 *
 *   node qa/gate/check_provenance.mjs [--dir game/dist]                       check, exit 1 on FAIL
 *   node qa/gate/check_provenance.mjs --write --dir apps/piggy_firefighters/build
 *
 * A sidecar qa/build/provenance-inputs.json (outside the artifact) keeps the per-file hashes of the last --write so a
 * FAIL can name what changed.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const APP = 'apps/piggy_firefighters';
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
	const i = argv.indexOf(name);
	return i > -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const WRITE = argv.includes('--write');
const DIR = resolve(ROOT, flag('--dir', 'game/dist'));
const STAMP = join(DIR, 'provenance.json');
const SIDECAR = join(ROOT, 'qa/build/provenance-inputs.json');
const rel = (p) => relative(ROOT, p).split(sep).join('/') || '.';

const INPUT_DIRS = [`${APP}/src`, `${APP}/static`, `${APP}/vendor`];
const INPUT_FILES = [`${APP}/package.json`, `${APP}/vite.config.js`, `${APP}/svelte.config.js`];
// The dev-only rig viewer: build_dist.sh moves it out of the route tree for the build, so it is never an input.
const EXCLUDE = [`${APP}/src/routes/rigs`];
const SKIP_NAMES = new Set(['.DS_Store', 'node_modules']);

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const walk = (dir, out) => {
	if (!existsSync(dir)) return;
	for (const name of readdirSync(dir).sort()) {
		if (SKIP_NAMES.has(name)) continue;
		const p = join(dir, name);
		const r = rel(p);
		if (EXCLUDE.some((e) => r === e || r.startsWith(`${e}/`))) continue;
		const st = statSync(p);
		if (st.isDirectory()) walk(p, out);
		else if (st.isFile()) out.push(r);
	}
};
const inputs = () => {
	const files = [];
	for (const d of INPUT_DIRS) walk(join(ROOT, d), files);
	for (const n of readdirSync(join(ROOT, 'packages')).sort()) walk(join(ROOT, 'packages', n, 'src'), files);
	for (const f of INPUT_FILES) if (existsSync(join(ROOT, f))) files.push(f);
	files.sort();
	const hashes = {};
	for (const f of files) hashes[f] = sha256(readFileSync(join(ROOT, f)));
	const digest = sha256(files.map((f) => `${f}\t${hashes[f]}\n`).join(''));
	return { digest, hashes, count: files.length };
};
const git = (...args) => {
	try {
		return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
	} catch {
		return null;
	}
};
const fail = (msg) => {
	console.error(`FAIL check_provenance: ${msg}`);
	process.exit(1);
};
const short = (h) => String(h ?? '?').slice(0, 12);

if (!existsSync(join(DIR, 'index.html'))) fail(`${rel(DIR)} has no index.html — not a built tree (run ./tools/build_dist.sh)`);

if (WRITE) {
	const { digest, hashes, count } = inputs();
	const head = git('rev-parse', 'HEAD');
	// The held /rigs route is the build's own doing, not a dirty tree.
	const dirty = git('status', '--porcelain', '--', '.', `:!${APP}/src/routes/rigs`);
	const stamp = {
		schema: 1,
		game: 'piggy_firefighters',
		builtAt: new Date().toISOString(),
		gitHead: head,
		gitDirty: dirty === null ? null : dirty.length > 0,
		inputDigest: digest,
		inputFileCount: count,
		indexHtmlSha: sha256(readFileSync(join(DIR, 'index.html'))),
	};
	writeFileSync(STAMP, `${JSON.stringify(stamp, null, '\t')}\n`);
	mkdirSync(dirname(SIDECAR), { recursive: true });
	writeFileSync(SIDECAR, `${JSON.stringify({ inputDigest: digest, files: hashes }, null, '\t')}\n`);
	console.log(
		`provenance stamped: ${rel(STAMP)} (head ${String(head ?? '?').slice(0, 7)}${stamp.gitDirty ? ' +local changes' : ''}, ${count} inputs, digest ${short(digest)}…, index.html ${short(stamp.indexHtmlSha)}…)`,
	);
	process.exit(0);
}

if (!existsSync(STAMP)) {
	fail(`${rel(DIR)} carries no provenance.json — a tree without a stamp is FAIL by default (rebuild it with ./tools/build_dist.sh, which stamps every build)`);
}
const stamp = JSON.parse(readFileSync(STAMP, 'utf8'));
const problems = [];
const { digest, hashes, count } = inputs();
if (digest !== stamp.inputDigest) {
	let detail = `${stamp.inputFileCount ?? '?'} inputs stamped, ${count} now`;
	if (existsSync(SIDECAR)) {
		const side = JSON.parse(readFileSync(SIDECAR, 'utf8'));
		if (side.inputDigest === stamp.inputDigest) {
			const changed = [...new Set([...Object.keys(side.files), ...Object.keys(hashes)])].filter((f) => side.files[f] !== hashes[f]);
			detail = `${changed.length} input(s) differ, e.g. ${changed.slice(0, 8).join(', ')}`;
		}
	}
	problems.push(`build inputs changed since the stamp (${detail}) — ${rel(DIR)} is not the tree these sources produce; rebuild with ./tools/build_dist.sh`);
}
const idx = sha256(readFileSync(join(DIR, 'index.html')));
if (idx !== stamp.indexHtmlSha) {
	problems.push(`${rel(DIR)}/index.html is not the stamped one (${short(idx)}… now, ${short(stamp.indexHtmlSha)}… stamped) — the tree was edited or partially copied after the build`);
}
for (const p of problems) console.error(`FAIL check_provenance: ${p}`);
if (problems.length) process.exit(1);
const head = git('rev-parse', 'HEAD');
const note = head && stamp.gitHead && head !== stamp.gitHead ? ` (stamped on ${stamp.gitHead.slice(0, 7)}, HEAD is ${head.slice(0, 7)}: inputs identical)` : '';
console.log(
	`PASS check_provenance: ${rel(DIR)} is the tree the sources produce (head ${String(stamp.gitHead ?? '?').slice(0, 7)}, ${count} inputs, digest ${short(digest)}…, index.html ${short(idx)}…)${note}`,
);
