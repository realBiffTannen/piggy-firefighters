import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType, Position } from './types';

// book events shared with scatter game
type BookEventReveal = {
	index: number;
	type: 'reveal';
	board: RawSymbol[][];
	paddingPositions: number[];
	anticipation: number[];
	gameType: GameType;
};

type BookEventSetTotalWin = {
	index: number;
	type: 'setTotalWin';
	amount: number;
};

type BookEventFinalWin = {
	index: number;
	type: 'finalWin';
	amount: number;
};

type BookEventSetWin = {
	index: number;
	type: 'setWin';
	amount: number;
	winLevel: number;
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: {
		symbol: SymbolName;
		kind: number;
		win: number;
		positions: Position[];
		meta: {
			lineIndex: number;
			multiplier: number;
			winWithoutMult: number;
			globalMult: number;
			lineMultiplier: number;
		};
	}[];
};

// customised
type BookEventCreateBonusSnapshot = {
	index: number;
	type: 'createBonusSnapshot';
	bookEvents: BookEvent[];
};

// ---- Hold & Build / Golden Build (docs/GAME_CONTRACT.md sections 4-5) --------
// Bonus cell positions are 0-based {reel,row} on the 5x3 grid, no padding offset.
// All amounts are integer x100 of the base bet.

export type BonusKind = 'holdAndBuild' | 'goldenBuild';
/** v2.4 (contract 7.2): the N-board features. Never carried by `buildStart`. */
export type ExpandedBonusKind = 'expandedHoldAndBuild' | 'goldenExpanded';
export type AnyBonusKind = BonusKind | ExpandedBonusKind;
export type BuildOrBustOutcome = BonusKind | ExpandedBonusKind | 'bust';
export type BonusSource = 'base' | 'buy' | 'buildOrBust';
export type HatResult = 'build' | 'upgrade' | 'maxed';
export type JackpotKind = null | 'minor' | 'major' | 'grand';

export type BonusHouse = { reel: number; row: number; tier: number };
export type BonusHat = { reel: number; row: number; result: HatResult; tier: number; golden?: boolean };
export type BonusDoor = {
	reel: number;
	row: number;
	tier: number;
	prize: number;
	jackpot: JackpotKind;
};

type BookEventBuildOrBust = {
	index: number;
	type: 'buildOrBust';
	outcome: BuildOrBustOutcome;
};

type BookEventBuildStart = {
	index: number;
	type: 'buildStart';
	bonus: BonusKind;
	source: BonusSource;
	spins: number;
	houses: BonusHouse[];
};

type BookEventBuildSpin = {
	index: number;
	type: 'buildSpin';
	spin: number; // 1-based
	hats: BonusHat[];
	extraSpin: boolean;
	spinsLeft: number; // after this spin, including any extra
};

type BookEventDoorReveal = {
	index: number;
	type: 'doorReveal';
	doors: BonusDoor[]; // reveal order (ascending prize, ties in reading order)
	boardTotal: number;
	/** v2.4: present only in an expanded round (0-based, < `boards`) */
	board?: number;
};

type BookEventGrandOpening = {
	index: number;
	type: 'grandOpening';
	multiplier: number;
	boardTotal: number;
	amount: number; // capped
	/** v2.4: present only in an expanded round */
	board?: number;
};

type BookEventBuildEnd = {
	index: number;
	type: 'buildEnd';
	amount: number; // capped
	winLevel: number;
};

// Base / Ante side features (contract §3a, §3b). Cells are 0-based on the visible 5x3 board.
type BookEventGust = {
	index: number;
	type: 'gust';
	hats: { reel: number; row: number }[];
	reelHats: number;
	totalHats: number;
};

type BookEventHatDelivery = {
	index: number;
	type: 'hatDelivery';
	hats: { reel: number; row: number; golden: boolean }[];
	reelHats: number;
	totalHats: number;
};

type BookEventStreetBonus = {
	index: number;
	type: 'streetBonus';
	streets: { row: number; multiplier: number; rowTotal: number; amount: number }[];
	boardTotal: number;
	/** v2.4: present only in an expanded round */
	board?: number;
};

// ---- EXPANDED HOLD & BUILD / GOLDEN EXPANDED (contract 7.2-7.4) -----------------
// An expanded round never emits buildStart / buildSpin / buildEnd.
export type ExpandSite = { board: number; houses: BonusHouse[] };
export type ExpandBoardSpin = {
	board: number;
	spin: number; // this board's own 1-based spin
	hats: BonusHat[];
	extraSpin: boolean;
	spinsLeft: number; // this board's spins after the tick, including any extra
};

type BookEventExpandStart = {
	index: number;
	type: 'expandStart';
	bonus: ExpandedBonusKind;
	source: 'buy' | 'buildOrBust';
	boards: number; // 2-4
	spins: number; // 6, per board
	sites: ExpandSite[];
	/** LUCKY `golden_four` only (docs/GAME_CONTRACT.md §8): 0.5. Omitted by every other mode (= 1). Every door,
	 *  prize, jackpot, street and total in the book is ALREADY scaled: this is an identity flag for titles and
	 *  copy, never a factor the client applies. */
	prizeScale?: number;
};

type BookEventExpandSpin = {
	index: number;
	type: 'expandSpin';
	tick: number; // 1-based
	/** one entry per board that still had spins at this tick, in board order */
	boards: ExpandBoardSpin[];
};

type BookEventExpandEnd = {
	index: number;
	type: 'expandEnd';
	boards: { board: number; total: number }[]; // each after its own streets / Grand Opening
	amount: number; // capped round total
	winLevel: number;
};

type BookEventWincap = {
	index: number;
	type: 'wincap';
	amount?: number;
};

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventSetTotalWin
	| BookEventCreateBonusSnapshot
	| BookEventFinalWin
	| BookEventSetWin
	// Hold & Build / Golden Build
	| BookEventBuildOrBust
	| BookEventBuildStart
	| BookEventBuildSpin
	| BookEventDoorReveal
	| BookEventGrandOpening
	| BookEventBuildEnd
	| BookEventWincap
	| BookEventGust
	| BookEventHatDelivery
	| BookEventStreetBonus
	// v2.4 expanded features
	| BookEventExpandStart
	| BookEventExpandSpin
	| BookEventExpandEnd;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
