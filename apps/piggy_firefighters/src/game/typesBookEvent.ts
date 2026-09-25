import type { BetType } from 'rgs-requests';

import type { SymbolName, RawSymbol, GameType, Position } from './types';

// ---- standard SDK events (docs/GAME_CONTRACT.md §8: SDK shapes, positions PADDED +1 row) -------------------------
type BookEventReveal = {
	index: number;
	type: 'reveal';
	/** 5 reels x 5 rows: padded row 0, the 3 visible rows, padded row 4 */
	board: RawSymbol[][];
	paddingPositions: number[];
	anticipation: number[];
	gameType: GameType;
	/** the math's reel set id (contract §3: BR0 / BRA / BRB / FR0 / FRI); optional in hand-made books */
	reelSet?: string;
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

/** One line win (math/src/calculations/lines.py). `positions` rows are PADDED (+1). `meta.lineIndex` is 1-based:
 *  line `n` is `config.paylines[n - 1]`. */
export type LineWin = {
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
};

type BookEventWinInfo = {
	index: number;
	type: 'winInfo';
	totalWin: number;
	wins: LineWin[];
};

type BookEventWincap = {
	index: number;
	type: 'wincap';
	amount?: number;
};

/** Natural trigger (math/src/events/events.py fs_trigger_event): `positions` are the alarm cells, rows PADDED. */
type BookEventFreeSpinTrigger = {
	index: number;
	type: 'freeSpinTrigger';
	totalFs: number;
	positions: Position[];
};

/** `amount` = the spin now being played (1-based), `total` = the spins the bonus has so far (SDK update_freespin_event). */
type BookEventUpdateFreeSpin = {
	index: number;
	type: 'updateFreeSpin';
	amount: number;
	total: number;
};

type BookEventFreeSpinEnd = {
	index: number;
	type: 'freeSpinEnd';
	amount: number;
	/** the SDK endFeature level: INFORMATIONAL only, never read for presentation (contract §8; game/roundTier.ts) */
	winLevel: number;
};

// customised (client-made on resume)
type BookEventCreateBonusSnapshot = {
	index: number;
	type: 'createBonusSnapshot';
	bookEvents: BookEvent[];
};

// ---- PIGGY FIREFIGHTERS custom events (docs/GAME_CONTRACT.md §8) ------------------------------------------------
// Cell positions are 0-based {reel, row} on the VISIBLE 5x3 board (no padding offset). Amounts are integers x100.

/** The bonus tier: Rescue Spins (tier 1) or Inferno Rescue (tier 2). Also the audio lane's bed key. */
export type BonusKind = 'rescue' | 'inferno';
export type BonusSource = 'natural' | 'buy' | 'alarmCall';
export type AlarmCallOutcome = 'rescue' | 'inferno' | 'falseAlarm';
/** A visible cell. `mult` (contract v1.1 §7-§8): the Blaze Wild multiplier, present only in Backdraft Spins. */
export type Cell = { reel: number; row: number; mult?: number };
export type Room = { reel: number; fire: number };
export type Spray = { reel: number; from: number; to: number };
export type RoomRescue = { reel: number; prize?: number };

/** base / ante / Backdraft Spins: 2-5 (3-5 in Backdraft Spins) cells ignite into Blaze Wilds. After `reveal`, before
 *  `winInfo`; `winInfo` then describes the board AFTER the Backdraft. In Backdraft Spins every cell carries `mult`
 *  (x2/x3/x5/x10) and a line's win is multiplied by the SUM of the mults of the Blaze Wilds it uses
 *  (`winInfo.meta.lineMultiplier`); base / ante Backdrafts are plain (contract v1.1 §7). */
type BookEventBackdraft = {
	index: number;
	type: 'backdraft';
	cells: Cell[];
	count: number;
};

/** First event of an `alarm_call` round. */
type BookEventAlarmCall = {
	index: number;
	type: 'alarmCall';
	outcome: AlarmCallOutcome;
};

type BookEventRescueStart = {
	index: number;
	type: 'rescueStart';
	bonus: BonusKind;
	source: BonusSource;
	spins: number;
	rooms: Room[];
	multiplier: number;
};

/** Every bonus spin, after `reveal`, before `winInfo` (may be empty so the cadence is uniform). */
type BookEventDouse = {
	index: number;
	type: 'douse';
	sprays: Spray[];
	rescues: RoomRescue[];
	/** the global multiplier AFTER this spin's rescues (this spin's line wins are multiplied by it) */
	multiplier: number;
	spinsAdded: number;
	spinsLeft: number;
};

type BookEventBuildingCleared = {
	index: number;
	type: 'buildingCleared';
	/** the building just cleared (1-based) */
	building: number;
	spinsAdded: number;
	spinsLeft: number;
};

type BookEventRescueEnd = {
	index: number;
	type: 'rescueEnd';
	amount: number;
	multiplier: number;
	rescued: number;
	buildings: number;
};

type BookEventBackdraftSpinsStart = {
	index: number;
	type: 'backdraftSpinsStart';
	spins: number;
};

type BookEventBackdraftSpinsEnd = {
	index: number;
	type: 'backdraftSpinsEnd';
	amount: number;
};

export type BookEvent =
	| BookEventReveal
	| BookEventWinInfo
	| BookEventSetTotalWin
	| BookEventCreateBonusSnapshot
	| BookEventFinalWin
	| BookEventSetWin
	| BookEventWincap
	| BookEventFreeSpinTrigger
	| BookEventUpdateFreeSpin
	| BookEventFreeSpinEnd
	| BookEventBackdraft
	| BookEventAlarmCall
	| BookEventRescueStart
	| BookEventDouse
	| BookEventBuildingCleared
	| BookEventRescueEnd
	| BookEventBackdraftSpinsStart
	| BookEventBackdraftSpinsEnd;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
