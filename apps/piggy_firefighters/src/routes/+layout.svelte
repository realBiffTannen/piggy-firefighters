<script lang="ts">
	// The Crash Galaxy publisher bumper: a ~2.2 s pre-roll over the splash, FIRST so it paints
	// before anything else. Never blocks loading, removes itself, honours ?skipSplash=1 /
	// ?skipBrand=1 and reduced motion. Muted when the player muted the game last session (the
	// audio manager's persisted key) — the audio singleton is NOT touched from here.
	// A REPLAY LAUNCH SKIPS IT ENTIRELY (see game/replayLaunch.ts): a replay link is
	// opened to inspect one recorded round, so nothing pre-rolls in front of it.
	import { mountBrandBumper } from '../brand/crash-galaxy-bumper';
	import { isReplayLaunch } from '../game/replayLaunch';
	mountBrandBumper({
		skip: isReplayLaunch(),
		muted: () => {
			try {
				return typeof localStorage !== 'undefined' && localStorage.getItem('piggy-firefighters-muted') === '1';
			} catch {
				return false;
			}
		},
	});

	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';

	// THE STUDIO HUD IS A PACKAGE. `@crashgalaxy/hud` (the vendored tarball
	// vendor/crashgalaxy-hud-1.0.3-ppec8b63d9.tgz, never link:) renders the bar, spin button, bet ladder,
	// autoplay picker, feature-buy sheet, burger menu, ante chip and rules door.
	// It is a sibling of <Game /> — DOM over the Pixi canvas — and learns every
	// game-specific fact through the one `hudConfig` prop (../hud.config.ts). Its
	// stylesheet must be imported before any app-owned CSS.
	import '@crashgalaxy/hud/styles.css';
	import { CrashGalaxyHud } from '@crashgalaxy/hud';
	import { hudConfig } from '../hud.config';

	import Game from '../components/Game.svelte';
	// The studio PIGGY FIREFIGHTERS splash. It REPLACES the upstream web-sdk boot
	// loaders (LoaderStakeEngine's Stake-Engine GIF + LoaderExample's "Add Your
	// Loader" GIF): a branded DOM overlay with a real progress bar, a
	// press-anywhere gate that doubles as the audio-unlock gesture, and the
	// hand-off that reveals the game + studio HUD. See Splash.svelte.
	import Splash from '../components/Splash.svelte';
	import NoSelect from '../components/NoSelect.svelte';
	import { setContext } from '../game/context';

	import messagesMap from '../i18n/messagesMap';

	type Props = { children: Snippet };

	const props: Props = $props();

	setContext();
</script>

<svelte:head>
	<title>PIGGY FIREFIGHTERS</title>
</svelte:head>

<GlobalStyle>
	<Authenticate {messagesMap}>
		<LoadI18n {messagesMap}>
			<Game />
			<CrashGalaxyHud config={hudConfig} />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<Splash />
<NoSelect />

{@render props.children()}
