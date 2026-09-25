/**
 * Reactive state for the Fortune Build / Golden Dragon Build scene (internal: Hold & Build / Golden Build).
 *
 * This is the scene-level, RENDER-facing model: which cells exist, the phase,
 * the spins-left counter, the running total plate, the premium (Golden) look,
 * and the +1-spin / grand-opening beats. Per-cell house ANIMATION is imperative
 * (see houseRegistry.ts + HouseView.svelte); the tier recorded here is the
 * authoritative snapshot for resume / reduced-motion / skip fast-forward.
 *
 * The director (buildDirector.ts) is the single writer during a live round.
 * Every value shown comes from the book — the scene never invents an outcome.
 */
import { BOARD_DIMENSIONS } from '../constants';
import type { AnyBonusKind, BonusSource } from '../typesBookEvent';

export type BuildPhase =
	| 'idle'
	| 'intro'
	| 'spinning'
	| 'doors'
	| 'grandOpening'
	| 'total'
	| 'outro';

export type CellSnapshot = { reel: number; row: number; tier: number }; // tier 0 = empty

/** Everything ONE board shows. A single-board bonus is `boards[0]`; an EXPANDED
 *  round (contract 7.2) holds 2-4 of these, each with its own spins, banner,
 *  houses, doors and total — nothing is shared between boards. */
export type BoardStatus = 'hidden' | 'live' | 'complete';
export type BoardPhase = 'spinning' | 'doors' | 'grandOpening' | 'done';
export type BoardState = {
	index: number;
	/** hidden = not revealed yet (expanded reveal); complete = its spins ran out */
	status: BoardStatus;
	phase: BoardPhase;
	spinsLeft: number;
	/** What the hazard banner under the board SHOWS. Always a booked figure: the
	 *  count before the spin, that count less the spin being played, and — on the
	 *  flip's peak frame — the event's own `spinsLeft` (which includes the +1). */
	bannerSpins: number;
	/** Bumped every time the banner figure changes, so the banner can tick + glow. */
	bannerTick: number;
	/** Bumped when the +1 SPIN call-out is raised. */
	bannerExtra: number;
	/** Bumped when this board's spins run out while others continue (expanded). */
	completeTick: number;
	/** The money total is shown only once the doors start to open. */
	showTotal: boolean;
	/** running booked total shown on the board's plate (book units, x100 of base bet) */
	totalDisplay: number;
	/** authoritative tier per cell for snapshot / reduced-motion / resume */
	tiers: Record<string, number>;
};

export const makeBoard = (index: number, spins = 6, status: BoardStatus = 'live'): BoardState => ({
	index,
	status,
	phase: 'spinning',
	spinsLeft: spins,
	bannerSpins: spins,
	bannerTick: 0,
	bannerExtra: 0,
	completeTick: 0,
	showTotal: false,
	totalDisplay: 0,
	tiers: {},
});

const CELLS: { reel: number; row: number }[] = [];
for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
	for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) CELLS.push({ reel, row });
}

/** Fixed 15-slot render list; HouseView renders one per slot for the round. */
export const BUILD_CELLS = CELLS;

export const stateBuild = $state({
	active: false,
	bonus: 'holdAndBuild' as AnyBonusKind,
	source: 'base' as BonusSource,
	premium: false, // Golden Build look
	phase: 'idle' as BuildPhase,

	spins: 6,
	spinIndex: 0, // 1-based current spin (single board) / tick (expanded)
	extraSpinFlash: false,

	grandMultiplier: 0,
	winLevel: 0,
	capped: false,

	/** Per-board state. Single-board bonuses use exactly one entry. */
	boards: [makeBoard(0)] as BoardState[],

	// ---- EXPANDED HOLD & BUILD / GOLDEN EXPANDED (contract 7.2) --------------------
	/** This round is an expanded one: the scene lays out N boards. */
	expanded: false,
	/** Booked board count (2-4). The reveal never shows a board beyond this. */
	boardCount: 1,
	/** How many boards the LAYOUT currently makes room for (1 -> N during the reveal). */
	layoutCount: 1,
	/** Shared round meter: shown from the first door reveal on. */
	showRoundTotal: false,
	/** The booked `expandStart.prizeScale` (LUCKY golden_four: 0.5; everything else 1). Identity only — names the
	 *  round GOLDEN DRAGON CITY x4; the book's amounts are already scaled and are shown as booked. */
	prizeScale: 1,
	roundTotal: 0,

	/** Incremented on teardown / route change / new round: stale director beats
	 *  captured with an older token bail out and apply final state once. */
	generation: 0,

	/** Set true by a skip / stop press: the director stops awaiting holds and
	 *  applies remaining beats instantly, exactly once. */
	skip: false,
});

const tiersOf = (board: number) => stateBuild.boards[board]?.tiers ?? {};

export const stateBuildDerived = {
	board: (board = 0) => stateBuild.boards[board],
	/** Count of cells currently holding a house (tier >= 1). */
	occupiedCount: (board = 0) => Object.values(tiersOf(board)).filter((t) => t >= 1).length,
	occupiedAll: () => stateBuild.boards.reduce((n, _b, i) => n + stateBuildDerived.occupiedCount(i), 0),
	isFullBoard: (board = 0) => stateBuildDerived.occupiedCount(board) >= BUILD_CELLS.length,
	/** Rows ("streets") whose five plots all hold a house — read off the shown
	 *  board, never invented; the booked `streetBonus` pays on exactly these. */
	streetsComplete: (board = 0) => {
		let n = 0;
		for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1) if (stateBuildDerived.isStreetComplete(row, board)) n += 1;
		return n;
	},
	isStreetComplete: (row: number, board = 0) => {
		const tiers = tiersOf(board);
		for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1) {
			if (!((tiers[`${reel}_${row}`] ?? 0) >= 1)) return false;
		}
		return true;
	},
};

export const resetBuildState = () => {
	stateBuild.active = false;
	stateBuild.phase = 'idle';
	stateBuild.premium = false;
	stateBuild.spins = 6;
	stateBuild.spinIndex = 0;
	stateBuild.extraSpinFlash = false;
	stateBuild.grandMultiplier = 0;
	stateBuild.winLevel = 0;
	stateBuild.capped = false;
	stateBuild.boards = [makeBoard(0)];
	stateBuild.expanded = false;
	stateBuild.boardCount = 1;
	stateBuild.layoutCount = 1;
	stateBuild.showRoundTotal = false;
	stateBuild.prizeScale = 1;
	stateBuild.roundTotal = 0;
	stateBuild.skip = false;
};

/** Bumping the generation invalidates any in-flight director run. */
export const invalidateBuild = () => {
	stateBuild.generation += 1;
	stateBuild.skip = true;
};

// DEV ONLY: a read-only snapshot for the QA capture drivers (qa/tags_0919/bonus_scene/*.mjs), so a
// capture can key off the round's real phase instead of sleeping. Stripped from production builds.
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
	(window as unknown as { __pwBuild?: () => unknown }).__pwBuild = () => ({
		active: stateBuild.active,
		phase: stateBuild.phase,
		expanded: stateBuild.expanded,
		boardCount: stateBuild.boardCount,
		layoutCount: stateBuild.layoutCount,
		tick: stateBuild.spinIndex,
		roundTotal: stateBuild.roundTotal,
		boards: stateBuild.boards.map((b) => ({
			status: b.status,
			phase: b.phase,
			spins: b.bannerSpins,
			total: b.totalDisplay,
			houses: Object.values(b.tiers).filter((t) => t >= 1).length,
		})),
	});
}
