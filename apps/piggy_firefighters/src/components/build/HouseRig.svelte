<script lang="ts" module>
	// One playing copy of a house Spine rig (straw / wood / brick / mansion /
	// palace). Rendered INSIDE <SpineProvider key="pw_house_<tier>">, so
	// getContextSpine() is the loaded house skeleton. Drives the rig exactly per
	// art-src/animation/runtime-manifest.json (houseInterface):
	//   - track 0 only: appear / upgrade_out / upgrade_in / idle / door_open /
	//     door_hold / collect. No overlays.
	//   - the RUNTIME prize label follows anchor_prize (door_open after
	//     evt_prize_visible, door_hold) then anchor_collect (collect); the rig pops
	//     anchor_prize scale for the label's entrance, and lifts anchor_collect for
	//     its exit — the label copies the bone's world position + scale each frame.
	//   - events are forwarded to HouseView (audio + await resolvers); completion
	//     is forwarded too. HouseView owns tier/jackpot context and the two-rig
	//     upgrade swap; this component owns exactly one skeleton instance.
	//   - reduced motion: hold a static pose, fade in; pooling reset on teardown.
	import type { JackpotKind } from '../../game/typesBookEvent';

	/** Imperative surface HouseView drives this instance through. */
	export type HouseRigApi = {
		/** Play a clip on track 0, queueing the manifest's `next` clip. */
		play: (clip: string) => void;
		/** Snap to a static pose (no motion): 'idle' (settled) or 'door_hold'. */
		snap: (clip: string) => void;
		/** Full pooling reset (clear tracks, setup pose, timeScale 1). */
		reset: () => void;
		/** Resolves after the first app render that drew this skeleton posed by the
		 *  clip last started with play()/snap() (HouseView's two-rig swap keeps the
		 *  outgoing rig until then). Callers bound it with their own timeout. */
		painted: () => Promise<void>;
	};

	export type HouseRigLabel = {
		text: string;
		jackpot: JackpotKind;
		/** off = hidden; prize = follow anchor_prize; collect = follow anchor_collect (fading). */
		mode: 'off' | 'prize' | 'collect';
	};

	const JACKPOT_COLOR: Record<Exclude<JackpotKind, null>, number> = {
		minor: 0x46a6ff,
		major: 0xb476ff,
		grand: 0xffcb3a,
	};
	// anchor_prize sits at the doorway centre in 1254-source-px skeleton units;
	// the label height target is ~0.135 × cell = ~170 source px (manifest).
	// Keep the doorway and its motion visible; entrance and collect still follow
	// the authored anchors. Pull long prizes toward the centre of their own cell.
	const LABEL_PX = 170;
	const LABEL_PULL = 0.55; // 0 = on the doorway, 1 = on the cell centre (x only)
	const JACKPOT_SCALE: Record<Exclude<JackpotKind, null>, number> = { minor: 1.0, major: 1.18, grand: 1.4 };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Text, Graphics, getContextApp, getContextSpine } from 'pixi-svelte';

	import { prefersReducedMotion, isTurbo } from '../../game/build/buildTiming';

	type Props = {
		/** Which house tier this instance is (1..5) — for premium tinting only. */
		tier: number;
		premium?: boolean;
		label: HouseRigLabel;
		register: (api: HouseRigApi) => () => void;
		onrigevent?: (name: string, intValue: number) => void;
		onrigcomplete?: (clip: string) => void;
	};

	const props: Props = $props();
	const spine = getContextSpine();
	const app = getContextApp();
	const reduced = prefersReducedMotion();

	const has = (name: string) => !!spine.skeleton.data.findAnimation(name);

	// ---- mixes (houseInterface.mix) --------------------------------------------
	// default 0; door_open→door_hold and door_hold→collect share poses (mix 0);
	// the returns to idle get a short 0.2 s so the leaves read as closing. Never
	// mix across evt_tier_swap (that is two different rigs — handled by HouseView).
	spine.state.data.defaultMix = 0;
	const setMix = (from: string, to: string, mix: number) => {
		if (has(from) && has(to)) spine.state.data.setMix(from, to, mix);
	};
	setMix('door_hold', 'idle', 0.2);
	setMix('collect', 'idle', 0.2);
	setMix('door_open', 'idle', 0.2);

	// subtle premium warmth on the golden-build skeleton (no bent masonry, just tint)
	if (props.premium) {
		try {
			spine.skeleton.color.set(1, 0.94, 0.72, 1);
		} catch {
			/* older runtime: skip tint */
		}
	}

	// ---- runtime label that follows anchor_prize / anchor_collect --------------
	let label = $state({ x: 0, y: 0, scale: 1, alpha: 0 });

	const syncLabel = () => {
		const mode = props.label.mode;
		if (mode === 'off') {
			if (label.alpha !== 0) label = { ...label, alpha: 0 };
			return;
		}
		const boneName = mode === 'collect' ? 'anchor_collect' : 'anchor_prize';
		const bone = spine.skeleton.findBone(boneName);
		if (!bone) {
			if (label.alpha !== 0) label = { ...label, alpha: 0 };
			return;
		}
		let alpha = 1;
		if (mode === 'collect') {
			// fade the label over ~0.24–0.36 s once collect begins (manifest)
			const entry = spine.state.getCurrent(0);
			if (entry) alpha = 1 - Math.min(1, Math.max(0, (entry.getAnimationTime() - 0.24) / 0.12));
		}
		label = {
			x: bone.worldX,
			y: bone.worldY,
			scale: Math.abs(bone.getWorldScaleX()),
			alpha,
		};
	};

	// ---- first-paint signal ----------------------------------------------------
	// Spine advances on Ticker.shared while the app renders on its own ticker, so
	// a clip started between the two can reach the screen one frame late (the
	// tier-swap empty lot). `posedSincePlay` flips when the skeleton has actually
	// been posed after the latest play/snap; a pre-render tick arms the signal
	// only then, and the post-render tick (after the app's LOW-priority render)
	// resolves the waiters: that composited frame contained the posed rig.
	let posedSincePlay = false;
	let paintArmed = false;
	let paintWaiters: Array<() => void> = [];
	const prevAfterWorld = spine.afterUpdateWorldTransforms;
	spine.afterUpdateWorldTransforms = (s) => {
		posedSincePlay = true;
		prevAfterWorld?.(s);
	};
	const PRE_RENDER = 25; // UPDATE_PRIORITY.HIGH (the app renders at LOW = -25)
	const POST_RENDER = -50; // UPDATE_PRIORITY.UTILITY
	const armPaint = () => {
		paintArmed = paintWaiters.length > 0 && posedSincePlay && !!spine.parent && !spine.destroyed;
	};
	const firePaint = () => {
		if (!paintArmed) return;
		paintArmed = false;
		const w = paintWaiters;
		paintWaiters = [];
		for (const r of w) r();
	};

	// ---- track-0 clip playback (with the manifest's `next` queue) ---------------
	const NEXT: Record<string, string | null> = {
		appear: 'idle',
		upgrade_in: 'idle',
		door_open: 'door_hold',
		door_hold: null, // director/HouseView drives collect explicitly
		collect: 'idle',
		upgrade_out: null, // rig hidden at evt_tier_swap
		idle: null,
	};

	const turboScale = (clip: string): number =>
		isTurbo() && (clip === 'appear' || clip === 'upgrade_in' || clip === 'door_open') ? 1.6 : 1;

	const api: HouseRigApi = {
		play: (clip) => {
			if (!has(clip)) return;
			// Spine 4.2 adds a ticker listener on every true assignment.
			if (!spine.autoUpdate) spine.autoUpdate = true;
			if (reduced) {
				// reduced motion: no dust / no build; jump to the settled/open pose and
				// fade the rig in. Still report completion + the reveal event so audio
				// and HouseView sequencing proceed.
				return api.snap(NEXT[clip] === 'door_hold' || clip === 'door_open' ? 'door_hold' : 'idle');
			}
			posedSincePlay = false;
			paintArmed = false;
			spine.state.timeScale = turboScale(clip);
			spine.state.setAnimation(0, clip, false);
			const next = NEXT[clip];
			if (next && has(next)) spine.state.addAnimation(0, next, false, 0);
			// Pose the clip's frame 0 now (no clip has an event at t=0, so nothing
			// fires early): the next composited frame shows the clip, never the
			// stale/setup pose of a rig that mounted in this same task.
			spine.update(0);
		},
		snap: (clip) => {
			const target = has(clip) ? clip : has('idle') ? 'idle' : clip;
			posedSincePlay = false;
			paintArmed = false;
			spine.state.timeScale = 1;
			spine.state.clearTracks();
			spine.skeleton.setToSetupPose();
			if (has(target)) {
				spine.state.setAnimation(0, target, false);
				spine.update(0);
			} else posedSincePlay = true; // setup pose is the pose
			// keep static cells cheap: stop ticking a settled skeleton
			spine.autoUpdate = false;
		},
		reset: () => {
			try {
				spine.state.clearTracks();
				spine.skeleton.setToSetupPose();
				spine.state.timeScale = 1;
			} catch {
				/* teardown race */
			}
		},
		painted: () => new Promise<void>((resolve) => paintWaiters.push(resolve)),
	};

	spine.state.addListener({
		event: (_entry, event) => {
			props.onrigevent?.(event.data.name, event.intValue ?? 0);
			// reduced motion snaps past door_open, so surface the reveal audio beat
			// via HouseView instead (it fires prizeVisible directly on the snap path).
		},
		complete: (entry) => {
			const name = entry.animation?.name ?? '';
			props.onrigcomplete?.(name);
			// a settled house is static: once it holds idle, stop autoUpdate.
			if (name === 'idle') spine.autoUpdate = false;
		},
	});

	onMount(() => {
		if (!spine.autoUpdate) spine.autoUpdate = true;
		spine.skeleton.setToSetupPose();
		const unregister = props.register(api);
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(syncLabel);
		ticker?.add(armPaint, undefined, PRE_RENDER);
		ticker?.add(firePaint, undefined, POST_RENDER);
		return () => {
			ticker?.remove(syncLabel);
			ticker?.remove(armPaint);
			ticker?.remove(firePaint);
			// never leave a swap waiting on a rig that is gone
			const w = paintWaiters;
			paintWaiters = [];
			for (const r of w) r();
			unregister();
			api.reset();
			spine.state.clearListeners?.();
		};
	});
</script>

{#if props.label.mode !== 'off' && label.alpha > 0.001}
	{@const jk = props.label.jackpot}
	{@const lx = label.x * (1 - LABEL_PULL)}
	{@const ly = label.y + 40}
	{#if jk}
		{@const k = label.scale * JACKPOT_SCALE[jk]}
		<!-- MINOR / MAJOR / GRAND prize plaque, scaled to the prize -->
		<Graphics
			x={lx}
			y={ly}
			scale={k}
			alpha={label.alpha}
			zIndex={20}
			draw={(g) => {
				const w = LABEL_PX * 2.9;
				const h = LABEL_PX * 1.05;
				for (let i = 0; i < 5; i += 1) g.roundRect(-w / 2 - i * 14, -h / 2 - i * 14, w + i * 28, h + i * 28, h * 0.3 + i * 10).fill({ color: JACKPOT_COLOR[jk], alpha: 0.09 });
				g.roundRect(-w / 2 - 16, -h / 2 - 16, w + 32, h + 32, h * 0.34).fill({ color: 0x2a1a0d });
				g.roundRect(-w / 2, -h / 2, w, h, h * 0.28).fill({ color: JACKPOT_COLOR[jk] });
				g.roundRect(-w / 2, -h / 2, w, h * 0.45, h * 0.28).fill({ color: 0xffffff, alpha: 0.22 });
				g.roundRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, h * 0.2).stroke({ width: 10, color: 0xfff6d2, alpha: 0.95 });
			}}
		/>
		<Text
			text={props.label.text}
			anchor={0.5}
			x={lx}
			y={ly}
			scale={k}
			alpha={label.alpha}
			zIndex={21}
			style={{
				fontFamily: 'LuckySign, Arial Black, sans-serif',
				fontSize: LABEL_PX * 0.72,
				fill: 0xffffff,
				stroke: { color: 0x2a1a0d, width: LABEL_PX * 0.13, join: 'round' },
				letterSpacing: 4,
			}}
		/>
	{:else}
		<!-- soft shade so the figure reads against busy thatch / brick -->
		<Graphics
			x={lx}
			y={ly}
			scale={label.scale}
			alpha={label.alpha * 0.85}
			zIndex={19}
			draw={(g) => {
				for (let i = 0; i < 6; i += 1) g.ellipse(0, 0, LABEL_PX * (1.55 - i * 0.2), LABEL_PX * (0.72 - i * 0.09)).fill({ color: 0x120a04, alpha: 0.11 });
			}}
		/>
		<Text
			text={props.label.text}
			anchor={0.5}
			x={lx}
			y={ly}
			scale={label.scale}
			alpha={label.alpha}
			zIndex={20}
			style={{
				fontFamily: 'LuckySign, Arial Black, sans-serif',
				fontSize: LABEL_PX,
				fill: props.tier >= 4 ? 0xffe07a : 0xfff4d6,
				stroke: { color: 0x2a1a0d, width: LABEL_PX * 0.2, join: 'round' },
				dropShadow: { color: 0x7a3d00, alpha: 1, blur: 0, distance: LABEL_PX * 0.07, angle: Math.PI / 2.2 },
			}}
		/>
	{/if}
{/if}
