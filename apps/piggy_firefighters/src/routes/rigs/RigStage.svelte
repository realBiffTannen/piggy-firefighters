<script lang="ts">
	// Stage: the same exported rig at source scale, ~160 px (desktop cell) and ~70 px (mobile cell)
	// on the game's colours, driven by the repo's pinned runtime through pixi-svelte.
	import { innerWidth, innerHeight } from 'svelte/reactivity/window';
	import { base } from '$app/paths';
	import { App, Container, Rectangle, SpineProvider, createApp, setContextApp } from 'pixi-svelte';

	import RigInstance from './RigInstance.svelte';
	import type { RigApi, RigIndex } from './types';

	type Props = { index: RigIndex; rigId: string; onrig: (id: string) => void };
	const props: Props = $props();
	const rig = props.index.rigs.find((entry) => entry.id === props.rigId)!;

	const app = createApp({
		assets: {
			[rig.id]: { type: 'spine', src: { atlas: `${base}/${rig.atlas}`, skeleton: `${base}/${rig.skeleton}` } },
		},
	});
	setContextApp(app);

	const GAME_COLOURS = [0x123a5a, 0xf6ead2, 0x1f7a7a, 0x0c2740, 0xef7d24];
	const query = new URLSearchParams(location.search);

	let clip = $state(query.get('clip') ?? 'idle');
	let loop = $state(false);
	let speed = $state(1);
	let prizeText = $state(query.get('prize') ?? '25x');
	let sourceBg = $state(0);
	let labelSize = $state(Number(query.get('label') ?? 170)); // source px; 170 = 0.135 x cell
	let log = $state<string[]>([]);
	let look = $state(Number(query.get('look') ?? 0));
	const bare = query.get('bare') === '1'; // capture mode: no toolbar / captions / log over the canvas (23 clip buttons wrap over the headroom)
	const apis = new Set<RigApi>();

	const W = $derived(innerWidth.current ?? 1600);
	const H = $derived(innerHeight.current ?? 900);
	const TOP = 92;
	const leftW = $derived(Math.round(W * 0.6));
	const headroom = rig.headroom ?? 1.12; // mascot clips leave the canvas upward (jump), so the source view keeps extra space above
	const sourceScale = $derived(Math.min(1, (H - TOP - 16) / (rig.sourceCanvas * headroom), (leftW - 16) / (rig.sourceCanvas * 1.05)));
	// rig origin relative to the canvas centre (houses are cell centred; the mascot's origin is its floor contact)
	const origin = rig.origin ?? { x: 0, y: 0 };
	const cells = $derived(
		rig.cells
			? rig.cells.map((cell) => ({ px: cell.px, x: leftW + cell.x, y: TOP + cell.y, colour: cell.colour }))
			: [
					...[0, 1, 2].map((i) => ({ px: 160, x: leftW + 110 + i * 200, y: TOP + 170, colour: GAME_COLOURS[i] })),
					...[0, 1, 2].map((i) => ({ px: 70, x: leftW + 65 + i * 110, y: TOP + 370, colour: GAME_COLOURS[i] })),
				],
	);
	const sequences = rig.sequences ?? [
		{ label: 'build', clips: ['appear', 'idle'] },
		{ label: 'upgrade', clips: ['upgrade_out', 'upgrade_in', 'idle'] },
		{ label: 'reveal + collect', clips: ['door_open', 'door_hold', 'door_hold', 'door_hold', 'collect', 'idle'] },
	];
	const loopClips = new Set(rig.clips.filter((entry) => entry.loop).map((entry) => entry.name));

	const register = (api: RigApi) => {
		apis.add(api);
		api.setSpeed(speed);
		api.look(look);
		const time = query.get('t');
		if (time !== null) api.seek(clip, Number(time));
		else api.play(clip, loop);
		return () => apis.delete(api);
	};
	const play = (name: string) => {
		clip = name;
		for (const api of apis) api.play(name, loop || loopClips.has(name));
	};
	const sequence = (names: string[]) => {
		clip = names[0];
		for (const api of apis) {
			api.play(names[0], false);
			for (const name of names.slice(1)) api.queue(name, loopClips.has(name) && name === names[names.length - 1]);
		}
	};
	const setSpeed = (value: number) => {
		speed = value;
		for (const api of apis) api.setSpeed(value);
	};

	// automation hook for frame captures (Playwright): window.__rigs.seek('door_open', 0.3)
	(window as unknown as Record<string, unknown>).__rigs = {
		seek: (name: string, time: number) => {
			clip = name;
			for (const api of apis) api.seek(name, time);
		},
		play,
		sequence,
		ready: () => app.stateApp.loaded && apis.size > 0,
		measure: () => [...apis][0]?.measure(),
		log: () => log,
		look: (value: number) => {
			look = value;
			for (const api of apis) api.look(value);
		},
	};
</script>

<div class="bar" class:bare>
	<label>
		rig
		<select value={props.rigId} onchange={(event) => props.onrig((event.currentTarget as HTMLSelectElement).value)}>
			{#each props.index.rigs as entry (entry.id)}<option value={entry.id}>{entry.id}</option>{/each}
		</select>
	</label>
	{#each rig.clips as entry (entry.name)}
		<button class:on={clip === entry.name} class:qa={!entry.shipping} onclick={() => play(entry.name)}>
			{entry.name} <small>{entry.duration.toFixed(2)}s</small>
		</button>
	{/each}
	<span class="sep"></span>
	{#each sequences as entry (entry.label)}
		<button onclick={() => sequence(entry.clips)}>seq: {entry.label}</button>
	{/each}
	<span class="sep"></span>
	{#each [1, 0.5, 0.25, 0.1] as value (value)}
		<button class:on={speed === value} onclick={() => setSpeed(value)}>{value}x</button>
	{/each}
	<label><input type="checkbox" bind:checked={loop} /> loop</label>
	<label>prize <input size="5" bind:value={prizeText} /></label>
	<label>label px <input size="4" type="number" step="10" bind:value={labelSize} /></label>
	<button onclick={() => (sourceBg = (sourceBg + 1) % GAME_COLOURS.length)}>source bg</button>
	{#if rig.blendPoses}
		<label>
			look L/R
			<input
				type="range"
				min="-1"
				max="1"
				step="0.05"
				value={look}
				oninput={(event) => {
					look = Number((event.currentTarget as HTMLInputElement).value);
					for (const api of apis) api.look(look);
				}}
			/>
		</label>
	{/if}
</div>

<div class="captions" class:bare style:left={`${leftW}px`} style:top={`${TOP}px`}>
	<p style:top="6px">{rig.caption ?? '160 px cells (desktop), then 70 px cells (mobile portrait), on game colours'}</p>
	<p style:top="0px" style:left={`${-leftW + 12}px`}>source scale x{sourceScale.toFixed(2)} (runtime atlas is packed at 0.5)</p>
</div>

<pre class="log" class:bare style:left={`${leftW + 20}px`} style:top={`${TOP + (rig.cells ? Math.max(...rig.cells.map((cell) => cell.y + cell.px * 0.6)) + 30 : 440)}px`}>events ({rig.events.join(', ')})
{log.join('\n')}</pre>

<div class="canvas">
	<App>
		{#if app.stateApp.loaded}
			<Container x={leftW / 2} y={TOP + (H - TOP) / 2 + ((headroom - 1.12) / 2) * rig.sourceCanvas * sourceScale} scale={sourceScale} sortableChildren={true}>
				<Rectangle anchor={0.5} width={rig.sourceCanvas * 1.04} height={rig.sourceCanvas * 1.1} backgroundColor={GAME_COLOURS[sourceBg]} borderRadius={24} />
				<Container x={origin.x} y={origin.y} sortableChildren={true}>
					<SpineProvider key={rig.id}>
						<RigInstance
							{rig}
							{prizeText}
							{labelSize}
							{register}
							onclip={(name) => (log = [...log, `-- ${name}`].slice(-24))}
							onevent={(line) =>
								(log = [...log, `${line.trackTime.toFixed(3)}s  ${line.name} ${line.detail}  (wall +${line.wallMs.toFixed(0)} ms)`].slice(-24))}
						/>
					</SpineProvider>
				</Container>
			</Container>
			{#each cells as cell, i (i)}
				<Container x={cell.x} y={cell.y} sortableChildren={true}>
					<Rectangle anchor={0.5} width={cell.px} height={cell.px} backgroundColor={cell.colour} borderRadius={cell.px * 0.06} />
					<Container scale={cell.px / rig.sourceCanvas} sortableChildren={true}>
						<Container x={origin.x} y={origin.y} sortableChildren={true}>
							<SpineProvider key={rig.id}>
								<RigInstance {rig} {prizeText} {labelSize} {register} />
							</SpineProvider>
						</Container>
					</Container>
				</Container>
			{/each}
		{/if}
	</App>
</div>

<style>
	.bar {
		position: absolute;
		z-index: 2;
		inset: 0 0 auto 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
		padding: 8px 10px;
		background: #123a5a;
	}
	.bare {
		display: none;
	}
	.bar button {
		font: inherit;
		color: #f6ead2;
		background: #1a5470;
		border: 1px solid #2b6c8c;
		border-radius: 6px;
		padding: 4px 8px;
		cursor: pointer;
	}
	.bar button.on {
		background: #ef7d24;
		border-color: #f7c948;
		color: #2a1206;
	}
	.bar button.qa {
		opacity: 0.6;
	}
	.bar .sep {
		width: 14px;
	}
	.bar select,
	.bar input {
		font: inherit;
	}
	.captions {
		position: absolute;
		z-index: 2;
		pointer-events: none;
	}
	.captions p {
		position: absolute;
		margin: 0;
		left: 20px;
		white-space: nowrap;
		opacity: 0.85;
	}
	.log {
		position: absolute;
		z-index: 2;
		margin: 0;
		padding: 10px;
		min-width: 420px;
		min-height: 120px;
		background: rgba(0, 0, 0, 0.35);
		border-radius: 8px;
		color: #f7c948;
	}
	.canvas {
		position: absolute;
		inset: 0;
		z-index: 1;
	}
</style>
