<script lang="ts">
  import { onMount } from 'svelte';
  import { PIXI, createApp, setContextApp, type LoadedSpine, type RawSpine } from 'pixi-svelte';
  // Reuse the workspace's Spine 4.2 parser without adding a second runtime dependency.
  import { getProcessed } from '../../../../../packages/pixi-svelte/src/lib/assetLoad';
  import { rigAssets, rigSources } from '../../game/anim/rigRegistry';
  import { isUsableRigData, type RigName } from '../../game/anim/rigLogic';
  import { previewFrame, type PreviewMode, type RigInfo } from './viewerLogic';
  import ViewerScene from './ViewerScene.svelte';

  const props: {
    rig: RigName; clip: string; skin: string; speed: number; paused: boolean;
    replay: number; anchors: boolean; mode: PreviewMode;
    onready: (info: RigInfo) => void; onlog: (text: string) => void;
  } = $props();
  const context = createApp({ assets: {} });
  setContextApp(context);
  const frame = $derived(previewFrame(props.mode));
  let host: HTMLDivElement;
  let data = $state<LoadedSpine>();
  let error = $state('');
  let ready = $state(false);

  onMount(() => {
    let disposed = false;
    let initialized = false;
    let destroyed = false;
    const app = new PIXI.Application();
    const destroy = () => {
      if (!initialized || destroyed) return;
      destroyed = true;
      app.destroy(true, { children: true, texture: false, textureSource: false });
    };
    void (async () => {
      try {
        // Do not probe guessed paths, even if called with a stale selection.
        if (!(props.rig in rigAssets)) throw new Error('BLOCKED: original export files are missing.');
        await app.init({ width: frame.width, height: frame.height, backgroundAlpha: 0,
          preference: 'webgl', antialias: true, autoDensity: true,
          resolution: Math.min(2, Math.max(1, window.devicePixelRatio || 1)) });
        initialized = true;
        if (disposed) { destroy(); return; }
        context.stateApp.pixiApplication = app;
        app.canvas.setAttribute('aria-label', `${props.rig} animation preview`);
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.display = 'block';
        app.canvas.style.touchAction = 'auto';
        app.renderer.events.autoPreventDefault = false;
        host.appendChild(app.canvas);
        const src = { skeleton: rigSources[props.rig].json, atlas: rigSources[props.rig].atlas };
        const rawAsset = await PIXI.Assets.load<RawSpine[string]>([src.skeleton, src.atlas]);
        if (disposed) return;
        const parsed = getProcessed({ key: props.rig, type: 'spine', src, rawAsset })?.[props.rig];
        if (!isUsableRigData(props.rig, parsed)) throw new Error('FAIL: exported rig does not satisfy the runtime clip, skin, event, anchor, size or Spine 4.2 interface. Run check_contract.py for details.');
        data = parsed as LoadedSpine;
        props.onready({ clips: data.animations.map(clip => ({ name: clip.name, duration: clip.duration })),
          skins: data.skins.map(skin => skin.name), version: data.version ?? 'unknown', width: data.width, height: data.height });
        ready = true;
      } catch (cause) {
        if (disposed) return;
        error = cause instanceof Error ? cause.message : String(cause);
        props.onlog(error);
        destroy();
      }
    })();
    return () => {
      disposed = true;
      // Child Spine/provider cleanup runs before the application destroys its stage.
      queueMicrotask(destroy);
    };
  });
</script>

<div class="canvas-host" bind:this={host}>
  {#if ready && data && context.stateApp.pixiApplication}
    <ViewerScene app={context.stateApp.pixiApplication} {data} {...props} />
  {:else}
    <p class:error role="status">{error || 'Loading original Spine export…'}</p>
  {/if}
</div>

<style>
  .canvas-host { position: absolute; inset: 0; }
  p { position: absolute; z-index: 1; top: 42%; left: 8%; right: 8%; text-align: center; color: #bbcbd1; }
  p.error { color: #ffaf9e; background: #291d23; padding: 20px; border-radius: 12px; }
</style>
