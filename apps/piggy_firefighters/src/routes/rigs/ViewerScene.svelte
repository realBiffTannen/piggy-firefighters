<script lang="ts">
  import { BaseSpineProvider, createContextParent, type PIXI, type LoadedSpine } from 'pixi-svelte';
  import type { RigName } from '../../game/anim/rigLogic';
  import type { PreviewMode } from './viewerLogic';
  import ViewerPlayback from './ViewerPlayback.svelte';
  const props: { app: PIXI.Application; data: LoadedSpine; rig: RigName; clip: string; skin: string;
    speed: number; paused: boolean; replay: number; spraySequence: boolean; anchors: boolean; mode: PreviewMode;
    onlog: (text: string) => void } = $props();
  createContextParent(props.app.stage);
  props.app.stage.sortableChildren = true;
</script>

<BaseSpineProvider spineData={props.data} autoUpdate={false} eventMode="none">
  <ViewerPlayback {...props} />
</BaseSpineProvider>
