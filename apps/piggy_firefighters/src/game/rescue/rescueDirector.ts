/**
 * RESCUE DIRECTOR — the feature flow of PIGGY FIREFIGHTERS, driven strictly by the book (docs/GAME_CONTRACT.md §4-§8).
 *
 *   natural   reveal -> winInfo/setWin -> setTotalWin -> freeSpinTrigger -> rescueStart -> [per spin: updateFreeSpin?,
 *             reveal -> douse -> (buildingCleared) -> winInfo/setWin -> setTotalWin] -> rescueEnd -> freeSpinEnd -> finalWin
 *   buy       rescueStart -> [spins] -> rescueEnd -> freeSpinEnd -> finalWin
 *   Alarm     alarmCall {outcome} -> (rescueStart ... as bought) | (setTotalWin 0 -> finalWin 0)
 *   Backdraft backdraftSpinsStart -> [reveal -> backdraft -> winInfo/setWin -> updateFreeSpin -> setTotalWin] x5
 *   Spins     -> backdraftSpinsEnd -> finalWin
 *
 * This module is the SINGLE WRITER of game/rescue/stateRescue.svelte.ts and of stateScene.mood. It never invents an
 * outcome: every room level, rescue, prize, multiplier and spin count it shows is the book's. Speed only shortens
 * holds (turbo, stop/skip), never the order. Every "press to continue" card holds the HUD press gate (SceneShutter /
 * AlarmCallCard) and continues by itself after a bounded wait, so an unattended round can never hang.
 *
 * Presentation lives in components/rescue/*, components/scene/SceneShutter.svelte and components/AlarmCallCard.svelte
 * (the art lane's delivered pictures, the rig slots and beats of docs/ANIMATION_CONTRACT.md); none of it touches this flow.
 */
import { claimWin, releaseWin, setFeatureSpins } from '@crashgalaxy/hud';
import { stateBet } from 'state-shared';

import { eventEmitter } from '../eventEmitter';
import { stateGame, stateGameDerived } from '../stateGame.svelte';
import { stateXstateDerived } from '../stateXstate';
import { hold } from '../fx/timing';
import { audioDirector } from '../fx/audioDirector';
import { stateScene, moodForBonus } from '../fx/stateScene.svelte';
import { formatBookAmount, formatBookMultiple } from '../money';
import { MODE_TITLE, MECHANIC, FEATURE } from '../names';
import { CONTRACT } from '../rulesContent';
import { rungLevelOfTier, MAX_WIN_LEVEL, WIN_CAP_BOOKED, type WinTier } from '../roundTier';
import { roundStakeOf } from '../roundStake';
import { gameSound } from '../audio';
import { animBeats } from '../fx/animBeats';
import { rescuedSkin } from '../anim/rigLogic';
import { ensureFeatureAssets } from '../lazyAssets';
import type { BookEvent, BookEventOfType, Cell } from '../typesBookEvent';
import type { Position } from '../types';
import type { EmitterEventShutter } from '../../components/scene/SceneShutter.svelte';
import { stateRescue, stateBackdraftSpins, stateAlarmCall, resetRescueState } from './stateRescue.svelte';
import { rescueBannerText, runningTotal } from './rescuePhone';

type Ev<T extends BookEvent['type']> = BookEventOfType<T>;

// ---- timing ----------------------------------------------------------------------------------------------------------
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
/** A director beat: turbo / reduced motion via hold(), stop/skip collapses it further. */
const beat = (ms: number) => sleep(hold(ms) * (stateRescue.skip ? 0.25 : 1));
/** Autoplay / turbo rounds never wait long on a card. */
const cardWaitMs = () => (stateXstateDerived.isAutoBetting() || stateBet.isTurbo ? 1400 : 6000);
/** Feature art and rigs arrive lazily (game/lazyAssets.ts, usually warmed long before a feature books). A director
 *  waits on them at most this long: a stalled network degrades the picture to its fallbacks, never hangs the round. */
const ASSET_BOUND_MS = 20000;
const assetsReady = (kind: Parameters<typeof ensureFeatureAssets>[0]) => Promise.race([ensureFeatureAssets(kind), sleep(ASSET_BOUND_MS)]);

// ---- cards (shown on the shutter, dismissed by a press or by time) ---------------------------------------------------
let cardResolve: (() => void) | null = null;
/** A card is on its way (the door is closing with it): a press that arrives before waitForCard() is latched, never lost. */
let cardExpected = false;
let pendingDismiss = false;
/** Press on a live card (SceneShutter / Space). */
export const dismissFeatureCard = () => {
	const done = cardResolve;
	cardResolve = null;
	if (!done) {
		if (cardExpected) pendingDismiss = true;
		return;
	}
	done();
};
const waitForCard = () =>
	new Promise<void>((resolve) => {
		const finish = () => {
			cardExpected = false;
			pendingDismiss = false;
			resolve();
		};
		if (pendingDismiss) return finish();
		cardResolve = finish;
		setTimeout(() => {
			if (cardResolve === finish) dismissFeatureCard();
		}, cardWaitMs());
	});

// ---- the bay door (bounded) --------------------------------------------------------------------------------------
/** Longest a director waits on the door. The door runs on clamped frame time, so on a 1-3 fps device a full lift takes
 *  well over 10 s of wall time; past this bound the round moves on and the door is told to get out of the way. An
 *  unattended round can never hang on a presentation. */
const SHUTTER_BOUND_MS = 45000;
const shutter = async (event: EmitterEventShutter) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const bounded = new Promise<'timeout'>((resolve) => (timer = setTimeout(() => resolve('timeout'), SHUTTER_BOUND_MS)));
	const done = eventEmitter.broadcastAsync(event).then(() => 'done' as const);
	const result = await Promise.race([done, bounded]);
	clearTimeout(timer);
	if (result === 'timeout') {
		console.warn(`rescueDirector: ${event.type} did not settle in ${SHUTTER_BOUND_MS} ms; resetting the door`);
		eventEmitter.broadcast({ type: 'shutterReset' });
	}
};

/** Stop / skip pressed during a feature: collapse the remaining holds (event order unchanged); rig beats still
 *  pending from the collapsed holds are dropped (their epoch moves on). */
export const skipFeature = () => {
	if (stateRescue.active || stateBackdraftSpins.active) stateRescue.skip = true;
	animBeats.newEpoch();
	dismissFeatureCard();
};

// ---- helpers ---------------------------------------------------------------------------------------------------------
const showBanner = (text: string) => {
	stateRescue.banner = text;
	stateRescue.bannerSeq += 1;
};

const spinsWord = (n: number) => `${n} ${n === 1 ? 'SPIN' : 'SPINS'}`;

/** Contract §8: the round's celebration, once, on its total. Emits the rig beat (animBeat winTier, ANIMATION_CONTRACT)
 *  and climbs the win rungs from tier 2 (BIG 15x … MAX = the cap); tier 0 (W <= S) and 1 climb nothing. */
const celebrateRound = async (tier: WinTier, total: number, costX: number) => {
	animBeats.emit({ beat: 'winTier', tier, amount: total / 100, x: total / 100 });
	if (tier >= 6) animBeats.emit({ beat: 'maxWin', amount: total / 100 });
	const level = rungLevelOfTier(tier);
	// the sign paces its climb on the floors of THIS round's cost (contract §8 v1.3.1)
	if (level) await eventEmitter.broadcastAsync({ type: 'winRungs', amount: total, level, tier, costX });
};

/** The book's rescueEnd figures for the outro card (never the client's own counters). */
let endStats: { rescued: number; buildings: number; multiplier: number } | null = null;

const animateSymbols = async (positions: Position[]) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({ type: 'boardWithAnimateSymbols', symbolPositions: positions });
};

/** Reels still streaming with no reveal (a bought round's preSpin) stop quietly on the board they left. */
const parkReels = () => {
	try {
		stateGameDerived.enhancedBoard.park();
	} catch {
		/* nothing travelling */
	}
};

// ---- Backdraft (base / ante / Backdraft Spins) -----------------------------------------------------------------------
/** Turn one visible cell into a Blaze Wild. Idempotent. Rows are 0-based visible rows (contract §8). */
export const igniteCell = (cell: Cell) => {
	const reel = stateGame.board[cell.reel];
	const symbol = reel?.reelState.symbols[cell.row + 1];
	if (!symbol || symbol.rawSymbol.blaze) return;
	symbol.rawSymbol = cell.mult ? { name: 'W', wild: true, blaze: true, blazeMult: cell.mult } : { name: 'W', wild: true, blaze: true };
};

export const backdraft = async (e: Ev<'backdraft'>) => {
	stateScene.busy = true;
	audioDirector.backdraft();
	animBeats.emit({ beat: 'backdraft', cells: e.cells.map((c) => ({ reel: c.reel, row: c.row })) });
	try {
		// the flame sweep + per-cell ignition (components/BackdraftFx.svelte calls igniteCell on each cell's beat)
		await eventEmitter.broadcastAsync({ type: 'backdraftFx', cells: e.cells });
	} finally {
		// whatever the picture did, the evaluated board is the book's: every ignited cell IS a W now
		e.cells.forEach(igniteCell);
		stateScene.busy = false;
	}
	await beat(220);
};

// ---- natural trigger ------------------------------------------------------------------------------------------------
export const freeSpinTrigger = async (e: Ev<'freeSpinTrigger'>) => {
	// the alarms that won the feature ring in a left-to-right wave (positions are PADDED rows, like winInfo)
	const cells = [...e.positions].sort((a, b) => a.reel - b.reel || a.row - b.row);
	cells.forEach((pos, i) => {
		setTimeout(() => {
			try {
				const name = stateGame.board[pos.reel]?.reelState.symbols[pos.row]?.rawSymbol.name ?? 'ALARM';
				eventEmitter.broadcast({ type: 'symbolWinFx', symbol: name, positions: [pos] });
			} catch {
				/* presentation only */
			}
		}, i * 90);
	});
	// once per round: already played at the landing of the 3rd alarm, unless this is a resumed round replaying its trigger
	gameSound.triggerFanfare();
	await animateSymbols(cells);
	await beat(350);
};

// ---- Rescue Spins / Inferno Rescue -----------------------------------------------------------------------------------
export const rescueStart = async (e: Ev<'rescueStart'>) => {
	const inferno = e.bonus === 'inferno';
	if (e.source !== 'natural') parkReels();
	const intro = {
		kind: 'intro' as const,
		premium: inferno,
		title: MODE_TITLE[inferno ? 'inferno' : 'rescue'],
		subtitle: inferno
			? `${spinsWord(e.spins)} · rooms fall in one spray · every rescue +2x, +1 spin and a prize`
			: `${spinsWord(e.spins)} · five rooms · every rescue +1x and +1 spin`,
		hint: 'TAP OR PRESS SPACE',
	};
	cardExpected = true;
	pendingDismiss = false;
	endStats = null;
	// the intro card's painting and its presenter (pf_rookie) ride on the door: resident before it drops
	await assetsReady('alarm');
	await shutter({ type: 'shutterClose', card: intro });
	// ---- under cover: the block rolls in -----------------------------------------------------------------------------
	// the Rescue block, the Trotters' rig (pf_rescued) and this orientation's rescue / inferno plate, uploaded while the
	// door is shut, so the reveal draws nothing that is not already on the GPU
	await assetsReady('rescue');
	stateRescue.bonus = e.bonus;
	stateRescue.source = e.source;
	stateRescue.rooms = e.rooms.map((room) => ({ reel: room.reel, fire: room.fire, start: room.fire, rescued: room.fire <= 0, sprayed: 0 }));
	stateRescue.multiplier = e.multiplier;
	stateRescue.building = 1;
	stateRescue.lastRescue = 2;
	stateRescue.rescued = 0;
	stateRescue.spinsLeft = e.spins;
	stateRescue.total = stateBet.winBookEventAmount ?? 0;
	stateRescue.capped = false;
	stateRescue.skip = false;
	stateRescue.banner = '';
	stateRescue.active = true;
	stateScene.mood = moodForBonus(inferno);
	stateGame.gameType = 'freegame';
	claimWin('rescue');
	setFeatureSpins(e.spins);
	audioDirector.bonusIntro(e.bonus);
	eventEmitter.broadcast({ type: 'boardShow' });
	// the rigs enter the scene with it (the Trotters take their windows under cover)
	animBeats.emit({ beat: 'rescueEnter', bonus: e.bonus, source: e.source, spins: e.spins, rooms: e.rooms.map((r) => ({ reel: r.reel, fire: r.fire })) });
	await waitForCard();
	await shutter({ type: 'shutterOpen' });
	await beat(300);
};

/** The rig skin of the Trotter in room `reel` of the CURRENT building (contract: room r of building b shows skin
 *  [(r + b) mod 5], b 0-based; stateRescue.building is 1-based). */
const skinOf = (reel: number) => rescuedSkin(reel, Math.max(0, stateRescue.building - 1));

export const douse = async (e: Ev<'douse'>) => {
	if (!stateRescue.active) return;
	stateScene.busy = true;
	const epoch = animBeats.epoch();
	animBeats.emit({
		beat: 'douse',
		sprays: e.sprays.map((s) => ({ reel: s.reel, from: s.from, to: s.to })),
		rescues: e.rescues.map((r) => ({ reel: r.reel, skin: skinOf(r.reel), ...(r.prize ? { prize: r.prize / 100 } : {}) })),
		multiplier: e.multiplier,
		spinsAdded: e.spinsAdded,
	});
	for (const spray of e.sprays) {
		const room = stateRescue.rooms.find((r) => r.reel === spray.reel);
		if (!room) continue;
		room.sprayed += 1;
		room.fire = Math.max(0, spray.to);
		// the scene draws the jet on this state change and cues hose_start / hose_loop / hose_end / steam with it
		await beat(260);
	}
	for (const rescue of e.rescues) {
		const room = stateRescue.rooms.find((r) => r.reel === rescue.reel);
		if (room) {
			room.fire = 0;
			room.rescued = true;
			if (rescue.prize) room.prize = rescue.prize;
		}
		// the room this beat is about, published BEFORE the beat: the phone drop's path is derived from it, and the rig
		// runtime snapshots that path synchronously when the beat arrives (a queued second rescue keeps its own window)
		stateRescue.lastRescue = rescue.reel;
		stateRescue.rescued += 1;
		// a phone's rail TOTAL takes the prize in with its plaque (the spin's setTotalWin then states the book's figure,
		// which includes it); wide layouts keep TOTAL on setTotalWin alone
		const stacked = stateGameDerived.sceneLayout().stacked;
		if (stacked) stateRescue.total = runningTotal(stateRescue.total, rescue.prize, WIN_CAP_BOOKED);
		// the badge climbs WITH the rescue it pays for (never past the book's figure for this douse, assigned below)
		const step = stateRescue.bonus === 'inferno' ? CONTRACT.infernoStep : CONTRACT.rescueStep;
		stateRescue.multiplier = Math.min(e.multiplier, stateRescue.multiplier + step);
		// one beat per rescued room, as the room is marked (a skipped round's later rescues are dropped by the epoch)
		animBeats.emit({ beat: 'rescue', reel: rescue.reel, skin: skinOf(rescue.reel), ...(rescue.prize ? { prize: rescue.prize / 100 } : {}), multiplier: e.multiplier }, epoch);
		// a phone says the prize once, on the plaque under the rescued room's sill (rescuePhone.rescueBannerText)
		showBanner(rescueBannerText(rescue.prize ? formatBookAmount(rescue.prize) : null, stacked));
		if (rescue.prize) audioDirector.prize();
		audioDirector.rescue(e.multiplier);
		await beat(420);
	}
	if (e.multiplier !== stateRescue.multiplier) {
		stateRescue.multiplier = e.multiplier;
		await beat(240);
	}
	if (e.spinsAdded > 0) {
		showBanner(`+${spinsWord(e.spinsAdded)}`);
		audioDirector.extraSpin();
		await beat(360);
	}
	stateRescue.spinsLeft = e.spinsLeft;
	setFeatureSpins(e.spinsLeft);
	if (e.spinsLeft === 0) audioDirector.lastSpin();
	stateScene.busy = false;
};

export const buildingCleared = async (e: Ev<'buildingCleared'>) => {
	if (!stateRescue.active) return;
	showBanner(`${MECHANIC.buildingCleared.toUpperCase()} · +${spinsWord(e.spinsAdded)}`);
	audioDirector.buildingCleared();
	// the beat WITH the banner: the crew celebrates in step with it, the rig runtime drops any ladder slide still queued
	// from this douse, and the Trotters re-skin for the next building (rigLogic; `building` is the 1-based ordinal just
	// cleared). The rigs re-show the Trotters at once, so the scene keeps the SAVED windows empty until the rooms reset
	// below (RescueScene clearedRooms). No epoch: a skip must not drop it, or the new building would open empty.
	animBeats.emit({ beat: 'buildingCleared', building: e.building, spinsAdded: e.spinsAdded });
	await beat(900);
	// the feature was torn down during the hold: nothing of it may re-appear
	if (!stateRescue.active) return;
	stateRescue.building = e.building + 1;
	// a NEW rooms array: the scene's saved-window hold ends with it and the re-skinned Trotters appear in the burning rooms
	stateRescue.rooms = stateRescue.rooms.map((room) => ({ ...room, fire: room.start, rescued: false, prize: undefined }));
	stateRescue.spinsLeft = e.spinsLeft;
	setFeatureSpins(e.spinsLeft);
	await beat(300);
};

/** `amount` = the spin being played (1-based), `total` = spins the bonus has so far: the counter shows what is left. */
export const updateFreeSpin = (e: Ev<'updateFreeSpin'>) => {
	const left = Math.max(0, e.total - e.amount);
	if (stateBackdraftSpins.active) {
		stateBackdraftSpins.spinsLeft = left;
		setFeatureSpins(left);
		return;
	}
	if (stateRescue.active) {
		stateRescue.spinsLeft = left;
		setFeatureSpins(left);
	}
};

/** The running round total inside a feature (the HUD's WIN readout is claimed by the scene). */
export const setFeatureTotal = (amount: number) => {
	if (stateRescue.active) stateRescue.total = amount;
	if (stateBackdraftSpins.active) stateBackdraftSpins.total = amount;
};

export const rescueEnd = async (e: Ev<'rescueEnd'>) => {
	if (!stateRescue.active) return;
	stateRescue.multiplier = e.multiplier;
	endStats = { rescued: e.rescued, buildings: e.buildings, multiplier: e.multiplier };
	// the bonus is over: no spins are left to show, whatever the counter held (a capped end leaves spins unplayed)
	stateRescue.spinsLeft = 0;
	setFeatureSpins(0);
	showBanner(`${FEATURE[stateRescue.bonus === 'inferno' ? 'inferno' : 'rescue'].toUpperCase()} COMPLETE`);
	await beat(700);
};

export const freeSpinEnd = async (_e: Ev<'freeSpinEnd'>, bookEvents: BookEvent[]) => {
	const round = roundStakeOf(bookEvents, stateRescue.capped);
	const total = round.total;
	stateRescue.skip = false;
	await celebrateRound(round.tier, total, round.cost);
	audioDirector.total(round.tier, stateRescue.bonus);
	const inferno = stateRescue.bonus === 'inferno';
	// the book's rescueEnd figures: `buildings` is the number CLEARED (contract §8), never the client's next-building ordinal
	const stats = endStats ?? { rescued: stateRescue.rescued, buildings: Math.max(0, stateRescue.building - 1), multiplier: stateRescue.multiplier };
	cardExpected = true;
	pendingDismiss = false;
	await shutter({
		type: 'shutterClose',
		card: {
			kind: 'outro',
			premium: inferno,
			title: `${MODE_TITLE[inferno ? 'inferno' : 'rescue']} COMPLETE`,
			subtitle: `${stats.rescued} rescued · ${stats.buildings} ${stats.buildings === 1 ? 'building' : 'buildings'} cleared · x${stats.multiplier}`,
			// framed cards show the MULTIPLE, never a currency figure (money.ts formatBookMultiple)
			value: formatBookMultiple(total),
			hint: 'TAP OR PRESS SPACE',
		},
	});
	await waitForCard();
	// ---- under cover: back to Station 13 ----------------------------------------------------------------------------
	leaveRescue();
	await shutter({ type: 'shutterOpen' });
};

const leaveRescue = () => {
	const stats = endStats ?? { rescued: stateRescue.rescued, buildings: Math.max(0, stateRescue.building - 1), multiplier: stateRescue.multiplier };
	animBeats.emit({ beat: 'rescueExit', total: stateRescue.total / 100, multiplier: stats.multiplier, rescued: stats.rescued, buildings: stats.buildings });
	stateRescue.active = false;
	stateRescue.rooms = [];
	stateRescue.banner = '';
	stateRescue.skip = false;
	stateScene.mood = 'base';
	stateGame.gameType = 'basegame';
	releaseWin('rescue');
	setFeatureSpins(null);
	audioDirector.bonusOutro();
};

// ---- Alarm Call ------------------------------------------------------------------------------------------------------
export const alarmCall = async (e: Ev<'alarmCall'>) => {
	parkReels();
	// the dispatch card's painting and Sprocket's rig, before the card rings (game/lazyAssets.ts 'alarm')
	await assetsReady('alarm');
	stateAlarmCall.outcome = e.outcome;
	stateAlarmCall.phase = 'ringing';
	stateAlarmCall.active = true;
	audioDirector.alarmRing();
	try {
		// the card rings, turns to the booked outcome and waits for a press (components/AlarmCallCard.svelte)
		await eventEmitter.broadcastAsync({ type: 'alarmCallShow', outcome: e.outcome, waitMs: cardWaitMs() });
	} finally {
		stateAlarmCall.active = false;
		stateAlarmCall.phase = 'idle';
	}
};

// ---- Backdraft Spins ---------------------------------------------------------------------------------------------------
export const backdraftSpinsStart = async (e: Ev<'backdraftSpinsStart'>) => {
	const [lo, hi] = CONTRACT.backdraftSpinsBlaze;
	cardExpected = true;
	pendingDismiss = false;
	// the card's painting (splash/card_backdraft via scene_card_backdraft) and the plates ride on the door
	await assetsReady('alarm');
	await shutter({
		type: 'shutterClose',
		card: {
			kind: 'intro',
			premium: false,
			art: 'scene_card_backdraft',
			variant: 'hazard',
			title: MODE_TITLE.backdraft_spins,
			subtitle: `${spinsWord(e.spins)} · ${lo}–${hi} Blaze Wilds every spin · ${CONTRACT.backdraftSpinsMultText}, added along a line`,
			hint: 'TAP OR PRESS SPACE',
		},
	});
	// ---- under cover: the bay door is blown open ---------------------------------------------------------------------
	await assetsReady('backdraft');
	stateBackdraftSpins.spins = e.spins;
	stateBackdraftSpins.spinsLeft = e.spins;
	stateBackdraftSpins.total = 0;
	stateBackdraftSpins.active = true;
	stateRescue.skip = false;
	claimWin('backdraftSpins');
	setFeatureSpins(e.spins);
	stateScene.mood = 'backdraft'; // swapped behind the door (theme §4), not cross-faded in view
	audioDirector.backdraftSpinsStart();
	await waitForCard();
	await shutter({ type: 'shutterOpen' });
	await beat(300);
};

export const backdraftSpinsEnd = async (e: Ev<'backdraftSpinsEnd'>, bookEvents: BookEvent[]) => {
	const round = roundStakeOf(bookEvents, stateRescue.capped);
	const total = round.total || e.amount;
	stateRescue.skip = false;
	setFeatureSpins(0);
	audioDirector.backdraftSpinsEnd();
	await celebrateRound(round.tier, total, round.cost);
	audioDirector.total(round.tier, 'backdraftSpins');
	stateBackdraftSpins.total = total;
	// the book's own figures for the card: how many Blaze Wilds lit, and the biggest multiplier among them
	const blazes = bookEvents.filter((ev): ev is Ev<'backdraft'> => ev.type === 'backdraft');
	const lit = blazes.reduce((n, ev) => n + ev.count, 0);
	const best = blazes.reduce((m, ev) => Math.max(m, ...ev.cells.map((c) => c.mult ?? 0)), 0);
	cardExpected = true;
	pendingDismiss = false;
	await shutter({
		type: 'shutterClose',
		card: {
			kind: 'outro',
			premium: false,
			variant: 'win',
			title: `${MODE_TITLE.backdraft_spins} COMPLETE`,
			subtitle: `${lit} Blaze Wilds${best > 0 ? ` · best ×${best}` : ''}`,
			// framed cards show the MULTIPLE, never a currency figure (money.ts formatBookMultiple)
			value: formatBookMultiple(total),
			hint: 'TAP OR PRESS SPACE',
		},
	});
	await waitForCard();
	// ---- under cover: back to Station 13 ----------------------------------------------------------------------------
	stateBackdraftSpins.active = false;
	stateScene.mood = 'base';
	stateGame.gameType = 'basegame';
	releaseWin('backdraftSpins');
	setFeatureSpins(null);
	await shutter({ type: 'shutterOpen' });
};

// ---- cap / teardown ----------------------------------------------------------------------------------------------------
export const wincap = () => {
	stateRescue.capped = true;
	// a capped round ends here: the spins counter never shows the unplayed leftovers through the end celebration
	if (stateRescue.active) stateRescue.spinsLeft = 0;
	if (stateBackdraftSpins.active) stateBackdraftSpins.spinsLeft = 0;
	if (stateRescue.active || stateBackdraftSpins.active) setFeatureSpins(0);
};

export const isCappedLevel = (level: number) => level >= MAX_WIN_LEVEL;

/** Called at every new round: an interrupted feature never leaves HUD ownership, the spins counter or the scene behind. */
export const teardownFeature = () => {
	const wasActive = stateRescue.active || stateBackdraftSpins.active || stateAlarmCall.active;
	// a new round: rig beats still pending from the previous presentation are dropped
	animBeats.newEpoch();
	if (stateRescue.active) animBeats.emit({ beat: 'rescueExit', total: stateRescue.total / 100, multiplier: stateRescue.multiplier, rescued: stateRescue.rescued, buildings: Math.max(0, stateRescue.building - 1) });
	dismissFeatureCard();
	cardExpected = false;
	pendingDismiss = false;
	endStats = null;
	if (wasActive) {
		releaseWin('rescue');
		releaseWin('backdraftSpins');
		setFeatureSpins(null);
		eventEmitter.broadcast({ type: 'shutterReset' });
	}
	resetRescueState();
	stateScene.mood = 'base';
	stateGame.gameType = 'basegame';
};
