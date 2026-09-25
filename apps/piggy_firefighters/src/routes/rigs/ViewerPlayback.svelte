<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { PIXI, getContextSpine } from 'pixi-svelte';
  import { RIG_DEFINITIONS, type RigName } from '../../game/anim/rigLogic';
  import { transitionRigClip } from '../../game/anim/playbackControl';
  import { isLoopClip, previewFrame, REFERENCE_HEIGHT, type PreviewMode } from './viewerLogic';
  const props: { app: PIXI.Application; rig: RigName; clip: string; skin: string; speed: number;
    paused: boolean; replay: number; spraySequence: boolean; anchors: boolean; mode: PreviewMode; onlog: (text: string) => void } = $props();
  const spine = getContextSpine();
  const guides = new PIXI.Graphics();
  const anchors = new PIXI.Graphics();
  let mounted = $state(false);
  const pending: string[] = [];
  let entry: ReturnType<typeof spine.state.setAnimation> | null = null;
  let phase: 'start' | 'loop' | 'end' | 'done' | null = null;
  let phaseElapsed = 0;
  let completed = false;

  function playClip(name: string, loop: boolean) {
    phaseElapsed = 0;
    completed = false;
    entry = transitionRigClip(spine, name, loop);
    props.onlog(`PLAY ${name} · ${props.skin || 'setup skin'} · ${loop ? 'loop' : 'once'}`);
  }

  function drawAnchors() {
    anchors.clear();
    if (!props.anchors) return;
    for (const name of RIG_DEFINITIONS[props.rig].anchors) {
      const bone = spine.skeleton.findBone(name);
      if (!bone) continue;
      const point = spine.toGlobal({ x: bone.worldX, y: bone.worldY });
      anchors.circle(point.x, point.y, 4).stroke({ color: 0x79f2e6, width: 1.5 });
      anchors.moveTo(point.x - 8, point.y).lineTo(point.x + 8, point.y);
      anchors.moveTo(point.x, point.y - 8).lineTo(point.x, point.y + 8).stroke({ color: 0x79f2e6, width: 1 });
    }
  }
  function update(delta: number) {
    phaseElapsed += delta;
    spine.update(delta);
    drawAnchors();
    for (const message of pending.splice(0)) props.onlog(message);
    // Match RigPlayback: advance only after the current frame applied its pose/events.
    // The loop hold uses animation seconds and the same capped ticker as gameplay.
    if (phase === 'start' && completed) {
      phase = 'loop';
      playClip('spray_loop', true);
    } else if (phase === 'loop' && phaseElapsed >= 0.8) {
      props.onlog(`SEQUENCE HOLD spray_loop @ ${(entry?.trackTime ?? 0).toFixed(3)}s`);
      phase = 'end';
      playClip('spray_end', false);
    } else if (phase === 'end' && completed) {
      phase = 'done';
      props.onlog('SEQUENCE COMPLETE chief_spray');
    }
  }

  $effect(() => {
    const { clip, skin, replay, spraySequence } = props;
    void replay;
    if (!mounted || spine.destroyed || !spine.skeleton.data.findAnimation(clip)) return;
    untrack(() => {
    pending.length = 0;
    phase = null;
    // Independent clips begin from setup. The explicit spray sequence retains
    // outgoing entries between its three steps to exercise the runtime mixes.
    spine.state.clearTracks();
    spine.skeleton.setToSetupPose();
    if (skin && spine.skeleton.data.findSkin(skin)) spine.skeleton.setSkinByName(skin);
    spine.skeleton.setSlotsToSetupPose();
    const sequenceReady = spraySequence && props.rig === 'pf_chief'
      && ['spray_start', 'spray_loop', 'spray_end'].every(name => spine.skeleton.data.findAnimation(name));
    spine.state.data.defaultMix = sequenceReady ? 0.15 : 0;
    if (props.rig === 'pf_chief' && spine.skeleton.data.findAnimation('spray_start') && spine.skeleton.data.findAnimation('spray_loop'))
      spine.state.data.setMix('spray_start', 'spray_loop', 0);
    if (sequenceReady) {
      phase = 'start';
      props.onlog('SEQUENCE START chief_spray · loop hold 0.8 animation seconds · mixes 0/0.15s');
      playClip('spray_start', false);
    } else playClip(clip, isLoopClip(clip));
    update(0);
    });
  });
  $effect(() => {
    if (!mounted) return;
    const frame = previewFrame(props.mode);
    const height = REFERENCE_HEIGHT[props.rig];
    untrack(() => {
    props.app.renderer.resize(frame.width, frame.height);
    const feetY = frame.height - 64;
    spine.position.set(frame.width / 2, feetY);
    spine.scale.set(frame.scale);
    const top = feetY - height * frame.scale;
    const rulerX = frame.width / 2 - 110 * frame.scale;
    guides.clear();
    guides.moveTo(24, feetY).lineTo(frame.width - 24, feetY).stroke({ color: 0x739099, width: 1, alpha: 0.55 });
    guides.moveTo(rulerX, top).lineTo(rulerX, feetY).stroke({ color: 0xe6bb79, width: 1, alpha: 0.7 });
    for (const y of [top, feetY]) guides.moveTo(rulerX - 6, y).lineTo(rulerX + 6, y).stroke({ color: 0xe6bb79, width: 1 });
    guides.moveTo(frame.width / 2, feetY - 8).lineTo(frame.width / 2, feetY + 8).stroke({ color: 0xffffff, width: 1 });
    update(0);
    });
  });
  $effect(() => { if (mounted) { void props.anchors; untrack(drawAnchors); } });

  onMount(() => {
    spine.autoUpdate = false;
    spine.state.data.defaultMix = 0;
    guides.zIndex = -1;
    anchors.zIndex = 1;
    props.app.stage.addChildAt(guides, 0);
    props.app.stage.addChild(anchors);
    const listener: Parameters<typeof spine.state.addListener>[0] = {
      event: (current, event) => {
        if (current === entry) pending.push(`EVENT ${event.data.name} · ${current.animation?.name} @ ${event.time.toFixed(3)}s`);
      },
      complete: current => {
        if (current !== entry) return;
        completed = true;
        pending.push(`${current.loop ? 'LOOP' : 'COMPLETE'} ${current.animation?.name}`);
      },
    };
    spine.state.addListener(listener);
    const tick: Parameters<typeof props.app.ticker.add>[0] = frame => {
      if (spine.destroyed) return;
      if (!props.paused) update(Math.min(frame.deltaMS / 1000, 0.1) * props.speed);
    };
    props.app.ticker.add(tick);
    mounted = true;
    return () => {
      mounted = false;
      props.app.ticker.remove(tick);
      pending.length = 0;
      if (!spine.destroyed) spine.state.removeListener(listener);
      guides.destroy();
      anchors.destroy();
    };
  });
</script>
