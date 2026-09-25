import _ from 'lodash';
import type { Tween } from 'svelte/motion';

import { hudReservedHeight } from '@crashgalaxy/hud';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, RawSymbol, SymbolState } from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import { gameSound } from './audio';
import { SYMBOL_SIZE, BOARD_SIZES, INITIAL_BOARD, BOARD_DIMENSIONS, INITIAL_SYMBOL_STATE } from './constants';
import { createSpinReel, createSpinBoard } from './reels/spinReels.svelte';
import { anticipationCamera } from './reels/anticipationCamera.svelte';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	// Retired donor Howler cues; every landing now drives the ONE Web Audio
	// manager (game/audio). The scatter in Piggy Workers is the HARD HAT ('HAT').
	if (rawSymbol.name === 'HAT') {
		// count it (drives scatterLandIndex / the trigger) and play the hat-land
		// ladder with its three alternates (round-robin, presentation RNG).
		stateGame.scatterCounter = stateGame.scatterCounter + 1;
		gameSound.hatLand(stateGame.scatterCounter);
		if (stateGame.scatterCounter === 6) gameSound.triggerFanfare();
	}
	// The GOLDEN hard hat is a hat in every way (contract §3) and owns its landing: a heavier gold
	// impact and a glint, in step with the flip + gold ring the symbol plays (SymbolSprite.svelte).
	if (rawSymbol.name === 'GHAT') {
		stateGame.scatterCounter = stateGame.scatterCounter + 1;
		gameSound.goldenHatLand();
		// the rung rides the hat lane, so a golden hat sharing a reel with a plain one still climbs in order
		gameSound.goldenHatRung(stateGame.scatterCounter);
		if (stateGame.scatterCounter === 6) gameSound.triggerFanfare();
	}

	// WILD (Master Bao with the WILD banner): give it a soft land accent.
	if (rawSymbol.name === 'W') {
		gameSound.wildLand();
	}

	// A hard hat landing on the base board makes the mascot glance at the reels.
	if (rawSymbol.name === 'HAT' || rawSymbol.name === 'GHAT') {
		eventEmitter.broadcast({ type: 'mascotReact', react: 'hat' });
	}
};

// TRUE SPINNING REELS (game/reels/spinReels.svelte.ts): each column is a continuous strip with baked
// motion blur; the window is never empty. Speed tiers, slam-stop, anticipation and reduced motion all
// live in the reel model; this file only wires the callbacks and their sounds.
const CONSTRUCTION_SYMBOLS = new Set(['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3']);
const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) =>
	createSpinReel({
		reelIndex,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelStopping: () => {
			// 5-rung reel-stop ladder: each reel stops on its own rising rung
			// (reel 0 → reel_stop_1 … reel 4 → reel_stop_5) via the new manager.
			gameSound.reelStop(reelIndex);
			// and the timber clunk when the reel sets construction symbols down (the visible rows;
			// hats and the WILD announce themselves on their own)
			const rows = board[reelIndex]?.reelState.symbols ?? [];
			const shown = rows.slice(1, 1 + BOARD_DIMENSIONS.y).map((s) => s.rawSymbol.name);
			if (shown.some((n) => CONSTRUCTION_SYMBOLS.has(n))) gameSound.symbolLand(reelIndex);
		},
		onSymbolLand,
	}),
);

/** The raw (non-proxied) reels: what per-frame code reads (components/reels/ReelStrips.svelte). */
export const spinReels = board;

export type Reel = (typeof board)[number];
export type ReelSymbol = Reel['reelState']['symbols'][number];

export type MultiplierSymbol = {
	initX: number;
	initY: number;
	symbolX: Tween<number>;
	symbolY: Tween<number>;
	rawSymbol: RawSymbol;
	symbolState: SymbolState;
	oncomplete: () => void;
};

export const stateGame = $state({
	board,
	gameType: 'basegame' as GameType,
	multiplierBoard: [] as (MultiplierSymbol | undefined)[][],
	scatterCounter: 0,
});

// ---- SCENE LAYOUT -----------------------------------------------------------
// One function places everything that shares the play area: the reels, the
// timber frame that wraps ONLY the reels, the world gutters left and right of it
// (desktop / landscape) or above and below it (portrait), the mascot's standing
// spot, and the bonus furniture hung on the frame. All maths is done in SCREEN
// px and converted to main-design units once, so the HUD (which reads the reel
// rect back through `HudConfig.boardGeometry`) and the canvas agree exactly.
//
// Contract with the HUD's ante chip (`publishAnteChipRoom`): the chip is pinned
// to the viewport's right edge, lifted `--hud-h + 12px` off the bar, and stands
// down into the burger menu when its rect (+12 px) intersects the reel rect. The
// game wants it to stay a CHIP everywhere, and not to sit on the TIMBER either,
// so the frame is kept clear of it: either the frame ends above the chip
// (strategy A — portrait and most desktops) or stops short of it sideways
// (strategy B — short-and-wide viewports, where giving up height would cost
// more board than giving up width). Whichever yields the larger board wins.
const FRAME_POST_WIDE = 0.24; // timber post thickness in CELLS, desktop / landscape
const FRAME_POST_STACKED = 0.17; // thinner timber when the board is full-width
const FRAME_INNER_MARGIN = 0.04; // cells between the reels and the timber
const FRAME_OUT_X = 1.33; // post + corner protrusion, in post units
const FRAME_OUT_TOP = 1.17; // hazard beam + protrusion, in post units
const FRAME_OUT_BOTTOM = 1.2; // lower beam + protrusion, in post units
const CHIP_CLEAR_H = 66; // fallback: chip 39 px + 12 px lift + 12 px guard + slack
const CHIP_CLEAR_W = 186; // fallback: chip <= ~162 px wide + 12 px edge + 12 px guard
const CHIP_GUARD = 12 + 4; // the HUD's own 12 px collision gap, plus slack
const MINI_PLAYER_MAX_H = 320; // below this the board takes the whole band and the ante lives in the menu
// PORTRAIT / TABLET: the board is width-bound (5 reels across a phone), so square cells leave the
// lower half of the screen empty. Cells are 1:1.3 there instead — the reel engine still thinks in
// square SYMBOL_SIZE units; BoardContainer stretches the board by this factor and SymbolSprite
// counter-scales the art (the tall portrait tiles then fill the cell). Owner ruling 2026-09-19:
// "the game size increased dramatically" on mobile, no props under the board.
const ROW_PITCH_STACKED = 1.3;
// portrait: sit above the middle of the band so the plate's foreground reads under the board
const STACKED_BAND_BIAS = 0.34;

// The HUD's ante chip changes size and shape with the viewport (one line on desktop, a two-line
// block in the mini player), so fixed clearances either waste board or collide. The chip is measured
// instead; until the HUD has mounted it the fallbacks above apply. `visibility` (not `display`) hides
// a stood-down chip, so its rect stays readable and the decision cannot oscillate.
const chipBox = $state({ left: 0, top: 0, width: 0, height: 0 });
export const watchAnteChip = () => {
	if (typeof window === 'undefined') return () => {};
	let raf = 0;
	let observer: ResizeObserver | undefined;
	const measure = () => {
		const chip = document.querySelector<HTMLElement>('.ante-chip');
		if (!chip) return false;
		const r = chip.getBoundingClientRect();
		if (r.width === 0 || r.height === 0) return true;
		if (
			Math.abs(r.left - chipBox.left) > 0.5 ||
			Math.abs(r.top - chipBox.top) > 0.5 ||
			Math.abs(r.width - chipBox.width) > 0.5 ||
			Math.abs(r.height - chipBox.height) > 0.5
		) {
			chipBox.left = r.left;
			chipBox.top = r.top;
			chipBox.width = r.width;
			chipBox.height = r.height;
		}
		if (!observer && 'ResizeObserver' in window) {
			observer = new ResizeObserver(() => measure());
			observer.observe(chip);
		}
		return true;
	};
	const poll = () => {
		if (!measure()) raf = requestAnimationFrame(poll);
	};
	poll();
	const onResize = () => requestAnimationFrame(measure);
	window.addEventListener('resize', onResize);
	return () => {
		cancelAnimationFrame(raf);
		observer?.disconnect();
		window.removeEventListener('resize', onResize);
	};
};
const MASCOT_GUTTER = 0.95; // cells of gutter the mascot needs beside the reels

export type SceneLayout = ReturnType<typeof sceneLayout>;

const sceneLayout = () => {
	const main = stateLayoutDerived.mainLayout();
	const cs = stateLayoutDerived.canvasSizes();
	const type = stateLayoutDerived.layoutType();
	const stacked = type === 'portrait' || type === 'tablet';
	const ms = main.scale || 1;
	const cw = Math.max(1, cs.width);
	const ch = Math.max(1, cs.height);
	const reserve = hudReservedHeight(cw, ch);
	const hudTop = ch - reserve;

	const f = stacked ? FRAME_POST_STACKED : FRAME_POST_WIDE;
	const m = FRAME_INNER_MARGIN;
	const r = stacked ? ROW_PITCH_STACKED : 1; // cell height / cell width
	// OWNER RULING 2026-09-19 (20:35): on a phone / tablet the board has NO vertical borders — the
	// reels run edge to edge and only the hazard beam above and the lower beam below remain.
	const sideCells = stacked ? 0 : 2 * (m + FRAME_OUT_X * f);
	const cellsW = BOARD_DIMENSIONS.x + sideCells;
	const cellsH = BOARD_DIMENSIONS.y * r + 2 * m + (FRAME_OUT_TOP + FRAME_OUT_BOTTOM) * f;
	const top = Math.max(6, ch * 0.02);

	// measured chip room (screen px), else the fallbacks
	const measured = chipBox.width > 0 && chipBox.left > cw / 2 && chipBox.top < hudTop;
	const clearH = measured ? Math.max(0, hudTop - chipBox.top) + CHIP_GUARD : CHIP_CLEAR_H;
	const clearW = measured ? Math.max(0, cw - chipBox.left) + CHIP_GUARD : CHIP_CLEAR_W;

	let cell: number;
	let bandBottom: number;
	if (stacked) {
		// full-width board; the world lives above and below it
		bandBottom = hudTop - clearH;
		cell = Math.min(cw / cellsW, (bandBottom - top) / (cellsH + 0.3));
	} else if (ch < MINI_PLAYER_MAX_H) {
		// Mini player (Popout S and smaller): every pixel goes to the board. The HUD sees the overlap
		// and carries the ante in the burger menu, which is the kit's own answer at this size.
		const miniTop = Math.max(3, ch * 0.012);
		bandBottom = hudTop - 2;
		cell = Math.min((bandBottom - miniTop) / cellsH, (cw * 0.98) / cellsW);
	} else {
		const cellA = (hudTop - clearH - top) / cellsH;
		const cellB = Math.min((hudTop - top) / (cellsH + 0.3), (cw / 2 - clearW) / (cellsW / 2));
		const cellG = cw / (BOARD_DIMENSIONS.x + 2 * MASCOT_GUTTER + FRAME_OUT_X * f);
		const useA = cellA >= cellB;
		cell = Math.min(useA ? cellA : cellB, cellG);
		bandBottom = useA ? hudTop - CHIP_CLEAR_H : hudTop - cell * 0.3;
	}
	cell = Math.max(24, cell);

	const frameH = cellsH * cell;
	const frameW = cellsW * cell;
	// portrait: sit a little above the middle of the band so the ground reads below
	const bandTop = !stacked && ch < MINI_PLAYER_MAX_H ? Math.max(3, ch * 0.012) : top;
	const free = Math.max(0, bandBottom - bandTop - frameH);
	const frameTop = bandTop + free * (stacked ? STACKED_BAND_BIAS : 0.5);
	const reelW = BOARD_DIMENSIONS.x * cell;
	const reelH = BOARD_DIMENSIONS.y * cell * r;
	const reelX = (cw - reelW) / 2;
	const reelY = frameTop + (FRAME_OUT_TOP * f + m) * cell;

	const toMainX = (sx: number) => main.width / 2 + (sx - cw / 2) / ms;
	const toMainY = (sy: number) => main.height / 2 + (sy - ch / 2) / ms;

	return {
		type,
		stacked,
		cell, // screen px per reel cell (its WIDTH; a cell is `cell` x `cellH`)
		cellH: cell * r,
		rowPitch: r, // cell height / cell width: 1 wide, ROW_PITCH_STACKED stacked
		sidePosts: !stacked, // stacked layouts draw no vertical timber (edge-to-edge reels)
		post: f, // timber post thickness in cells
		innerMargin: m,
		mainScale: ms,
		canvas: { width: cw, height: ch },
		hudTop,
		reel: { x: reelX, y: reelY, width: reelW, height: reelH },
		frame: { x: (cw - frameW) / 2, y: frameTop, width: frameW, height: frameH },
		gutter: Math.max(0, (cw - frameW) / 2), // world px left and right of the timber
		toMainX,
		toMainY,
	};
};

const boardLayout = () => {
	const main = stateLayoutDerived.mainLayout();
	const sl = sceneLayout();
	const scale = sl.cell / (SYMBOL_SIZE * sl.mainScale);
	return {
		x: main.width / 2,
		y: sl.toMainY(sl.reel.y + sl.reel.height / 2),
		// uniform: what overlays laid out in SCREEN terms (win signs, the bonus scene) use
		scale,
		// The SAME transforms with the anticipation camera push applied. Everything that DRAWS the
		// board reads these; `scale` / `scaleXY` above stay the layout truth so the HUD chip
		// collision and the bonus scene never breathe with the push.
		zoomScale: scale * anticipationCamera.zoom,
		// the board's own transform: rows are `rowPitch` taller than they are wide (see
		// ROW_PITCH_STACKED). Everything laid out in square SYMBOL_SIZE units inside
		// BoardContainer / the board-unit overlays lands on the right cell through this.
		scaleXY: { x: scale, y: scale * sl.rowPitch },
		zoomScaleXY: { x: scale * anticipationCamera.zoom, y: scale * sl.rowPitch * anticipationCamera.zoom },
		rowPitch: sl.rowPitch,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const boardRaw = () =>
	board.map((reel) => reel.reelState.symbols.map((reelSymbol) => reelSymbol.rawSymbol));

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

// Same surface as the SDK's enhanced board (preSpin / spin / settle / stop / readyToSpinEffect).
const enhancedBoard = createSpinBoard(board);

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({
	winLevelMap,
});

export const stateGameDerived = {
	onSymbolLand,
	boardLayout,
	sceneLayout,
	boardRaw,
	scatterLandIndex,
	enhancedBoard,
	getWinLevelDataByWinLevelAlias,
};
