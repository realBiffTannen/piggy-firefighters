<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { getContextSpine, getContextApp } from 'pixi-svelte';
  import { subscribeToBeats } from '../../game/anim/beatBus';
  import { registerMountedRig } from '../../game/anim/rigRegistry';
  import { createPlaybackEpoch, defaultLoop, motionTimeScale, planBeat, planLanding, RIG_DEFINITIONS, resolveSkin, type BeatPlan, type EmitterEventAnim, type MotionSettings, type LadderPath } from '../../game/anim/rigLogic';
  import { createFrameQueue, createRescueQueue, snapshotRigRequest, transitionRigClip, landingBus } from '../../game/anim/playbackControl';
  import type { RigActorProps, RigHandle } from '../../game/anim/rigTypes';

  const props: RigActorProps = $props();
  const spine = getContextSpine();
  const app = getContextApp();
  const epoch = createPlaybackEpoch();
  let settings: MotionSettings = { speedTier: 0, reducedMotion: false };
  let active: BeatPlan | null = null;
  let activeEpoch = 0;
  let stepIndex = 0;
  let elapsed = 0;
  let live = false;
  let entry: ReturnType<typeof spine.state.setAnimation> | null = null;
  let release: (() => void) | undefined;
  let spraying = false;
  const pendingRescues = createRescueQueue();
  let activePath = props.path;
  let resetPose = true;
  let arrivalPending = false;
  const frameQueue = createFrameQueue(epoch.isCurrent);

  function updatePose(delta: number) {
    const updatedEpoch = activeEpoch;
    spine.update(delta);
    // Events snapshot the pose which fired them, before completion advances clips.
    const arrived = arrivalPending;
    arrivalPending = false;
    frameQueue.flush();
    if (arrived && epoch.isCurrent(updatedEpoch)) landingBus.publish();
  }

  function emitRigEvent(name: string) {
    if (name === 'spray_on') spraying = true;
    if (name === 'spray_off') spraying = false;
    const anchors: Record<string, { x: number; y: number }> = {};
    for (const anchor of RIG_DEFINITIONS[props.rig].anchors) {
      const point = getBoneWorldPosition(anchor);
      if (point) anchors[anchor] = point;
    }
    try { props.onrigEvent?.({ rig: props.rig, slot: props.slot, index: props.index ?? 0, name, anchors }); }
    catch (error) { console.warn('Rig FX callback failed', error); }
  }

  function getBoneWorldPosition(name: string) {
    if (!live || spine.destroyed) return null;
    const bone = spine.skeleton.findBone(name);
    if (!bone) return null;
    const point = spine.toGlobal({ x: bone.worldX, y: bone.worldY });
    return { x: point.x, y: point.y };
  }
  const handle: RigHandle = { rig: props.rig, getBoneWorldPosition };

  function startStep() {
    const step = active?.steps[stepIndex];
    if (!step || !epoch.isCurrent(activeEpoch)) return;
    elapsed = 0;
    // Filter actual export durations too; Super Turbo never starts a >400ms clip.
    const clip = spine.skeleton.data.findAnimation(step.animation);
    const name = settings.speedTier === 2 && !step.loop && (clip?.duration ?? 0) > 0.4
      ? defaultLoop(props.rig, props.slot) : step.animation;
    entry = transitionRigClip(spine, name, step.loop || name !== step.animation, resetPose);
    resetPose = false;
    if (name === 'land' && active?.travel) arrivalPending = true;
    if (name === 'slide' && activePath && active?.travel) spine.position.set(activePath.fromX, activePath.fromY);
    if (name === 'land' && activePath) spine.position.set(activePath.toX, activePath.toY);
    // A ladder actor is present only while it traverses and lands; it must not
    // leave a wave_window pose at the sheet, duplicating the next rescued pig.
    if (props.slot === 'ladder' && step.loop && !step.holdSeconds) {
      const next = pendingRescues.shift();
      if (next) play(next.plan, next.path);
      else spine.visible = false;
    }
  }
  function play(plan: BeatPlan, path?: LadderPath) {
    if (!live || spine.destroyed) return;
    if (spraying) emitRigEvent('spray_off');
    activeEpoch = epoch.begin();
    frameQueue.clear();
    arrivalPending = false;
    const snapshot = snapshotRigRequest(plan, path);
    activePath = snapshot.path;
    active = snapshot.plan;
    stepIndex = 0;
    resetPose = !entry || settings.reducedMotion;
    if (plan.skin && props.rig === 'pf_rescued') {
      spine.skeleton.setSkinByName(plan.skin);
      spine.skeleton.setSlotsToSetupPose();
    }
    if (plan.visible !== undefined) spine.visible = plan.visible;
    spine.position.set(props.x ?? 0, props.y ?? 0);
    startStep();
    updatePose(0);
  }
  function handleBeat(event: EmitterEventAnim) {
    if (event.beat === 'spinStart') settings = { ...settings, speedTier: event.speedTier };
    if (event.beat === 'speedTier') settings = { ...settings, speedTier: event.tier };
    if (event.beat === 'reducedMotion') settings = { ...settings, reducedMotion: event.on };
    spine.state.timeScale = motionTimeScale(settings);
    const plan = planBeat(props.rig, props.slot, event, settings, props.index ?? 0);
    if (!plan) return;
    if (props.slot === 'ladder' && event.beat === 'rescue' && active?.travel && !active.steps[stepIndex]?.loop) {
      // One douse can save several rooms. Preserve every local performance without
      // returning a promise to, or delaying, the game director. Spin/exit cancels all.
      pendingRescues.push(plan, props.path);
      return;
    }
    pendingRescues.clear();
    play(plan, props.path);
  }
  subscribeToBeats(handleBeat);

  $effect(() => {
    const scale = props.scale ?? 1;
    spine.scale.set(scale);
    spine.position.set(props.x ?? 0, props.y ?? 0);
  });
  $effect(() => {
    const nextSettings: MotionSettings = { speedTier: props.speedTier ?? 0, reducedMotion: props.reducedMotion ?? false };
    // Playback reads layout/path props; those must not become settings dependencies.
    untrack(() => {
      settings = nextSettings;
      spine.state.timeScale = motionTimeScale(settings);
      if (live) {
        pendingRescues.clear();
        play({ steps: [{ animation: defaultLoop(props.rig, props.slot), loop: true }] });
      }
    });
  });

  onMount(() => {
    const ticker = app.stateApp.pixiApplication?.ticker;
    if (!ticker) return;
    live = true;
    spine.autoUpdate = false;
    spine.state.data.defaultMix = 0.15;
    if (props.rig === 'pf_chief') spine.state.data.setMix('spray_start','spray_loop',0);
    if (props.rig === 'pf_rescued') {
      spine.state.data.setMix('slide','land',0);
      spine.skeleton.setSkinByName(resolveSkin(props.skin, props.index));
      spine.skeleton.setSlotsToSetupPose();
    }
    const listener: Parameters<typeof spine.state.addListener>[0] = {
      complete: completed => {
        if (completed !== entry || !epoch.isCurrent(activeEpoch)) return;
        const step = active?.steps[stepIndex];
        if (!step?.loop) frameQueue.defer(activeEpoch, () => {
          if (completed !== entry) return;
          stepIndex++;
          startStep();
        });
      },
      event: (eventEntry, event) => {
        if (eventEntry !== entry || !epoch.isCurrent(activeEpoch)) return;
        frameQueue.defer(activeEpoch, () => emitRigEvent(event.data.name));
      },
    };
    spine.state.addListener(listener);
    const unsubscribeLanding = landingBus.subscribe(() => {
      if (!live || spine.destroyed || props.slot !== 'sheet') return;
      const plan = planLanding(props.rig, settings);
      if (plan) play(plan);
    });
    play({ steps: [{ animation: defaultLoop(props.rig, props.slot), loop: true }], visible: props.slot !== 'ladder' && props.slot !== 'winPlate' });
    const tick: Parameters<typeof ticker.add>[0] = frame => {
      if (!live || spine.destroyed || !epoch.isCurrent(activeEpoch)) return;
      const delta = Math.min(frame.deltaMS / 1000, 0.1);
      elapsed += delta * motionTimeScale(settings);
      const step = active?.steps[stepIndex];
      if (step?.animation === 'slide' && active?.travel && activePath && entry) {
        const t = Math.min(1, elapsed / Math.max(entry.animation?.duration ?? 1.2, 0.001));
        const eased = t * t * (3 - 2 * t);
        spine.position.set(activePath.fromX + (activePath.toX - activePath.fromX) * eased, activePath.fromY + (activePath.toY - activePath.fromY) * eased);
      }
      updatePose(settings.reducedMotion ? 0 : delta);
      if (step?.holdSeconds && elapsed >= step.holdSeconds) { stepIndex++; startStep(); }
    };
    ticker.add(tick);
    release = registerMountedRig(props.rig);
    try { props.onready?.(handle); }
    catch (error) { console.warn('Rig ready callback failed', error); }
    return () => {
      if (spraying) emitRigEvent('spray_off');
      live = false;
      pendingRescues.clear();
      frameQueue.clear();
      unsubscribeLanding();
      epoch.dispose();
      ticker.remove(tick);
      if (!spine.destroyed) {
        spine.state.removeListener(listener);
        spine.state.clearTracks();
      }
      release?.();
      // BaseSpineProvider owns display-object destruction and shared atlas data.
      try { props.ondispose?.(props.rig, props.index ?? 0); }
      catch (error) { console.warn('Rig dispose callback failed', error); }
    };
  });
</script>
