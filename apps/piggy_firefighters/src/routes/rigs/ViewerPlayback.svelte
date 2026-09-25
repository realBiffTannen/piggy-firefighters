<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { PIXI, getContextSpine } from 'pixi-svelte';
  import { RIG_DEFINITIONS, type RigName } from '../../game/anim/rigLogic';
  import { isLoopClip, previewFrame, REFERENCE_HEIGHT, type PreviewMode } from './viewerLogic';
  const props: { app: PIXI.Application; rig: RigName; clip: string; skin: string; speed: number;
    paused: boolean; replay: number; anchors: boolean; mode: PreviewMode; onlog: (text: string) => void } = $props();
  const spine = getContextSpine();
  const guides = new PIXI.Graphics();
  const anchors = new PIXI.Graphics();
  let mounted = $state(false);
  const pending: string[] = [];

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
    spine.update(delta);
    drawAnchors();
    for (const message of pending.splice(0)) props.onlog(message);
  }

  $effect(() => {
    const { clip, skin, replay } = props;
    void replay;
    if (!mounted || spine.destroyed || !spine.skeleton.data.findAnimation(clip)) return;
    untrack(() => {
    pending.length = 0;
    // Each clip review begins from setup; this page does not judge director crossfades.
    spine.state.clearTracks();
    spine.skeleton.setToSetupPose();
    if (skin && spine.skeleton.data.findSkin(skin)) spine.skeleton.setSkinByName(skin);
    spine.skeleton.setSlotsToSetupPose();
    const loop = isLoopClip(clip);
    spine.state.setAnimation(0, clip, loop);
    props.onlog(`PLAY ${clip} · ${skin || 'setup skin'} · ${loop ? 'loop' : 'once'}`);
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
      event: (entry, event) => pending.push(`EVENT ${event.data.name} · ${entry.animation?.name} @ ${event.time.toFixed(3)}s`),
      complete: entry => pending.push(`${entry.loop ? 'LOOP' : 'COMPLETE'} ${entry.animation?.name}`),
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
