<script lang="ts" module>
	import type { BuildOrBustOutcome } from '../../game/typesBookEvent';

	export type EmitterEventBuildOrBust =
		| { type: 'buildOrBustAnticipate'; outcome: BuildOrBustOutcome }
		| { type: 'buildOrBustBust' }
		/** v2.4: the two EXPANDED awards get their own reveal on the card */
		| { type: 'buildOrBustExpand'; golden: boolean };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { cubicOut, backOut } from 'svelte/easing';

	import { Container, Graphics, Text } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { waitForTimeout } from 'utils-shared/wait';

	import { getContext } from '../../game/context';
	import { drawSignPanel, signTitleStyle, signSubStyle, ensureSignFont } from '../../game/build/signPanel';
	import { MODE_TITLE } from '../../game/names';

	const context = getContext();

	let visible = $state(false);
	let mode = $state<'anticipate' | 'bust' | 'expand'>('anticipate');
	let golden = $state(false);
	const appear = new Tween(0, { duration: 0, easing: backOut });
	const pulse = new Tween(0, { duration: 0, easing: cubicOut });
	// expanded reveal: the sign OPENS UP sideways (wings slide out from behind it)
	const open = new Tween(0, { duration: 0, easing: backOut });
	const rays = new Tween(0, { duration: 0, easing: cubicOut });

	const reducedMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	context.eventEmitter.subscribeOnMount({
		// Identical suspense for every outcome — no fake near-miss. Only the
		// resolution differs: a bust is handed to `buildOrBustBust`, an expanded
		// award to `buildOrBustExpand`; a hold / golden fades this plate and the
		// buildStart cover takes over.
		buildOrBustAnticipate: async ({ outcome }) => {
			mode = 'anticipate';
			visible = true;
			ensureSignFont();
			appear.set(0, { duration: 0 });
			open.set(0, { duration: 0 });
			rays.set(0, { duration: 0 });
			await appear.set(1, { duration: reducedMotion() ? 0 : 260 });
			if (!reducedMotion()) {
				for (let i = 0; i < 3; i += 1) {
					pulse.set(0, { duration: 0 });
					await pulse.set(1, { duration: 200 });
				}
			} else {
				await waitForTimeout(200);
			}
			if (outcome === 'goldenBuild' || outcome === 'holdAndBuild') {
				await appear.set(0, { duration: reducedMotion() ? 0 : 220 });
				visible = false;
			}
		},
		// Brief, neutral wooden settle. No fanfare, no celebration.
		buildOrBustBust: async () => {
			mode = 'bust';
			visible = true;
			ensureSignFont();
			appear.set(1, { duration: reducedMotion() ? 0 : 160 });
			await waitForTimeout(reducedMotion() ? 300 : 1200);
			await appear.set(0, { duration: reducedMotion() ? 0 : 240 });
			visible = false;
		},
		// EXPANDED HOLD & BUILD / GOLDEN EXPANDED: the same sign opens up — two wings
		// slide out from behind it and light rakes across. The wings are a flourish,
		// NOT a board count: how many boards open is revealed on the site itself.
		buildOrBustExpand: async ({ golden: g }) => {
			golden = g;
			mode = 'expand';
			visible = true;
			ensureSignFont();
			appear.set(1, { duration: 0 });
			if (reducedMotion()) {
				open.set(1, { duration: 0 });
				await waitForTimeout(900);
			} else {
				pulse.set(0, { duration: 0 });
				void pulse.set(1, { duration: 260 });
				void rays.set(1, { duration: 1500 });
				await open.set(1, { duration: 620 });
				await waitForTimeout(1050);
			}
			await appear.set(0, { duration: reducedMotion() ? 0 : 260 });
			visible = false;
		},
	});

	const mainLayout = () => context.stateLayoutDerived.mainLayout();
	const S = 120;
	const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
</script>

{#if visible}
	<!-- `appear` eases with backOut, which OVERSHOOTS: on the way out it dips below
	     zero, and a negative alpha on a full-canvas rectangle paints the whole play
	     area black for the last ~100 ms of the fade (the "black flash" on bonus
	     entry). Always clamp. The dim is site-night blue, not black. -->
	<CanvasSizeRectangle backgroundColor={golden && mode === 'expand' ? 0x1a0f02 : 0x04131c} backgroundAlpha={0.5 * clamp01(appear.current)} />
	<MainContainer>
		<Container
			x={mainLayout().width / 2}
			y={mainLayout().height / 2}
			scale={0.85 + Math.max(0, appear.current) * 0.15}
			alpha={clamp01(appear.current * 1.6)}
		>
			{#if mode === 'expand'}
				<!-- raking light behind the sign -->
				<Graphics
					blendMode="add"
					alpha={Math.sin(clamp01(rays.current) * Math.PI) * 0.9}
					rotation={rays.current * 0.5}
					draw={(g) => {
						for (let i = 0; i < 10; i += 1) {
							const a = (i / 10) * Math.PI * 2;
							g.poly([0, 0, Math.cos(a - 0.09) * S * 5.2, Math.sin(a - 0.09) * S * 5.2, Math.cos(a + 0.09) * S * 5.2, Math.sin(a + 0.09) * S * 5.2]).fill({ color: golden ? 0xb6ff8a : 0xffd34d, alpha: 0.1 });
						}
					}}
				/>
				<!-- the wings slide out from BEHIND the sign, eased with overshoot -->
				{#each [-1, 1] as side (side)}
					<Container x={side * S * 2.55 * clamp01(open.current * 1.02)} y={S * 0.06} scale={0.9} alpha={clamp01(open.current * 2.2)}>
						<Graphics draw={(g) => drawSignPanel(g, { w: S * 2.6, h: S * 1.9, s: S, variant: golden ? 'gold' : 'timber' })} />
					</Container>
				{/each}
			{/if}
			<Graphics
				scale={mode === 'expand' ? 1 + Math.sin(clamp01(pulse.current) * Math.PI) * 0.05 : 1}
				draw={(g) => drawSignPanel(g, { w: S * 6.2, h: S * 2.2, s: S, variant: mode === 'bust' ? 'muted' : mode === 'expand' && golden ? 'win' : 'hazard' })}
			/>
			{#if mode === 'anticipate'}
				<Text
					anchor={0.5}
					y={-S * 0.24}
					scale={1 + pulse.current * 0.06}
					text={MODE_TITLE.build_or_bust}
					style={signTitleStyle(S, { gold: true })}
				/>
				<Text anchor={0.5} y={S * 0.5} alpha={0.9} text="The cards are turning…" style={signSubStyle(S)} />
			{:else if mode === 'expand'}
				<Text
					anchor={0.5}
					y={-S * 0.2}
					scale={0.86 + 0.14 * clamp01(open.current)}
					text={golden ? MODE_TITLE.expanded_golden_build : MODE_TITLE.expanded_hold_and_build}
					style={{ ...signTitleStyle(S, { gold: true }), fontSize: golden ? S * 0.5 : S * 0.4 }}
				/>
				<Text anchor={0.5} y={S * 0.52} alpha={clamp01(open.current * 1.5 - 0.4)} text="The city grows…" style={signSubStyle(S)} />
			{:else}
				<Text
					anchor={0.5}
					y={-S * 0.22}
					text="NO FEATURE THIS TIME"
					style={{ ...signTitleStyle(S), fontSize: S * 0.4 }}
				/>
				<Text anchor={0.5} y={S * 0.5} alpha={0.85} text="The street stays quiet." style={signSubStyle(S)} />
			{/if}
		</Container>
	</MainContainer>
{/if}
