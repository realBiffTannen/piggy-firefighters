<script lang="ts">
	// RESCUE SCENE — Rescue Spins / Inferno Rescue (contract §5-§6, theme §4), plus the Backdraft Spins header plate
	// (contract §7) and the feature banner.
	//
	// HONEST STATE, DELIVERED ART. Everything drawn here READS game/rescue/stateRescue.svelte.ts, which only the rescue
	// director writes, from the book: the apartment block above the reels (the art lane's facade band with one room
	// per reel column, each room's fire level picking its state sprite: 2 roaring / 1 smouldering / 0 safe, Inferno in
	// its own set; geometry from features/rescue/rooms.meta.json through game/artMeta.ts), the ladder from the truck
	// to the block, the hose and nozzle, a water jet + splash on every douse and a steam puff where a fire goes out, the
	// multiplier badge and the building / total plates (blank plates lettered at runtime), the jump sheet at the ladder
	// foot, and the running TOTAL (the HUD's own WIN readout is claimed by the scene: claimWin('rescue')). The spins
	// counter is the HUD's (setFeatureSpins).
	//
	// RIGS (docs/ANIMATION_CONTRACT.md v1.1): the rescued Trotters wave in the windows (`rescueRoom` x5), slide down the
	// ladder (`ladder`, the path in slot coordinates) into the sheet held by Sprocket (`sheet`). Until Codex's
	// exports exist the slots draw nothing and the procedural fallback plays: a brass tag with the Trotter's name hops to
	// the ladder, slides down and lands in the sheet, publishing the runtime's `landingBus` arrival so sheet rigs (if
	// any) still react.
	//
	// PHONES (stacked layouts; owner 2026-09-26 "This view is not clear at all", and no mascots in the mobile view): no
	// ladder, no jump sheet, no Sprocket, no hose nozzle and no water jet across the reels (splash + steam at the
	// window only). The band is taller by an info rail above the cornice (stateGame BUILDING_BAND_CELLS_STACKED) that
	// carries BUILDING / TOTAL / xN off the windows, so the flames and smoke over the cornice show; the transient banner
	// rides that rail (one layer at a time), never the middle reel row. The window Trotters stand lower and smaller, so the
	// fire behind them shows. EVERY rescued Trotter drops at WINDOW size straight down its own column and out of sight
	// behind the header beam: the first of a douse is the rig's own slide (stateRescue.lastRescue, published before the
	// beat, picks its window), every other one a snapshot of the pig the scene drops itself, side by side (the rig runtime
	// only queues them). An Inferno prize sits once, on a cream plaque under its sill that fades in once its Trotter has
	// dropped past it; the rail TOTAL takes the prize in at the same rescue (the banner then says just RESCUED!).
	// Placement and timing rules: game/rescue/rescuePhone.ts (gate: qa/gate/check_rescue_phone.mjs).
	//
	// Laid out in BOARD-LOCAL units (SYMBOL_SIZE per cell, reel 0 at x = REEL_PADDING cells), inside the band the scene
	// layout reserves above the frame while the scene is up (stateGame BUILDING_BAND_CELLS).
	import { onMount, untrack } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { Container, Graphics, Text, BaseSprite, PIXI, getContextApp } from 'pixi-svelte';

	import Grab from '../scene/Grab.svelte';
	import RigStage from '../rigs/RigStage.svelte';
	import { getContext } from '../../game/context';
	import { SYMBOL_SIZE, REEL_PADDING, BOARD_SIZES } from '../../game/constants';
	import { formatBookAmount } from '../../game/money';
	import { MODE_TITLE, BUILDING, trotterSkin } from '../../game/names';
	import { prefersReducedMotion, isTurbo } from '../../game/fx/timing';
	import { boardTicker } from '../../game/reels/boardTicker';
	import { sceneTex } from '../../game/fx/sceneTextures.svelte';
	import { audioDirector } from '../../game/fx/audioDirector';
	import { stateSpeed } from '../../game/stateSpeed.svelte';
	import { stateRescue, stateBackdraftSpins } from '../../game/rescue/stateRescue.svelte';
	import { BOARD_FRAME, RESCUE_ART, rescueProp } from '../../game/artMeta';
	import { rigRegistry } from '../../game/anim/rigRegistry';
	import { landingBus } from '../../game/anim/playbackControl';
	import { subscribeToBeats } from '../../game/anim/beatBus';
	import { fitRigInSlot, type RigName } from '../../game/anim/rigLogic';
	import { qv } from '../../game/quality.svelte';
	import {
		BANNER_FULL,
		PHONE_FONT,
		PLAQUE_TEXT_FILL,
		createDropGate,
		createRoomsSeen,
		fitWidth,
		forgetRooms,
		phoneBannerRail,
		phoneDropPath,
		phoneDropPose,
		phoneDropSlot,
		phoneRescueBand,
		plaqueAlpha,
		roomOneShots,
		trotterSlot,
		type PhoneExit,
	} from '../../game/rescue/rescuePhone';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const context = getContext();
	const app = getContextApp();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const INK = 0x3b2313;
	const CREAM = 0xf4e9d2;

	const sl = $derived(context.stateGameDerived.sceneLayout());
	const bl = () => context.stateGameDerived.boardLayout();
	const H = $derived(BOARD_SIZES.height * sl.rowPitch);
	const inferno = $derived(stateRescue.bonus === 'inferno');
	const stacked = $derived(sl.stacked);
	const speedTier = $derived((stateSpeed.tier === 'super' ? 2 : stateSpeed.tier === 'turbo' ? 1 : 0) as 0 | 1 | 2);
	const reduced = prefersReducedMotion();
	// the multiplier badge swells on every change (a rescue landed its +1x / +2x); reduced motion: no pulse
	const badgePulse = new Spring(1, { stiffness: 0.18, damping: 0.32 });
	let lastMult = stateRescue.multiplier;
	$effect(() => {
		const m = stateRescue.multiplier;
		if (m === lastMult) return;
		lastMult = m;
		if (reduced) return;
		untrack(() => {
			// phones: the badge sits near the screen edge on the rail, so it swells a little less
			void badgePulse.set(sl.stacked ? 1.28 : 1.45, { instant: true });
			badgePulse.target = 1;
		});
	});

	// ---- geometry (board-local units) ----------------------------------------------------------------------------------
	const m = $derived(sl.innerMargin * S);
	const post = $derived(sl.post * S);
	/** the frame's outer top / bottom edges */
	const frameTop = $derived(-sl.frameTopCells * S);
	const frameBottom = $derived(H + m + post * (BOARD_FRAME.bottom / BOARD_FRAME.left));
	const bandTop = $derived(-(sl.frameTopCells + sl.buildingBandCells) * S);
	const bandH = $derived(sl.buildingBandCells * S);
	/** facade px -> board units: one reel column per room */
	const kf = S / RESCUE_ART.pitch;
	const facadeW = RESCUE_ART.facade.w * kf;
	const facadeH = RESCUE_ART.facade.h * kf;
	const cellX = (reel: number) => (reel + REEL_PADDING) * S;
	const midRoom = RESCUE_ART.rooms[2];
	const facadeLeft = $derived(cellX(2) - (midRoom.box.x + midRoom.box.w / 2) * kf);
	const facadeTop = $derived(bandTop + bandH - facadeH - S * 0.03);
	const roomRect = (reel: number) => {
		const room = RESCUE_ART.rooms[reel] ?? RESCUE_ART.rooms[0];
		return { x: facadeLeft + room.box.x * kf, y: facadeTop + room.box.y * kf, w: room.box.w * kf, h: room.box.h * kf };
	};
	const windowRect = (reel: number) => {
		const room = RESCUE_ART.rooms[reel] ?? RESCUE_ART.rooms[0];
		return { x: facadeLeft + room.window.x * kf, y: facadeTop + room.window.y * kf, w: room.window.w * kf, h: room.window.h * kf };
	};
	const windowCentre = (reel: number) => {
		const r = windowRect(reel);
		return { x: r.x + r.w / 2, y: r.y + r.h * 0.55 };
	};
	const sill = (reel: number) => {
		const r = windowRect(reel);
		return { x: r.x + r.w / 2, y: r.y + r.h };
	};

	// the ladder (wide layouts): from the truck at the bottom-left of the frame up to the block's left end
	const LADDER_W = S * 0.55;
	const ladderSeg = rescueProp('ladder_segment');
	const ladderTopProp = rescueProp('ladder_top');
	const ladder = $derived.by(() => {
		if (stacked) return null;
		const foot = { x: -m - post - S * 0.62, y: frameBottom - S * 0.05 };
		const top = { x: facadeLeft + S * 0.12, y: facadeTop + facadeH * 0.5 };
		const dx = top.x - foot.x;
		const dy = top.y - foot.y;
		const len = Math.hypot(dx, dy);
		const ks = LADDER_W / ladderSeg.w;
		return { foot, top, len, angle: Math.atan2(dx, -dy), ks, segH: ladderSeg.h * ks, segments: Math.max(1, Math.ceil((len - ladderTopProp.h * ks * 0.6) / (ladderSeg.h * ks))) };
	});
	/** the room rescued last: a phone drop leaves ITS window (the director writes it before the rescue beat, and the rig
	 *  runtime reads the path below synchronously on that beat, so a derived — pulled on read — is always current) */
	const sheetReel = $derived(stateRescue.lastRescue);
	// the jump sheet at the ladder foot (wide layouts only: phones have no sheet and no performers)
	const sheetProp = rescueProp('jump_sheet');
	const SHEET_W = S * 1.15;
	const SHEET_H = (SHEET_W * sheetProp.h) / sheetProp.w;
	const sheetAt = $derived(ladder ? { x: ladder.foot.x + S * 0.42, y: ladder.foot.y - S * 0.06 } : { x: W / 2, y: frameTop });
	/** where a window Trotter stands and how tall it is: the same bounds-aware fit RigStage gives the `rescueRoom` slot
	 *  (rescuePhone.trotterSlot: lower and smaller on phones), so the phone drop starts exactly where the waving pig was */
	const windowTrotter = (reel: number) => {
		const slot = trotterSlot(windowRect(reel), stacked);
		const data = (app.stateApp.loadedAssets as any)?.pf_rescued;
		if (!data?.width || !data?.height) return { feet: { x: slot.x + slot.w / 2, y: slot.y + slot.h * 0.914 }, h: slot.h * 0.83 };
		const fit = fitRigInSlot({ x: data.x ?? 0, y: data.y ?? 0, width: data.width, height: data.height }, slot.w, slot.h, 1);
		return { feet: { x: slot.x + fit.x, y: slot.y + fit.y }, h: fit.scale * data.height };
	};
	/** the phone drop slot: ONE fixed slot over all five columns, masked at the header beam (rescuePhone.phoneDropSlot) */
	const dropSlot = $derived(stacked ? phoneDropSlot({ S, W, windows: [0, 1, 2, 3, 4].map(windowRect), frameTop }) : null);
	/** the slide path the runtime's ladder actor follows (docs/ANIMATION_CONTRACT.md `ladder` slot); on a phone, straight
	 *  down the rescued room's own column at window size, ending wholly under the beam */
	const slidePath = $derived.by(() => {
		if (ladder) return { from: { x: ladder.top.x, y: ladder.top.y }, to: { x: sheetAt.x, y: sheetAt.y - SHEET_H * 0.3 } };
		const t = windowTrotter(sheetReel);
		return phoneDropPath(t.feet, frameTop, t.h);
	});
	const ladderSlot = $derived.by(() => {
		if (dropSlot) return dropSlot;
		const pad = S * 0.9;
		const x = Math.min(slidePath.from.x, slidePath.to.x) - pad;
		const y = Math.min(slidePath.from.y, slidePath.to.y) - pad * 1.4;
		return { x, y, w: Math.abs(slidePath.from.x - slidePath.to.x) + pad * 2, h: Math.abs(slidePath.from.y - slidePath.to.y) + pad * 2.4 };
	});
	/** the ladder slot's host: on a phone it shows only the rig slide of a douse's FIRST rescue (rescuePhone.createDropGate)
	 *  — the runtime's queued slides would be cut by the next spin right after popping back into their empty windows */
	let dropNode: PIXI.Container | undefined;
	const dropGate = createDropGate();
	/** each room's Trotter host (the `rescueRoom` slot's container): a phone snapshots it for the scene's own drop */
	const roomNodes: (PIXI.Container | undefined)[] = [];
	/** when each room's Trotter left (its rescue beat): its prize plaque waits until the drop has passed */
	const rescuedAt: (number | undefined)[] = [];
	/** the rooms array whose SAVED windows stay empty through the NEXT BUILDING hold: the buildingCleared beat (with the
	 *  banner) re-shows every room Trotter at once, and the director replaces the array when the new building is up */
	let clearedRooms = $state.raw<unknown>(null);
	/** how fast exits play: 1 normal, turbo / super turbo shorter, reduced motion a short fade */
	const exitSpeed = () => (reduced ? 0.2 : speedTier === 2 ? 0.42 : speedTier === 1 ? 0.63 : 1);
	// the scene subscribes at its own mount, before the feature's rigs mount, so this runs BEFORE the room rig hides its
	// Trotter on the same beat: the snapshot below still sees the waving pig
	subscribeToBeats((event) => {
		const host = dropNode && !dropNode.destroyed ? dropNode : undefined;
		if (event.beat === 'douse') {
			dropGate.douse();
			// phones: the rig's ladder host shows only for the rescue the rig slides (the `rig` exit below)
			if (host) host.alpha = stacked ? 0 : 1;
		} else if (event.beat === 'rescue') {
			rescuedAt[event.reel] = performance.now();
			if (!stacked) {
				if (host) host.alpha = 1;
				return;
			}
			const exit = dropGate.rescue({ reduced, speedTier });
			if (exit === 'rig') {
				if (host) host.alpha = 1;
			} else snapshotExit(event.reel, exit);
		} else if (event.beat === 'buildingCleared') clearedRooms = stateRescue.rooms;
	});
	/** the ladder actor's size: a phone drop keeps the window Trotter's size (no 2x jump), wide layouts 1.25 cells */
	const ladderActorH = $derived(stacked ? windowTrotter(sheetReel).h : S * 1.25);
	const sheetSlot = $derived({ x: sheetAt.x - S * 0.9, y: sheetAt.y - S * 1.35, w: S * 1.8, h: S * 1.5 });

	// the hose: nozzle at the truck side (bottom-left), hose tiled off the left edge to it
	const nozzleProp = rescueProp('hose_nozzle');
	const NOZZLE_W = S * 1.05;
	const NOZZLE_H = (NOZZLE_W * nozzleProp.h) / nozzleProp.w;
	const nozzleAt = $derived(
		ladder ? { x: ladder.foot.x + S * 1.25, y: frameBottom + S * 0.3, rot: -0.55 } : { x: S * 0.55, y: frameBottom + S * 0.42, rot: -0.7 },
	);
	/** where the water leaves the nozzle (board units): the prop nozzle's tip */
	const nozzleTip = () => {
		const n = nozzleAt;
		return { x: n.x + Math.cos(n.rot) * NOZZLE_W * 0.48, y: n.y + Math.sin(n.rot) * NOZZLE_W * 0.48 };
	};
	const hoseProp = rescueProp('hose_segment');
	const HOSE_H = S * 0.2;
	const HOSE_TILE_W = (HOSE_H * hoseProp.w) / hoseProp.h;
	const hoseTiles = $derived.by(() => {
		if (!ladder) return [];
		// the world gutter (screen px) in board units: S units per reel cell
		const fromX = -m - post - (sl.gutter * S) / Math.max(1, sl.cell) - S;
		const toX = nozzleAt.x - NOZZLE_W * 0.35;
		const n = Math.max(0, Math.ceil((toX - fromX) / HOSE_TILE_W));
		return Array.from({ length: n }, (_, i) => toX - (i + 1) * HOSE_TILE_W);
	});

	/** the slot scale that makes a rig stand `wantH` board units tall inside a w x h slot (RigStage fits the rig to
	 *  the slot first; 1 until the rig's data is loaded, when the slot's own fit is the size) */
	const fitScale = (rig: RigName, w: number, h: number, wantH: number) => {
		const data = (app.stateApp.loadedAssets as any)?.[rig];
		if (!data?.width || !data?.height) return 1;
		// the same bounds-aware fit RigStage applies (feet centred, motion gutter); the layout scale it accepts is <= 1
		const fit = fitRigInSlot({ x: data.x ?? 0, y: data.y ?? 0, width: data.width, height: data.height }, w, h, 1).scale;
		return fit > 0 ? Math.min(1, wantH / (fit * data.height)) : 1;
	};

	// ---- textures ----------------------------------------------------------------------------------------------------------
	const tex = (key: string): PIXI.Texture | undefined => ((app.stateApp.loadedAssets as any)?.[key] ?? sceneTex(key)) as PIXI.Texture | undefined;
	const roomTex = (reel: number, fire: number, rescued: boolean) => tex(`rescue_room_${reel}_${RESCUE_ART.stateOfFire(rescued ? 0 : fire, inferno)}`);

	// ---- one-shot FX from ONE ticker: water jets, splashes, steam, the fallback slide, the banner fade -----------------
	/** one running one-shot: `release` frees what the node does not own (a snapshot texture) whenever it ends */
	type Fx = { node: PIXI.Container; t: number; d: number; step: (p: number) => void; done?: () => void; release?: () => void };
	const fx: Fx[] = [];
	/** jets, splashes and the procedural slide: over everything of the block */
	let fxNode: PIXI.Container | undefined;
	/** steam: over the rooms but UNDER the plates and the badge, so a puff never covers BUILDING / TOTAL */
	let steamNode: PIXI.Container | undefined;
	/** phones: the scene's own Trotter drops, over the plaques and masked at the header beam like the rig's drop slot */
	let dropFxNode: PIXI.Container | undefined;
	let dropFxMask: PIXI.Graphics | undefined;
	/** phones: each prize plaque's host (faded in from the ticker once its Trotter has dropped past it) */
	const plaqueNodes: (PIXI.Container | undefined)[] = [];
	/** what the watcher has already played (rescuePhone.roomOneShots) */
	const seen = createRoomsSeen();
	let bannerNode: PIXI.Container | undefined;
	/** phones: the rail's BUILDING / TOTAL plates, cross-faded against the banner that rides over them */
	let railNode: PIXI.Container | undefined;
	let bannerT = 1;
	let lastBanner = 0;

	const endFx = (f: Pick<Fx, 'node' | 'release'>) => {
		if (!f.node.destroyed) f.node.destroy({ children: true });
		f.release?.();
	};
	const addFx = (node: PIXI.Container, d: number, step: (p: number) => void, opts: { done?: () => void; parent?: PIXI.Container; release?: () => void } = {}) => {
		const parent = opts.parent ?? fxNode;
		if (!parent || parent.destroyed) {
			endFx({ node, release: opts.release });
			return;
		}
		parent.addChild(node);
		fx.push({ node, t: 0, d: Math.max(1, d), step, done: opts.done, release: opts.release });
		step(0);
	};
	const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
	const dur = (ms: number) => (reduced ? Math.min(ms, 150) : isTurbo() ? ms * 0.6 : ms);

	/** A W on reel r sprays room r: the jet from the nozzle to the window, the splash, steam if the fire went out. */
	const spray = (reel: number, fireAfter: number) => {
		if (!fxNode) return;
		const jetTex = tex('rescue_water_jet');
		const target = windowCentre(reel);
		const from = nozzleTip();
		const dx = target.x - from.x;
		const dy = target.y - from.y;
		const len = Math.hypot(dx, dy);
		// phones: no jet across the reels (the nozzle would sit under them); splash + steam at the window only
		if (jetTex && !reduced && !stacked) {
			const jet = new PIXI.Sprite(jetTex);
			jet.anchor.set(0.03, 0.88);
			jet.position.set(from.x, from.y);
			jet.rotation = Math.atan2(dy, dx) + 0.22;
			const k = len / (jetTex.width * 0.93);
			jet.scale.set(k, Math.min(k, (S * 0.9) / jetTex.height));
			addFx(jet, dur(720), (p) => {
				const grow = Math.min(1, p / 0.22);
				jet.scale.x = k * easeOut(grow);
				jet.alpha = p < 0.72 ? 1 : 1 - (p - 0.72) / 0.28;
			});
		}
		const splashTex = tex('rescue_water_splash');
		if (splashTex) {
			const splash = new PIXI.Sprite(splashTex);
			splash.anchor.set(0.5, 0.85);
			splash.position.set(target.x, target.y + S * 0.15);
			const k = (stacked ? S * 0.62 : S * 0.9) / splashTex.width;
			addFx(splash, dur(640), (p) => {
				const q = Math.max(0, (p - 0.18) / 0.82);
				splash.scale.set(k * (reduced ? 1 : 0.4 + 0.6 * easeOut(Math.min(1, q * 2.5))));
				splash.alpha = q <= 0 ? 0 : q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
			});
		}
		const steamTex = tex('rescue_steam_puff');
		if (steamTex && fireAfter <= 0) {
			const puff = new PIXI.Sprite(steamTex);
			puff.anchor.set(0.5, 0.7);
			puff.position.set(target.x, target.y - S * 0.1);
			// phones: a smaller puff that stays on the facade (the info rail sits just above the cornice)
			const k = (stacked ? S * 0.5 : S * 0.8) / steamTex.width;
			const rise = stacked ? S * 0.22 : S * 0.5;
			addFx(puff, dur(1000), (p) => {
				const q = Math.max(0, (p - 0.25) / 0.75);
				puff.scale.set(k * (0.5 + 0.9 * easeOut(q)));
				puff.position.y = target.y - S * 0.1 - rise * q;
				puff.alpha = q <= 0 ? 0 : 0.95 * (1 - q * q);
			}, { parent: steamNode && !steamNode.destroyed ? steamNode : fxNode });
			audioDirector.steam();
		}
		audioDirector.sprayStart();
		setTimeout(() => audioDirector.sprayEnd(), dur(640));
	};

	/** The procedural rescued Trotter (no `pf_rescued` rig): a brass tag with the family member's name hops out of the
	 *  window, slides down the ladder (or drops into the sheet on a phone), lands, and the sheet rigs hear the landing. */
	const slideFallback = (reel: number) => {
		if (!fxNode || rigRegistry.has('pf_rescued')) return;
		const tagTex = tex('rescue_badge_blank');
		const node = new PIXI.Container();
		if (tagTex) {
			const tag = new PIXI.Sprite(tagTex);
			tag.anchor.set(0.5);
			tag.width = S * 0.5;
			tag.height = (S * 0.5 * tagTex.height) / tagTex.width;
			node.addChild(tag);
		}
		const label = new PIXI.Text({ text: trotterSkin(reel, stateRescue.building).toUpperCase(), style: { fontFamily: 'StationSign, Lilita One, Inter, sans-serif', fontSize: S * 0.11, fill: INK, align: 'center' } });
		label.anchor.set(0.5);
		node.addChild(label);
		const start = sill(reel);
		// a phone has no sheet: the tag drops straight down its own column to the header beam and fades there
		const path = ladder ? slidePath : { from: start, to: { x: start.x, y: frameTop - S * 0.12 } };
		const hop = ladder ? dur(380) : 0;
		const slideMs = ladder ? dur(760) : dur(520);
		const landMs = dur(260);
		const total = hop + slideMs + landMs + dur(500);
		let landed = false;
		addFx(
			node,
			total,
			(p) => {
				const t = p * total;
				if (t < hop && ladder) {
					const q = easeOut(t / hop);
					node.position.set(start.x + (path.from.x - start.x) * q, start.y + (path.from.y - start.y) * q - Math.sin(Math.PI * q) * S * 0.6);
					node.rotation = -0.3 * Math.sin(Math.PI * q);
				} else if (t < hop + slideMs) {
					const q = (t - hop) / slideMs;
					const e = ladder ? q * q * (3 - 2 * q) : q * q;
					node.position.set(path.from.x + (path.to.x - path.from.x) * e, path.from.y + (path.to.y - path.from.y) * e - (ladder ? 0 : Math.sin(Math.PI * q) * S * 0.35));
					node.rotation = ladder ? -0.25 : 0.4 * Math.sin(Math.PI * 2 * q);
				} else {
					if (!landed) {
						landed = true;
						landingBus.publish(); // the sheet rigs (if mounted) catch on the actual arrival
					}
					const q = Math.min(1, (t - hop - slideMs) / landMs);
					node.position.set(path.to.x, path.to.y - Math.sin(Math.PI * q) * S * 0.18);
					node.rotation = 0;
					node.alpha = t > total - dur(320) ? Math.max(0, (total - t) / dur(320)) : 1;
				}
			},
			{
				done: () => {
					if (!landed) landingBus.publish();
				},
			},
		);
	};

	/**
	 * PHONES: a rescued Trotter the rig does not slide (a douse's later rescues; every one on turbo / super turbo /
	 * reduced motion) still leaves its window visibly. At its beat, BEFORE the room rig hides it, the room's Trotter host is
	 * snapshotted (one small render texture) and the snapshot drops straight down its own column, side by side with the
	 * rig's drop, into the masked layer: gone behind the header beam. Reduced motion fades it in place. The texture is
	 * destroyed with the sprite, at the end or when the scene leaves.
	 */
	const snapshotExit = (reel: number, exit: PhoneExit) => {
		const room = roomNodes[reel];
		const layer = dropFxNode;
		const renderer = app.stateApp.pixiApplication?.renderer;
		if (!room || room.destroyed || !room.visible || !layer || layer.destroyed || !renderer || !rigRegistry.has('pf_rescued')) return;
		let texture: PIXI.Texture | undefined;
		let region: { x: number; y: number; width: number; height: number };
		try {
			const b = room.getLocalBounds();
			if (!(b.width > 1 && b.height > 1)) return; // the rig already hid it: nothing to drop
			region = { x: b.x, y: b.y, width: b.width, height: b.height };
			// device pixels per board unit here, capped by the quality tier
			const ws = Math.hypot(room.worldTransform.a, room.worldTransform.b) || 1;
			const resolution = renderer.resolution * Math.min(2, ws) * qv({ high: 1, mid: 0.85, low: 0.6 });
			texture = renderer.generateTexture({ target: room, resolution });
		} catch {
			texture?.destroy(true);
			return;
		}
		const tx = texture;
		const release = () => {
			if (!tx.destroyed) tx.destroy(true);
		};
		const sprite = new PIXI.Sprite(tx);
		sprite.anchor.set(0.5);
		// the room host has no scale or rotation: its local bounds sit at its own position
		const cx = room.x + region.x + region.width / 2;
		const cy = room.y + region.y + region.height / 2;
		sprite.position.set(cx, cy);
		if (exit === 'fade') {
			addFx(sprite, 150, (p) => (sprite.alpha = 1 - p), { parent: layer, release });
			return;
		}
		const t = windowTrotter(reel);
		const path = phoneDropPath(t.feet, frameTop, t.h);
		addFx(
			sprite,
			760 * exitSpeed(),
			(p) => {
				const pose = phoneDropPose(p, path.from, path.to, S);
				sprite.position.set(cx, cy + (pose.y - path.from.y));
				sprite.rotation = pose.rot;
			},
			{ parent: layer, release },
		);
	};
	/** the drop layer's mask: the phone drop slot (rescuePhone.phoneDropSlot), ending at the header beam */
	const drawDropMask = () => {
		const layer = dropFxNode;
		if (!layer || layer.destroyed) return;
		if (!dropFxMask || dropFxMask.destroyed || dropFxMask.parent !== layer) {
			dropFxMask = new PIXI.Graphics();
			layer.addChild(dropFxMask);
			layer.mask = dropFxMask;
		}
		const r = dropSlot ?? { x: 0, y: 0, w: 1, h: 1 };
		dropFxMask.clear().rect(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h)).fill(0xffffff);
	};
	$effect(() => {
		void dropSlot;
		untrack(drawDropMask);
	});

	// spray flashes follow the state the director writes; a room rescued this spin starts its slide. The director changes
	// a room IN PLACE on a douse, so this effect must TRACK each room's own fields: reading only the array left it dead on
	// every douse (no jet, splash or steam) and let the building change fire every stale spray at once.
	$effect(() => {
		const rooms = stateRescue.rooms;
		for (const room of rooms) {
			void room.sprayed;
			void room.rescued;
		}
		untrack(() => {
			const shots = roomOneShots(rooms, seen);
			for (const s of shots.sprays) spray(s.reel, s.fireAfter);
			for (const reel of shots.rescues) slideFallback(reel);
		});
	});
	$effect(() => {
		if (stateRescue.bannerSeq !== lastBanner) {
			lastBanner = stateRescue.bannerSeq;
			// phones: a banner that replaces one still up ('RESCUED!' -> '+1 SPIN') stays up and swaps its words, instead
			// of dropping back to the rail for a moment (rescuePhone.phoneBannerRail: one layer at a time)
			const showing = untrack(() => !!phoneBand) && bannerT >= 0.06 && bannerT < 0.88;
			bannerT = showing ? BANNER_FULL : 0;
		}
	});
	$effect(() => {
		// the scene leaves: nothing of it may play on
		if (!stateRescue.active) untrack(() => clearFx());
	});

	const clearFx = () => {
		fx.splice(0).forEach(endFx);
		forgetRooms(seen);
		rescuedAt.length = 0;
	};

	const tick = (dt: number) => {
		for (let i = fx.length - 1; i >= 0; i -= 1) {
			const f = fx[i];
			if (f.node.destroyed) {
				fx.splice(i, 1);
				f.release?.();
				continue;
			}
			f.t += dt;
			const p = Math.min(1, f.t / f.d);
			f.step(p);
			if (p >= 1) {
				f.done?.();
				fx.splice(i, 1);
				endFx(f);
			}
		}
		if (bannerNode && !bannerNode.destroyed) {
			bannerT = Math.min(1, bannerT + dt / 1500);
			const up = bannerT < 1 && !!stateRescue.banner;
			if (phoneBand) {
				// phones: the banner REPLACES the rail plates, one layer at a time (never two sets of letters at once)
				const a = up ? phoneBannerRail(bannerT) : { banner: 0, rail: 1 };
				bannerNode.visible = a.banner > 0;
				bannerNode.alpha = a.banner;
				if (!reduced) bannerNode.scale.set(0.85 + 0.15 * Math.min(1, Math.max(0, (bannerT - 0.06) / (BANNER_FULL - 0.06))));
				if (railNode && !railNode.destroyed) railNode.alpha = a.rail;
			} else {
				bannerNode.visible = up;
				const inP = Math.min(1, bannerT / 0.12);
				bannerNode.alpha = bannerT < 0.75 ? inP : 1 - (bannerT - 0.75) / 0.25;
				if (!reduced) bannerNode.scale.set(0.85 + 0.15 * inP);
			}
		}
		// phones: each prize plaque fades in once its Trotter has dropped past it (rescuePhone.plaqueAlpha)
		const now = performance.now();
		for (let r = 0; r < plaqueNodes.length; r += 1) {
			const node = plaqueNodes[r];
			if (node && !node.destroyed) node.alpha = plaqueAlphaOf(r, now);
		}
	};
	const plaqueAlphaOf = (reel: number, now = performance.now()) => {
		const at = rescuedAt[reel];
		return at === undefined ? 1 : plaqueAlpha(now - at, exitSpeed());
	};

	onMount(() => {
		boardTicker.add(tick);
		// the phone drop reached the beam (behind it, masked): hide the host so the douse's queued drops play unseen
		const offLanding = landingBus.subscribe(() => {
			if (dropNode && !dropNode.destroyed && dropGate.landed(stacked)) dropNode.alpha = 0;
		});
		return () => {
			offLanding();
			boardTicker.remove(tick);
			clearFx();
			bannerPlate?.destroy();
			bannerPlate = undefined;
		};
	});

	const titleStyle = (size: number, fill = CREAM) => ({
		fontFamily: 'StationSign, Lilita One, Inter, sans-serif',
		fontSize: size,
		fill,
		align: 'center' as const,
		stroke: { color: INK, width: Math.max(2, size * 0.14), join: 'round' as const },
	});
	/** runtime lettering on a blank cream plate / badge: ink, no stroke */
	const plateStyle = (size: number) => ({
		fontFamily: 'StationSign, Lilita One, Inter, sans-serif',
		fontSize: size,
		fill: INK,
		align: 'center' as const,
	});
	// TXT-14: one PIXI.TextStyle per role, built once. pixi-svelte re-assigns `text.style` whenever ANY prop of a Text
	// changes, and a fresh options object per template run made every TOTAL / building / prize / spins-left update
	// rebuild the style (and re-key the raster) alongside the text; a stable TextStyle instance makes that assignment
	// a no-op, so only a real text change rasterises. Same faces, same sizes.
	const STYLE = {
		building: new PIXI.TextStyle(plateStyle(S * 0.17)),
		total: new PIXI.TextStyle(plateStyle(S * 0.19)),
		badge: new PIXI.TextStyle(plateStyle(S * 0.3)),
		prize: new PIXI.TextStyle(titleStyle(S * 0.16, 0xf5d23c)),
		backdraftTitle: new PIXI.TextStyle(plateStyle(S * 0.24)),
		backdraftLine: new PIXI.TextStyle(plateStyle(S * 0.2)),
		banner: new PIXI.TextStyle({ ...plateStyle(S * 0.3), wordWrap: true, wordWrapWidth: S * 3.9 }),
		// phones: the rail, the sill plaques and a ONE-line banner, each fitted to its plate (rescuePhone.PHONE_FONT)
		railBuilding: new PIXI.TextStyle(plateStyle(S * PHONE_FONT.building)),
		railTotal: new PIXI.TextStyle(plateStyle(S * PHONE_FONT.total)),
		plaque: new PIXI.TextStyle(plateStyle(S * PHONE_FONT.plaque)),
		bannerPhone: new PIXI.TextStyle(plateStyle(S * PHONE_FONT.banner)),
	};
	/** a label's scale so it fits `maxW` board units (never grows): long amounts / currencies shrink onto their plate */
	const fitText = (text: string, style: PIXI.TextStyle, maxW: number) => {
		try {
			return fitWidth(PIXI.CanvasTextMetrics.measureText(text, style).width, maxW);
		} catch {
			return 1;
		}
	};
	const badgeProp = rescueProp('badge_blank');
	const plateProp = rescueProp('spins_plate_blank');
	const plateH = (w: number) => (w * plateProp.h) / plateProp.w;
	/** the highest flame / smoke of any room: the rooms' sprites rise above the cornice (rooms.meta box_in_facade) */
	const smokeTop = $derived(facadeTop + Math.min(...RESCUE_ART.rooms.map((r) => r.box.y)) * kf);
	/** phones: the info rail, the sill plaques and the banner's place (rescuePhone.phoneRescueBand); null on wide layouts */
	const phoneBand = $derived(
		stacked
			? phoneRescueBand({ S, W, bandTop, smokeTop, frameTop, windows: [0, 1, 2, 3, 4].map(windowRect), plateAspect: plateProp.w / plateProp.h, badgeAspect: badgeProp.h / badgeProp.w })
			: null,
	);
	const badgeAt = $derived.by(() => {
		if (phoneBand) return { x: phoneBand.badge.x, y: phoneBand.badge.y };
		const x = stacked ? W - S * 0.5 : facadeLeft + facadeW - S * 0.62;
		return { x, y: facadeTop + facadeH * 0.2 };
	});
	const badgeW = $derived(phoneBand ? phoneBand.badge.w : S * 0.8);
	const buildingPlateAt = $derived({ x: stacked ? S * 0.95 : facadeLeft + S * 0.95, y: facadeTop + facadeH * 0.13, w: S * 1.55 });
	const totalPlateAt = $derived({ x: W / 2 + (stacked ? S * 0.3 : S * 0.55), y: facadeTop + facadeH * 0.13, w: S * 2.05 });
	const buildingText = $derived(`${BUILDING} ${stateRescue.building}`);
	const totalText = $derived(`TOTAL ${formatBookAmount(stateRescue.total)}`);
	const badgeText = $derived(`x${stateRescue.multiplier}`);

	// the phone banner's plate: the blank spins plate NINE-SLICED to the rail's long, low shape (its bolts keep their size),
	// built into a Grab'd host and rebuilt only when the rail or the texture changes; destroyed with the scene
	let bannerPlateHost: PIXI.Container | undefined;
	let bannerPlate: PIXI.Container | undefined;
	const buildBannerPlate = () => {
		bannerPlate?.destroy();
		bannerPlate = undefined;
		const host = bannerPlateHost;
		const b = phoneBand?.banner;
		if (!host || host.destroyed || !b) return;
		const t = tex('rescue_spins_plate');
		if (t && t.height > 0) {
			const corner = Math.round(t.height * 0.36); // the bolt block and the cream field's notched corner
			const k = b.h / t.height;
			const n = new PIXI.NineSliceSprite({ texture: t, leftWidth: corner, topHeight: corner, rightWidth: corner, bottomHeight: corner });
			n.width = b.w / k;
			n.height = b.h / k;
			n.scale.set(k);
			n.position.set(-b.w / 2, -b.h / 2);
			bannerPlate = n;
		} else {
			bannerPlate = new PIXI.Graphics()
				.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, b.h * 0.25)
				.fill(CREAM)
				.stroke({ width: 4, color: INK });
		}
		host.addChild(bannerPlate);
	};
	$effect(() => {
		void phoneBand?.banner;
		void tex('rescue_spins_plate');
		untrack(buildBannerPlate);
	});
</script>

<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: W / 2, y: H / 2 }}>
	{#if stateRescue.active && bandH > 0}
		<!-- the hose from the truck (off the left edge) to the nozzle; hidden on phones (no jet crosses the reels there,
		     so no idle nozzle under them) -->
		{#if !stacked}
			{#if tex('rescue_hose_segment')}
				{#each hoseTiles as hx (hx)}
					<BaseSprite texture={tex('rescue_hose_segment')} x={hx} y={nozzleAt.y + NOZZLE_H * 0.12} width={HOSE_TILE_W + 0.5} height={HOSE_H} anchor={{ x: 0, y: 0.5 }} />
				{/each}
			{/if}
			{#if tex('rescue_hose_nozzle')}
				<BaseSprite texture={tex('rescue_hose_nozzle')} x={nozzleAt.x} y={nozzleAt.y} rotation={nozzleAt.rot} width={NOZZLE_W} height={NOZZLE_H} anchor={{ x: 0.5, y: 0.55 }} />
			{/if}
		{/if}

		<!-- the block: facade band with one room per reel column (each room's fire state is its own sprite) -->
		{#if tex(inferno ? 'rescue_facade_inferno' : 'rescue_facade')}
			<BaseSprite texture={tex(inferno ? 'rescue_facade_inferno' : 'rescue_facade')} x={facadeLeft} y={facadeTop} width={facadeW} height={facadeH} />
		{/if}
		{#each stateRescue.rooms as room (room.reel)}
			{@const rr = roomRect(room.reel)}
			{@const rt = roomTex(room.reel, room.fire, room.rescued)}
			{#if rt}
				<BaseSprite texture={rt} x={rr.x} y={rr.y} width={rr.w} height={rr.h} />
			{/if}
		{/each}
		<!-- steam from a doused window: over the rooms, under the plates and the badge (never over BUILDING / TOTAL) -->
		<Container>
			<Grab ongrab={(node) => (steamNode = node)} />
		</Container>

		<!-- the ladder from the truck to the block (wide layouts); phones jump straight into the sheet -->
		{#if ladder && tex('rescue_ladder_segment')}
			<Container x={ladder.foot.x} y={ladder.foot.y} rotation={ladder.angle}>
				{#each Array.from({ length: ladder.segments }, (_, i) => i) as i (i)}
					<BaseSprite texture={tex('rescue_ladder_segment')} x={-LADDER_W / 2} y={-(i + 1) * ladder.segH + 0.5} width={LADDER_W} height={ladder.segH + 1} />
				{/each}
				{#if tex('rescue_ladder_top')}
					<BaseSprite texture={tex('rescue_ladder_top')} x={-(ladderTopProp.w * ladder.ks) / 2} y={-ladder.segments * ladder.segH - ladderTopProp.h * ladder.ks + 2} width={ladderTopProp.w * ladder.ks} height={ladderTopProp.h * ladder.ks} />
				{/if}
			</Container>
		{/if}

		<!-- the jump sheet at the ladder foot (the holders are the `sheet` rigs); phones have none -->
		{#if !stacked && tex('rescue_jump_sheet')}
			<BaseSprite texture={tex('rescue_jump_sheet')} x={sheetAt.x} y={sheetAt.y} width={SHEET_W} height={SHEET_H} anchor={0.5} />
		{/if}

		<!-- building / TOTAL plates and the multiplier badge (blank art, lettered here); phones: on the info rail above
		     the cornice, off the windows -->
		{#if phoneBand}
			{@const pb = phoneBand}
			<Container>
				<Grab ongrab={(node) => (railNode = node)} />
				{#if tex('rescue_spins_plate')}
					<BaseSprite texture={tex('rescue_spins_plate')} x={pb.building.x} y={pb.building.y} width={pb.building.w} height={pb.building.h} anchor={0.5} />
					<BaseSprite texture={tex('rescue_spins_plate')} x={pb.total.x} y={pb.total.y} width={pb.total.w} height={pb.total.h} anchor={0.5} />
				{/if}
				<Text anchor={0.5} x={pb.building.x} y={pb.building.y} scale={fitText(buildingText, STYLE.railBuilding, pb.building.w * 0.76)} text={buildingText} style={STYLE.railBuilding} />
				<Text anchor={0.5} x={pb.total.x} y={pb.total.y} scale={fitText(totalText, STYLE.railTotal, pb.total.w * 0.8)} text={totalText} style={STYLE.railTotal} />
			</Container>
		{:else}
			{#if tex('rescue_spins_plate')}
				<BaseSprite texture={tex('rescue_spins_plate')} x={buildingPlateAt.x} y={buildingPlateAt.y} width={buildingPlateAt.w} height={plateH(buildingPlateAt.w)} anchor={0.5} />
				<BaseSprite texture={tex('rescue_spins_plate')} x={totalPlateAt.x} y={totalPlateAt.y} width={totalPlateAt.w} height={plateH(totalPlateAt.w)} anchor={0.5} />
			{/if}
			<Text anchor={0.5} x={buildingPlateAt.x} y={buildingPlateAt.y} text={buildingText} style={STYLE.building} />
			<Text anchor={0.5} x={totalPlateAt.x} y={totalPlateAt.y} text={totalText} style={STYLE.total} />
		{/if}
		<Container x={badgeAt.x} y={badgeAt.y} scale={badgePulse.current}>
			{#if tex('rescue_badge_blank')}
				<BaseSprite texture={tex('rescue_badge_blank')} width={badgeW} height={(badgeW * badgeProp.h) / badgeProp.w} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.circle(0, 0, badgeW * 0.425).fill(inferno ? 0xe9b23b : 0xd7262b).stroke({ width: 4, color: INK })} />
			{/if}
			<Text anchor={0.5} scale={phoneBand ? fitText(badgeText, STYLE.badge, badgeW * 0.6) : 1} text={badgeText} style={STYLE.badge} />
		</Container>

		<!-- Inferno: the rescued pig's instant prize on the sill (wide layouts; phones letter it on a plaque, below) -->
		{#if !stacked}
			{#each stateRescue.rooms as room (room.reel)}
				{#if room.rescued && room.prize}
					{@const s = sill(room.reel)}
					<Text anchor={0.5} x={s.x} y={s.y - S * 0.14} text={`+${formatBookAmount(room.prize)}`} style={STYLE.prize} />
				{/if}
			{/each}
		{/if}

		<!-- rigs: the Trotters at their windows (phones: lower and smaller, so the fire shows; empty through the NEXT
		     BUILDING hold), the ladder actor (phones: the drop down its own column), Sprocket with the sheet (wide
		     layouts only: no mascots in the mobile view) -->
		{#each stateRescue.rooms as room (room.reel)}
			{@const ts = trotterSlot(windowRect(room.reel), stacked)}
			<Container x={ts.x} y={ts.y} visible={!(clearedRooms === stateRescue.rooms && room.rescued)}>
				<Grab ongrab={(node) => (roomNodes[room.reel] = node)} />
				<RigStage {...{ slot: 'rescueRoom' as const }} index={room.reel} width={ts.w} height={ts.h} scale={1} layout={stacked ? 'portrait' : 'desktop'} reducedMotion={reduced} {speedTier} />
			</Container>
		{/each}

		<!-- phones: each Inferno prize ONCE, on a cream plaque between its sill and the header beam: over the window
		     Trotters, UNDER the drops (a pig falls past its prize, never into it), faded in once its Trotter has passed
		     (a persistent host mounted with the scene, so late plaques keep this place in the stack) -->
		{#if phoneBand}
			<Container>
				{#each stateRescue.rooms as room (room.reel)}
					{#if room.rescued && room.prize && phoneBand.plaques[room.reel]}
						{@const p = phoneBand.plaques[room.reel]}
						{@const label = `+${formatBookAmount(room.prize)}`}
						<Container>
							<Grab
								ongrab={(node) => {
									node.alpha = plaqueAlphaOf(room.reel);
									plaqueNodes[room.reel] = node;
								}}
							/>
							{#if tex('rescue_spins_plate')}
								<BaseSprite texture={tex('rescue_spins_plate')} x={p.x} y={p.y} width={p.w} height={p.h} anchor={0.5} />
							{:else}
								<Graphics draw={(g) => g.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.h * 0.25).fill(CREAM).stroke({ width: 3, color: INK })} />
							{/if}
							<Text anchor={0.5} x={p.x} y={p.y} scale={fitText(label, STYLE.plaque, p.w * PLAQUE_TEXT_FILL)} text={label} style={STYLE.plaque} />
						</Container>
					{/if}
				{/each}
			</Container>
		{/if}

		<Container x={ladderSlot.x} y={ladderSlot.y}>
			<Grab ongrab={(node) => (dropNode = node)} />
			<RigStage
				{...{ slot: 'ladder' as const }}
				width={ladderSlot.w}
				height={ladderSlot.h}
				scale={fitScale('pf_rescued', ladderSlot.w, ladderSlot.h, ladderActorH)}
				layout={stacked ? 'portrait' : 'desktop'}
				reducedMotion={reduced}
				{speedTier}
				path={{ fromX: slidePath.from.x - ladderSlot.x, fromY: slidePath.from.y - ladderSlot.y, toX: slidePath.to.x - ladderSlot.x, toY: slidePath.to.y - ladderSlot.y }}
			/>
		</Container>
		<!-- phones: the scene's own Trotter drops (every rescue the rig does not slide), masked at the header beam -->
		<Container>
			<Grab
				ongrab={(node) => {
					dropFxNode = node;
					dropFxMask = undefined;
					drawDropMask();
				}}
			/>
		</Container>
		{#if !stacked}
			<Container x={sheetSlot.x} y={sheetSlot.y}>
				<RigStage {...{ slot: 'sheet' as const }} width={sheetSlot.w} height={sheetSlot.h} scale={1} layout="desktop" reducedMotion={reduced} {speedTier} />
			</Container>
		{/if}

		<!-- water jets, splashes and the procedural slide (written from the board ticker) -->
		<Container>
			<Grab ongrab={(node) => (fxNode = node)} />
		</Container>
	{/if}

	{#if stateBackdraftSpins.active}
		<!-- Backdraft Spins header plate, centred in the band the layout reserves above the frame (theme §4: "the 5-spin
		     counter on a brass plate"; stateGame BACKDRAFT_BAND_CELLS) -->
		<Container x={W / 2} y={(frameTop + bandTop) / 2}>
			{#if tex('rescue_spins_plate')}
				<BaseSprite texture={tex('rescue_spins_plate')} width={S * 3.1} height={plateH(S * 3.1)} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.roundRect(-S * 1.55, -S * 0.55, S * 3.1, S * 1.1, S * 0.1).fill(0xe9b23b).stroke({ width: 4, color: INK })} />
			{/if}
			<Text anchor={0.5} y={-S * 0.2} text={MODE_TITLE.backdraft_spins} style={STYLE.backdraftTitle} />
			<Text anchor={0.5} y={S * 0.16} text={`${stateBackdraftSpins.spinsLeft} LEFT · ${formatBookAmount(stateBackdraftSpins.total)}`} style={STYLE.backdraftLine} />
		</Container>
	{/if}

	<!-- the feature banner ('RESCUED!', '+1 SPIN', 'NEXT BUILDING · +5 SPINS', 'RESCUE SPINS COMPLETE'): over the reels on
	     wide layouts; on phones ONE line on the info rail, left of the xN badge, never on the middle reel row -->
	<!-- zIndex: the scene's own furniture mounts AFTER this container (when the scene goes active) and would otherwise draw
	     over it; on a phone the banner lies on the rail plates, so it must be the top layer -->
	<Container x={phoneBand ? phoneBand.banner.x : W / 2} y={phoneBand ? phoneBand.banner.y : H / 2} zIndex={1} visible={false}>
		<Grab ongrab={(node) => (bannerNode = node)} />
		{#if phoneBand}
			<Container>
				<Grab
					ongrab={(node) => {
						bannerPlateHost = node;
						buildBannerPlate();
					}}
				/>
			</Container>
			{#if stateRescue.banner}
				<Text anchor={0.5} scale={fitText(stateRescue.banner, STYLE.bannerPhone, phoneBand.banner.w * 0.84)} text={stateRescue.banner} style={STYLE.bannerPhone} />
			{/if}
		{:else if stateRescue.banner}
			{#if tex('rescue_spins_plate')}
				<BaseSprite texture={tex('rescue_spins_plate')} width={S * 4.4} height={plateH(S * 4.4)} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.roundRect(-S * 2.3, -S * 0.36, S * 4.6, S * 0.72, S * 0.18).fill({ color: 0x1e2a4a, alpha: 0.88 }).stroke({ width: 5, color: 0xff7a1a })} />
			{/if}
			<Text anchor={0.5} text={stateRescue.banner} style={STYLE.banner} />
		{/if}
	</Container>
</Container>
