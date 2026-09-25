/**
 * THE WIN NUMBER ROLLS — everywhere it is shown.
 *
 * The studio HUD renders `stateBet.winBookEventAmount` exactly as it is written (it deliberately runs
 * no second ease of its own), so the game owns the roll: this module tweens that value from the board
 * ticker when `setTotalWin` arrives, and components/Win.svelte counts the on-board number with the
 * same duration law and easing. (The HUD hides its meter while the on-board number is up, so the two
 * are seen one after the other: the big count, then the meter catching up to the round total.)
 *
 * Terminal correctness is by STATE, not by clock: `finishWinMeter()` lands the meter on the exact book
 * amount (skip press, `finalWin`, a new round), and if anything else writes the value mid-roll (the
 * bonus director, the round reset) the roll stands down instead of fighting it.
 */
import { stateBet } from 'state-shared';

import { prefersReducedMotion } from '../fx/timing';
import { speedFactor } from '../stateSpeed.svelte';
import { boardTicker } from './boardTicker';

/** Roll length for a win of `bookAmount` (integer x100 of the base bet), before speed scaling:
 *  about 0.45 s for the smallest wins, easing up to about 1.2 s near 15x and holding there. */
export const winRollBaseMs = (bookAmount: number): number => {
	const x = Math.max(0, bookAmount / 100);
	const u = Math.min(1, x / 15);
	return 450 + 750 * Math.pow(u, 0.7);
};

/** The same, at the current speed tier (Turbo halves it, Super Turbo takes 30 %), never a flicker. */
export const winRollMs = (bookAmount: number): number =>
	prefersReducedMotion() ? 0 : Math.max(160, winRollBaseMs(bookAmount) * speedFactor());

/** Shared easing of every win roll: quick off the mark, a long soft landing. */
export const winRollEase = (u: number): number => 1 - Math.pow(1 - (u < 0 ? 0 : u > 1 ? 1 : u), 3);

let active = false;
let from = 0;
let target = 0;
let elapsed = 0;
let duration = 0;
let lastWritten = 0;
let waiters: (() => void)[] = [];

const stop = () => {
	if (!active) return;
	active = false;
	boardTicker.remove(tick);
	const list = waiters;
	waiters = [];
	list.forEach((resolve) => resolve());
};

const tick = (dt: number) => {
	if (stateBet.winBookEventAmount !== lastWritten) return stop(); // somebody else owns it now
	elapsed += dt;
	const u = Math.min(1, elapsed / duration);
	lastWritten = u >= 1 ? target : Math.round(from + (target - from) * winRollEase(u));
	stateBet.winBookEventAmount = lastWritten;
	if (u >= 1) stop();
};

/** Roll the HUD WIN meter to `amount`. Resolves when it has landed (or stood down). */
export const rollWinMeterTo = (amount: number, durationMs: number): Promise<void> => {
	const current = stateBet.winBookEventAmount;
	if (active && target === amount) return new Promise((resolve) => waiters.push(resolve));
	stop();
	if (durationMs <= 0 || amount <= current || prefersReducedMotion()) {
		stateBet.winBookEventAmount = amount;
		return Promise.resolve();
	}
	from = current;
	target = amount;
	elapsed = 0;
	duration = durationMs;
	lastWritten = current;
	active = true;
	boardTicker.add(tick);
	return new Promise((resolve) => waiters.push(resolve));
};

/** Land on the exact target now (skip press, end of round). */
export const finishWinMeter = () => {
	if (!active) return;
	if (stateBet.winBookEventAmount === lastWritten) stateBet.winBookEventAmount = target;
	stop();
};

export const winMeterRolling = () => active;
