/**
 * HouseView imperative registry.
 *
 * The build director drives 15 cells by looking up a stable HANDLE per cell,
 * keyed `${reel}_${row}`. HouseView.svelte registers its handle on mount and
 * unregisters on destroy. The handle is the drop-in seam for the animation
 * worker's Spine house rigs: when the rigs land, HouseView keeps this exact
 * interface (appear / upgradeTo / maxed / openDoor / collect / setStatic) and
 * only its body changes — the director does not.
 *
 * Every async method resolves when its presentation completes. The director
 * additionally guards on a generation token and never waits forever on a
 * handle (bounded recovery lives in the director), so a missing or slow handle
 * cannot hang the round.
 */
import type { JackpotKind } from '../typesBookEvent';

export type HouseHandle = {
	/** A new house builds on this (previously empty) cell at `tier`. */
	appear: (tier: number) => Promise<void>;
	/** This house rises one (or more, for a snap) tier to `tier`. */
	upgradeTo: (tier: number) => Promise<void>;
	/** Tier-5 hit again: a short "maxed" sparkle, no tier change. */
	maxed: () => Promise<void>;
	/** Open this house's door onto its booked prize (+ jackpot plaque). */
	openDoor: (prizeText: string, jackpot: JackpotKind) => Promise<void>;
	/** Collect the revealed prize toward the running total. */
	collect: () => Promise<void>;
	/** Street bonus: the shown prize becomes the multiplied figure, with a punch (optional on fallbacks). */
	bumpPrize?: (prizeText: string) => Promise<void>;
	/** Snap to a static pose at `tier` (0 = empty). No animation. */
	setStatic: (tier: number) => void;
};

const registry = new Map<string, HouseHandle>();

export const cellKey = (reel: number, row: number): string => `${reel}_${row}`;

/** Registry key: single-board bonuses are board 0; EXPANDED rounds add boards 1-3. */
const regKey = (reel: number, row: number, board: number): string => `${board}:${reel}_${row}`;

export const registerHouse = (reel: number, row: number, handle: HouseHandle, board = 0): (() => void) => {
	const key = regKey(reel, row, board);
	registry.set(key, handle);
	return () => {
		if (registry.get(key) === handle) registry.delete(key);
	};
};

export const getHouse = (reel: number, row: number, board = 0): HouseHandle | undefined =>
	registry.get(regKey(reel, row, board));

export const clearHouseRegistry = (): void => registry.clear();
