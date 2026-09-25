/**
 * ONE ticker callback for everything that moves on the reels: the spin engine (spinReels.svelte.ts),
 * every reel symbol's land / win / idle motion (components/SymbolSprite.svelte) and the win number
 * (components/Win.svelte). Subscribers write straight onto PIXI display objects; nothing here goes
 * through a reactive prop.
 *
 * It rides the game's own PIXI ticker (so motion is computed in the same callback chain that renders
 * it, ahead of the render) and falls back to requestAnimationFrame only until the application exists.
 */
import { stateApp } from '../stateApp';

export type BoardTick = (dtMs: number, nowMs: number) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
const subscribers: BoardTick[] = [];
let ticker: any;
let raf = 0;
let lastRaf = 0;
let clock = 0;

/** A long frame (tab switch, GC, another lane's hot reload) must not teleport anything. */
const MAX_DT = 50;

const run = (dtRaw: number) => {
	const dt = dtRaw > MAX_DT ? MAX_DT : dtRaw < 0 ? 0 : dtRaw;
	clock += dt;
	for (let i = 0; i < subscribers.length; i += 1) subscribers[i](dt, clock);
};

const onPixiTick = (tk: { deltaMS: number }) => run(tk.deltaMS);

const onRaf = (now: number) => {
	raf = 0;
	if (attach()) return;
	run(lastRaf ? now - lastRaf : 16.7);
	lastRaf = now;
	if (subscribers.length) raf = requestAnimationFrame(onRaf);
};

const attach = (): boolean => {
	const candidate = (stateApp as any).pixiApplication?.ticker;
	if (ticker && (!candidate || candidate === ticker)) return true;
	if (!candidate) return false;
	// a re-created application (hot reload) brings a new ticker: follow it
	try {
		ticker?.remove(onPixiTick);
	} catch {
		/* the old ticker was destroyed with its application */
	}
	ticker = candidate;
	// HIGH (= 25): motion is written before the renderer's own LOW-priority callback draws the frame
	ticker.add(onPixiTick, undefined, 25);
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
	return true;
};

export const boardTicker = {
	/** Engine clock in ms (sum of clamped frame deltas): every reel timer reads this, never Date. */
	now: () => clock,
	add(fn: BoardTick, first = false) {
		if (subscribers.includes(fn)) return;
		if (first) subscribers.unshift(fn);
		else subscribers.push(fn);
		if (!attach() && !raf && typeof requestAnimationFrame !== 'undefined') {
			lastRaf = 0;
			raf = requestAnimationFrame(onRaf);
		}
	},
	remove(fn: BoardTick) {
		const i = subscribers.indexOf(fn);
		if (i >= 0) subscribers.splice(i, 1);
	},
};
