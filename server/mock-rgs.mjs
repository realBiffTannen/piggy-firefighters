#!/usr/bin/env node
/**
 * Mock Stake Engine RGS for PIGGY FIREFIGHTERS (internal id `piggy_firefighters`) local development and QA.
 *
 * Serves the SAME published artifacts the real RGS is given — the generated
 * books (`books_<mode>.jsonl.zst`), the optimizer's weighted lookup table
 * (`lookUpTable_<mode>_0.csv`) and `index.json` — so it cannot drift from the
 * math. It is a dev/test tool and is never part of the uploaded bundle.
 *
 * BOOKS. `BOOKS_DIR` (env) points at a publish tree. Default: Codex's published
 * `math/publish` once it holds an `index.json` — every mode it lists is served,
 * so `golden_four` appears the moment Codex publishes it, with no edit here.
 * The in-progress `math/games/piggy_firefighters/library/publish_files` is NEVER a default:
 * the repo rule is that nobody reads it while a generation runs (CLAUDE.md);
 * pass it explicitly as BOOKS_DIR when Codex says it is stable.
 *
 * FIXTURES-ONLY MODE. With no published index (PIGGY FIREFIGHTERS before Codex's 1M run),
 * the mock still boots: the bet-mode roster and costs come from the fixture
 * index (`costs`), and every `/wallet/play` returns a DEV fixture of the
 * requested mode (a pinned one if `?fixture=` set it, else a random one of
 * that mode). Outcomes are then fixture books, NOT weighted draws — say so in
 * any capture. `BOOKS_DIR=none` forces this mode.
 *
 * FIXTURES. `FIXTURES_DIR` (env) wins; default `server/fixtures` — the COPY/FE
 * lane's copy of Codex's 39 PRODUCTION fixtures (25,000x cap, nine modes incl.
 * golden_four; source math/games/piggy_firefighters/fixtures, 2026-09-23, names unchanged).
 * Falls back to math/games/piggy_firefighters/fixtures.
 *
 * Wire facts that are easy to get wrong (kept faithful to the SDK schema):
 *   1. Amounts are MICRO-UNITS: 1_000_000 == 1.00 (constants-shared/bet.ts).
 *   2. round.payoutMultiplier is a plain float; books store it ×100 → divide.
 *   3. PLAIN HTTP on 127.0.0.1 only. rgs-fetcher speaks http to loopback hosts.
 *
 * Run:  PORT=3082 node server/mock-rgs.mjs     (PORT env, default 3036; one mock per lane)
 * Launch the game with:  ?sessionID=local&rgs_url=127.0.0.1:3082&device=desktop
 */
import { createServer as createHttpServer } from 'node:http';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import {
	createWriteStream,
	readFileSync,
	writeFileSync,
	openSync,
	readSync,
	statSync,
	existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as zlibConstants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISHED_BOOKS_DIR = join(REPO, 'math', 'publish');
const hasIndex = (dir) => Boolean(dir) && existsSync(join(dir, 'index.json'));
// explicit BOOKS_DIR wins ('none' = fixtures only); else Codex's published tree if it exists; else fixtures only
const BOOKS_DIR =
	process.env.BOOKS_DIR === 'none' ? null : process.env.BOOKS_DIR || (hasIndex(PUBLISHED_BOOKS_DIR) ? PUBLISHED_BOOKS_DIR : null);
const INDEX = BOOKS_DIR ? join(BOOKS_DIR, 'index.json') : null;

// ---- deterministic dev fixtures ---------------------------------------------
// `POST /control/fixture {name}` pins a fixture; every following /wallet/play
// then returns that fixture's book and charges its mode's cost, until cleared
// with `{name:null}`. The frontend sets this from `?fixture=<name>` on the game
// URL (src/game/devFixture.ts). Dev/test only; never part of the upload.
// FIXTURES_DIR (env) lets a frontend lane run against its own hand-made books while the math lane rewrites the real ones.
const PROMOTED_FIXTURES_DIR = join(REPO, 'server', 'fixtures');
const FIXTURES_DIR =
	process.env.FIXTURES_DIR ||
	(hasIndex(PROMOTED_FIXTURES_DIR) ? PROMOTED_FIXTURES_DIR : join(REPO, 'math', 'games', 'piggy_firefighters', 'fixtures'));
const FIXTURES_INDEX = join(FIXTURES_DIR, 'index.json');
const fixtureIndex = existsSync(FIXTURES_INDEX) ? JSON.parse(readFileSync(FIXTURES_INDEX, 'utf8')) : { fixtures: [] };
const fixtureRoster = new Map(fixtureIndex.fixtures.map((f) => [f.name, f]));
const loadFixture = (name) => {
	const meta = fixtureRoster.get(name);
	if (!meta) return undefined;
	const book = JSON.parse(readFileSync(join(FIXTURES_DIR, meta.file), 'utf8'));
	// `cost` on a fixture wins over the books index (a fixture can be staged before its mode's books exist)
	return { mode: meta.mode, cost: meta.cost, book };
};

const MICRO = 1_000_000; // 1_000_000 == 1.00
const START_BALANCE = Math.round((Number(process.env.DEMO_BALANCE) || 10_000) * MICRO);
// DEV: RESUME=<fixture> leaves an UNFINISHED round open on every new session, so
// /wallet/authenticate returns an active round and the frontend replays/settles
// it from its book through the same director (docs/GAME_CONTRACT.md §5). Use a
// bonus fixture (e.g. build_or_bust_hold) to exercise the build director on
// resume, or base_win for the plain settle path. Cleared with `?fixture=off`-style
// `POST /control/resume {name:null}`, or by ending the round. Never in the upload.
// RESUME_AMOUNT=<micro> (or `amount` on /control/resume) stakes the seeded round at
// something OTHER than defaultBetLevel: the checklist rule is that an active round's
// own amount replaces the default, and a seed at the default cannot tell the two apart.
let resumeFixture = process.env.RESUME || null;
const resumeAmountEnv = Number(process.env.RESUME_AMOUNT);
const BET_LEVELS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].map((d) => d * MICRO);
const DEFAULT_BET_LEVEL = 1 * MICRO;
const DEFAULT_JURISDICTION = {
	socialCasino: false, disabledFullscreen: false, disabledTurbo: false,
	disabledSuperTurbo: false, disabledAutoplay: false, disabledSlamstop: false,
	disabledSpacebar: false, disabledBuyFeature: false, displayNetPosition: false,
	displayRTP: true, displaySessionTimer: false, minimumRoundDuration: 0,
};

if (process.env.BOOKS_DIR && process.env.BOOKS_DIR !== 'none' && !hasIndex(BOOKS_DIR)) {
	console.error(`mock-rgs: no index.json under BOOKS_DIR=${BOOKS_DIR} (unset it for math/publish or fixtures-only)`);
	process.exit(1);
}
if (!BOOKS_DIR && fixtureRoster.size === 0) {
	console.error(`mock-rgs: no published books (math/publish) and no fixtures under ${FIXTURES_DIR}; nothing to serve`);
	process.exit(1);
}

// ---- framed zstd store (books do not fit in RAM at publication scale) --------
const FRAME_RAW_BYTES = 8 * 1024 * 1024;
const FRAME_CACHE = 4;
const DIR_TAG = createHash('sha256').update(BOOKS_DIR ?? 'fixtures-only').digest('hex').slice(0, 8);
const INDEX_FORMAT = 1;
const storePaths = (mode, events) => ({
	src: join(BOOKS_DIR, events),
	frames: join(tmpdir(), `pff-${DIR_TAG}-books_${mode}.frames.zst`),
	index: join(tmpdir(), `pff-${DIR_TAG}-books_${mode}.v${INDEX_FORMAT}.idx`),
});

const storeIsFresh = (paths) => {
	const srcTime = statSync(paths.src).mtimeMs;
	return (
		statSync(paths.frames, { throwIfNoEntry: false })?.mtimeMs >= srcTime &&
		statSync(paths.index, { throwIfNoEntry: false })?.mtimeMs >= srcTime
	);
};

async function prepareMode(paths) {
	if (storeIsFresh(paths)) return false;
	const proc = spawn('zstd', ['-dc', paths.src], { stdio: ['ignore', 'pipe', 'inherit'] });
	const closed = new Promise((r) => proc.on('close', r));
	const out = createWriteStream(paths.frames);
	const write = (buf) => (out.write(buf) ? Promise.resolve() : new Promise((r) => out.once('drain', r)));

	const frameOffsets = [];
	const frameLengths = [];
	const ids = [];
	const bookFrame = [];
	const bookLine = [];
	const criteriaNames = [];
	const criteriaIds = [];
	const criteriaIndex = new Map();

	let pending = [];
	let pendingBytes = 0;
	let offset = 0;

	const flush = async () => {
		if (pending.length === 0) return;
		const packed = zstdCompressSync(Buffer.from(pending.join('\n')), {
			params: { [zlibConstants.ZSTD_c_compressionLevel]: 1 },
		});
		await write(packed);
		frameOffsets.push(offset);
		frameLengths.push(packed.length);
		offset += packed.length;
		pending = [];
		pendingBytes = 0;
	};

	for await (const line of createInterface({ input: proc.stdout, crlfDelay: Infinity })) {
		if (!line) continue;
		const id = Number(/"id":\s*(\d+)/.exec(line)?.[1]);
		if (!Number.isFinite(id)) continue;
		const criteria = /"criteria":\s*"?([^",}]*)"?/.exec(line)?.[1] ?? '';
		if (!criteriaIndex.has(criteria)) {
			criteriaIndex.set(criteria, criteriaNames.length);
			criteriaNames.push(criteria);
		}
		ids.push(id);
		bookFrame.push(frameOffsets.length);
		bookLine.push(pending.length);
		criteriaIds.push(criteriaIndex.get(criteria));
		pending.push(line);
		pendingBytes += line.length + 1;
		if (pendingBytes >= FRAME_RAW_BYTES) await flush();
	}
	await flush();
	await new Promise((resolve, reject) => out.on('error', reject).end(resolve));
	const exit = await closed;
	if (exit !== 0) throw new Error(`zstd exited ${exit} expanding ${paths.src}`);

	const json = JSON.stringify({ format: INDEX_FORMAT, count: ids.length, frameOffsets, frameLengths, criteriaNames });
	const header = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, ' '));
	const head = Buffer.alloc(8);
	head.writeUInt32LE(header.length, 0);
	head.writeUInt32LE(ids.length, 4);
	writeFileSync(paths.index, [
		head, header,
		Buffer.from(Uint32Array.from(ids).buffer),
		Buffer.from(Uint32Array.from(bookFrame).buffer),
		Buffer.from(Uint32Array.from(bookLine).buffer),
		Buffer.from(Uint32Array.from(criteriaIds).buffer),
	].reduce((a, b) => Buffer.concat([a, b])));
	return true;
}

async function loadMode(mode) {
	const paths = storePaths(mode.name, mode.events);
	if (!storeIsFresh(paths)) await prepareMode(paths);

	const blob = readFileSync(paths.index);
	const headerLength = blob.readUInt32LE(0);
	const count = blob.readUInt32LE(4);
	const meta = JSON.parse(blob.subarray(8, 8 + headerLength).toString('utf8'));
	let at = 8 + headerLength;
	const take = () => {
		const start = blob.byteOffset + at;
		const arr = start % 4 === 0
			? new Uint32Array(blob.buffer, start, count)
			: new Uint32Array(blob.buffer.slice(start, start + count * 4));
		at += count * 4;
		return arr;
	};
	const ids = take();
	const bookFrame = take();
	const bookLine = take();
	const criteriaIds = take();

	const slotById = new Map();
	const criteriaById = new Map();
	for (let i = 0; i < count; i += 1) {
		slotById.set(ids[i], i);
		criteriaById.set(ids[i], meta.criteriaNames[criteriaIds[i]]);
	}

	const fd = openSync(paths.frames, 'r');
	const cache = new Map();
	const readFrame = (frameNo) => {
		const hit = cache.get(frameNo);
		if (hit) return hit;
		const length = meta.frameLengths[frameNo];
		const buf = Buffer.allocUnsafe(length);
		readSync(fd, buf, 0, length, meta.frameOffsets[frameNo]);
		const lines = zstdDecompressSync(buf).toString('utf8').split('\n');
		cache.set(frameNo, lines);
		if (cache.size > FRAME_CACHE) cache.delete(cache.keys().next().value);
		return lines;
	};
	const readBook = (id) => {
		const slot = slotById.get(id);
		if (slot === undefined) return undefined;
		return JSON.parse(readFrame(bookFrame[slot])[bookLine[slot]]);
	};

	const rows = readFileSync(join(BOOKS_DIR, mode.weights), 'utf8')
		.trim().split('\n')
		.map((line) => {
			const [id, weight, payout] = line.split(',');
			return { id: Number(id), weight: Number(weight), payout: Number(payout) };
		});
	const cumulative = [];
	let running = 0;
	for (const row of rows) { running += row.weight; cumulative.push(running); }

	const byCriteria = new Map();
	for (const row of rows) {
		const criteria = criteriaById.get(row.id);
		if (criteria === undefined) continue;
		if (!byCriteria.has(criteria)) byCriteria.set(criteria, []);
		byCriteria.get(criteria).push(row.id);
	}
	return { ...mode, readBook, rows, cumulative, total: running, byCriteria };
}

function pickWeighted(mode) {
	const target = Math.random() * mode.total;
	let lo = 0, hi = mode.cumulative.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (mode.cumulative[mid] < target) lo = mid + 1;
		else hi = mid;
	}
	return mode.rows[lo].id;
}

// ---- HTTP plumbing ----------------------------------------------------------
function json(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		'content-type': 'application/json',
		'content-length': Buffer.byteLength(payload),
		'access-control-allow-origin': '*',
		'access-control-allow-headers': 'content-type',
		'access-control-allow-methods': 'GET,POST,OPTIONS',
	});
	res.end(payload);
}
function readBody(req) {
	return new Promise((resolve) => {
		let raw = '';
		req.on('data', (c) => (raw += c));
		req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
	});
}
const SUCCESS = { statusCode: 'SUCCESS', statusMessage: 'ok' };

/** Fixtures-only roster: the fixture index's `costs` (Codex's PIGGY FIREFIGHTERS fixtures carry all nine), else the costs
 *  the fixtures themselves name. `fixturesOnly` marks a mode whose plays are served from fixtures. */
const fixtureOnlyIndex = () => {
	const costs = { ...(fixtureIndex.costs ?? {}) };
	for (const f of fixtureIndex.fixtures) if (costs[f.mode] === undefined && f.cost !== undefined) costs[f.mode] = f.cost;
	return { modes: Object.entries(costs).map(([name, cost]) => ({ name, cost: Number(cost), fixturesOnly: true })) };
};

export async function startServer(port = Number(process.env.PORT || 3036)) {
	const index = INDEX ? JSON.parse(readFileSync(INDEX, 'utf8')) : fixtureOnlyIndex();
	if (!INDEX) console.log(`mock-rgs: FIXTURES-ONLY (no published books): every play is a DEV fixture from ${FIXTURES_DIR}`);
	// Cost per mode from the FULL index (before MODES filtering) so a pinned
	// fixture can charge its mode's cost even when that mode's books aren't framed.
	const modeCosts = new Map(index.modes.map((m) => [m.name, m.cost]));
	// MODES (env) restricts which modes are framed/loaded — e.g. MODES=base for a
	// fast base-game smoke check. Unset loads every mode in index.json.
	const only = (process.env.MODES || '').split(',').map((s) => s.trim()).filter(Boolean);
	index.modes = only.length ? index.modes.filter((m) => only.includes(m.name)) : index.modes;
	const modes = {};
	for (const m of index.modes) {
		if (m.fixturesOnly) {
			const pool = fixtureIndex.fixtures.filter((f) => f.mode === m.name).map((f) => f.name);
			modes[m.name] = { ...m, pool, rows: [] };
			console.log(`  mode '${m.name}': cost ${m.cost}x, fixtures only (${pool.length}: ${pool.join(', ') || 'none'})`);
			continue;
		}
		modes[m.name] = await loadMode(m);
		const rtp = modes[m.name].rows.reduce((a, r) => a + r.payout * r.weight, 0) /
			(100 * m.cost * modes[m.name].total);
		console.log(`  mode '${m.name}': ${modes[m.name].rows.length} books, cost ${m.cost}x, RTP ${rtp.toFixed(4)}`);
	}

	// Bet-mode roster for /authenticate (feature = purchasable buy bonus).
	const betModes = {};
	for (const m of index.modes) {
		betModes[m.name.toUpperCase()] = { mode: m.name.toUpperCase(), costMultiplier: m.cost, feature: m.cost >= 75 };
	}

	// DEV: build an active (unfinished) round from a fixture so authenticate can
	// hand the frontend a round to resume. `event: null` resumes from the start of
	// the book, so the whole sequence replays through the same director.
	const buildResumeRound = (name, roundID, amountOverride) => {
		const fx = loadFixture(name);
		if (!fx) return null;
		const cost = fx.cost ?? modeCosts.get(fx.mode) ?? 1; // `cost` on a fixture wins (loadFixture)
		const amount =
			Number.isInteger(amountOverride) && amountOverride > 0
				? amountOverride
				: Number.isInteger(resumeAmountEnv) && resumeAmountEnv > 0
					? resumeAmountEnv
					: DEFAULT_BET_LEVEL;
		const payoutMultiplier = fx.book.payoutMultiplier / 100;
		return {
			roundID,
			amount,
			payout: Math.round(amount * payoutMultiplier),
			payoutMultiplier,
			active: true,
			mode: fx.mode.toUpperCase(),
			event: null,
			state: fx.book.events,
			bookID: fx.book.id,
			criteria: fx.book.criteria,
			_wager: Math.round(amount * cost),
		};
	};

	if (resumeFixture && !fixtureRoster.has(resumeFixture)) {
		console.warn(`mock-rgs: RESUME='${resumeFixture}' is not a known fixture; ignoring.`);
		resumeFixture = null;
	}

	const sessions = new Map();
	const session = (id) => {
		const key = id || 'anon';
		if (!sessions.has(key)) {
			const s = { balance: START_BALANCE, round: null, roundID: 1 };
			if (resumeFixture) {
				const round = buildResumeRound(resumeFixture, s.roundID++);
				if (round) {
					s.balance -= round._wager; // already wagered before the interruption
					delete round._wager;
					s.round = round;
					console.log(`mock-rgs: session '${key}' opens with a resumable '${resumeFixture}' round`);
				}
			}
			sessions.set(key, s);
		}
		return sessions.get(key);
	};
	const balanceObject = (s) => ({ amount: s.balance, currency: 'USD' });
	let force = null;
	let forcedBookID = null;
	let fixtureName = null; // dev: pinned deterministic fixture (src/game/devFixture.ts)

	const handler = async (req, res) => {
		const url = new URL(req.url, 'http://localhost');
		if (req.method === 'OPTIONS') return json(res, 204, {});
		if (url.pathname === '/health') return json(res, 200, { ok: true, modes: Object.keys(modes), fixturesOnly: !INDEX, fixturesDir: FIXTURES_DIR });

		// Replay: GET /bet/replay/{game}/{version}/{mode}/{event}
		if (req.method === 'GET' && url.pathname.startsWith('/bet/replay/')) {
			const [, , , , , modeSeg, eventSeg] = url.pathname.split('/');
			const mode = modes[String(modeSeg || '').toLowerCase()];
			if (!mode || mode.fixturesOnly) return json(res, 404, { error: { statusCode: 404, code: 'ERR_VAL', message: `unknown mode ${modeSeg}` } });
			const id = Number(eventSeg);
			if (!mode.rows.some((r) => r.id === id)) return json(res, 404, { error: { statusCode: 404, code: 'ERR_VAL', message: `unknown replay book ${eventSeg}` } });
			const book = mode.readBook(id);
			const payoutMultiplier = book.payoutMultiplier / 100;
			return json(res, 200, {
				status: SUCCESS, roundID: id, amount: DEFAULT_BET_LEVEL,
				payout: Math.round(DEFAULT_BET_LEVEL * payoutMultiplier),
				payoutMultiplier, costMultiplier: mode.cost, active: true,
				mode: mode.name.toUpperCase(), event: null, state: book.events,
				bookID: book.id, criteria: book.criteria,
			});
		}
		if (req.method === 'GET') {
			return json(res, 200, { service: 'piggy_firefighters mock RGS', booksDir: BOOKS_DIR, fixturesDir: FIXTURES_DIR, fixturesOnly: !INDEX, modes: index.modes.map(({ name, cost }) => ({ name, cost })) });
		}

		const body = await readBody(req);

		if (url.pathname === '/control/force') { force = body.criteria ?? null; forcedBookID = Number.isInteger(body.bookID) ? body.bookID : null; return json(res, 200, { force, bookID: forcedBookID }); }
		if (url.pathname === '/control/fixture') {
			const name = body.name ?? null;
			if (name !== null && !fixtureRoster.has(name)) return json(res, 404, { error: { message: `unknown fixture ${name}` }, fixtures: [...fixtureRoster.keys()] });
			fixtureName = name;
			return json(res, 200, { fixture: fixtureName });
		}
		if (url.pathname === '/control/resume') {
			const name = body.name ?? null;
			if (name !== null && !fixtureRoster.has(name)) return json(res, 404, { error: { message: `unknown fixture ${name}` }, fixtures: [...fixtureRoster.keys()] });
			const amount = Number.isInteger(body.amount) && body.amount > 0 ? body.amount : undefined;
			resumeFixture = name;
			// Make the caller's next authenticate resumable without a restart. A
			// brand-new session is seeded once by session() (resumeFixture is now
			// set); an existing one is refreshed here — never both, so the wager is
			// only taken once. An explicit `amount` (micro-units) stakes the seed.
			if (name && body.sessionID) {
				// A new session is created UNSEEDED here and seeded once below, so the
				// stated amount (not session()'s default) is what the round carries.
				const held = resumeFixture; resumeFixture = null;
				const s = session(body.sessionID);
				resumeFixture = held;
				const round = buildResumeRound(name, s.roundID++, amount);
				if (round) { s.balance -= round._wager; delete round._wager; s.round = round; }
			}
			return json(res, 200, { resume: resumeFixture });
		}
		if (url.pathname === '/control/reset') { sessions.clear(); force = null; forcedBookID = null; fixtureName = null; return json(res, 200, { ok: true }); }

		if (url.pathname === '/wallet/authenticate') {
			const s = session(body.sessionID);
			return json(res, 200, {
				status: SUCCESS, balance: balanceObject(s),
				config: {
					minBet: BET_LEVELS[0], maxBet: BET_LEVELS.at(-1), stepBet: BET_LEVELS[0],
					defaultBetLevel: DEFAULT_BET_LEVEL, betLevels: BET_LEVELS, betModes,
					jurisdiction: DEFAULT_JURISDICTION,
				},
				// The LAST round, open or settled, exactly as the real RGS answers: `active` is
				// what the client reads to tell "resume this" from "this already finished", and
				// a mock that hid settled rounds could never exercise the second branch.
				round: s.round ?? undefined,
			});
		}

		if (url.pathname === '/wallet/play') {
			const s = session(body.sessionID);
			const amount = Number(body.amount ?? 0);
			if (!BET_LEVELS.includes(amount)) return json(res, 400, { status: { statusCode: 'ERR_GE', statusMessage: 'bet level not allowed' }, error: { message: `amount ${amount} not an allowed bet level` } });

			// DEV: a pinned fixture returns its deterministic book and charges its
			// own mode's cost, regardless of the requested mode.
			// FIXTURES-ONLY: an unpinned play of a fixtures-only mode is a random DEV fixture of that mode.
			const requested = modes[String(body.mode ?? 'base').toLowerCase()];
			const servedFixture =
				fixtureName ?? (requested?.fixturesOnly && requested.pool.length ? requested.pool[Math.floor(Math.random() * requested.pool.length)] : null);
			if (servedFixture) {
				const fx = loadFixture(servedFixture);
				if (!fx) return json(res, 500, { error: { message: `fixture ${servedFixture} unreadable` } });
				const cost = fx.cost ?? modeCosts.get(fx.mode) ?? 1; // `cost` on a fixture wins (loadFixture)
				const wager = Math.round(amount * cost);
				if (wager > s.balance) return json(res, 400, { status: { statusCode: 'ERR_IPB', statusMessage: 'insufficient balance' }, error: { message: 'insufficient balance' } });
				const book = fx.book;
				const payoutMultiplier = book.payoutMultiplier / 100;
				const payout = Math.round(amount * payoutMultiplier);
				const hasBonus = book.events.some((e) => ['buildStart', 'expandStart', 'buildOrBust'].includes(e.type)) ||
					book.events.filter((e) => e.type === 'reveal').length > 1;
				s.balance -= wager;
				s.round = {
					roundID: s.roundID++, amount, payout, payoutMultiplier,
					active: payout > 0 || hasBonus,
					mode: fx.mode.toUpperCase(), event: null, state: book.events,
					bookID: book.id, criteria: book.criteria,
				};
				return json(res, 200, { status: SUCCESS, balance: balanceObject(s), round: s.round });
			}

			const modeName = String(body.mode ?? 'base').toLowerCase();
			const mode = modes[modeName];
			if (!mode || mode.fixturesOnly) return json(res, 400, { error: { message: `unknown mode ${body.mode}` } });
			const wager = Math.round(amount * mode.cost);
			if (wager > s.balance) return json(res, 400, { status: { statusCode: 'ERR_IPB', statusMessage: 'insufficient balance' }, error: { message: 'insufficient balance' } });

			let id;
			if (forcedBookID !== null && mode.rows.some((r) => r.id === forcedBookID)) id = forcedBookID;
			else if (force && mode.byCriteria.get(force)?.length) { const pool = mode.byCriteria.get(force); id = pool[Math.floor(Math.random() * pool.length)]; }
			else id = pickWeighted(mode);

			const book = mode.readBook(id);
			const payoutMultiplier = book.payoutMultiplier / 100;
			const payout = Math.round(amount * payoutMultiplier);
			s.balance -= wager;
			s.round = {
				roundID: s.roundID++, amount, payout, payoutMultiplier,
				active: payout > 0 || book.events.filter((e) => e.type === 'reveal').length > 1,
				mode: mode.name.toUpperCase(), event: null, state: book.events,
				bookID: book.id, criteria: book.criteria,
			};
			return json(res, 200, { status: SUCCESS, balance: balanceObject(s), round: s.round });
		}

		if (url.pathname === '/wallet/end-round') {
			const s = session(body.sessionID);
			if (s.round?.active) { s.balance += s.round.payout; s.round = { ...s.round, active: false }; }
			return json(res, 200, { status: SUCCESS, balance: balanceObject(s) });
		}

		if (url.pathname === '/bet/event') {
			const s = session(body.sessionID);
			if (s.round) s.round.event = String(body.event ?? '');
			return json(res, 200, { status: SUCCESS });
		}
		return json(res, 404, { error: { message: 'not found' } });
	};

	const http = createHttpServer(handler);
	await new Promise((resolve) => http.listen(port, '127.0.0.1', resolve));
	return { port: http.address().port, close: () => http.close() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	console.log(`mock-rgs: books ${BOOKS_DIR ?? '(none: fixtures only)'} · fixtures ${FIXTURES_DIR} (${fixtureRoster.size})`);
	startServer().then(({ port }) => {
		console.log(`mock-rgs: http://127.0.0.1:${port} — plain http, no TLS`);
		console.log(`launch: ?sessionID=local&rgs_url=127.0.0.1:${port}&device=desktop`);
	});
}
