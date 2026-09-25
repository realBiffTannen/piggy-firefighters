/**
 * Shared, NON-reactive facts about the base board that per-frame code reads without touching the
 * reactive graph. `idle` is maintained by components/Board.svelte (round machine idle, no reel
 * travelling, no bonus scene); `lastIdleStart` lets the symbols keep their idle micro-reactions from
 * ever starting together (components/SymbolSprite.svelte).
 */
export const boardLife = {
	idle: false,
	lastIdleStart: -1e9,
	/** idle reactions playing right now: the board murmurs, it never fidgets (SymbolSprite caps it) */
	idleActive: 0,
};
