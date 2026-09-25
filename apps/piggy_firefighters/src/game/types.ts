import { type SpinningReelSymbolState } from 'utils-slots';
import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type RawSymbol = {
	name: SymbolName;
	multiplier?: number;
	scatter?: boolean;
	wild?: boolean;
	/** CLIENT-ONLY: a W ignited by a Backdraft (contract §4). Never in a book; set by the backdraft presentation so
	 *  the cell draws the Blaze Wild art. The evaluated board treats it as an ordinary W. */
	blaze?: boolean;
	/** CLIENT-ONLY: the Blaze Wild's multiplier (Backdraft Spins, contract v1.1 §7), drawn as a badge on the cell. */
	blazeMult?: number;
};
export type BetMode = keyof typeof config.betModes;
export type GameType = keyof typeof config.paddingReels;

export const SYMBOL_STATES = [
	'static',
	'spin',
	'land',
	'win',
	'postWinStatic',
] as const;

export type SymbolState = SpinningReelSymbolState | (typeof SYMBOL_STATES)[number];

export type Position = {
	reel: number;
	row: number;
};
