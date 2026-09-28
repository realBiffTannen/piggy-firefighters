<script lang="ts">
  import { Container, getContextApp, type LoadedSpine } from 'pixi-svelte';
  import RigActor from './RigActor.svelte';
  import SlotClip from './SlotClip.svelte';
  import type { RigActorProps } from '../../game/anim/rigTypes';
  import { fitRigInSlot, type RigName, type RigSlot, type LadderPath } from '../../game/anim/rigLogic';

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
    rescueRoom: ['pf_rescued'], ladder: ['pf_rescued'], sheet: ['pf_rookie'], winPlate: ['pf_chief'],
  } satisfies Record<RigSlot, RigName[]>)[props.slot]);
  const path = $derived(props.path ?? (props.fromX !== undefined && props.fromY !== undefined && props.toX !== undefined && props.toY !== undefined
    ? { fromX: props.fromX, fromY: props.fromY, toX: props.toX, toY: props.toY } : undefined));
  // Each actor owns an equal share of the slot's width. The export's setup bounds (finish_export.mjs derives them;
  // a negative origin is normal: the Chief's hose arm reaches left of his feet) are fitted whole, feet centred, with
  // the motion gutter, so no pose is clipped by the slot mask. The slot scale comes from the scene's desktop /
  // portrait layout, never device detection, and can only shrink the fitted actor.
  const share = $derived(props.width / Math.max(1, rigs.length));
  function place(rig: RigName, actorIndex: number) {
    const data = app.stateApp.loadedAssets?.[rig] as LoadedSpine | undefined;
    if (!data?.width || !data.height) return { x: share * (actorIndex + 0.5), y: props.height, scale: 0 };
    const fit = fitRigInSlot({ x: data.x ?? 0, y: data.y ?? 0, width: data.width, height: data.height }, share, props.height, props.scale);
    return { x: share * actorIndex + fit.x, y: fit.y, scale: fit.scale };
  }
</script>

<Container eventMode="none">
  <SlotClip width={props.width} height={props.height} />
  {#each rigs as rig, actorIndex (rig)}
    {@const at = place(rig, actorIndex)}
    <RigActor {rig} slot={props.slot} index={props.index ?? 0}
      x={at.x} y={at.y}
      scale={at.scale} reducedMotion={props.reducedMotion} speedTier={props.speedTier}
      skin={props.skin} {path} onready={props.onready} ondispose={props.ondispose} onrigEvent={props.onrigEvent} />
  {/each}
</Container>
