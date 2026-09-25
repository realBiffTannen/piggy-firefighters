/**
 * Hold & Build / Golden Build ROUND DIRECTOR.
 *
 * Sequences the booked bonus events into presentation: covered transition in,
 * house placement, per-spin hat drops / builds / upgrades / maxed sparkles, the
 * exactly-one +1-spin beat, the door reveal with a bounded stagger, jackpot
 * plaques, collection into a total, Grand Opening, the scaled total-win, and the
 * covered return to base. It NEVER invents an outcome — every tier, prize, extra
 * spin and total comes from the event.
 *
 * Director rules (task B1.5):
 *   - Every run captures the generation token; a stale run (teardown / route
 *     change / new round bumped `generation`) bails and applies final state once.
 *   - A skip / stop press sets `stateBuild.skip`; holds collapse and houses snap
 *     via setStatic, still applying the final booked state exactly once.
 *   - Turbo shortens holds and keeps event order (buildTiming).
 *   - Never wait forever on a house callback: every handle await is bounded, so
 *     a slow / missing rig recovers instead of hanging the round.
 *   - HUD win ownership + feature-spins are claimed/released idempotently, so a
 *     round can never double-award.
 */
import { waitForTimeout } from 'utils-shared/wait';
import { claimWin, releaseWin, setFeatureSpins } from '@crashgalaxy/hud';

import { eventEmitter } from '../eventEmitter';
import { INITIAL_BOARD, SYMBOL_SIZE } from '../constants';
import { stateGame } from '../stateGame.svelte';
import type {
	BookEvent,
	BookEventOfType,
	BonusKind,
	JackpotKind,
	BonusHat,
} from '../typesBookEvent';
import { audioDirector } from './audioDirector';
import { formatBookMultiple } from '../money';
import { roundCelebrationLevel } from '../roundTier';
import { getHouse, cellKey } from './houseRegistry';
import { BONUS_TIMING, hold, doorStagger } from './buildTiming';
import { stateBuild, stateBuildDerived, resetBuildState, makeBoard } from './stateBuild.svelte';
import { getCellReels, planSpin } from './cellReels';
import { finishAllTweens } from './motion';
import { stateScene, moodForBonus } from './stateScene.svelte';
import type { ShutterCard } from '../../components/scene/SceneShutter.svelte';
import { FEATURE, MODE_TITLE, TIER_NAME } from '../names';

const FEATURE_OWNER = 'buildFeature';
let featureClaimed = false;

export const claimFeature = () => {
	if (featureClaimed) return;
	claimWin(FEATURE_OWNER);
	featureClaimed = true;
};
export const releaseFeature = () => {
	if (!featureClaimed) return;
	releaseWin(FEATURE_OWNER);
	setFeatureSpins(null);
	featureClaimed = false;
};

/** True while this director run still owns the scene. */
export const alive = (gen: number) => gen === stateBuild.generation && stateBuild.active;
/** Fast path: skip pressed or run went stale — snap, do not animate/await. */
export const fast = (gen: number) => stateBuild.skip || !alive(gen);

/** Never wait forever on a house/effect callback. */
let beatFaults = 0;
/** A presentation beat is bounded in TIME and in FAILURE: a rejected beat (a display object
 *  destroyed under a tween, a missing texture) is logged and treated as finished, never
 *  re-thrown into the book-event chain — a thrown beat is what left an expanded round hanging
 *  with its spins on the sign (production, 2026-09-19). The book always plays on. */
export const bounded = <T>(p: Promise<T>, ms = 4000): Promise<T | void> =>
	Promise.race([
		p.catch((err: unknown) => {
			beatFaults += 1;
			if (beatFaults <= 5) console.error('[build] presentation beat failed; continuing the round', err);
		}),
		waitForTimeout(ms),
	]);

// ---- dismissible bonus cards (intro / outro) --------------------------------
// The mode-identity intro and the closing outro are PRESS-GATED cards, not
// auto-plates: BuildBonusCard.svelte holds `holdPressGate()` while a card is up,
// so the dismiss press (Space or pointer) can never fall through and place a bet.
// The director waits on the player's press OR a bounded auto-advance, whichever
// comes first, so a card can never hang the round (turbo / reduced-motion / skip
// all still complete).
let cardWaiter: (() => void) | null = null;
/** Resolve the card the director is currently waiting on (press / stop / teardown). */
export const dismissBuildCard = () => {
	cardWaiter?.();
};

/** Wait for the player's press on the card riding the shutter, or a bounded
 *  auto-advance, whichever comes first. */
const awaitCardPress = (autoMs: number) =>
	new Promise<void>((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			cardWaiter = null;
			clearTimeout(timer);
			resolve();
		};
		cardWaiter = finish;
		const timer = setTimeout(finish, autoMs);
	});

/**
 * THE covered scene change (base -> bonus, bonus -> base). The roller shutter
 * slams down carrying the mode card, `swap()` flips the scene BEHIND it, the
 * player presses (or the bounded auto-advance fires), and it rattles back up.
 * `swap()` runs exactly once on every path — normal, turbo, skip, stale run —
 * so the scene can never be left half-changed, and no path shows a bare or
 * black play area.
 */
export const coveredChange = async (gen: number, card: ShutterCard, autoMs: number, swap: () => void) => {
	if (gen !== stateBuild.generation) {
		// stale run (teardown / new round): change state silently, never animate
		swap();
		return;
	}
	await bounded(eventEmitter.broadcastAsync({ type: 'shutterClose', card }), 3000);
	swap();
	// the unattended floor stays brisk; a skip / stop press does not wait at all
	if (!fast(gen)) await awaitCardPress(autoMs);
	await bounded(eventEmitter.broadcastAsync({ type: 'shutterOpen' }), 3000);
};

/** Put the base reels back at rest on the boot board. The cascading reels "fall
 *  out" on spin start and only a `reveal` lands them again, which a bought round
 *  never sends; `settle` rewrites the symbols but leaves them where they fell. */
export const restIdleBoard = () => {
	eventEmitter.broadcast({ type: 'boardSettle', board: INITIAL_BOARD });
	for (const reel of stateGame.board) {
		for (const sym of reel.reelState.symbols) {
			void sym.symbolY.set((sym.symbolIndexOfBoard + 0.5) * SYMBOL_SIZE, { duration: 0 });
		}
	}
};

const setTier = (reel: number, row: number, tier: number, board = 0) => {
	const b = stateBuild.boards[board];
	if (b) b.tiers[cellKey(reel, row)] = tier;
};

/** The HUD carries ONE feature-spins figure: a single board's own count, or — in an
 *  expanded round — the most any board still has (the round lasts that long). */
const syncFeatureSpins = () => {
	let n = 0;
	for (const b of stateBuild.boards) if (b.status !== 'hidden') n = Math.max(n, b.bannerSpins);
	setFeatureSpins(n);
};

const setBanner = (board: number, n: number) => {
	const b = stateBuild.boards[board];
	if (!b) return;
	if (b.bannerSpins !== n) {
		b.bannerSpins = n;
		b.bannerTick += 1;
	}
	syncFeatureSpins();
};

/** Place a board's booked starting houses (70 ms ripple; static on the fast path). */
export const placeHouses = async (gen: number, houses: { reel: number; row: number; tier: number }[], board = 0) => {
	for (let i = 0; i < houses.length; i += 1) {
		const h = houses[i];
		setTier(h.reel, h.row, h.tier, board);
		const handle = getHouse(h.reel, h.row, board);
		if (fast(gen)) {
			handle?.setStatic(h.tier);
			continue;
		}
		// House build/door/prize/collect cues follow the picture: they fire from the
		// rig's own events inside HouseView (evt_build_impact / evt_door_latch /
		// evt_prize_visible / evt_collect_start), or from the sprite fallback's tween
		// milestones — once per event. The director keeps only the beats that have no
		// house-rig event: hat contact, the maxed pulse, +1 spin, intro/outro,
		// jackpot plaques, and the total.
		if (stateBuild.expanded) {
			// several boards fill at once: overlap the builds instead of queueing them
			void bounded(handle?.appear(h.tier) ?? Promise.resolve());
			await waitForTimeout(hold(85));
		} else {
			await bounded(handle?.appear(h.tier) ?? Promise.resolve());
			if (i < houses.length - 1) await waitForTimeout(hold(70));
		}
	}
};

const prizeToText = (prize: number, jackpot: JackpotKind): string => {
	if (jackpot) return jackpot.toUpperCase(); // MINOR / MAJOR / GRAND
	const mult = prize / 100;
	const rounded = Math.round(mult * 100) / 100;
	return `${rounded}×`;
};

// ---- events -----------------------------------------------------------------

export const buildStart = async (e: BookEventOfType<'buildStart'>) => {
	// A fresh round: invalidate any lingering run, reset, take a new token.
	stateBuild.generation += 1;
	const gen = stateBuild.generation;
	resetBuildState();

	stateBuild.active = true;
	stateBuild.bonus = e.bonus as BonusKind;
	stateBuild.source = e.source;
	stateBuild.premium = e.bonus === 'goldenBuild';
	stateBuild.spins = e.spins;
	stateBuild.boards = [makeBoard(0, e.spins)];
	stateBuild.phase = 'intro';

	stateScene.busy = true;

	claimFeature();
	setFeatureSpins(e.spins);
	audioDirector.bonusIntro(e.bonus as BonusKind);
	// The mascot cheers the feature entry, then braces as the shutter comes down.
	eventEmitter.broadcast({ type: 'mascotReact', react: 'celebrate' });
	// a natural trigger holds a little longer so the hats' celebration wave (6 x 70 ms + the burst's own
	// 200 ms lead-in) finishes before the shutter slams over it; a bought round has nothing to show here
	if (!fast(gen)) await waitForTimeout(hold(e.source === 'base' ? 900 : 520));
	eventEmitter.broadcast({ type: 'mascotReact', react: 'brace' });

	// ONE covered change for every entry (natural trigger, direct buy, Build or
	// Bust award): the mode card rides on the shutter, the build site and its hour
	// of day are swapped in behind it, and it lifts onto the finished set.
	const premium = stateBuild.premium;
	await coveredChange(
		gen,
		{
			kind: 'intro',
			premium,
			title: premium ? MODE_TITLE.golden_build : MODE_TITLE.hold_and_build,
			subtitle: premium
				? `Every new building starts at Tier 3 — a ${TIER_NAME[3]} or better`
				: `Lanterns build the street over ${e.spins} spins — every door holds a prize`,
			hint: 'Tap or press Space',
		},
		3400,
		() => {
			eventEmitter.broadcast({ type: 'boardHide' });
			eventEmitter.broadcast({ type: 'featureDropsClear' });
			stateScene.staged = true;
			stateScene.mood = moodForBonus(premium);
		},
	);
	eventEmitter.broadcast({ type: 'mascotReact', react: 'excited' });

	stateBuild.phase = 'spinning';

	// Place the booked starting houses (natural-trigger hats become Tier 1;
	// bought / Build-or-Bust place 6-9; Golden starts on booked Tier 3-5).
	await placeHouses(gen, e.houses, 0);
};

export type BoardSpin = { board: number; hats: BonusHat[]; extraSpin: boolean; spinsLeft: number };

/**
 * ONE bonus spin on one board, or one TICK of an expanded round on every board
 * that still has spins (contract 7.2: boards spin together, each resolves its own
 * hats, +1 SPIN and banner). The same code path plays both, so a single board and
 * an expanded board can never drift apart.
 *
 *   1. every board spends a spin on its banner
 *   2. CELL REELS: every empty plot spins a strip of the game's own symbols and
 *      stops — staggered left to right, top to bottom — on a hard hat where the
 *      book landed one, otherwise on a regular symbol that dims and eases away
 *   3. hats that upgrade a standing house arrive the way they always have
 *      (white square, 3D land); reel hats are taken over IN PLACE by the 3D hat
 *   4. +1 SPIN: the board's hats flip in sync, banner ticks on the peak frame
 *   5. each hat slams into its plot and the house builds / upgrades
 */
export const playSpins = async (gen: number, entries: BoardSpin[]) => {
	if (!entries.length) return;
	stateBuild.phase = 'spinning';
	const premium = stateBuild.premium;

	// 1. the banner counts THIS spin down first (booked: spinsLeft without the extra),
	//    and only ticks back up — on the flip's peak frame — if the book awards +1.
	let lastSpinCue = false;
	for (const e of entries) {
		const afterSpend = e.spinsLeft - (e.extraSpin ? 1 : 0);
		setBanner(e.board, afterSpend);
		if (afterSpend === 1 && !e.extraSpin) lastSpinCue = true;
	}
	if (lastSpinCue && !fast(gen)) audioDirector.lastSpin?.();

	if (!fast(gen)) await bounded(eventEmitter.broadcastAsync({ type: 'buildSpinPulse' }), 2000);

	// 2. the cell reels, all boards on one clock
	if (!fast(gen)) {
		const plans = entries.map((e) => ({
			e,
			plan: planSpin({ tiers: stateBuild.boards[e.board]?.tiers ?? {}, hats: e.hats.filter((h) => h.result === 'build'), premium }),
		}));
		const longest = plans.reduce((m, p) => Math.max(m, p.plan.total), 0);
		if (longest > 0) {
			audioDirector.reelSpinStart?.();
			const firstHat = entries.find((e) => e.hats.length)?.hats[0];
			if (firstHat) eventEmitter.broadcast({ type: 'mascotReact', react: 'look', at: (firstHat.reel + 0.5) / 5 });
			await bounded(Promise.all(plans.map(({ e, plan }) => getCellReels(e.board)?.spin(plan) ?? Promise.resolve())), longest + 1500);
			audioDirector.reelSpinStop?.();
		}
	}
	if (fast(gen)) for (const e of entries) getCellReels(e.board)?.clear();

	// 3-5. every board resolves its own hats; boards overlap with a short ripple so
	//      the eye gets a beat per board instead of one wall of slams
	await Promise.all(
		entries.map(async (e, i) => {
			if (!fast(gen) && i > 0) await waitForTimeout(hold(130) * i);
			await resolveBoardHats(gen, e);
		}),
	);

	if (!fast(gen)) await waitForTimeout(BONUS_TIMING.spinSettle());
};

const resolveBoardHats = async (gen: number, e: BoardSpin) => {
	const board = e.board;
	const bs = stateBuild.boards[board];
	if (!bs) return;
	const hats = e.hats;

	if (hats.length && !fast(gen)) {
		// white square on every HOUSE a hat is about to land on (reel hats already
		// announced themselves by stopping on their plot)
		const onHouses = hats.filter((h) => h.result !== 'build');
		if (onHouses.length) await bounded(eventEmitter.broadcastAsync({ type: 'buildHatTargets', cells: onHouses, board }), 1500);
		// the 3D hats: house hats land; reel hats are taken over in place
		await bounded(
			eventEmitter.broadcastAsync({
				type: 'buildHatsLand',
				board,
				hats: hats.map((h) => ({ reel: h.reel, row: h.row, golden: !!h.golden, fromReel: h.result === 'build' })),
			}),
			2500,
		);
		if (!fast(gen)) await waitForTimeout(hold(160));
	}

	// THE FLIP — every hat landed on THIS board tumbles in sync, EVERY time hats land, whatever
	// kind of hat it is (owner ruling 2026-09-19: QA saw the rotation only on some landings — it
	// used to play only when the book awarded +1). The +1 SPIN award is a separate matter: when
	// the book grants it, the banner ticks N -> N+1 on the manifest's PEAK FRAME of that same
	// flip; when it does not, the hats still flip and the banner stays.
	if (hats.length) {
		const award = () => {
			if (!e.extraSpin) return;
			audioDirector.extraSpin();
			stateBuild.extraSpinFlash = true;
			bs.bannerExtra += 1;
			setBanner(board, e.spinsLeft);
			eventEmitter.broadcast({ type: 'mascotReact', react: 'thumbs' });
		};
		if (fast(gen)) award();
		else {
			let awarded = false;
			await bounded(
				eventEmitter.broadcastAsync({
					type: 'buildHatsFlip',
					board,
					onPeak: () => {
						if (awarded) return;
						awarded = true;
						award();
					},
				}),
				4000,
			);
			if (!awarded) award(); // bounded recovery: the award is never lost
			if (!fast(gen)) await waitForTimeout(hold(140));
		}
		stateBuild.extraSpinFlash = false;
	}

	// each hat slams into its cell as the square trace starts, then builds
	if (stateBuild.expanded && !fast(gen)) {
		// several boards resolve at once: a board's hats OVERLAP (each starts as the last
		// one's dust goes up) so a tick stays a beat, not a queue. Order is unchanged.
		await Promise.all(
			hats.map(async (hat, i) => {
				if (i > 0) await waitForTimeout(hold(360) * i);
				await applyHat(gen, hat, board);
			}),
		);
		if (!fast(gen)) await waitForTimeout(BONUS_TIMING.betweenHats());
	} else {
		for (const hat of hats) {
			await applyHat(gen, hat, board);
			if (!fast(gen)) await waitForTimeout(BONUS_TIMING.betweenHats());
		}
	}
	eventEmitter.broadcast({ type: 'buildHatsClear', board });
	for (const hat of hats) getCellReels(board)?.release(hat.reel, hat.row);

	bs.spinsLeft = e.spinsLeft;
	setBanner(board, e.spinsLeft);
	const filled = stateBuildDerived.occupiedCount(board);
	if ((filled === 13 || filled === 14) && hats.length && !fast(gen)) audioDirector.nearFull?.();
};

export const buildSpin = async (e: BookEventOfType<'buildSpin'>) => {
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	stateBuild.spinIndex = e.spin;
	await playSpins(gen, [{ board: 0, hats: e.hats as BonusHat[], extraSpin: e.extraSpin, spinsLeft: e.spinsLeft }]);
};

const applyHat = async (gen: number, hat: BonusHat, board = 0) => {
	const handle = getHouse(hat.reel, hat.row, board);
	const before = stateBuild.boards[board]?.tiers[cellKey(hat.reel, hat.row)] ?? 0;

	if (!fast(gen)) {
		// slam + square trace START TOGETHER; the house work begins under the dust
		void eventEmitter.broadcastAsync({ type: 'buildHatSlam', reel: hat.reel, row: hat.row, board });
		await bounded(
			eventEmitter.broadcastAsync({ type: 'buildSquareTrace', reel: hat.reel, row: hat.row, tier: hat.tier, board }),
			2000,
		);
	}

	// `before < 1` on an upgrade only happens on a recovered (resumed) round whose
	// earlier events were not replayed: build the booked tier rather than upgrade nothing
	if (hat.result === 'build' || (hat.result === 'upgrade' && before < 1)) {
		setTier(hat.reel, hat.row, hat.tier, board);
		if (fast(gen)) return handle?.setStatic(hat.tier);
		eventEmitter.broadcast({ type: 'buildDust', reel: hat.reel, row: hat.row, board });
		await bounded(handle?.appear(hat.tier) ?? Promise.resolve());
		return;
	}

	if (hat.result === 'upgrade') {
		setTier(hat.reel, hat.row, hat.tier, board);
		if (fast(gen)) return handle?.setStatic(hat.tier);
		await bounded(handle?.upgradeTo(hat.tier) ?? Promise.resolve());
		return;
	}

	// maxed: Tier 5 hit again, short sparkle, no tier change.
	if (fast(gen)) return;
	audioDirector.houseMaxed();
	eventEmitter.broadcast({ type: 'buildSparkle', reel: hat.reel, row: hat.row, board });
	await bounded(handle?.maxed() ?? Promise.resolve());
};

/** The doors each board opened, kept for the street beat (a street doubles exactly these prizes). */
const lastDoors = new Map<number, BookEventOfType<'doorReveal'>['doors']>();

export const doorReveal = async (e: BookEventOfType<'doorReveal'>) => {
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	const board = e.board ?? 0;
	const bs = stateBuild.boards[board];
	if (!bs) return;
	lastDoors.set(board, e.doors);
	stateBuild.phase = 'doors';
	bs.phase = 'doors';
	bs.totalDisplay = 0;
	// expanded: the shared round meter comes up with the first board's doors
	if (stateBuild.expanded) stateBuild.showRoundTotal = true;

	// an expanded round opens up to four boards of doors: keep each sweep tighter
	const tight = stateBuild.expanded ? 0.7 : 1;
	const stagger = Math.round(doorStagger(e.doors.length) * tight);
	let running = 0;

	// Open doors in booked order with a bounded stagger; each prize appears only
	// after its door has cleared it; jackpots get a plaque; collect tallies total.
	const openOne = async (index: number) => {
		const door = e.doors[index];
		if (!fast(gen) && stagger) await waitForTimeout(stagger * index);
		// the book is the authority on the final tier (also heals a recovered round)
		setTier(door.reel, door.row, door.tier, board);
		const handle = getHouse(door.reel, door.row, board);
		const text = prizeToText(door.prize, door.jackpot);
		if (fast(gen)) {
			handle?.setStatic(door.tier);
		} else {
			// evt_door_latch / evt_prize_visible inside HouseView fire the latch +
			// prize cues; the jackpot plaque treatment stays a director beat.
			await bounded(handle?.openDoor(text, door.jackpot) ?? Promise.resolve());
			audioDirector.doorChime?.(Math.round((index / Math.max(1, e.doors.length - 1)) * 7));
			if (door.jackpot) {
				audioDirector.jackpot(door.jackpot);
				eventEmitter.broadcast({ type: 'mascotReact', react: door.jackpot === 'grand' ? 'mega' : 'big' });
			}
		}
	};

	// Kick off the staggered opens, then await them all (bounded overall).
	await bounded(Promise.all(e.doors.map((_, i) => openOne(i))), 6000);

	// The money total appears only now, as the first prize leaves for it.
	bs.showTotal = true;
	if (!fast(gen)) await waitForTimeout(hold(260));

	// Collect each prize into the running total (in reading order for legibility).
	for (let i = 0; i < e.doors.length; i += 1) {
		const door = e.doors[i];
		running += door.prize;
		if (!fast(gen)) {
			// The coin-trail beat drives HouseView's collect clip (evt_collect_start
			// fires the collect cue there); no fixed-timer collect cue here.
			eventEmitter.broadcast({ type: 'buildCoinTrail', reel: door.reel, row: door.row, board });
		}
		if (fast(gen)) bs.totalDisplay = running;
		else {
			// the figure ticks when the coins ARRIVE at the sign, not when they leave
			const arrived = running;
			setTimeout(() => {
				if (alive(gen) && bs.totalDisplay < arrived) bs.totalDisplay = arrived;
			}, hold(430));
			await waitForTimeout(Math.min(BONUS_TIMING.collectHold(), stagger || 60));
		}
	}
	if (!fast(gen)) await waitForTimeout(hold(480));

	// Authoritative board total from the book.
	bs.totalDisplay = e.boardTotal;
	bs.phase = 'done';
	if (stateBuild.expanded && !fast(gen)) await waitForTimeout(hold(320));
};

/** v2.3: completed rows ("streets") pay x2. Minimal, honest presentation — the
 *  rows light up and the total moves to the booked post-street figure. In an
 *  expanded round the event carries `board` and plays on the board it belongs to. */
export const streetBonus = async (e: BookEventOfType<'streetBonus'>) => {
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	const board = e.board ?? 0;
	const bs = stateBuild.boards[board];
	if (!bs) return;
	const doors = lastDoors.get(board) ?? [];
	const streets = e.streets ?? [];
	// THE MULTIPLIER MOMENT (owner, 2026-09-19: "a lot more clear when a multiplier is applied for a
	// full street"). Per street, in order: the row lights and the words come up (BuildBoard's
	// FULL STREET xN callout), the row's five prizes re-read as the multiplied figures one after
	// another with a punch (contract §4 5a: every door in the row pays xN, jackpots included), and
	// once every street has spoken the board total moves to the booked post-street figure with a
	// xN badge slamming onto the total. Every figure shown is the book's: prize x multiplier.
	for (const st of streets) {
		if (fast(gen)) break;
		audioDirector.streetBonus?.(st.multiplier);
		eventEmitter.broadcast({ type: 'mascotReact', react: 'big' });
		const callout = bounded(eventEmitter.broadcastAsync({ type: 'buildStreet', row: st.row, multiplier: st.multiplier, board }), 3000);
		// the words read for ~1 s on their own; the figures re-read once the plaque has left the row
		await waitForTimeout(hold(980));
		const rowDoors = doors.filter((d) => d.row === st.row).sort((a, b) => a.reel - b.reel);
		for (const d of rowDoors) {
			if (fast(gen)) break;
			void getHouse(d.reel, d.row, board)?.bumpPrize?.(prizeToText(d.prize * st.multiplier, d.jackpot));
			await waitForTimeout(hold(90));
		}
		await callout;
	}
	bs.totalDisplay = e.boardTotal;
	if (!fast(gen) && streets.length) {
		await bounded(
			eventEmitter.broadcastAsync({ type: 'buildStreetBadge', multiplier: streets[streets.length - 1].multiplier, board }),
			2000,
		);
	}
	if (!fast(gen)) await waitForTimeout(hold(300));
};

/** v2.3 base-game events whose presentation is a later task: accepted so a book
 *  that carries them plays through without a hitch. */
export const gust = async (_e: unknown) => {};
export const hatDelivery = async (_e: unknown) => {};

export const grandOpening = async (e: BookEventOfType<'grandOpening'>) => {
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	const board = e.board ?? 0;
	const bs = stateBuild.boards[board];
	if (!bs) return;
	if (!stateBuild.expanded) stateBuild.phase = 'grandOpening';
	bs.phase = 'grandOpening';
	stateBuild.grandMultiplier = e.multiplier;
	// the GRAND FESTIVAL has its own cue (was: the generic total stinger at whatever level the round held)
	audioDirector.grandFestival?.();
	eventEmitter.broadcast({ type: 'mascotReact', react: 'celebrate' });
	if (!fast(gen)) {
		await bounded(
			eventEmitter.broadcastAsync({ type: 'buildGrandOpening', multiplier: e.multiplier, board }),
			5000,
		);
	}
	bs.totalDisplay = e.amount;
	if (!fast(gen)) await waitForTimeout(BONUS_TIMING.grandOpeningHold());
	bs.phase = 'done';
};

/** End-feature events carry the feature share; the later book total also includes any entry win.
 * Resume retains that tail of the book. Isolated presentation calls without it keep their own amount. */
export const finalRoundAmount = (e: { index: number; amount: number }, bookEvents: BookEvent[]) => {
	for (let i = bookEvents.length - 1; i >= 0; i -= 1) {
		const event = bookEvents[i];
		if (event.index > e.index && (event.type === 'finalWin' || event.type === 'setTotalWin')) return event.amount;
	}
	return e.amount;
};

/** The celebration rung follows the ROUND, like the plate (OWNER RULING 2026-09-24). The math's booked round
 * `winLevel` when a book carries one; otherwise the rung derived from the booked round total with the math's own
 * endFeature table (game/roundTier.ts END_FEATURE_FLOORS, the only table that decides the celebrated LEVEL;
 * components/WinRungs.svelte keeps its own endFeature floors that only pace the count-up label and never pick
 * the level), used only where it differs from the feature-share level. MAX stays the wincap only. setWin is not
 * read: its winLevel is on the `standard` scale.
 * The amount is only compared, never changed: the plate keeps finalRoundAmount. `bookEvents` is the whole
 * book on a live round and the retained tail (from buildStart / expandStart) on a resume, so the round-total
 * events after the feature end are in view on both paths. */
export const finalRoundWinLevel = (e: { index: number; amount: number; winLevel: number }, bookEvents: BookEvent[]) =>
	roundCelebrationLevel(e, bookEvents, finalRoundAmount(e, bookEvents), stateBuild.capped).level;

export const buildEnd = async (e: BookEventOfType<'buildEnd'>, bookEvents: BookEvent[] = []) => {
	const gen = stateBuild.generation;
	if (!alive(gen)) return;
	const bs = stateBuild.boards[0];
	if (bs) bs.totalDisplay = e.amount;
	await finishRound(gen, finalRoundAmount(e, bookEvents), finalRoundWinLevel(e, bookEvents), 'Round total');
};

/**
 * The end of EVERY bonus round, single-board or expanded: the scaled total
 * (win rungs from BIG WIN up, the scene's own plaque below), then the covered
 * return to the base board and the release of the HUD win ownership.
 */
export const finishRound = async (gen: number, amount: number, winLevel: number, subtitle: string) => {
	stateBuild.phase = 'total';
	stateBuild.winLevel = winLevel;
	stateBuild.roundTotal = amount;

	// BIG WIN and above are scored by the win rungs' own climbing cues
	if (winLevel < 6) audioDirector.total(winLevel);
	const rung = (['celebrate', 'celebrate', 'celebrate', 'celebrate', 'thumbs', 'thumbs', 'big', 'super', 'mega', 'epic', 'max'] as const)[
		Math.max(0, Math.min(10, Math.round(winLevel)))
	];
	if (amount > 0) eventEmitter.broadcast({ type: 'mascotReact', react: rung });
	if (!fast(gen)) {
		if (winLevel >= 6) {
			// BIG WIN or better: the win rungs ARE the total presentation (docs/WIN_RUNGS_SPEC.md) — the
			// climbing site sign over the finished street, in the player's currency, ending on the max win
			// card at the cap. The scene's own total plaque is for smaller totals only, so the two never
			// compete. `winLevel` is on the math's endFeature scale, for the ROUND total (finalRoundWinLevel / roundTier.ts).
			await bounded(
				eventEmitter.broadcastAsync({ type: 'winRungs', amount, level: winLevel, scale: 'endFeature' }),
				30000,
			);
		} else {
			await bounded(
				eventEmitter.broadcastAsync({
					type: 'buildTotalPresent',
					amount,
					winLevel,
					capped: stateBuild.capped,
				}),
				10000,
			);
			await waitForTimeout(BONUS_TIMING.totalHold());
		}
	}
	// Covered return to the base board: the closing card (with the booked total)
	// rides the shutter down, the base board and daylight come back behind it.
	stateBuild.phase = 'outro';
	audioDirector.bonusOutro();
	await coveredChange(
		gen,
		{
			kind: 'outro',
			premium: stateBuild.premium,
			title: 'FEATURE COMPLETE',
			subtitle,
			// the multiple, never a currency figure: this is a framed card (see money.formatBookMultiple)
			value: formatBookMultiple(amount),
			hint: 'Tap or press Space',
		},
		4000,
		() => {
			eventEmitter.broadcast({ type: 'buildTotalHide' });
			eventEmitter.broadcast({ type: 'buildHatsClear' });
			for (let i = 0; i < stateBuild.boards.length; i += 1) getCellReels(i)?.clear();
			stateScene.staged = false;
			stateScene.mood = 'day';
			// A bought / Build-or-Bust round carries no `reveal`, so the reels spun out
			// and never landed: come back to the same idle board the game boots on
			// (decorative, not an outcome) instead of an empty frame.
			if (stateBuild.source !== 'base') restIdleBoard();
			eventEmitter.broadcast({ type: 'boardShow' });
		},
	);
	eventEmitter.broadcast({ type: 'mascotReact', react: 'calm' });

	releaseFeature();
	stateBuild.active = false;
	stateBuild.phase = 'idle';
	stateScene.busy = false;
};

export const buildOrBust = async (e: BookEventOfType<'buildOrBust'>) => {
	// Original anticipation → reveal, driven by the BOOKED outcome. The
	// anticipation is IDENTICAL for every outcome (no fake near-miss); only the
	// resolution differs.
	eventEmitter.broadcast({ type: 'buildOrBustOutcome', outcome: e.outcome });
	await bounded(
		eventEmitter.broadcastAsync({ type: 'buildOrBustAnticipate', outcome: e.outcome }),
		5000,
	);
	if (e.outcome === 'bust') {
		// A brief, neutral wooden settle and an honest "no feature this time"
		// result — no fanfare. The book then falls straight to setTotalWin 0 /
		// finalWin. goldenBuild / holdAndBuild instead hand off to the buildStart
		// that follows, through the SAME intro path as a direct buy.
		//
		// A bust book carries no `reveal` and nothing covers the base reels, which were
		// streaming since the bet started: with no board to land on they brake back onto
		// the board they left (`settle` with no board — nothing is invented), under the
		// card, so the round can end with the reels at rest.
		eventEmitter.broadcast({ type: 'boardSettle', board: [] });
		await bounded(eventEmitter.broadcastAsync({ type: 'buildOrBustBust' }), 4000);
	} else if (e.outcome === 'expandedHoldAndBuild' || e.outcome === 'goldenExpanded') {
		// v2.4: the two EXPANDED awards resolve on the card itself (the sign opens
		// up), then hand to the expandStart that follows — the same entry as a buy.
		await bounded(eventEmitter.broadcastAsync({ type: 'buildOrBustExpand', golden: e.outcome === 'goldenExpanded' }), 5000);
	}
};

export const wincap = () => {
	stateBuild.capped = true;
};

/** Called on route teardown / new-game start to guarantee the feature releases
 *  its HUD win ownership even if a round was interrupted mid-presentation. */
export const teardownBuild = () => {
	stateBuild.generation += 1;
	stateBuild.skip = true;
	stateBuild.active = false;
	stateBuild.phase = 'idle';
	dismissBuildCard(); // never leave a press-gated card (and its gate) hanging
	finishAllTweens(); // reveal / reel motion lands on its final values, exactly once
	for (let i = 0; i < stateBuild.boards.length; i += 1) getCellReels(i)?.clear();
	releaseFeature();
	// never leave a round covered, on the wrong board, or at the wrong hour
	if (stateScene.staged || stateScene.covered || stateScene.mood !== 'day') {
		eventEmitter.broadcast({ type: 'shutterReset' });
		eventEmitter.broadcast({ type: 'buildHatsClear' });
		stateScene.staged = false;
		stateScene.mood = 'day';
		eventEmitter.broadcast({ type: 'boardShow' });
	}
	stateScene.busy = false;
	if (stateBuildDerived.occupiedAll() === 0) resetBuildState();
};
