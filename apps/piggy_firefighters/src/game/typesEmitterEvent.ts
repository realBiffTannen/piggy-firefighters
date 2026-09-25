import type { EmitterEventAnim } from './anim/beatBus';
import type { EmitterEventBoard } from '../components/Board.svelte';
import type { EmitterEventBoardFrame } from '../components/BoardFrame.svelte';
import type { EmitterEventWin } from '../components/Win.svelte';
import type { EmitterEventWinRungs } from '../components/WinRungs.svelte';
import type { EmitterEventBoardFx } from '../components/BoardFx.svelte';
import type { EmitterEventPaylines } from '../components/Paylines.svelte';
import type { EmitterEventLinePop } from '../components/LinePop.svelte';
import type { EmitterEventBackdraftFx } from '../components/BackdraftFx.svelte';
import type { EmitterEventAlarmCall } from '../components/AlarmCallCard.svelte';
import type { EmitterEventShutter } from '../components/scene/SceneShutter.svelte';

export type EmitterEventGame =
	| EmitterEventBoard
	| EmitterEventBoardFrame
	| EmitterEventWin
	| EmitterEventWinRungs
	| EmitterEventBoardFx
	| EmitterEventPaylines
	| EmitterEventLinePop
	| EmitterEventBackdraftFx
	| EmitterEventAlarmCall
	| EmitterEventShutter
	// Codex rig runtime (docs/ANIMATION_CONTRACT.md v1.1 §Runtime interface): the ONE `animBeat` event type
	| EmitterEventAnim;
