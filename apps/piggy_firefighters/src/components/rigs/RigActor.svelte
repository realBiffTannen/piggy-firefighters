<script lang="ts">
  import { BaseSpineProvider, getContextApp, type LoadedSpine } from 'pixi-svelte';
  import { isUsableRigData } from '../../game/anim/rigLogic';
  import type { RigActorProps, RigHandle } from '../../game/anim/rigTypes';
  import RigPlayback from './RigPlayback.svelte';

  const props: RigActorProps = $props();
  const app = getContextApp();
  let handle: RigHandle | undefined;
  export function getBoneWorldPosition(name: string) { return handle?.getBoneWorldPosition(name) ?? null; }
  function ready(value: RigHandle) { handle = value; props.onready?.(value); }
  function disposed(rig: RigActorProps['rig'], index: number) { handle = undefined; props.ondispose?.(rig, index); }
  const data = $derived(app.stateApp.loadedAssets?.[props.rig]);
  const usable = $derived(isUsableRigData(props.rig, data));
</script>

{#if usable}
  {#key data}
    <BaseSpineProvider spineData={data as LoadedSpine} autoUpdate={false} eventMode="none">
      <RigPlayback {...props} onready={ready} ondispose={disposed} />
    </BaseSpineProvider>
  {/key}
{/if}
