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
	// ladder (`ladder`, the path in slot coordinates) into the sheet held by Sprocket and Ember (`sheet`). Until Codex's
	// exports exist the slots draw nothing and the procedural fallback plays: a brass tag with the Trotter's name hops to
	// the ladder, slides down and lands in the sheet, publishing the runtime's `landingBus` arrival so sheet rigs (if
	// any) still react. Phones (stacked layouts) have no gutter for a ladder: the rescued jump from the sill straight
	// into the sheet held under their window.
	//
	// Laid out in BOARD-LOCAL units (SYMBOL_SIZE per cell, reel 0 at x = REEL_PADDING cells), inside the band the scene
	// layout reserves above the frame while the scene is up (stateGame BUILDING_BAND_CELLS).
	import { onMount, untrack } from 'svelte';
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
	import { stateRig } from '../../game/fx/stateRig.svelte';
	import { stateSpeed } from '../../game/stateSpeed.svelte';
	import { stateRescue, stateBackdraftSpins } from '../../game/rescue/stateRescue.svelte';
	import { BOARD_FRAME, RESCUE_ART, rescueProp } from '../../game/artMeta';
	import { rigRegistry } from '../../game/anim/rigRegistry';
	import { landingBus } from '../../game/anim/playbackControl';
	import type { RigName } from '../../game/anim/rigLogic';

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
	// the jump sheet: at the ladder foot, or (stacked) on the header beam under the window being rescued
	let sheetReel = $state(2);
	const sheetProp = rescueProp('jump_sheet');
	const SHEET_W = S * 1.15;
	const SHEET_H = (SHEET_W * sheetProp.h) / sheetProp.w;
	const sheetAt = $derived.by(() => {
		if (ladder) return { x: ladder.foot.x + S * 0.42, y: ladder.foot.y - S * 0.06 };
		const s = sill(sheetReel);
		return { x: Math.max(SHEET_W / 2, Math.min(W - SHEET_W / 2, s.x)), y: frameTop + post * 0.2 };
	});
	/** the slide path the runtime's ladder actor follows (docs/ANIMATION_CONTRACT.md `ladder` slot) */
	const slidePath = $derived.by(() => {
		if (ladder) return { from: { x: ladder.top.x, y: ladder.top.y }, to: { x: sheetAt.x, y: sheetAt.y - SHEET_H * 0.3 } };
		const s = sill(sheetReel);
		return { from: { x: s.x, y: s.y }, to: { x: sheetAt.x, y: sheetAt.y - SHEET_H * 0.3 } };
	});
	const ladderSlot = $derived.by(() => {
		const pad = S * 0.9;
		const x = Math.min(slidePath.from.x, slidePath.to.x) - pad;
		const y = Math.min(slidePath.from.y, slidePath.to.y) - pad * 1.4;
		return { x, y, w: Math.abs(slidePath.from.x - slidePath.to.x) + pad * 2, h: Math.abs(slidePath.from.y - slidePath.to.y) + pad * 2.4 };
	});
	const sheetSlot = $derived({ x: sheetAt.x - S * 0.9, y: sheetAt.y - S * 1.35, w: S * 1.8, h: S * 1.5 });

	// the hose: nozzle at the truck side (bottom-left), hose tiled off the left edge to it
	const nozzleProp = rescueProp('hose_nozzle');
	const NOZZLE_W = S * 1.05;
	const NOZZLE_H = (NOZZLE_W * nozzleProp.h) / nozzleProp.w;
	const nozzleAt = $derived(
		ladder ? { x: ladder.foot.x + S * 1.25, y: frameBottom + S * 0.3, rot: -0.55 } : { x: S * 0.55, y: frameBottom + S * 0.42, rot: -0.7 },
	);
	/** where the water leaves the nozzle (board units): the nozzle's tip, or the chief rig's `nozzle_tip` while it sprays */
	const nozzleTip = () => {
		if (fxNode && stateRig.nozzleTip) {
			const p = fxNode.toLocal(new PIXI.Point(stateRig.nozzleTip.x, stateRig.nozzleTip.y));
			return { x: p.x, y: p.y };
		}
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
		const fit = Math.min(w / data.width, h / data.height);
		return fit > 0 ? wantH / (fit * data.height) : 1;
	};

	// ---- textures ----------------------------------------------------------------------------------------------------------
	const tex = (key: string): PIXI.Texture | undefined => ((app.stateApp.loadedAssets as any)?.[key] ?? sceneTex(key)) as PIXI.Texture | undefined;
	const roomTex = (reel: number, fire: number, rescued: boolean) => tex(`rescue_room_${reel}_${RESCUE_ART.stateOfFire(rescued ? 0 : fire, inferno)}`);

	// ---- one-shot FX from ONE ticker: water jets, splashes, steam, the fallback slide, the banner fade -----------------
	type Fx = { node: PIXI.Container; t: number; d: number; step: (p: number) => void; done?: () => void };
	const fx: Fx[] = [];
	let fxNode: PIXI.Container | undefined;
	const lastSprayed = [0, 0, 0, 0, 0];
	const lastRescued = [false, false, false, false, false];
	let bannerNode: PIXI.Container | undefined;
	let bannerT = 1;
	let lastBanner = 0;

	const addFx = (node: PIXI.Container, d: number, step: (p: number) => void, done?: () => void) => {
		if (!fxNode) return;
		fxNode.addChild(node);
		fx.push({ node, t: 0, d: Math.max(1, d), step, done });
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
		if (jetTex && !reduced) {
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
			const k = (S * 0.9) / splashTex.width;
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
			const k = (S * 0.8) / steamTex.width;
			addFx(puff, dur(1000), (p) => {
				const q = Math.max(0, (p - 0.25) / 0.75);
				puff.scale.set(k * (0.5 + 0.9 * easeOut(q)));
				puff.position.y = target.y - S * 0.1 - S * 0.5 * q;
				puff.alpha = q <= 0 ? 0 : 0.95 * (1 - q * q);
			});
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
		const path = slidePath;
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
			() => {
				if (!landed) landingBus.publish();
			},
		);
	};

	// spray flashes follow the state the director writes; a room rescued this spin starts its slide
	$effect(() => {
		const rooms = stateRescue.rooms;
		untrack(() => {
			rooms.forEach((room) => {
				if (room.sprayed !== lastSprayed[room.reel]) {
					lastSprayed[room.reel] = room.sprayed;
					spray(room.reel, room.fire);
				}
				if (room.rescued !== lastRescued[room.reel]) {
					lastRescued[room.reel] = room.rescued;
					if (room.rescued) {
						sheetReel = room.reel;
						slideFallback(room.reel);
					}
				}
			});
		});
	});
	$effect(() => {
		if (stateRescue.bannerSeq !== lastBanner) {
			lastBanner = stateRescue.bannerSeq;
			bannerT = 0;
		}
	});
	$effect(() => {
		// the scene leaves: nothing of it may play on
		if (!stateRescue.active) untrack(() => clearFx());
	});

	const clearFx = () => {
		fx.splice(0).forEach((f) => f.node.destroy({ children: true }));
		lastSprayed.fill(0);
		lastRescued.fill(false);
	};

	const tick = (dt: number) => {
		for (let i = fx.length - 1; i >= 0; i -= 1) {
			const f = fx[i];
			if (f.node.destroyed) {
				fx.splice(i, 1);
				continue;
			}
			f.t += dt;
			const p = Math.min(1, f.t / f.d);
			f.step(p);
			if (p >= 1) {
				f.done?.();
				f.node.destroy({ children: true });
				fx.splice(i, 1);
			}
		}
		if (bannerNode && !bannerNode.destroyed) {
			bannerT = Math.min(1, bannerT + dt / 1500);
			bannerNode.visible = bannerT < 1 && !!stateRescue.banner;
			const inP = Math.min(1, bannerT / 0.12);
			bannerNode.alpha = bannerT < 0.75 ? inP : 1 - (bannerT - 0.75) / 0.25;
			if (!reduced) bannerNode.scale.set(0.85 + 0.15 * inP);
		}
	};

	onMount(() => {
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			clearFx();
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
	const badgeProp = rescueProp('badge_blank');
	const plateProp = rescueProp('spins_plate_blank');
	const plateH = (w: number) => (w * plateProp.h) / plateProp.w;
	const badgeAt = $derived.by(() => {
		const x = stacked ? W - S * 0.5 : facadeLeft + facadeW - S * 0.62;
		return { x, y: facadeTop + facadeH * 0.2 };
	});
	const buildingPlateAt = $derived({ x: stacked ? S * 0.95 : facadeLeft + S * 0.95, y: facadeTop + facadeH * 0.13, w: S * 1.55 });
	const totalPlateAt = $derived({ x: W / 2 + (stacked ? S * 0.3 : S * 0.55), y: facadeTop + facadeH * 0.13, w: S * 2.05 });
</script>

<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: W / 2, y: H / 2 }}>
	{#if stateRescue.active && bandH > 0}
		<!-- the hose from the truck (off the left edge) to the nozzle; hidden when the chief rig sprays himself -->
		{#if !rigRegistry.has('pf_chief')}
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

		<!-- the jump sheet at the ladder foot (the holders are the `sheet` rigs) -->
		{#if tex('rescue_jump_sheet')}
			<BaseSprite texture={tex('rescue_jump_sheet')} x={sheetAt.x} y={sheetAt.y} width={SHEET_W} height={SHEET_H} anchor={0.5} />
		{/if}

		<!-- building / TOTAL plates and the multiplier badge (blank art, lettered here) -->
		{#if tex('rescue_spins_plate')}
			<BaseSprite texture={tex('rescue_spins_plate')} x={buildingPlateAt.x} y={buildingPlateAt.y} width={buildingPlateAt.w} height={plateH(buildingPlateAt.w)} anchor={0.5} />
			<BaseSprite texture={tex('rescue_spins_plate')} x={totalPlateAt.x} y={totalPlateAt.y} width={totalPlateAt.w} height={plateH(totalPlateAt.w)} anchor={0.5} />
		{/if}
		<Text anchor={0.5} x={buildingPlateAt.x} y={buildingPlateAt.y} text={`${BUILDING} ${stateRescue.building}`} style={plateStyle(S * 0.17)} />
		<Text anchor={0.5} x={totalPlateAt.x} y={totalPlateAt.y} text={`TOTAL ${formatBookAmount(stateRescue.total)}`} style={plateStyle(S * 0.19)} />
		<Container x={badgeAt.x} y={badgeAt.y}>
			{#if tex('rescue_badge_blank')}
				<BaseSprite texture={tex('rescue_badge_blank')} width={S * 0.8} height={(S * 0.8 * badgeProp.h) / badgeProp.w} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.circle(0, 0, S * 0.34).fill(inferno ? 0xe9b23b : 0xd7262b).stroke({ width: 4, color: INK })} />
			{/if}
			<Text anchor={0.5} text={`x${stateRescue.multiplier}`} style={plateStyle(S * 0.3)} />
		</Container>

		<!-- Inferno: the rescued pig's instant prize on the sill -->
		{#each stateRescue.rooms as room (room.reel)}
			{#if room.rescued && room.prize}
				{@const s = sill(room.reel)}
				<Text anchor={0.5} x={s.x} y={s.y - S * 0.14} text={`+${formatBookAmount(room.prize)}`} style={titleStyle(S * 0.16, 0xf5d23c)} />
			{/if}
		{/each}

		<!-- rigs: the Trotters at their windows, the ladder actor, Sprocket + Ember with the sheet -->
		{#each stateRescue.rooms as room (room.reel)}
			{@const wr = windowRect(room.reel)}
			<Container x={wr.x} y={wr.y - wr.h * 0.1}>
				<RigStage {...{ slot: 'rescueRoom' as const }} index={room.reel} width={wr.w} height={wr.h * 1.05} scale={1} layout={stacked ? 'portrait' : 'desktop'} reducedMotion={reduced} {speedTier} />
			</Container>
		{/each}
		<Container x={ladderSlot.x} y={ladderSlot.y}>
			<RigStage
				{...{ slot: 'ladder' as const }}
				width={ladderSlot.w}
				height={ladderSlot.h}
				scale={fitScale('pf_rescued', ladderSlot.w, ladderSlot.h, S * 1.25)}
				layout={stacked ? 'portrait' : 'desktop'}
				reducedMotion={reduced}
				{speedTier}
				path={{ fromX: slidePath.from.x - ladderSlot.x, fromY: slidePath.from.y - ladderSlot.y, toX: slidePath.to.x - ladderSlot.x, toY: slidePath.to.y - ladderSlot.y }}
			/>
		</Container>
		<Container x={sheetSlot.x} y={sheetSlot.y}>
			<RigStage {...{ slot: 'sheet' as const }} width={sheetSlot.w} height={sheetSlot.h} scale={1} layout={stacked ? 'portrait' : 'desktop'} reducedMotion={reduced} {speedTier} />
		</Container>

		<!-- water jets, splashes, steam and the procedural slide (written from the board ticker) -->
		<Container>
			<Grab ongrab={(node) => (fxNode = node)} />
		</Container>
	{/if}

	{#if stateBackdraftSpins.active}
		<!-- Backdraft Spins header plate above the frame (theme §4: "the 5-spin counter on a brass plate") -->
		<Container x={W / 2} y={frameTop - S * 0.62}>
			{#if tex('rescue_spins_plate')}
				<BaseSprite texture={tex('rescue_spins_plate')} width={S * 3.1} height={plateH(S * 3.1)} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.roundRect(-S * 1.55, -S * 0.55, S * 3.1, S * 1.1, S * 0.1).fill(0xe9b23b).stroke({ width: 4, color: INK })} />
			{/if}
			<Text anchor={0.5} y={-S * 0.2} text={MODE_TITLE.backdraft_spins} style={plateStyle(S * 0.24)} />
			<Text anchor={0.5} y={S * 0.16} text={`${stateBackdraftSpins.spinsLeft} LEFT · ${formatBookAmount(stateBackdraftSpins.total)}`} style={plateStyle(S * 0.2)} />
		</Container>
	{/if}

	<!-- the feature banner ('RESCUED!', '+1 SPIN', 'NEXT BUILDING · +5 SPINS', 'RESCUE SPINS COMPLETE') -->
	<Container x={W / 2} y={H / 2} visible={false}>
		<Grab ongrab={(node) => (bannerNode = node)} />
		{#if stateRescue.banner}
			{#if tex('rescue_spins_plate')}
				<BaseSprite texture={tex('rescue_spins_plate')} width={S * 4.4} height={plateH(S * 4.4)} anchor={0.5} />
			{:else}
				<Graphics draw={(g) => g.roundRect(-S * 2.3, -S * 0.36, S * 4.6, S * 0.72, S * 0.18).fill({ color: 0x1e2a4a, alpha: 0.88 }).stroke({ width: 5, color: 0xff7a1a })} />
			{/if}
			<Text anchor={0.5} text={stateRescue.banner} style={{ ...plateStyle(S * 0.3), wordWrap: true, wordWrapWidth: S * 3.9 }} />
		{/if}
	</Container>
</Container>
