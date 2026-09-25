<script lang="ts">
  import { Container, getContextApp, type LoadedSpine } from 'pixi-svelte';
  import RigActor from './RigActor.svelte';
  import SlotClip from './SlotClip.svelte';
  import type { RigActorProps } from '../../game/anim/rigTypes';
  import type { RigName, RigSlot, LadderPath } from '../../game/anim/rigLogic';

  type Props = Pick<RigActorProps, 'onready' | 'ondispose' | 'onrigEvent' | 'speedTier' | 'skin'> & {
    slot: RigSlot;
    index?: number;
    width: number;
    height: number;
    scale: number;
    layout: 'desktop' | 'portrait';
    reducedMotion: boolean;
    path?: LadderPath;
    fromX?: number;
    fromY?: number;
    toX?: number;
    toY?: number;
  };
  const props: Props = $props();
  const app = getContextApp();
  const rigs = $derived(({
    mascotLeft: ['pf_chief'], mascotRight: ['pf_dog'], cardPresenter: ['pf_rookie'],
    rescueRoom: ['pf_rescued'], ladder: ['pf_rescued'], sheet: ['pf_rookie','pf_dog'], winPlate: ['pf_chief'],
  } satisfies Record<RigSlot, RigName[]>)[props.slot]);
  const path = $derived(props.path ?? (props.fromX !== undefined && props.fromY !== undefined && props.toX !== undefined && props.toY !== undefined
    ? { fromX: props.fromX, fromY: props.fromY, toX: props.toX, toY: props.toY } : undefined));
  function fit(rig: RigName) {
    const data = app.stateApp.loadedAssets?.[rig] as LoadedSpine | undefined;
    if (!data?.width || !data.height) return 0;
    // All authored roots are at the feet; preserve aspect ratio. The slot scale
    // comes from the scene's desktop/portrait layout, never device detection.
    return Math.min(props.width / rigs.length / data.width, props.height / data.height) * Math.max(0, props.scale);
  }
</script>

<Container eventMode="none">
  <SlotClip width={props.width} height={props.height} />
  {#each rigs as rig, actorIndex (rig)}
    <RigActor {rig} slot={props.slot} index={props.index ?? 0}
      x={props.width * (actorIndex + 0.5) / rigs.length} y={props.height}
      scale={fit(rig)} reducedMotion={props.reducedMotion} speedTier={props.speedTier}
      skin={props.skin} {path} onready={props.onready} ondispose={props.ondispose} onrigEvent={props.onrigEvent} />
  {/each}
</Container>
