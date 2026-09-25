<script lang="ts">
  import { onMount } from 'svelte';
  import { rigAssets } from '../../game/anim/rigRegistry';
  import { RIG_DEFINITIONS, type RigName } from '../../game/anim/rigLogic';
  import { availableRigNames, appendLog, isLoopClip, previewFrame, REFERENCE_HEIGHT, RIG_NAMES,
    type PreviewMode, type RigInfo, type ViewerLog } from './viewerLogic';
  import ViewerCanvas from './ViewerCanvas.svelte';
  const available = availableRigNames(rigAssets);
  let rig = $state<RigName | ''>(available[0] ?? '');
  let clip = $state('');
  let skin = $state('');
  let info = $state<RigInfo | null>(null);
  let mode = $state<PreviewMode>('desktop');
  let speed = $state(1);
  let paused = $state(false);
  let anchors = $state(false);
  let replay = $state(0);
  let logs = $state<ViewerLog[]>([]);
  let sequence = 0;
  const frame = $derived(previewFrame(mode));
  const activeClip = $derived(info?.clips.find(value => value.name === clip));
  function log(text: string) { logs = appendLog(logs, { id: ++sequence, text }); }
  function selectRig() { info = null; clip = ''; skin = ''; logs = []; paused = false; }
  function loaded(value: RigInfo) {
    info = value;
    clip = rig ? RIG_DEFINITIONS[rig].loop : '';
    skin = rig === 'pf_rescued' ? 'grandma' : (value.skins.find(name => name === 'default') ?? value.skins[0] ?? '');
    log(`LOADED ${rig} · Spine ${value.version} · bounds ${value.width} × ${value.height}`);
  }
  onMount(() => {
    document.documentElement.classList.add('pf-rig-viewer');
    return () => document.documentElement.classList.remove('pf-rig-viewer');
  });
</script>

<svelte:head><title>Piggy Firefighters — clip review</title></svelte:head>
<main>
  <header><div><p class="eyebrow">PIGGY FIREFIGHTERS / ANIMATION LAB</p><h1>Character clip review</h1></div><span class="badge">{available.length}/4 exports present</span></header>
  {#if !import.meta.env.DEV}
    <p>This review tool is available in development only.</p>
  {:else}
    <p class="intro">Inspect original rigs in isolation. Acceptance requires a recorded review of every clip; asset presence and this viewer do not certify motion quality.</p>
    <div class="workspace">
      <aside aria-label="Review controls">
        <div class="field"><label for="rig">Character</label><select id="rig" bind:value={rig} onchange={selectRig} disabled={!available.length}>
          {#if !available.length}<option value="">Awaiting original exports</option>{/if}
          {#each available as name}<option value={name}>{name}</option>{/each}
        </select></div>
        <div class="field"><label for="skin">Skin</label><select id="skin" bind:value={skin} disabled={!info?.skins.length}>
          {#if !info?.skins.length}<option value="">No skin loaded</option>{/if}
          {#each info?.skins ?? [] as name}<option value={name}>{name}</option>{/each}
        </select></div>
        <div class="field"><label for="clip">Animation</label><select id="clip" bind:value={clip} disabled={!info}>
          {#if !info}<option value="">No clip loaded</option>{/if}
          {#each info?.clips ?? [] as value}<option value={value.name}>{value.name} · {value.duration.toFixed(2)}s</option>{/each}
        </select></div>
        <p class="clip-note">{activeClip ? `${activeClip.duration.toFixed(3)}s · ${isLoopClip(clip) ? 'authored loop' : 'once, holds final pose'}` : 'Real clips appear after a valid export loads.'}</p>
        <div class="field"><label for="speed">Playback speed</label><select id="speed" bind:value={speed} disabled={!info}><option value={1}>Normal · 1×</option><option value={0.25}>Quarter · 0.25×</option></select></div>
        <div class="buttons"><button disabled={!info} onclick={() => paused = !paused}>{paused ? 'Resume' : 'Pause'}</button><button disabled={!info} onclick={() => { replay++; paused = false; }}>Replay</button></div>
        <div class="field"><label for="frame">Preview frame</label><select id="frame" bind:value={mode}><option value="desktop">Desktop · 920 × 600</option><option value="mobile">Phone · 360 × 480</option></select></div>
        <label class="toggle"><input type="checkbox" bind:checked={anchors} disabled={!info} /> Show contract anchors</label>
        <p class="small">{rig ? RIG_DEFINITIONS[rig].anchors.join(' · ') : 'Anchor points appear with the original rig.'}</p>
        <div class="rule"></div><p class="eyebrow">EXPORT READINESS</p>
        <ul class="readiness">{#each RIG_NAMES as name}<li><strong>{name}</strong><span class:present={available.includes(name)}>{available.includes(name) ? 'Files present' : 'BLOCKED · missing'}</span></li>{/each}</ul>
      </aside>
      <section class="preview-column" aria-label="Animation preview">
        <div class="preview-toolbar"><span>{mode === 'mobile' ? 'PHONE SIZE STUDY' : 'DESKTOP SIZE STUDY'}</span><span>{frame.scale}× rig scale · {paused ? 'paused' : `${speed}× playback`}</span></div>
        <div class="frame-surround"><div class="preview-frame" class:phone={mode === 'mobile'} style:aspect-ratio={`${frame.width} / ${frame.height}`} style:max-width={`${frame.width}px`}>
          {#if rig}
            {#key rig}<ViewerCanvas {rig} {clip} {skin} {speed} {paused} {replay} {anchors} {mode} onready={loaded} onlog={log} />{/key}
          {:else}
            <div class="empty" role="status"><span class="empty-mark" aria-hidden="true">—</span><h2>Original rigs are on their way</h2><p>BLOCKED: no original character exports are present.</p><p>There is no substitute animation to review. Add the agreed Spine 4.2 JSON, atlas and PNG pages, then reload this page.</p></div>
          {/if}
        </div></div>
        <p class="reference">{rig ? `Gold ruler: ${REFERENCE_HEIGHT[rig]} authored pixels · feet pivot on baseline.` : 'Size reference appears when a rig is loaded.'} Frame: {frame.width} × {frame.height} logical pixels, fitted to available width. Phone mode is a size study, not game-layout acceptance.</p>
        <section class="events" aria-label="Spine event log"><div class="log-title"><h2>Event log</h2><button class="quiet" disabled={!logs.length} onclick={() => logs = []}>Clear</button></div>
          {#if !logs.length}<p class="small">Keyed Spine events, loop boundaries and clip completion appear here.</p>{/if}
          <ol>{#each logs as row (row.id)}<li><span>{String(row.id).padStart(3, '0')}</span>{row.text}</li>{/each}</ol>
        </section>
      </section>
    </div>
    <footer>Motion review: NOT RUN until original exports are present and reviewed. This isolated stage has no game director, runtime travel, RGS or audio.</footer>
  {/if}
</main>

<style>
  /* app.html locks gameplay to one screen, including an inline body overflow. */
  :global(html.pf-rig-viewer), :global(html.pf-rig-viewer body) { height: auto; min-height: 100%; overflow: auto !important; overscroll-behavior: auto; background: #10191f !important; }
  :global(html.pf-rig-viewer body) { margin: 0; color: #eef1e9; font: 14px/1.5 system-ui, sans-serif; }
  :global(*) { box-sizing: border-box; }
  main { max-width: 1320px; margin: 0 auto; padding: 36px 28px; }
  header, .preview-toolbar, .log-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .eyebrow { color: #e6bb79; font-size: 10px; letter-spacing: .17em; font-weight: 700; margin: 0 0 8px; }
  h1 { font-size: clamp(25px, 4vw, 38px); letter-spacing: -.03em; line-height: 1.1; margin: 0; } h2 { font-size: 18px; line-height: 1.3; }
  .badge { flex-shrink: 0; border: 1px solid #45606a; border-radius: 30px; padding: 7px 12px; font-size: 12px; color: #c4d7d7; }
  .intro { max-width: 880px; color: #a6bbc2; margin: 18px 0 30px; }
  .workspace { display: grid; grid-template-columns: 245px minmax(0, 1fr); gap: 24px; align-items: start; }
  aside { background: #18262e; border: 1px solid #2d444e; padding: 20px; border-radius: 14px; }
  .field { margin-bottom: 15px; } label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: #c5d6d7; }
  select, button { font: inherit; color: #eef1e9; border: 1px solid #46616b; border-radius: 7px; background: #21353e; min-height: 40px; }
  select { width: 100%; padding: 8px; font-size: 12px; } button { cursor: pointer; padding: 8px 16px; }
  button:hover:not(:disabled) { border-color: #e6bb79; } select:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid #e6bb79; outline-offset: 3px; }
  :disabled { opacity: .48; cursor: default; } .buttons { display: flex; gap: 8px; margin: 0 0 20px; } .buttons button { flex: 1; }
  .clip-note, .small, .reference { color: #a6bbc2; font-size: 11px; } .clip-note { min-height: 34px; margin: -5px 0 15px; }
  .toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; } input { accent-color: #e6bb79; }
  .rule { border-top: 1px solid #324851; margin: 20px 0; }
  .readiness { list-style: none; padding: 0; margin: 0; } .readiness li { margin: 12px 0 0; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
  .readiness span { color: #d6a995; font-size: 10px; } .readiness .present { color: #94d4bd; }
  .preview-toolbar { padding: 0 3px 10px; font-size: 10px; color: #c4d7d7; letter-spacing: .08em; }
  .frame-surround { background: #0c1218; border: 1px solid #2d444e; border-radius: 14px; overflow: hidden; min-height: 220px; }
  .preview-frame { width: 100%; position: relative; margin: 0 auto; background-color: #17242c; background-image: linear-gradient(#273a4244 1px, transparent 1px), linear-gradient(90deg, #273a4244 1px, transparent 1px); background-size: 40px 40px; }
  .preview-frame.phone { border-left: 1px solid #45606a; border-right: 1px solid #45606a; }
  .empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; text-align: center; }
  .empty-mark { color: #e6bb79; font-size: 45px; font-weight: 200; } .empty p { color: #a6bbc2; max-width: 380px; font-size: 12px; margin: 5px 0; } .empty h2 { margin: 8px 0; }
  .reference { margin: 10px 3px 20px; } .events { border: 1px solid #2d444e; background: #142129; padding: 15px 18px; border-radius: 12px; }
  .log-title h2 { font-size: 13px; margin: 0; } .quiet { min-height: 28px; padding: 3px 10px; font-size: 11px; }
  .events ol { margin: 12px 0 0; padding: 0; list-style: none; max-height: 190px; overflow-y: auto; font: 11px/1.7 ui-monospace, monospace; overflow-wrap: anywhere; }
  .events li { border-top: 1px solid #293d45; padding: 5px 0; } .events li span { margin-right: 12px; color: #6d919e; }
  footer { color: #809aa4; font-size: 11px; border-top: 1px solid #2d444e; padding-top: 20px; margin-top: 26px; }
  @media(max-width: 720px) { main { padding: 24px 16px; } header { align-items: flex-start; } .badge { font-size: 10px; padding: 5px 8px; } .workspace { grid-template-columns: 1fr; } aside { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; } aside .rule, aside .eyebrow, aside .readiness { grid-column: 1 / -1; } .readiness { display: grid; grid-template-columns: 1fr 1fr; } .empty { padding: 16px; } .empty-mark { display: none; } .empty h2 { font-size: 16px; } .empty p { font-size: 10px; } }
</style>
