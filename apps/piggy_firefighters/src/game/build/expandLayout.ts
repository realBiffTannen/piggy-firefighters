/**
 * Layout for an EXPANDED round: 1-4 full 5x3 boards, each with its own timber,
 * spins banner and TOTAL sign, all fully visible above the HUD and clear of the
 * ante chip, at every viewport. Works in SCREEN px; the largest fit wins.
 *
 *   OWNER RULING 2026-09-19: every expanded round opens the site as a 2x2 of four BOXES at every
 *   viewport — two boxes to a row, never more. Boards fill the boxes in reading order (the third
 *   board starts the second row); a box the book did not unlock shows the LOCKED hoarding
 *   (BuildScene lock panels). So the grid never re-flows as boards arrive: 2, 3 and 4 boards all
 *   stand in the same four boxes, and only the single opening board is laid out on its own.
 *
 * A board's box is measured in CELLS around its grid (timber, the TOTAL sign on
 * the hazard beam, the spins banner hung underneath), so nothing a board draws
 * can leave its slot.
 */
import { BOARD_DIMENSIONS } from '../constants';

export type Slot = { x: number; y: number; cell: number }; // grid top-left + px per cell
export type ExpandLayout = { slots: Slot[]; cols: number; rows: number; cell: number; header: { x: number; y: number; h: number; w: number } };

export type Band = { x: number; y: number; w: number; h: number };

// the timber art (BoardTimber.svelte) around the 5x3 opening, in post thicknesses
const FRAME_OUT_X = 1.33;
const FRAME_OUT_TOP = 1.17;
const FRAME_OUT_BOTTOM = 1.23;

/** extents of one compact board around its grid, in cells. Nothing hangs under a board any
 *  more (contract 7.7 removed the banner strip), so the box ends at the lower beam and the
 *  freed height goes to bigger boards. */
export const boardBox = (post: number, margin: number) => {
	const left = margin + FRAME_OUT_X * post + 0.04;
	const top = Math.max(margin + FRAME_OUT_TOP * post, 0.13 + 0.26 + 0.05); // the spins tag rides the beam
	const bottom = margin + FRAME_OUT_BOTTOM * post + 0.06;
	return { left, top, bottom, w: BOARD_DIMENSIONS.x + 2 * left, h: BOARD_DIMENSIONS.y + top + bottom };
};

// The first grid listed is the preferred READ. Three boards prefer 2+1 (two up, one centred
// below): it is the larger fit on desktop AND it makes the reveal legible — 2 -> 3 keeps the
// top row where it stands and the third board rises in below; 3 -> 4 moves only the third
// board half a slot aside so the fourth can swing into the corner left free. A row of three
// would have to re-flow every board into a 2x2 at the same time as the fourth arrives.
// Never more than two boxes in a row (owner). The first grid listed is the preferred READ and wins
// unless another is clearly larger (8%): on desktop two boards stand side by side and 3/4 make the
// 2x2; on a phone in portrait the same rule yields a STACK (two boards one above the other, 3/4 a
// column of boxes) because side-by-side boards there would be ~30 px cells (owner, 2026-09-19:
// mobile is "very important to get right").
const GRIDS: Record<number, [number, number][]> = {
	1: [[1, 1]],
	2: [[2, 1], [1, 2]],
	3: [[2, 2], [1, 4]],
	4: [[2, 2], [1, 4]],
};
/** OWNER RULING 2026-09-19 (20:30): two boards stand side by side with NO locked box; a booked
 *  three shows the 2x2 with ONE locked box; four fills the 2x2. Boxes are laid out for the BOOKED
 *  count (BuildScene passes it), so the grid never re-flows while boards arrive. */
export const boxesFor = (booked: number) => (booked <= 1 ? 1 : booked === 2 ? 2 : 4);

/** PHONE PORTRAIT, A BOOKED THREE: THE BOX THAT NEVER OPENS IS A SLIM HOARDING (review 2026-09-20, seats A and C).
 *  In the portrait STACK the locked box used to take a full quarter of the column for the whole round: measured at
 *  390x844 the three boards the player paid for stood at ~37 px cells while the hoarding had ~21% of the screen.
 *  A booked three never puts a board in box 4 (`assignSlots` only hands out slots 0..count-1), so that box can be
 *  any size. It keeps its place at the foot of the column, as the owner ruled, at this share of a box; the height
 *  it gives back goes to the three live boards. The 2x2 (desktop, landscape, popout) is untouched, and so is a
 *  booked FOUR, where every box has to hold a board. */
const SLIM_LOCK = 0.45;

export const expandLayout = (count: number, band: Band, post: number, margin: number, headerH: number): ExpandLayout => {
	// `count` is the BOOKED board count: 1 alone, 2 side by side, 3 or 4 as the 2x2 of boxes
	const n = boxesFor(count);
	const box = boardBox(post, margin);
	const gapX = 0.2;
	const gapY = 0.1;
	const area = { x: band.x, y: band.y + headerH, w: band.w, h: Math.max(10, band.h - headerH) };

	// height of a grid in cells; a booked three standing as a column gives its locked fourth box SLIM_LOCK of a box
	const slimFor = (cols: number) => count === 3 && cols === 1;
	const gridH = (cols: number, rows: number) => (slimFor(cols) ? (rows - 1 + SLIM_LOCK) * box.h : rows * box.h) + (rows - 1) * gapY;
	let best = { cell: 0, cols: 1, rows: 1 };
	for (const [cols, rows] of GRIDS[n]) {
		const cell = Math.min(area.w / (cols * box.w + (cols - 1) * gapX), area.h / gridH(cols, rows));
		// the first grid listed is the preferred READ (a row / a 2x2); another grid must be
		// clearly larger (8%) to displace it, so near-ties do not pick an awkward 2+1
		if (cell > best.cell * (best.cell ? 1.08 : 0)) best = { cell, cols, rows };
	}
	const { cols, rows } = best;
	const cell = Math.max(8, best.cell);
	const slim = slimFor(cols);

	const totalH = gridH(cols, rows) * cell;
	const y0 = area.y + (area.h - totalH) / 2;
	const slots: Slot[] = [];
	for (let i = 0; i < n; i += 1) {
		if (slim && i === n - 1) {
			// the slim hoarding: a whole box at SLIM_LOCK scale, centred under the column
			const c = cell * SLIM_LOCK;
			slots.push({ x: area.x + (area.w - box.w * c) / 2 + box.left * c, y: y0 + (n - 1) * (box.h + gapY) * cell + box.top * c, cell: c });
			continue;
		}
		const r = Math.floor(i / cols);
		const inRow = Math.min(cols, n - r * cols); // a short last row (2+1) is centred
		const c = i - r * cols;
		const rowW = (inRow * box.w + (inRow - 1) * gapX) * cell;
		const x0 = area.x + (area.w - rowW) / 2;
		slots.push({
			x: x0 + (c * (box.w + gapX) + box.left) * cell,
			y: y0 + (r * (box.h + gapY) + box.top) * cell,
			cell,
		});
	}
	return { slots, cols, rows, cell, header: { x: band.x + band.w / 2, y: band.y + headerH / 2, h: headerH, w: band.w } };
};
