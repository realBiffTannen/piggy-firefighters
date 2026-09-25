/**
 * PIGGY FIREFIGHTERS — the art lane's delivered GEOMETRY, read from the meta JSON files that ship beside the art
 * (tools/art/derive_*.py write them). Every consumer that has to place runtime text on a blank plate, cut a frame
 * out of a plate or align a room over a reel column reads these numbers here instead of typing them.
 *
 * The JSON files live under static/assets/** (served files, which Vite will not import as modules), so
 * tools/art/gen_art_meta.mjs copies the fields the runtime reads into ./artMeta.generated.ts and qa/gate fails when
 * that copy drifts from the served JSON.
 */
import { frameMeta, cellsMeta, roomsMeta, propsMeta, signsMeta, maxwinMeta, symbolsMeta, symbolsTallMeta } from './artMeta.generated';

export type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (box: readonly number[]): Rect => ({ x: box[0], y: box[1], w: box[2] - box[0], h: box[3] - box[1] });

// ---- the truck-panel reel frame (ui_scene/board_frame.webp) ---------------------------------------------------------
/** Plate size and its reel opening in plate px; the top rail repeats every `railPeriod` px from `railTileX`. */
export const BOARD_FRAME = {
	w: frameMeta.w,
	h: frameMeta.h,
	open: { x0: frameMeta.open_px.x0, x1: frameMeta.open_px.x1, y0: frameMeta.open_px.y0, y1: frameMeta.open_px.y1 },
	railPeriod: frameMeta.rail_period_px,
	railTileX: frameMeta.top_tile[0],
	/** post / beam thickness in plate px (outer edge to the opening) */
	left: frameMeta.open_px.x0,
	right: frameMeta.w - frameMeta.open_px.x1,
	top: frameMeta.open_px.y0,
	bottom: frameMeta.h - frameMeta.open_px.y1,
} as const;

// ---- cell frames (ui_scene/cell_frame_*.webp, nine-slice) + the line-number plate ---------------------------------
type CellFrameKind = keyof typeof cellsMeta.frames;
/** The opening of a cell frame as fractions of its 384 px tile, and the nine-slice corner (the bolt block). */
export const cellFrame = (kind: CellFrameKind) => {
	const f = cellsMeta.frames[kind];
	const [w, h] = f.size;
	const hole = { x0: f.hole[0] * w, y0: f.hole[1] * h, x1: f.hole[2] * w, y1: f.hole[3] * h };
	// the corner block holds the bolt (its centre sits on the border's middle, radius ~ a third of the border)
	const border = Math.max(hole.x0, hole.y0, w - hole.x1, h - hole.y1);
	return { w, h, hole, corner: Math.round(border * 1.4) };
};
export const LINE_PLATE = {
	w: cellsMeta.line_plate.size[0],
	h: cellsMeta.line_plate.size[1],
	/** the blank cream field is the lower 60 % of the plate: centre the number there */
	textY: 0.62,
} as const;

// ---- the Rescue block (features/rescue/*) ---------------------------------------------------------------------------
type RoomFiles = (typeof roomsMeta.rooms)[number]['files'];
export type RoomStateName = keyof RoomFiles;
export const RESCUE_ART = {
	facade: {
		files: roomsMeta.facade.files,
		w: roomsMeta.facade.box[2] - roomsMeta.facade.box[0],
		h: roomsMeta.facade.box[3] - roomsMeta.facade.box[1],
	},
	/** reel column pitch in plate px (rooms are placed one per reel at this pitch) */
	pitch: roomsMeta.pitch_px,
	rooms: roomsMeta.rooms.map((room) => ({
		reel: room.reel,
		size: { w: room.size[0], h: room.size[1] },
		/** where the room sprite's top-left goes, in facade px (may be negative: the smoke rises above the cornice) */
		box: rectOf(room.box_in_facade),
		window: rectOf(room.window_in_facade),
		files: room.files,
	})),
	/** fire level -> state name (contract §5: 2 roaring, 1 smouldering, 0 safe) */
	stateOfFire: (fire: number, inferno: boolean): RoomStateName => {
		const base = fire >= 2 ? 'roaring' : fire === 1 ? 'smouldering' : 'safe';
		return (inferno ? `inferno_${base}` : base) as RoomStateName;
	},
} as const;

type PropName = keyof typeof propsMeta.props;
export const rescueProp = (name: PropName) => {
	const p = propsMeta.props[name] as { file: string; size: [number, number]; rung_period_px?: number; rail_span_px?: [number, number] };
	return { file: p.file, w: p.size[0], h: p.size[1], rungPeriod: p.rung_period_px, railSpan: p.rail_span_px };
};

// ---- win-rung signs (winrungs/signs/*.webp) ------------------------------------------------------------------------
export type RungSkin = keyof typeof signsMeta;
/** Sign plate geometry: the title board's centre (the sign's pivot), the amount plank's centre and width. */
export const rungSign = (skin: RungSkin) => {
	const s = signsMeta[skin];
	return {
		w: s.w,
		h: s.h,
		boardY: s.board[1],
		plankY: s.plank[1],
		plankW: s.plank[2],
		plankH: s.plank[3],
	};
};

// ---- max-win card (maxwin/*.webp) ------------------------------------------------------------------------------------
export const MAXWIN_CARD = {
	files: maxwinMeta.files,
	size: maxwinMeta.size,
	/** where the runtime title and multiple go, as fractions of the card */
	titleSafeArea: maxwinMeta.titleSafeArea,
} as const;

// ---- symbol tiles ------------------------------------------------------------------------------------------------------
/** The lettered WILD badge inside the WILD tiles (tile px). symbolMotion.WILD_BANNER carries the same rects. */
export const WILD_BADGE = {
	square: symbolsMeta.wild_badge.sym_W,
	tall: symbolsTallMeta.wild_badge.symT_W,
	squareTile: symbolsMeta.tile,
	tallTile: symbolsTallMeta.tile,
} as const;
