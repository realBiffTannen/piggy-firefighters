/**
 * EXPANDED HOLD & BUILD / GOLDEN EXPANDED round director (contract 7.2-7.4).
 *
 * The site "opens up" into N parallel boards (N is BOOKED: 2, 3 or 4). This
 * director owns only what is new — the reveal, the per-tick fan-out, the SITE
 * COMPLETE rest state and the banking of board totals into the round total — and
 * reuses the single-board director for everything a board does on its own
 * (buildDirector.playSpins / doorReveal / streetBonus / grandOpening /
 * finishRound), so a board in an expanded round IS the board players know.
 *
 * Same rules as the single-board director: generation tokens, skip / stop, turbo,
 * reduced motion, bounded awaits, idempotent HUD win ownership. Nothing here
 * invents an outcome: the board count, every house, hat, spin and total is read
 * from the book. In particular the reveal never starts to show a board that is
 * not in the book, and the suspense beat between boards is IDENTICAL whether or
 * not another board follows.
 */
import { waitForTimeout } from 'utils-shared/wait';
import { setFeatureSpins } from '@crashgalaxy/hud';

import { eventEmitter } from '../eventEmitter';
import type { BookEvent, BookEventOfType, BonusHat } from '../typesBookEvent';
import { audioDirector } from './audioDirector';
import { hold } from './buildTiming';
import { stateBuild, resetBuildState, makeBoard } from './stateBuild.svelte';
import { stateScene, moodForBonus } from './stateScene.svelte';
import { alive, fast, bounded, coveredChange, claimFeature, placeHouses, playSpins, finishRound, finalRoundAmount, finalRoundWinLevel } from './buildDirector';
import { cellKey } from './houseRegistry';
import { MODE_TITLE } from '../names';

/** LUCKY golden_four is the one Golden Expanded round the book marks with a prizeScale below 1 (contract §8). */
export const isGoldenFour = (golden: boolean, prizeScale: number) => golden && prizeScale < 1;
/** The round's player-facing title (theme §5): FORTUNE CITY / GOLDEN DRAGON CITY / GOLDEN DRAGON CITY x4. */
export const expandedTitle = (golden: boolean, prizeScale = 1) =>
	isGoldenFour(golden, prizeScale) ? MODE_TITLE.golden_four : golden ? MODE_TITLE.expanded_golden_build : MODE_TITLE.expanded_hold_and_build;
/** A booked scale, or 1 when the event omits it (every mode but golden_four). */
const scaleOf = (e: { prizeScale?: number } | undefined) =>
	typeof e?.prizeScale === 'number' && e.prizeScale > 0 ? e.prizeScale : 1;

/** Stage an expanded round behind the shutter. `boards` is the BOOKED count. */
const stage = async (
	gen: number,
	golden: boolean,
	boards: number,
	spins: number,
	source: 'buy' | 'buildOrBust',
	prizeScale = 1,
) => {
	stateBuild.active = true;
	stateBuild.bonus = golden ? 'goldenExpanded' : 'expandedHoldAndBuild';
	stateBuild.source = source;
	stateBuild.premium = golden;
	stateBuild.prizeScale = prizeScale;
	stateBuild.spins = spins;
	stateBuild.expanded = true;
	stateBuild.boardCount = boards;
	stateBuild.layoutCount = 1;
	// every booked board is mounted (hidden) behind the shutter so its entrance
	// never hitches; only board 0 is visible when the shutter lifts
	stateBuild.boards = Array.from({ length: boards }, (_, i) => makeBoard(i, spins, i === 0 ? 'live' : 'hidden'));
	stateBuild.phase = 'intro';
	stateScene.busy = true;

	claimFeature();
	setFeatureSpins(spins);
	audioDirector.expandIntro?.(golden);
	eventEmitter.broadcast({ type: 'mascotReact', react: 'celebrate' });
	if (!fast(gen)) await waitForTimeout(hold(520));
	eventEmitter.broadcast({ type: 'mascotReact', react: 'brace' });

	await coveredChange(
		gen,
		{
			kind: 'intro',
			premium: golden,
			title: expandedTitle(golden, prizeScale),
			subtitle: isGoldenFour(golden, prizeScale)
				? `The city grows — ${boards} Golden districts, every door at half value`
				: golden
					? 'The city grows — every new building starts at Tier 3'
					: `The city grows — every district builds over its own ${spins} spins`,
			hint: 'Tap or press Space',
		},
		3600,
		() => {
			eventEmitter.broadcast({ type: 'boardHide' });
			eventEmitter.broadcast({ type: 'featureDropsClear' });
			stateScene.staged = true;
			stateScene.mood = moodForBonus(golden);
		},
	);
	eventEmitter.broadcast({ type: 'mascotReact', react: 'excited' });
	stateBuild.phase = 'spinning';
};

/** Everything at its final layout, no motion (skip / stale / resume). */
const snapOpen = () => {
	stateBuild.layoutCount = stateBuild.boardCount;
	for (const b of stateBuild.boards) if (b.status === 'hidden') b.status = 'live';
	eventEmitter.broadcast({ type: 'expandSnap' });
};

export const expandStart = async (e: BookEventOfType<'expandStart'>) => {
	// A fresh round: invalidate any lingering run, reset, take a new token.
	stateBuild.generation += 1;
	const gen = stateBuild.generation;
	resetBuildState();

	const boards = Math.max(2, Math.min(4, Math.round(e.boards)));
	const golden = e.bonus === 'goldenExpanded';
	await stage(gen, golden, boards, e.spins, e.source, scaleOf(e));

	// ---- IMPERIAL DECREE (donor: SITE PERMIT): the booked count is drawn on the counter reel ----
	// Presentation of the book's `boards`, never a decision; skip / turbo-stop show the number
	// plainly. Bounded, so the beat can never hold the round.
	if (alive(gen)) {
		await bounded(
			eventEmitter.broadcastAsync({ type: 'expandCountReel', boards, golden, instant: fast(gen) }),
			fast(gen) ? 1500 : 9000,
		);
	}

	// ---- THE REVEAL: one board, then the site opens up, one booked board at a time ----
	// Every board comes to life as it lands: its booked starting houses pop in while the
	// count beat plays, so each crane-in has its payoff and the site fills as it opens.
	const placed: Promise<void>[] = [];
	const placedBoard = new Set<number>();
	const placeBoard = (board: number) => {
		if (placedBoard.has(board)) return;
		placedBoard.add(board);
		const site = e.sites.find((s) => s.board === board);
		if (site) placed.push(placeHouses(gen, site.houses, site.board));
	};
	if (fast(gen)) {
		snapOpen();
	} else {
		placeBoard(0); // the player reads ONE board first — a real one, with its houses
		await waitForTimeout(hold(980));
		for (let k = 1; k < boards; k += 1) {
			if (fast(gen)) break;
			// camera pulls back to make room for exactly the boards revealed so far + this one
			if (k === 1) audioDirector.expandOpen?.();
			stateBuild.layoutCount = k + 1;
			await bounded(eventEmitter.broadcastAsync({ type: 'expandPullBack', count: k + 1 }), 4000);
			if (fast(gen)) break;
			// the site settles before the next board arrives: two motions, never one blur
			await waitForTimeout(hold(240));
			// the board is craned / hinged in with weight, dust and a bolt-down beat
			stateBuild.boards[k].status = 'live';
			await bounded(eventEmitter.broadcastAsync({ type: 'expandBoardIn', board: k }), 5000);
			if (fast(gen)) break;
			// the count beat: the SAME held breath after every board, then either the
			// site opens further or the sign stamps the final, booked count. The new
			// board's houses pop in under it.
			placeBoard(k);
			await bounded(eventEmitter.broadcastAsync({ type: 'expandCount', count: k + 1, final: k === boards - 1 }), 4000);
		}
		if (fast(gen)) snapOpen();
	}

	// whatever the reveal did not get to (skip / fast path) comes up now, boards overlapping
	for (const site of e.sites) placeBoard(site.board);
	await Promise.all(placed);
	if (!fast(gen)) await waitForTimeout(hold(420));
};

// ---- resume recovery ------------------------------------------------------------------
// game/utils.ts (another owner's file) rewinds an interrupted round to `buildStart`
// only. Until it also rewinds to `expandStart`, a resumed expanded round arrives
// here mid-way with no staged scene. The board state at that point is rebuilt
// HONESTLY from the book: final tiers from each board's `doorReveal`, walked back
// through the hats that are still to come.
const recover = async (bookEvents: BookEvent[]) => {
	stateBuild.generation += 1;
	const gen = stateBuild.generation;
	resetBuildState();
	const end = bookEvents.find((b) => b.type === 'expandEnd') as BookEventOfType<'expandEnd'> | undefined;
	const doorEvents = bookEvents.filter((b) => b.type === 'doorReveal') as BookEventOfType<'doorReveal'>[];
	const spinEvents = bookEvents.filter((b) => b.type === 'expandSpin') as BookEventOfType<'expandSpin'>[];
	const boards = Math.max(2, Math.min(4, end?.boards.length ?? doorEvents.length ?? 2));
	const golden = spinEvents.some((t) => t.boards.some((b) => b.hats.some((h) => h.golden))) || doorEvents.every((d) => d.doors.every((x) => x.tier >= 3));

	const sites = Array.from({ length: boards }, (_, board) => {
		const tiers: Record<string, number> = {};
		for (const d of doorEvents.find((x) => (x.board ?? 0) === board)?.doors ?? []) tiers[cellKey(d.reel, d.row)] = d.tier;
		for (let t = spinEvents.length - 1; t >= 0; t -= 1) {
			const entry = spinEvents[t].boards.find((b) => b.board === board);
			for (const h of entry?.hats ?? []) {
				const key = cellKey(h.reel, h.row);
				if (h.result === 'build') tiers[key] = 0;
				else if (h.result === 'upgrade') tiers[key] = Math.max(golden ? 3 : 1, (tiers[key] ?? h.tier) - (h.golden ? 2 : 1));
			}
		}
		const houses = Object.entries(tiers)
			.filter(([, tier]) => tier >= 1)
			.map(([key, tier]) => ({ reel: Number(key.split('_')[0]), row: Number(key.split('_')[1]), tier }));
		const left = spinEvents[0]?.boards.find((b) => b.board === board);
		return { board, houses, spinsLeft: left ? left.spinsLeft - (left.extraSpin ? 1 : 0) + 1 : 0 };
	});

	await stage(gen, golden, boards, 6, 'buy', scaleOf(bookEvents.find((b) => b.type === 'expandStart') as BookEventOfType<'expandStart'> | undefined));
	snapOpen();
	const wasSkip = stateBuild.skip;
	stateBuild.skip = true; // houses come up static: this is a restored state, not a beat
	for (const site of sites) {
		await placeHouses(gen, site.houses, site.board);
		const bs = stateBuild.boards[site.board];
		bs.spinsLeft = site.spinsLeft;
		bs.bannerSpins = site.spinsLeft;
		if (site.spinsLeft <= 0) bs.status = 'complete';
	}
	stateBuild.skip = wasSkip;
	return gen;
};

export const expandSpin = async (e: BookEventOfType<'expandSpin'>, bookEvents: BookEvent[] = []) => {
	if (!stateBuild.active || !stateBuild.expanded) await recover(bookEvents);
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	stateBuild.spinIndex = e.tick;

	// every board that still has spins spends one of ITS spins, together
	const entries = e.boards
		.filter((b) => stateBuild.boards[b.board])
		.map((b) => ({ board: b.board, hats: b.hats as BonusHat[], extraSpin: b.extraSpin, spinsLeft: b.spinsLeft }));
	await playSpins(gen, entries);

	// a board whose spins ran out rests, finished, while the others continue
	const finished = entries.filter((b) => b.spinsLeft <= 0 && stateBuild.boards[b.board].status !== 'complete');
	if (finished.length) {
		finished.forEach((b, i) => {
			const bs = stateBuild.boards[b.board];
			bs.status = 'complete';
			setTimeout(() => {
				if (!alive(gen)) return;
				bs.completeTick += 1;
				if (!fast(gen)) audioDirector.boardComplete?.();
			}, fast(gen) ? 0 : hold(140) * i);
		});
		if (!fast(gen)) await waitForTimeout(hold(980) + hold(140) * (finished.length - 1));
	}
};

export const expandEnd = async (e: BookEventOfType<'expandEnd'>, bookEvents: BookEvent[] = []) => {
	if (!stateBuild.active || !stateBuild.expanded) await recover(bookEvents);
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	const amount = finalRoundAmount(e, bookEvents);

	// authoritative per-board totals (book verification only — contract 7.7 shows ONE meter,
	// which every door prize already flew into during the doors). The meter is corrected to
	// the booked round total, never above what the capped round pays, and sealed with a beat.
	stateBuild.showRoundTotal = true;
	for (const b of e.boards) {
		const bs = stateBuild.boards[b.board];
		if (!bs) continue;
		bs.totalDisplay = b.total;
		bs.showTotal = false;
		bs.phase = 'done';
	}
	stateBuild.roundTotal = amount;
	stateBuild.phase = 'total';
	if (!fast(gen)) {
		await waitForTimeout(hold(360));
		await bounded(eventEmitter.broadcastAsync({ type: 'expandTotalSeal' }), 2000);
	}
	stateBuild.roundTotal = amount;
	if (!fast(gen)) await waitForTimeout(hold(520));

	await finishRound(gen, amount, finalRoundWinLevel(e, bookEvents), 'Round total');
};
