<script lang="ts">
  import { rigAssets } from '../../game/anim/rigRegistry';
  import { RIG_DEFINITIONS, type RigName } from '../../game/anim/rigLogic';
  const rigs = Object.keys(RIG_DEFINITIONS) as RigName[];
</script>

<svelte:head><title>Piggy Firefighters — rig readiness</title></svelte:head>
<main>
  <p class="label">DEVELOPMENT • RIG READINESS</p>
  <h1>Piggy Firefighters</h1>
  <p>Original character exports are required before motion review. This page shows asset presence only;
    it does not certify loaded art, animation quality, or accepted motion.</p>
  <ul>
    {#each rigs as rig}
      <li><strong>{rig}</strong><span>{rig in rigAssets ? 'Export files found — motion review pending' : 'Awaiting original Spine export'}</span></li>
    {/each}
  </ul>
  <p>No substitute character art is displayed. The game keeps its procedural fallback until a valid original rig is loaded and mounted.</p>
</main>

<style>
  :global(body) { margin: 0; background: #111820; color: #f5ecdc; font: 16px/1.6 system-ui, sans-serif; }
  main { max-width: 760px; margin: 8vh auto; padding: 24px; }
  .label { color: #edbc69; font-size: 12px; letter-spacing: .15em; }
  h1 { font-size: clamp(28px, 6vw, 48px); line-height: 1.1; }
  ul { padding: 0; list-style: none; border-top: 1px solid #415363; }
  li { display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #415363; }
  span { color: #c4cdd4; }
</style>
