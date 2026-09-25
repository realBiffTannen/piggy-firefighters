<script lang="ts">
	// One playing copy of the SHIPPED rig. Must be rendered inside <SpineProvider>.
	// Also demonstrates the integration contract: a RUNTIME text prize that follows anchor_prize
	// (door_open after evt_prize_visible, door_hold) and anchor_collect (collect).
	import { onMount } from 'svelte';
	import { Text, getContextApp, getContextSpine } from 'pixi-svelte';

	import type { RigApi, RigIndexEntry } from './types';

	type Props = {
		rig: RigIndexEntry;
		prizeText: string;
		labelSize?: number;
		register: (api: RigApi) => () => void;
		onevent?: (line: { clip: string; name: string; trackTime: number; wallMs: number; detail: string }) => void;
		onclip?: (clip: string) => void;
	};

	const props: Props = $props();
	const spine = getContextSpine();
	const app = getContextApp();

	let mode: 'off' | 'prize' | 'collect' = 'off';
	let clipStartedAt = performance.now();
	let label = $state({ x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 0 });

	spine.state.data.defaultMix = 0;
	for (const from of ['door_hold', 'collect', 'door_open']) {
		if (spine.skeleton.data.findAnimation(from) && spine.skeleton.data.findAnimation('idle'))
			spine.state.data.setMix(from, 'idle', 0.2);
	}

	const syncLabel = () => {
		const entry = spine.state.getCurrent(0);
		const boneName = mode === 'collect' ? props.rig.anchors?.collect : props.rig.anchors?.prize;
		const bone = boneName ? spine.skeleton.findBone(boneName) : null;
		if (!bone || mode === 'off') {
			if (label.alpha !== 0) label = { ...label, alpha: 0 };
			return;
		}
		let alpha = 1;
		if (mode === 'collect' && entry) alpha = 1 - Math.min(1, Math.max(0, (entry.getAnimationTime() - 0.24) / 0.12));
		label = {
			x: bone.worldX,
			y: bone.worldY,
			scaleX: Math.abs(bone.getWorldScaleX()),
			scaleY: Math.abs(bone.getWorldScaleY()),
			alpha,
		};
	};

	spine.state.addListener({
		start: (entry) => {
			const clip = entry.animation?.name ?? '';
			clipStartedAt = performance.now();
			mode = clip === 'door_hold' ? 'prize' : clip === 'collect' ? 'collect' : 'off';
			props.onclip?.(clip);
		},
		event: (entry, event) => {
			if (event.data.name === 'evt_prize_visible') mode = 'prize';
			props.onevent?.({
				clip: entry.animation?.name ?? '',
				name: event.data.name,
				trackTime: event.time,
				wallMs: performance.now() - clipStartedAt,
				detail: [event.intValue ? `int=${event.intValue}` : '', event.floatValue ? `float=${event.floatValue}` : '', event.stringValue ?? '']
					.filter(Boolean)
					.join(' '),
			});
		},
		complete: (entry) => {
			if (entry.animation?.name === 'collect') mode = 'off';
		},
	});

	// overlay clips (blink) live on their own track and only touch the slots/bones documented in the rig guide
	let overlayTimer: ReturnType<typeof setTimeout> | undefined;
	const scheduleOverlays = () => {
		clearTimeout(overlayTimer);
		const overlay = props.rig.overlays?.[0];
		if (!overlay) return;
		const wait = overlay.minGap + Math.random() * (overlay.maxGap - overlay.minGap);
		overlayTimer = setTimeout(() => {
			if (spine.autoUpdate) {
				spine.state.setAnimation(overlay.track, overlay.clip, false);
				spine.state.addEmptyAnimation(overlay.track, 0, 0);
			}
			scheduleOverlays();
		}, (wait * 1000) / Math.max(0.1, spine.state.timeScale));
	};

	// eye-line blend poses (mascot: look_l / look_r) on track 2, additive, alpha = amount. 3 = spine-core MixBlend.add.
	let lookAmount = 0;
	const applyLook = () => {
		const name = lookAmount < 0 ? 'look_l' : 'look_r';
		if (!spine.skeleton.data.findAnimation(name)) return;
		if (Math.abs(lookAmount) < 0.01) {
			if (spine.state.getCurrent(2)) spine.state.setEmptyAnimation(2, 0.12);
			return;
		}
		const current = spine.state.getCurrent(2);
		const entry = current?.animation?.name === name ? current : spine.state.setAnimation(2, name, true);
		entry.mixBlend = 3;
		entry.alpha = Math.min(1, Math.abs(lookAmount));
	};

	const api: RigApi = {
		look: (amount) => {
			lookAmount = amount;
			applyLook();
		},
		play: (clip, loop = false) => {
			// Replaying or adding an overlay must not register another ticker.
			if (!spine.autoUpdate) spine.autoUpdate = true;
			const overlay = props.rig.overlays?.find((entry) => entry.clip === clip);
			if (overlay) {
				// an overlay button plays ON TOP of whatever track 0 is doing
				spine.state.setAnimation(overlay.track, clip, false);
				spine.state.addEmptyAnimation(overlay.track, 0, 0);
				return;
			}
			spine.state.setAnimation(0, clip, loop);
			scheduleOverlays();
		},
		measure: () => {
			// per clip: hand-to-grip gap (counted only while that grip's constraint is fully on, so a deliberately released hand is not a
			// failure), IK stretch split into arms and legs, and how far any bone origin rises above / leaves the source canvas sideways.
			const result: Record<string, { maxGap: number; maxStretch: number; maxStretchArm: number; maxStretchLeg: number; released: boolean; armFrame: number; armBone: string }> = {};
			const wasAuto = spine.autoUpdate;
			for (const clip of props.rig.clips) {
				let maxGap = 0;
				let arm = 1;
				let leg = 1;
				let released = false;
				let armFrame = 0;
				let armBone = '';
				for (let frame = 0; frame <= Math.round(clip.duration * 30); frame++) {
					api.seek(clip.name, frame / 30);
					for (const check of props.rig.attachChecks ?? []) {
						const a = spine.skeleton.findBone(check.bone);
						const b = spine.skeleton.findBone(check.target);
						const constraint = check.constraint ? spine.skeleton.findTransformConstraint(check.constraint) : null;
						if (constraint && constraint.mixX < 0.999) {
							released = true;
							continue;
						}
						if (a && b) maxGap = Math.max(maxGap, Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY));
					}
					for (const constraint of spine.skeleton.ikConstraints)
						for (const bone of constraint.bones) {
							if (constraint.data.name.includes('leg')) leg = Math.max(leg, Math.abs(bone.ascaleX));
							else if (Math.abs(bone.ascaleX) > arm) {
								arm = Math.abs(bone.ascaleX);
								armFrame = frame;
								armBone = bone.data.name;
							}
						}
				}
				result[clip.name] = {
					maxGap: Number(maxGap.toFixed(3)),
					maxStretch: Number(Math.max(arm, leg).toFixed(4)),
					maxStretchArm: Number(arm.toFixed(4)),
					maxStretchLeg: Number(leg.toFixed(4)),
					released,
					armFrame,
					armBone,
				};
			}
			spine.autoUpdate = wasAuto;
			return result;
		},
		queue: (clip, loop = false) => {
			spine.state.addAnimation(0, clip, loop, 0);
		},
		seek: (clip, time) => {
			spine.autoUpdate = false;
			spine.state.clearTracks();
			spine.skeleton.setToSetupPose();
			mode = 'off';
			spine.state.setAnimation(0, clip, false);
			applyLook();
			spine.update(0);
			spine.update(time);
			syncLabel();
		},
		setSpeed: (speed) => {
			spine.state.timeScale = speed;
		},
	};

	onMount(() => {
		const unregister = props.register(api);
		const ticker = app.stateApp.pixiApplication?.ticker;
		ticker?.add(syncLabel);
		return () => {
			ticker?.remove(syncLabel);
			clearTimeout(overlayTimer);
			unregister();
		};
	});
</script>

<Text
	text={props.prizeText}
	anchor={0.5}
	x={label.x}
	y={label.y}
	scale={{ x: label.scaleX, y: label.scaleY }}
	alpha={label.alpha}
	zIndex={10}
	style={{
		fontFamily: 'Arial Black, Arial, sans-serif',
		fontWeight: '900',
		fontSize: props.labelSize ?? 170,
		fill: 0xffffff,
		stroke: { color: 0x2a1206, width: (props.labelSize ?? 170) * 0.19, join: 'round' },
	}}
/>
