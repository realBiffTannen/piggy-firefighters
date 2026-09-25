<script lang="ts">
	// THE MASCOTS beside the reels (theme §4: "Chief Hamm stands left of the reels; Ember sits right") — the rig slots
	// `mascotLeft` (pf_chief) and `mascotRight` (pf_dog) of docs/ANIMATION_CONTRACT.md v1.1, mounted for the whole
	// session in the world gutters (desktop / landscape) or on the ground under the frame (stacked layouts). Codex's
	// RigStage draws nothing until an export exists; there is no procedural mascot (the base scene has no mascot
	// picture of its own: the world plate stands alone), so no fallback is gated here.
	//
	// The runtime-owned `sign_hit` plate (contract v1.3): the mascot rig carries no sign; on the decisive contact frame
	// of `point_reels` / `big_win` the rig fires `sign_hit` and THIS component flashes a lettered brass badge (the art
	// lane's blank badge, lettered here) at the chief's `head_top` anchor — "ALARM!", the rung name or "MAX WIN!",
	// whichever beat the chief is acting on. The chief's `spray_on` / `spray_off` also publish his nozzle tip so the
	// Rescue scene can start its water jet from the rig's nozzle instead of the prop nozzle (game/fx/stateRig).
	import { onMount } from 'svelte';
	import { Container, PIXI, getContextApp } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import Grab from './scene/Grab.svelte';
	import RigStage from './rigs/RigStage.svelte';
	import { getContext } from '../game/context';
	import { prefersReducedMotion } from '../game/fx/timing';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { stateRig } from '../game/fx/stateRig.svelte';
	import { stateSpeed } from '../game/stateSpeed.svelte';
	import { winLevelMap } from '../game/winLevelMap';
	import { rungLevelOfTier, type WinTier } from '../game/roundTier';
	import { rescueProp } from '../game/artMeta';
	import type { RigAnimationEvent } from '../game/anim/rigTypes';

	/* eslint-disable @typescript-eslint/no-explicit-any */
	const context = getContext();
	const app = getContextApp();
	const reduced = prefersReducedMotion();
	const speedTier = $derived((stateSpeed.tier === 'super' ? 2 : stateSpeed.tier === 'turbo' ? 1 : 0) as 0 | 1 | 2);

	// ---- slots (main-design units; the scene layout works in screen px and converts) -------------------------------
	const sl = $derived(context.stateGameDerived.sceneLayout());
	const slots = $derived.by(() => {
		const ms = sl.mainScale;
		const cell = sl.cell / ms;
		const frameX = sl.toMainX(sl.frame.x);
		const frameR = sl.toMainX(sl.frame.x + sl.frame.width);
		const frameB = sl.toMainY(sl.frame.y + sl.frame.height);
		const gutter = sl.gutter / ms;
		if (!sl.stacked && gutter > cell * 0.7) {
			// the gutters: the chief right against the left post, Ember against the right post, feet on the frame's foot
			const w = Math.min(gutter * 0.96, cell * 2.1);
			const h = Math.min(cell * 2.7, (sl.frame.height / ms) * 0.95);
			return {
				visible: true,
				layout: 'desktop' as const,
				scale: 1,
				left: { x: frameX - w, y: frameB - h, w, h },
				right: { x: frameR, y: frameB - h, w: Math.min(w, cell * 1.5), h: h * 0.8 },
			};
		}
		// stacked: the ground under the frame (the free band the layout leaves below the board)
		const groundTop = frameB;
		const groundBottom = sl.toMainY(sl.hudTop);
		const h = Math.min(cell * 1.5, (groundBottom - groundTop) * 0.92);
		const w = Math.min(cell * 1.6, sl.canvas.width / ms / 2.4);
		return {
			visible: h > cell * 0.7,
			layout: 'portrait' as const,
			scale: 0.8,
			left: { x: sl.toMainX(sl.canvas.width * 0.04), y: groundBottom - h, w, h },
			right: { x: sl.toMainX(sl.canvas.width * 0.96) - w * 0.8, y: groundBottom - h * 0.85, w: w * 0.8, h: h * 0.85 },
		};
	});

	// ---- what the chief is acting on (for the sign_hit plate's word) ----------------------------------------------------
	let word = 'WILD!';
	context.eventEmitter.subscribeOnMount({
		animBeat: (beat: any) => {
			if (beat.beat === 'alarmLand') word = beat.count >= 3 ? 'ALARM!' : `ALARM ×${beat.count}`;
			else if (beat.beat === 'winTier') {
				const tier = beat.tier as WinTier;
				const level = rungLevelOfTier(tier);
				word = level ? `${winLevelMap[level as keyof typeof winLevelMap]?.text ?? 'WIN'}!` : tier > 0 ? 'NICE!' : word;
			} else if (beat.beat === 'maxWin') word = 'MAX WIN!';
			else if (beat.beat === 'rescueEnter') word = 'MOVE OUT!';
			else if (beat.beat === 'rescue') word = 'NICE SAVE!';
		},
	});

	// ---- the sign_hit plate (imperative, one ticker) --------------------------------------------------------------------
	let plateRoot: PIXI.Container | undefined;
	let plate: PIXI.Container | undefined;
	let plateT = 1;
	const PLATE_MS = 720;
	const badge = rescueProp('badge_blank');

	const showPlate = (global: { x: number; y: number }) => {
		if (!plateRoot) return;
		if (!plate) {
			plate = new PIXI.Container();
			const t = sceneTex('rescue_badge_blank') as PIXI.Texture | undefined;
			if (t) {
				const s = new PIXI.Sprite(t);
				s.anchor.set(0.5);
				s.width = 150;
				s.height = (150 * badge.h) / badge.w;
				plate.addChild(s);
			} else {
				plate.addChild(new PIXI.Graphics().roundRect(-75, -40, 150, 80, 18).fill(0xe9b23b).stroke({ width: 4, color: 0x3b2313 }));
			}
			const label = new PIXI.Text({ text: '', style: { fontFamily: 'StationSign, Lilita One, Inter, sans-serif', fontSize: 30, fill: 0x3b2313, align: 'center', wordWrap: true, wordWrapWidth: 130 } });
			label.anchor.set(0.5);
			label.label = 'word';
			plate.addChild(label);
			plateRoot.addChild(plate);
		}
		const label = plate.getChildByLabel('word') as PIXI.Text | null;
		if (label) label.text = word;
		const local = plateRoot.toLocal(new PIXI.Point(global.x, global.y));
		plate.position.set(local.x, local.y - 60);
		plate.visible = true;
		plateT = 0;
	};

	const tick = (tk: PIXI.Ticker) => {
		if (!plate || plateT >= 1) return;
		plateT = Math.min(1, plateT + Math.min(50, tk.deltaMS) / PLATE_MS);
		const p = plateT;
		const pop = reduced ? 1 : p < 0.25 ? 1.25 - 0.25 * (1 - Math.pow(1 - p / 0.25, 2)) : 1;
		plate.scale.set(pop);
		plate.alpha = p < 0.12 ? p / 0.12 : p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
		plate.rotation = reduced ? 0 : Math.sin(p * Math.PI * 3) * 0.06 * (1 - p);
		if (p >= 1) plate.visible = false;
	};

	// ---- rig events (Spine events, frame-timed, with anchor snapshots in global coordinates) ---------------------------
	const onRigEvent = (event: RigAnimationEvent) => {
		if (event.rig !== 'pf_chief') return;
		if (event.name === 'spray_on') stateRig.nozzleTip = event.anchors.nozzle_tip ?? null;
		else if (event.name === 'spray_off') stateRig.nozzleTip = null;
		else if (event.name === 'sign_hit') {
			const at = event.anchors.head_top ?? event.anchors.grip_r;
			if (at) {
				stateRig.signHit = { seq: stateRig.signHit.seq + 1, x: at.x, y: at.y };
				showPlate(at);
			}
		}
	};
	const onDispose = () => {
		stateRig.nozzleTip = null;
	};

	onMount(() => {
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(tick);
		return () => {
			ticker?.remove(tick);
			plate?.destroy({ children: true });
			plate = undefined;
			stateRig.nozzleTip = null;
		};
	});
</script>

<MainContainer>
	<Container x={slots.left.x} y={slots.left.y} visible={slots.visible}>
		<RigStage {...{ slot: 'mascotLeft' as const }} width={slots.left.w} height={slots.left.h} scale={slots.scale} layout={slots.layout} reducedMotion={reduced} {speedTier} onrigEvent={onRigEvent} ondispose={onDispose} />
	</Container>
	<Container x={slots.right.x} y={slots.right.y} visible={slots.visible}>
		<RigStage {...{ slot: 'mascotRight' as const }} width={slots.right.w} height={slots.right.h} scale={slots.scale} layout={slots.layout} reducedMotion={reduced} {speedTier} />
	</Container>
	<!-- the runtime-owned sign_hit plate, over both slots -->
	<Container>
		<Grab ongrab={(node) => (plateRoot = node)} />
	</Container>
</MainContainer>
