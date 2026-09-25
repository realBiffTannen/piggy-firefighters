<script lang="ts" module>
	/**
	 * Imperative handle for the feature-entry VFX rig (`fx_transition`).
	 * Every method is safe to call at any time, on any path, and never throws.
	 */
	export type TransitionFxHandle = {
		/** Light rays behind the mode card. Loops until `stop()`. */
		rays: () => void;
		/**
		 * The rays pull in and dim UNDER the sign as the press lands, ending
		 * invisible at the blast's impact. Fire-and-forget: it hides itself when the
		 * clip completes or its wall-clock bound expires, and never blocks anything.
		 */
		vacuum: (timeScale: number) => void;
		/**
		 * The dust-blast reveal. `timeScale` > 1 plays faster (turbo / skip).
		 * `onImpact` fires at the rig's `impact` event (or never, if Spine is
		 * unavailable). The promise ALWAYS resolves: on the clip's `complete`, or on
		 * a wall-clock timer sized to the clip, whichever comes first. Callers must
		 * not depend on it for correctness: it is decoration over the door timeline.
		 */
		blast: (timeScale: number, onImpact?: () => void) => Promise<void>;
		/** Clear tracks, hide everything, stop updating. Idempotent. */
		stop: () => void;
		/** Seconds the blast clip runs at timeScale 1 (0 if the rig is unusable). */
		readonly blastSeconds: number;
		/** Time of the `white` event in the blast clip at timeScale 1. */
		readonly whiteAt: number;
	};
</script>

<script lang="ts">
	/* eslint-disable @typescript-eslint/no-explicit-any */
	// EFFECTS ONLY: there is no character in this rig. It is mounted inside a
	// <SpineProvider key="fx_transition">, so getContextSpine() is the loaded
	// skeleton. Hardening follows the stuck-bonus post-mortem (Pixi 8 destroy()
	// nulls a node's transforms; a throw inside a frame or listener callback must
	// never reach a director's await):
	//   - every Spine call sits in try/catch and degrades to "do nothing";
	//   - listeners are wrapped, and a destroyed instance turns every method inert;
	//   - blast() resolves on a timer regardless of Spine, so nothing can hang on it;
	//   - autoUpdate is off whenever nothing is playing (no idle per-frame cost).
	import { onMount } from 'svelte';
	import { getContextSpine } from 'pixi-svelte';

	type Props = { onready?: (handle: TransitionFxHandle) => void };
	const props: Props = $props();
	const spine = getContextSpine();

	let dead = false;
	let playing = 0; // token: a newer blast()/rays()/stop() supersedes an older blast

	const usable = () => !dead && !!spine && !(spine as any).destroyed;
	const guard = <T,>(fn: () => T, fallback: T): T => {
		if (!usable()) return fallback;
		try {
			return fn();
		} catch (err) {
			if (import.meta.env?.DEV) console.warn('[TransitionFx] ignored', err);
			return fallback;
		}
	};

	const clip = (name: string) => guard(() => spine.skeleton.data.findAnimation(name), null);
	// The reveal clip: `blast_effect` is the hand-edited take (the FX project's edited take);
	// `blast` is the original seed and stays as the fallback for an older export.
	const BLAST_CLIP = clip('blast_effect') ? 'blast_effect' : 'blast';
	const blastSeconds = clip(BLAST_CLIP)?.duration ?? 0;
	const whiteAt = guard(() => {
		const a = spine.skeleton.data.findAnimation(BLAST_CLIP);
		for (const tl of (a?.timelines ?? []) as any[]) {
			for (const ev of (tl?.events ?? []) as any[]) if (ev?.data?.name === 'white') return ev.time as number;
		}
		return blastSeconds * 0.7;
	}, 0);

	const hideAll = () =>
		guard(() => {
			spine.state.clearTracks();
			spine.skeleton.setToSetupPose(); // setup pose has every slot at alpha 0
			spine.update(0);
			spine.autoUpdate = false;
			spine.visible = false;
		}, undefined);

	let onImpactNow: (() => void) | null = null;
	guard(() => {
		spine.state.data.defaultMix = 0;
		spine.state.addListener({
			event: (_entry: unknown, event: any) => {
				try {
					if (event?.data?.name === 'impact') {
						const cb = onImpactNow;
						onImpactNow = null;
						cb?.();
					}
				} catch (err) {
					if (import.meta.env?.DEV) console.warn('[TransitionFx] listener ignored', err);
				}
			},
		});
	}, undefined);

	const handle: TransitionFxHandle = {
		blastSeconds,
		whiteAt,
		rays: () => {
			playing += 1;
			guard(() => {
				// `card_rays` has no spark timelines: the card already has its own glints
				if (!clip('card_rays')) return;
				spine.visible = true;
				spine.autoUpdate = true;
				spine.state.timeScale = 1;
				spine.skeleton.setToSetupPose();
				spine.state.setAnimation(0, 'card_rays', true);
			}, undefined);
		},
		vacuum: (timeScale) => {
			const mine = (playing += 1);
			const scale = Math.max(0.25, Math.min(6, timeScale || 1));
			const seconds = clip('card_vacuum')?.duration ?? 0;
			const end = () => {
				if (mine === playing) hideAll(); // a newer rays()/stop() owns the rig: leave it alone
			};
			const started = guard(() => {
				if (!seconds) return false;
				spine.visible = true;
				spine.autoUpdate = true;
				spine.state.timeScale = scale;
				const entry = spine.state.setAnimation(0, 'card_vacuum', false);
				entry.listener = { complete: () => end() } as any;
				return true;
			}, false);
			if (!started) return end();
			setTimeout(end, (seconds / scale) * 1000 + 200);
		},
		blast: (timeScale, onImpact) =>
			new Promise<void>((resolve) => {
				const mine = (playing += 1);
				const scale = Math.max(0.25, Math.min(6, timeScale || 1));
				let done = false;
				const finish = () => {
					if (done) return;
					done = true;
					clearTimeout(timer);
					if (mine === playing) hideAll(); // a newer run owns the rig: leave it alone
					resolve();
				};
				// wall-clock bound: clip length at this speed + margin. Fires even if
				// the ticker is starved or Spine never reports `complete`.
				const timer = setTimeout(finish, Math.max(200, (blastSeconds / scale) * 1000 + 250));
				const started = guard(() => {
					if (!clip(BLAST_CLIP)) return false;
					onImpactNow = onImpact ?? null;
					spine.visible = true;
					spine.autoUpdate = true;
					spine.state.timeScale = scale;
					const entry = spine.state.setAnimation(0, BLAST_CLIP, false);
					entry.listener = { complete: () => finish() } as any;
					return true;
				}, false);
				if (!started) finish();
			}),
		stop: () => {
			playing += 1;
			onImpactNow = null;
			hideAll();
		},
	};

	onMount(() => {
		hideAll();
		guard(() => (spine as any).once?.('destroyed', () => (dead = true)), undefined);
		props.onready?.(handle);
		return () => {
			dead = true;
			onImpactNow = null;
		};
	});
</script>
