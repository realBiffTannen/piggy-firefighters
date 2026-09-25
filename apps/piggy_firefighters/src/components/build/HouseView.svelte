<script lang="ts">
	// One house per bonus cell. Registers a stable HouseHandle (houseRegistry) that
	// the build director drives; the director never branches on tier or on
	// sprite-vs-Spine. When all five authored Spine house rigs are loaded this
	// renders the Spine body (art-src/animation/runtime-manifest.json →
	// houseInterface); if a rig fails to load it falls back to the flat-sprite
	// <HouseSprite> which registers the SAME handle.
	//
	// The upgrade is a TWO-RIG swap per the manifest: the outgoing tier plays
	// `upgrade_out`; on its `evt_tier_swap` (fully covered by the rig's dust) the
	// incoming tier mounts under the same cover and starts `upgrade_in` on top;
	// the outgoing rig is removed once the incoming rig has been composited in
	// its first posed frame (both draw the identical cloud there), so no frame
	// ever shows the empty lot. Two slots (double-buffer) hold the two skeletons.
	//
	// Sound follows the picture: the per-house cues (build impact, door latch,
	// prize reveal, collect) fire from the rig's own events here, once per event —
	// NOT from fixed director timers (the director stopped firing them). The
	// sprite fallback fires the same cues from its tween milestones.
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { Container, SpineProvider } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../../game/context';
	import { registerHouse } from '../../game/build/houseRegistry';
	import { stateBuild } from '../../game/build/stateBuild.svelte';
	import { audioDirector } from '../../game/build/audioDirector';
	import { dur, prefersReducedMotion } from '../../game/build/buildTiming';
	import type { JackpotKind } from '../../game/typesBookEvent';
	import HouseRig, { type HouseRigApi, type HouseRigLabel } from './HouseRig.svelte';
	import HouseSprite from './HouseSprite.svelte';
	import TierBadge from './TierBadge.svelte';

	type Props = {
		reel: number;
		row: number;
		x: number;
		y: number;
		size: number;
		premium?: boolean;
		/** board index in an EXPANDED round (single-board bonuses: 0) */
		board?: number;
	};
	const { reel, row, x, y, size, premium = false, board = 0 }: Props = $props();

	const context = getContext();
	const reduced = prefersReducedMotion();

	const RIG_KEYS = ['pw_house_straw', 'pw_house_wood', 'pw_house_brick', 'pw_house_mansion', 'pw_house_palace'];
	const rigKey = (t: number) => RIG_KEYS[Math.min(5, Math.max(1, Math.round(t))) - 1];
	const rigsReady = $derived(RIG_KEYS.every((k) => !!context.stateApp.loadedAssets?.[k]));

	const CANVAS_SCALE = size / 1254; // 1 Spine unit = 1 source px; canvas → cell

	const OFF: HouseRigLabel = { text: '', jackpot: null, mode: 'off' };

	// ---- reactive slot state (double-buffer for the tier swap) ------------------
	let slotTiers = $state<[number, number]>([0, 0]); // 0 = unmounted
	let active = $state(0); // index of the currently-shown slot
	let labels = $state<[HouseRigLabel, HouseRigLabel]>([{ ...OFF }, { ...OFF }]);
	const pulse = new Tween(1, { duration: 0, easing: backOut }); // maxed pulse

	const setSlotTier = (slot: number, t: number) => {
		const n = [...slotTiers] as [number, number];
		n[slot] = t;
		slotTiers = n;
	};
	// Every label write bumps its slot's revision, so a delayed completion that
	// captured (slot, revision) can tell whether anything newer has been written.
	const labelRev: [number, number] = [0, 0];
	const setLabel = (slot: number, l: HouseRigLabel) => {
		const n = [...labels] as [HouseRigLabel, HouseRigLabel];
		n[slot] = l;
		labels = n;
		labelRev[slot] += 1;
	};
	// Bumped by every operation that re-seats the slots (appear / upgrade / static),
	// so a swap still waiting on the incoming rig's first paint never clears a slot
	// a newer operation now owns.
	let slotGen = 0;
	/** Upper bound on waiting for the incoming rig's first composited frame. Paint
	 *  normally lands on the next frame (8-33 ms); upgrade_in's shared cloud holds
	 *  through f3 (100 ms), so the fallback still removes the outgoing rig under it. */
	const FIRST_PAINT_GUARD_MS = 100;

	// ---- non-reactive plumbing -------------------------------------------------
	const apis: (HouseRigApi | null)[] = [null, null];
	const slotClip: string[] = ['', ''];
	const apiWaiters: Array<{ slot: number; resolve: () => void }> = [];
	type Waiter = { slot: number; kind: 'event' | 'complete'; key: string; resolve: () => void; done: boolean };
	let waiters: Waiter[] = [];

	const registerSlot = (slot: number, api: HouseRigApi) => {
		apis[slot] = api;
		for (const w of apiWaiters.filter((w) => w.slot === slot)) w.resolve();
		for (let i = apiWaiters.length - 1; i >= 0; i -= 1) if (apiWaiters[i].slot === slot) apiWaiters.splice(i, 1);
		return () => {
			if (apis[slot] === api) apis[slot] = null;
		};
	};

	/** Wait until a slot's rig has mounted + registered (bounded). */
	const awaitApi = (slot: number, ms = 700): Promise<void> => {
		if (apis[slot]) return Promise.resolve();
		return new Promise<void>((res) => {
			apiWaiters.push({ slot, resolve: res });
			setTimeout(res, ms);
		});
	};

	/** Wait for a specific rig event or clip completion on a slot (bounded). */
	const waitFor = (slot: number, kind: 'event' | 'complete', key: string, ms: number): Promise<void> =>
		new Promise<void>((resolve) => {
			const w: Waiter = { slot, kind, key, resolve: () => {}, done: false };
			const fin = () => {
				if (w.done) return;
				w.done = true;
				waiters = waiters.filter((x) => x !== w);
				resolve();
			};
			w.resolve = fin;
			waiters.push(w);
			setTimeout(fin, ms);
		});

	const resolveWaiters = (slot: number, kind: 'event' | 'complete', key: string) => {
		for (const w of waiters.filter((w) => !w.done && w.slot === slot && w.kind === kind && w.key === key)) w.resolve();
	};

	// ---- rig event / completion routing (sound follows the picture) ------------
	const handleRigEvent = (slot: number, name: string, intValue: number) => {
		if (name === 'evt_build_impact') {
			// THE construction accent only: int 1 on appear / int 2 on upgrade_in.
			// The other impacts (roof, chimney/topper) are lighter ticks we do not
			// promote to a full accent (manifest: "do not play three full accents").
			if (intValue === 1 && slotClip[slot] === 'appear') audioDirector.houseAppear(slotTiers[slot]);
			else if (intValue === 2 && slotClip[slot] === 'upgrade_in') audioDirector.houseUpgrade(slotTiers[slot]);
		} else if (name === 'evt_door_latch') {
			audioDirector.doorLatch();
		} else if (name === 'evt_prize_visible') {
			setLabel(slot, { ...labels[slot], mode: 'prize' });
			audioDirector.prizeVisible(slotTiers[slot], labels[slot].jackpot);
		} else if (name === 'evt_collect_start') {
			audioDirector.collect();
		}
		resolveWaiters(slot, 'event', name);
	};

	const handleRigComplete = (slot: number, clip: string) => resolveWaiters(slot, 'complete', clip);

	// ---- the HouseHandle (Spine path) ------------------------------------------
	const appear = async (t: number) => {
		slotGen += 1;
		setSlotTier(1 - active, 0);
		setSlotTier(active, t);
		setLabel(active, { ...OFF });
		await awaitApi(active);
		if (reduced) return apis[active]?.snap('idle');
		slotClip[active] = 'appear';
		apis[active]?.play('appear');
		await waitFor(active, 'complete', 'appear', 1400);
	};

	const upgradeTo = async (t: number) => {
		const gen = ++slotGen;
		if (reduced) {
			setSlotTier(1 - active, 0);
			setSlotTier(active, t); // remount at new tier; setup pose = settled idle
			await awaitApi(active);
			return apis[active]?.snap('idle');
		}
		const old = active;
		const nw = 1 - active;
		slotClip[old] = 'upgrade_out';
		apis[old]?.play('upgrade_out');
		await waitFor(old, 'event', 'evt_tier_swap', 900);
		// swap EXACTLY on evt_tier_swap: mount the booked next tier under the dust,
		// promote it on top, and play upgrade_in from under the same cover.
		setSlotTier(nw, t);
		await awaitApi(nw);
		const incoming = apis[nw];
		if (!incoming) {
			// A bounded mount wait can expire: retain a visible house instead of
			// discarding the only mounted rig.
			setSlotTier(nw, 0);
			apis[old]?.snap('idle');
			return;
		}
		active = nw;
		slotClip[nw] = 'upgrade_in';
		const painted = incoming.painted();
		incoming.play('upgrade_in');
		// The incoming rig now owns the cover, drawn on top. Keep the outgoing rig
		// (same cloud, pixel-identical) until the incoming one has actually reached
		// the screen, then remove it: removing it in this tick left one composited
		// frame with neither rig (the empty lot). It must still go before the
		// incoming clouds part, or a frozen slab would linger behind the new house.
		await Promise.race([painted, waitForTimeout(FIRST_PAINT_GUARD_MS)]);
		if (gen === slotGen && active === nw) setSlotTier(old, 0);
		await waitFor(nw, 'complete', 'upgrade_in', 1200);
	};

	const maxed = async () => {
		if (reduced) return;
		await pulse.set(1.1, { duration: dur(150) });
		await pulse.set(1, { duration: dur(220) });
	};

	const openDoor = async (text: string, jk: JackpotKind) => {
		setLabel(active, { text, jackpot: jk, mode: 'off' });
		await awaitApi(active);
		if (reduced) {
			apis[active]?.snap('door_hold');
			audioDirector.doorLatch();
			setLabel(active, { text, jackpot: jk, mode: 'prize' });
			audioDirector.prizeVisible(slotTiers[active], jk);
			return;
		}
		slotClip[active] = 'door_open';
		apis[active]?.play('door_open');
		// evt_door_latch + evt_prize_visible drive the audio + reveal the label.
		await waitFor(active, 'event', 'evt_prize_visible', 1000);
	};

	/** FULL STREET: the label re-reads as the doubled figure and the house punches (owner, 2026-09-19).
	 *  The label keeps the kind the door revealed (collect only hides it, never
	 *  clears it), so a MINOR / MAJOR / GRAND re-reads on its jackpot plaque. The
	 *  text is the director's booked figure; this write also supersedes any
	 *  collect completion still pending on this slot (revision guard). */
	const bumpPrize = async (text: string) => {
		setLabel(active, { ...labels[active], text, mode: 'prize' });
		if (reduced) return;
		await pulse.set(1.18, { duration: dur(140) });
		await pulse.set(1, { duration: dur(300) });
	};

	const collect = async () => {
		const slot = active; // the slot collected is fixed now, not re-read later
		if (labels[slot].mode === 'off') return; // nothing revealed here
		setLabel(slot, { ...labels[slot], mode: 'collect' });
		const rev = labelRev[slot];
		// Same-round hide: keep text + jackpot kind so a later street bump re-reads
		// on the same plaque. Skip it when anything newer (a bump, a reveal, a
		// reset, a remount) wrote this slot's label meanwhile: buildCoinTrail does
		// not await collect, and under reduced motion this wait outlasts the
		// director's collapsed holds, so a street bump can land first.
		const hide = () => {
			if (labelRev[slot] === rev) setLabel(slot, { ...labels[slot], mode: 'off' });
		};
		if (reduced) {
			audioDirector.collect();
			await waitForTimeout(dur(60));
			hide();
			return;
		}
		slotClip[slot] = 'collect';
		apis[slot]?.play('collect');
		// evt_collect_start fires the cue; the label follows anchor_collect + fades.
		await waitFor(slot, 'complete', 'collect', 700);
		hide();
	};

	const setStatic = (t: number) => {
		slotGen += 1;
		setLabel(0, { ...OFF });
		setLabel(1, { ...OFF });
		if (t < 1) {
			setSlotTier(0, 0);
			setSlotTier(1, 0);
			return;
		}
		setSlotTier(1 - active, 0);
		if (slotTiers[active] === t) apis[active]?.snap('idle');
		else setSlotTier(active, t); // fresh mount → setup pose = settled idle
	};

	// collect is presented off the director's per-door coin-trail beat (the director
	// never calls handle.collect directly), so the collect clip + evt_collect_start
	// stay in sync with the running total. No-op on the fallback path (slots empty).
	context.eventEmitter.subscribeOnMount({
		buildCoinTrail: ({ reel: r, row: rw, board: b }) => {
			if ((b ?? 0) !== board) return;
			if (rigsReady && r === reel && rw === row) void collect();
		},
	});

	onMount(() => {
		if (!rigsReady) return; // <HouseSprite> owns the handle in the fallback path
		// The build site now mounts BEHIND the shutter, possibly after the director
		// has already recorded this cell's tier (skip / resume / stale run): come up
		// in the booked static pose rather than empty.
		const booked = stateBuild.boards[board]?.tiers[`${reel}_${row}`] ?? 0;
		if (booked >= 1 && stateBuild.skip) setStatic(booked);
		return registerHouse(reel, row, { appear, upgradeTo, maxed, openDoor, collect, setStatic, bumpPrize }, board);
	});

	const order = $derived<[number, number]>([1 - active, active]); // active drawn last (on top)
</script>

{#if rigsReady}
	<Container {x} {y} scale={pulse.current}>
		<Container scale={CANVAS_SCALE}>
			{#each order as slot (slot)}
				{#if slotTiers[slot] >= 1}
					<SpineProvider key={rigKey(slotTiers[slot])}>
						<HouseRig
							tier={slotTiers[slot]}
							{premium}
							label={labels[slot]}
							register={(api) => registerSlot(slot, api)}
							onrigevent={(name, intValue) => handleRigEvent(slot, name, intValue)}
							onrigcomplete={(clip) => handleRigComplete(slot, clip)}
						/>
					</SpineProvider>
				{/if}
			{/each}
		</Container>
		<!-- tier medallion: inside the pulse so it punches with the house; reads the ACTIVE slot,
		     so the digit flips exactly when the incoming tier is promoted under the rig's dust -->
		<TierBadge tier={slotTiers[active]} {size} />
	</Container>
{:else}
	<HouseSprite {reel} {row} {x} {y} {size} {premium} {board} />
{/if}
