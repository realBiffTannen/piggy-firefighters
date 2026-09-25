import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBoardFrame } from '../components/BoardFrame.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventBuild } from '../components/build/BuildScene.svelte';
import type { EmitterEventBuildCard } from '../components/build/BuildBonusCard.svelte';
import type { EmitterEventBuildOrBust } from '../components/build/BuildOrBust.svelte';
import type { EmitterEventMascot } from './mascotEvents';
import type { EmitterEventFeatureDrops } from '../components/FeatureDrops.svelte';
import type { EmitterEventWinRungs } from '../components/WinRungs.svelte';
import type { EmitterEventBoardFx } from '../components/BoardFx.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBoardFrame
	| EmitterEventWin
	| EmitterEventBuild
	| EmitterEventBuildCard
	| EmitterEventBuildOrBust
	| EmitterEventMascot
	| EmitterEventFeatureDrops
	| EmitterEventWinRungs
	| EmitterEventBoardFx;
