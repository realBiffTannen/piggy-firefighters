/**
 * SPINNING REELS — the model. (The picture is components/reels/ReelStrips.svelte.)
 *
 * Each column is an endless strip streaming DOWN past the window. The strip is addressed in whole
 * symbols: slot `j` sits at board y = (j - 0.5 + pos) * SYMBOL_SIZE, where `pos` is how far the strip
 * has travelled. Slots 0..4 are the board the spin started from (padded row 0..4), negative slots are
 * what comes in from the top: decorative padding from the math reel strips (config.paddingReels) and,
 * once the stop is planned, the BOOK's five symbols at slots -pFinal..-pFinal+4, so that when the
 * strip has travelled exactly `pFinal` symbols the book's board is in the window. The frontend never
 * chooses what lands; it only chooses WHEN, and the planner makes the landing arrive on its beat.
 *
 * One reel's life:
 *   wait -> windup (kicks back, up) -> accel -> cruise -> brake (constant deceleration to a dead stop
 *   `overshoot` PAST the rest line) -> IMPACT -> settle (damped spring back to rest) -> rest
 *
 * IMPACT is the hand-over. Until then the column is drawn by pooled strip sprites; at IMPACT the
 * strip is at zero velocity (so it is perfectly sharp), the Svelte column — which has carried the
 * book's symbols, hidden, since the brake began — is shown at the same offset, the strip is hidden,
 * every symbol goes to `land` (game/symbolMotion.ts plays its material response) and the reel-stop /
 * symbol-land callbacks fire. The settle spring then moves the whole column while the symbols react
 * inside it: overlap, not a queue.
 *
 * Interface parity with the SDK reels it replaces (packages/utils-slots): `reelState.symbols /
 * motion / spinType / anticipating`, `enhancedBoard.preSpin / spin / settle / stop /
 * readyToSpinEffect`, the same reveal-event contract (`board`, `anticipation`), the same
 * `onReelStopping` / `onSymbolLand` callbacks, the same "a reel held for anticipation cannot be
 * slam-stopped" rule.
 *
 * Everything here advances from ONE ticker callback (boardTicker); nothing is a Tween or a timeout.
 */
import { stateBet } from 'state-shared';

import config from '../config';
import {
	REEL_SPIN_NORMAL,
	REEL_SPIN_TURBO,
	REEL_SPIN_SUPER,
	REEL_SLAM,
	REEL_REDUCED,
	type ReelSpinTier,
} from '../constants';
import { SYMBOL_SIZE } from '../constants';
import type { RawSymbol, SymbolState } from '../types';
import { isSuperTurbo } from '../stateSpeed.svelte';
import { prefersReducedMotion } from '../fx/timing';
import { boardTicker } from './boardTicker';

export type ReelMotion = 'spinning' | 'bouncing' | 'stopped';
export type ReelSpinType = 'normal' | 'fast' | 'anticipated';

type Phase = 'rest' | 'wait' | 'windup' | 'accel' | 'cruise' | 'brake' | 'settle' | 'rdim' | 'rhold' | 'rfade';

/** Rows of a padded reel: 0 = above the window, 1..3 = visible, 4 = below. */
export const REEL_ROWS = 5;
/** A target slot must still be this far (symbols) above the window when the stop is planned. */
const OFFSCREEN = 4.4;

const LEGEND: Record<string, RawSymbol['name']> = {
	'1': 'H1',
	'2': 'H2',
	'3': 'H3',
	'4': 'H4',
	a: 'L1',
	b: 'L2',
	c: 'L3',
	d: 'L4',
	W: 'W',
	s: 'ALARM',
	g: 'GALARM',
};

// One shared RawSymbol object per name: padding is decoration, it never needs its own identity.
const PAD_SYMBOL = Object.fromEntries(Object.values(LEGEND).map((name) => [name, { name }])) as Record<
	string,
	RawSymbol
>;
const decode = (strips: readonly string[]): RawSymbol[][] =>
	strips.map((strip) => Array.from(strip, (ch) => PAD_SYMBOL[LEGEND[ch] ?? 'L4']));

const PADDING = {
	basegame: decode(config.paddingReels.basegame),
	antegame: decode(config.paddingReels.antegame),
	backdraftgame: decode(config.paddingReels.backdraftgame),
	freegame: decode(config.paddingReels.freegame),
	infernogame: decode(config.paddingReels.infernogame),
};

/**
 * Which strips stream past. The reveal's `gameType` (written into stateGame before the spin) says base vs bonus; the
 * bonus kind / bet mode then picks the reel set (contract §3: BR0 base, BRA ante, BRB Backdraft Spins, FR0 Rescue
 * Spins, FRI Inferno Rescue). stateGame imports this module, so the game type arrives through a getter (no cycle).
 */
let paddingSource: () => { gameType: string; inferno: boolean } = () => ({ gameType: 'basegame', inferno: false });
export const setPaddingSource = (source: typeof paddingSource) => {
	paddingSource = source;
};

const paddingFor = (reelIndex: number): RawSymbol[] => {
	const mode = String(stateBet.activeBetModeKey ?? '').toLowerCase();
	const { gameType, inferno } = paddingSource();
	let set = PADDING.basegame;
	if (gameType === 'freegame') set = mode === 'backdraft_spins' ? PADDING.backdraftgame : inferno ? PADDING.infernogame : PADDING.freegame;
	else if (mode === 'ante') set = PADDING.antegame;
	return set[reelIndex] ?? set[0];
};

const pickTier = (): ReelSpinTier =>
	isSuperTurbo() ? REEL_SPIN_SUPER : stateBet.isTurbo ? REEL_SPIN_TURBO : REEL_SPIN_NORMAL;

const easeOutCubic = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);

export type CreateSpinReelOptions = {
	reelIndex: number;
	initialSymbols: RawSymbol[];
	initialSymbolState: SymbolState;
	onReelStopping: () => void;
	onSymbolLand: (args: { rawSymbol: RawSymbol }) => void;
};

const createReelSymbol = (rawSymbol: RawSymbol, row: number, symbolState: SymbolState) => ({
	id: {},
	rawSymbol,
	/** padded row, 0..4 (1..3 are in the window) */
	row,
	symbolState,
	oncomplete: () => {},
	// Compatibility with code written against the SDK's cascading reel (game/build/buildDirector.ts
	// `restIdleBoard` re-seats fallen symbols): a spinning reel's symbols never leave their rows, so
	// the position is fixed and `set` has nothing to do.
	symbolIndexOfBoard: row - 1,
	symbolY: { current: (row - 0.5) * SYMBOL_SIZE, set: async (_y: number, _options?: unknown) => {} },
});

export const createSpinReel = (options: CreateSpinReelOptions) => {
	const reelState = $state({
		symbols: options.initialSymbols.map((raw, row) => createReelSymbol(raw, row, options.initialSymbolState)),
		motion: 'stopped' as ReelMotion,
		spinType: 'normal' as ReelSpinType,
		anticipating: false,
	});

	/** Plain numbers the view reads every frame. Never reactive. */
	const rt = {
		phase: 'rest' as Phase,
		t: 0,
		pos: 0,
		vel: 0,
		speed: REEL_SPIN_NORMAL.speed,
		tier: REEL_SPIN_NORMAL,
		delay: 0,
		startedAt: 0,
		old: options.initialSymbols.slice() as RawSymbol[],
		target: null as RawSymbol[] | null,
		pad: paddingFor(options.reelIndex),
		padStart: 0,
		planned: false,
		pFinal: 0,
		brakeFrom: 0,
		brakeDist: 0,
		brakeMs: 0,
		overshoot: 0,
		impactAt: 0,
		noStop: false,
		slam: false,
		// what the view draws
		showStrip: false,
		columnOffset: 0, // symbols
		columnAlpha: 1,
		// bookkeeping
		resolved: true,
		resolve: (() => {}) as () => void,
		onImpact: (() => {}) as () => void,
		/** bumped whenever slot contents may have changed wholesale (new spin, new plan) */
		contentVersion: 0,
	};

	/** What the strip shows at slot `j` (see the header). */
	const symbolAt = (j: number): RawSymbol => {
		if (j >= 0 && j < REEL_ROWS) return rt.old[j];
		if (rt.planned && rt.target) {
			const r = j + rt.pFinal;
			if (r >= 0 && r < REEL_ROWS) return rt.target[r];
		}
		const n = rt.pad.length;
		return rt.pad[(((rt.padStart - j) % n) + n) % n];
	};

	const setAllStates = (state: SymbolState) => {
		for (const s of reelState.symbols) s.symbolState = state;
	};

	const writeSymbols = (raw: RawSymbol[]) => {
		reelState.symbols.forEach((s, row) => {
			if (raw[row]) s.rawSymbol = raw[row];
		});
	};

	const finish = () => {
		if (rt.resolved) return;
		rt.resolved = true;
		rt.resolve();
	};

	return { reelIndex: options.reelIndex, options, reelState, rt, symbolAt, setAllStates, writeSymbols, finish };
};

export type SpinReel = ReturnType<typeof createSpinReel>;
export type SpinReelSymbol = SpinReel['reelState']['symbols'][number];

type RevealLike = { board: RawSymbol[][]; anticipation?: number[] };

export const createSpinBoard = (board: SpinReel[]) => {
	let slamPending = false;
	let resultsIn = false;
	let ticking = false;

	const anyActive = () => {
		for (let i = 0; i < board.length; i += 1) if (board[i].rt.phase !== 'rest') return true;
		return false;
	};

	// ---- start ---------------------------------------------------------------------------------
	const startAll = () => {
		const now = boardTicker.now();
		const reduced = prefersReducedMotion();
		const tier = pickTier();
		let started = false;
		board.forEach((reel, i) => {
			const rt = reel.rt;
			if (rt.phase !== 'rest' && rt.phase !== 'settle') return; // already travelling
			reel.finish(); // a spin pressed during the last settle: that round's promise must not dangle
			started = true;
			rt.tier = tier;
			rt.speed = tier.speed;
			rt.old = reel.reelState.symbols.map((s) => s.rawSymbol);
			rt.target = null;
			rt.planned = false;
			rt.slam = false;
			rt.noStop = false;
			rt.pad = paddingFor(i);
			rt.padStart = Math.floor(Math.random() * rt.pad.length);
			rt.pos = 0;
			rt.vel = 0;
			rt.t = 0;
			rt.columnOffset = 0;
			rt.startedAt = now;
			rt.contentVersion += 1;
			reel.reelState.anticipating = false;
			reel.reelState.motion = 'spinning';
			reel.reelState.spinType = stateBet.isTurbo ? 'fast' : 'normal';
			reel.setAllStates('spin');
			if (reduced) {
				rt.phase = 'rdim';
				rt.showStrip = false;
				rt.delay = 0;
			} else {
				rt.phase = 'wait';
				rt.delay = i * tier.startStagger;
				rt.showStrip = true;
				rt.columnAlpha = 1;
			}
		});
		if (started) {
			slamPending = false;
			resultsIn = false;
		}
		wake();
	};

	// ---- schedule --------------------------------------------------------------------------------
	const earliestImpact = (reel: SpinReel, tier: ReelSpinTier) =>
		reel.rt.startedAt + reel.rt.delay + tier.windupMs + tier.accelMs + tier.minSpinMs + tier.brakeMs;

	/** Re-time reels `from..` so they land left to right from `base`; planned reels whose book symbols
	 *  are already on their way into the window keep the plan they have. */
	const schedule = (from: number, base: number, anticipation: number[], firstStep: number, onlyEarlier = false) => {
		const tier = pickTier();
		let at = base;
		for (let i = from; i < board.length; i += 1) {
			const reel = board[i];
			const rt = reel.rt;
			const held = (anticipation[i] || 0) > 0;
			at += held ? tier.anticipationMs : i === from ? firstStep : tier.stopStagger;
			if (rt.phase === 'brake' || rt.phase === 'settle' || rt.phase === 'rest') {
				at = Math.max(at, rt.impactAt);
				continue;
			}
			if (rt.planned && rt.pFinal - rt.pos < OFFSCREEN) {
				at = Math.max(at, rt.impactAt);
				continue;
			}
			const next = Math.max(at, rt.slam ? 0 : earliestImpact(reel, tier));
			if (onlyEarlier && rt.target && next >= rt.impactAt - 1) {
				// a slam may pull a held reel's landing EARLIER, never push it back (repeated presses
				// must not keep a reel streaming)
				at = rt.impactAt;
				continue;
			}
			rt.impactAt = next;
			at = next;
			rt.planned = false;
		}
	};

	let anticipationOfSpin: number[] = [];

	const plan = (reel: SpinReel, now: number) => {
		const rt = reel.rt;
		const tier = pickTier();
		const v = rt.speed / 1000; // symbols per ms
		const brakeMs = rt.slam ? REEL_SLAM.brakeMs : tier.brakeMs;
		const overshoot = rt.slam ? Math.min(REEL_SLAM.overshoot, tier.overshoot) : tier.overshoot;
		const nominal = (v * brakeMs) / 2;
		const travel = v * Math.max(0, rt.impactAt - now);
		let pFinal = Math.round(rt.pos + travel - overshoot - nominal);
		let dist = travel - (pFinal + overshoot - rt.pos);
		const minFinal = Math.ceil(rt.pos + OFFSCREEN);
		if (pFinal < minFinal || dist <= 0.2 || pFinal + overshoot - dist < rt.pos) {
			// the beat cannot be met without showing the book's symbols popping in: land later instead,
			// and carry the delay down the line so the left-to-right rhythm survives
			pFinal = Math.max(pFinal, minFinal);
			dist = Math.min(nominal, pFinal + overshoot - rt.pos);
			const actual = now + (pFinal + overshoot - rt.pos + dist) / v;
			const late = actual - rt.impactAt;
			rt.impactAt = actual;
			if (late > 1) {
				for (let i = reel.reelIndex + 1; i < board.length; i += 1) {
					if (!board[i].rt.planned && board[i].rt.target) board[i].rt.impactAt += late;
				}
			}
		}
		rt.pFinal = pFinal;
		rt.overshoot = overshoot;
		rt.brakeDist = dist;
		rt.brakeFrom = pFinal + overshoot - dist;
		rt.brakeMs = (2 * dist) / v;
		rt.planned = true;
		rt.contentVersion += 1;
	};

	// ---- impact ----------------------------------------------------------------------------------
	const impact = (reel: SpinReel) => {
		const rt = reel.rt;
		rt.showStrip = false;
		rt.vel = 0;
		rt.columnOffset = rt.overshoot;
		rt.columnAlpha = 1;
		rt.phase = 'settle';
		rt.t = 0;
		rt.onImpact();
		reel.reelState.motion = 'stopped';
		for (const s of reel.reelState.symbols) {
			s.symbolState = 'land';
			// only what the player can see has landed: the rows above and below the window are not on
			// the board (contract §3) and must not count as alarms or make a sound
			if (s.row >= 1 && s.row <= REEL_ROWS - 2) reel.options.onSymbolLand({ rawSymbol: s.rawSymbol });
		}
	};

	// ---- per-frame -------------------------------------------------------------------------------
	const stepReel = (reel: SpinReel, dt: number, now: number) => {
		const rt = reel.rt;
		if (rt.phase === 'rest') return;
		rt.t += dt;
		const tier = rt.tier;

		if (rt.phase === 'wait') {
			if (rt.t < rt.delay) return;
			rt.t -= rt.delay;
			rt.phase = tier.windupMs > 0 ? 'windup' : 'accel';
		}
		if (rt.phase === 'windup') {
			const u = Math.min(1, rt.t / tier.windupMs);
			rt.pos = -tier.windupDist * easeOutCubic(u);
			rt.vel = 0;
			if (u < 1) return;
			rt.t -= tier.windupMs;
			rt.phase = 'accel';
		}
		if (rt.phase === 'accel') {
			// constant acceleration out of the wind-up peak (velocity is zero there, so there is no kink):
			// the column is visibly on its way within a frame or two of letting go
			const T = tier.accelMs;
			const u = Math.min(1, rt.t / T);
			const base = tier.windupMs > 0 ? -tier.windupDist : 0;
			rt.pos = base + ((rt.speed / 1000) * T * u * u) / 2;
			rt.vel = rt.speed * u;
			if (u < 1) return;
			const over = rt.t - T;
			rt.pos += (rt.speed / 1000) * over;
			rt.t = over;
			rt.phase = 'cruise';
			rt.vel = rt.speed;
			if (rt.target && !rt.planned) plan(reel, now);
			return;
		}
		if (rt.phase === 'cruise') {
			if (rt.target && !rt.planned) plan(reel, now - dt);
			rt.pos += (rt.speed / 1000) * dt;
			rt.vel = rt.speed;
			if (!rt.planned || rt.pos < rt.brakeFrom) return;
			// entered the brake part-way through this frame: keep the remainder
			rt.t = (rt.pos - rt.brakeFrom) / (rt.speed / 1000);
			rt.phase = 'brake';
			reel.reelState.motion = 'bouncing';
			// the hidden Svelte column takes the book's symbols now, a whole brake ahead of its reveal
			reel.writeSymbols(rt.target!);
		}
		if (rt.phase === 'brake') {
			const u = Math.min(1, rt.t / rt.brakeMs);
			rt.pos = rt.brakeFrom + rt.brakeDist * (2 * u - u * u);
			rt.vel = rt.speed * (1 - u);
			if (u < 1) return;
			const over = rt.t - rt.brakeMs;
			impact(reel);
			rt.t = over;
		}
		if (rt.phase === 'settle') {
			const s = rt.t / 1000;
			const w = Math.PI * 2 * tier.settleHz;
			const d = tier.settleDamp;
			rt.columnOffset = rt.overshoot * Math.exp(-d * s) * (Math.cos(w * s) + (d / w) * Math.sin(w * s));
			if (rt.t >= tier.settleMs * 0.5) reel.finish();
			if (rt.t >= tier.settleMs) {
				rt.columnOffset = 0;
				rt.phase = 'rest';
			}
			return;
		}

		// ---- reduced motion: no travel. The old board dims, the book's board fades up. ----
		if (rt.phase === 'rdim') {
			const u = Math.min(1, rt.t / REEL_REDUCED.dimMs);
			rt.columnAlpha = 1 - (1 - REEL_REDUCED.dimAlpha) * u;
			if (u >= 1) {
				rt.phase = 'rhold';
				rt.t = 0;
			}
			return;
		}
		if (rt.phase === 'rhold') {
			if (!rt.target || now < rt.impactAt) return;
			reel.writeSymbols(rt.target);
			rt.overshoot = 0;
			impact(reel);
			rt.columnAlpha = REEL_REDUCED.dimAlpha;
			rt.phase = 'rfade';
			rt.t = 0;
			return;
		}
		if (rt.phase === 'rfade') {
			const u = Math.min(1, rt.t / REEL_REDUCED.fadeMs);
			rt.columnAlpha = REEL_REDUCED.dimAlpha + (1 - REEL_REDUCED.dimAlpha) * u;
			if (u >= 1) {
				rt.columnAlpha = 1;
				rt.phase = 'rest';
				reel.finish();
			}
		}
	};

	const tick = (dt: number, now: number) => {
		for (let i = 0; i < board.length; i += 1) stepReel(board[i], dt, now);
		if (!anyActive()) {
			ticking = false;
			boardTicker.remove(tick);
		}
	};

	const wake = () => {
		if (ticking) return;
		ticking = true;
		boardTicker.add(tick, true);
	};

	// ---- public ------------------------------------------------------------------------------------
	const preSpin = async (_options?: unknown) => {
		// The reels let go on the press and stream until the book arrives; nothing to wait for, so the
		// round request leaves on the press at every speed tier.
		startAll();
	};

	const applySlam = () => {
		const now = boardTicker.now();
		let k = 0;
		let last = now;
		let firstHeld = board.length;
		board.forEach((reel, i) => {
			const rt = reel.rt;
			if (rt.noStop) {
				firstHeld = Math.min(firstHeld, i);
				return;
			}
			if (!rt.target || rt.phase === 'brake' || rt.phase === 'settle' || rt.phase === 'rest') return;
			if (rt.phase === 'rdim' || rt.phase === 'rhold') {
				rt.impactAt = now + k * 20;
				k += 1;
				return;
			}
			if (rt.planned && rt.pFinal - rt.pos < OFFSCREEN) {
				last = Math.max(last, rt.impactAt);
				return;
			}
			const at = now + REEL_SLAM.brakeMs + k * REEL_SLAM.stagger;
			if (rt.planned && rt.impactAt <= at) {
				last = Math.max(last, rt.impactAt);
				return; // already landing sooner than a slam would
			}
			rt.slam = true;
			rt.planned = false;
			rt.impactAt = at;
			last = Math.max(last, at);
			k += 1;
		});
		// held (anticipation) reels are information and cannot be slammed, but they follow the new beat
		if (k > 0 && firstHeld < board.length) schedule(firstHeld, last, anticipationOfSpin, pickTier().stopStagger, true);
	};

	const spin = async ({ revealEvent }: { revealEvent: RevealLike; paddingBoard?: unknown }) => {
		startAll();
		const now = boardTicker.now();
		const tier = pickTier();
		const reduced = prefersReducedMotion();
		const anticipation = revealEvent.anticipation ?? [];
		anticipationOfSpin = anticipation;
		const firstHeld = anticipation.findIndex((v) => (v || 0) > 0);

		const promises = board.map((reel, i) => {
			const rt = reel.rt;
			const held = (anticipation[i] || 0) > 0;
			rt.target = revealEvent.board[i];
			rt.planned = false;
			rt.noStop = firstHeld >= 0 && i >= firstHeld;
			reel.reelState.spinType = held ? 'anticipated' : rt.noStop ? 'normal' : stateBet.isTurbo ? 'fast' : 'normal';
			rt.onImpact = () => {
				reel.options.onReelStopping();
				const next = board[i + 1];
				if (next && (anticipation[i + 1] || 0) > 0) next.reelState.anticipating = true;
			};
			rt.resolved = false;
			return new Promise<void>((resolve) => (rt.resolve = resolve));
		});

		if (reduced) {
			board.forEach((reel, i) => {
				const held = (anticipation[i] || 0) > 0;
				const prev = i > 0 ? board[i - 1].rt.impactAt : Math.max(now, reel.rt.startedAt + REEL_REDUCED.holdMs);
				reel.rt.impactAt = prev + (i === 0 ? 0 : held ? tier.anticipationMs * 0.5 : REEL_REDUCED.stagger);
			});
		} else {
			schedule(0, now + tier.brakeMs + 60, anticipation, 0);
		}
		resultsIn = true;
		if (slamPending) applySlam();
		slamPending = false;
		wake();

		await Promise.all(promises);
	};

	/** Second press. Before the book has arrived it is remembered and applied the moment it does. */
	const stop = () => {
		if (!anyActive()) return;
		if (!resultsIn) {
			slamPending = true;
			return;
		}
		applySlam();
	};

	/** Put a board up without a spin (resume, error). With no board while the reels are travelling —
	 *  the round request failed — the reels brake back onto the board they left: nothing is invented. */
	const settle = (rawBoard?: RawSymbol[][]) => {
		const now = boardTicker.now();
		const hasBoard = !!rawBoard && rawBoard.length > 0;
		board.forEach((reel, i) => {
			const rt = reel.rt;
			const travelling = rt.phase !== 'rest' && rt.phase !== 'settle';
			if (!hasBoard && travelling && !rt.target) {
				rt.target = rt.old;
				rt.noStop = false;
				rt.slam = true;
				rt.planned = false;
				rt.impactAt = now + REEL_SLAM.brakeMs + i * REEL_SLAM.stagger;
				rt.onImpact = () => {};
				return;
			}
			if (!hasBoard) return;
			rt.phase = 'rest';
			rt.showStrip = false;
			rt.columnOffset = 0;
			rt.columnAlpha = 1;
			rt.vel = 0;
			rt.target = null;
			rt.planned = false;
			const raw = rawBoard![i];
			if (raw && raw.length) reel.writeSymbols(raw);
			reel.setAllStates('static');
			reel.reelState.motion = 'stopped';
			reel.reelState.anticipating = false;
			reel.finish();
		});
		if (!hasBoard) {
			resultsIn = true;
			wake();
		}
	};

	/** The board is being covered / hidden with reels still streaming (a bought round sends no
	 *  `reveal`): stop the engine quietly on the board it left. Never visible. */
	const park = () => {
		board.forEach((reel) => {
			const rt = reel.rt;
			if (rt.phase === 'rest' || rt.target) return;
			rt.phase = 'rest';
			rt.showStrip = false;
			rt.columnOffset = 0;
			rt.columnAlpha = 1;
			rt.vel = 0;
			reel.setAllStates('static');
			reel.reelState.motion = 'stopped';
			reel.finish();
		});
	};

	return { board, preSpin, spin, settle, stop, park, readyToSpinEffect: () => {} };
};
