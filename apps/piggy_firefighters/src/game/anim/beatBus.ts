import { eventEmitter } from '../eventEmitter';
import type { EmitterEventAnim } from './rigLogic';
export type { EmitterEventAnim } from './rigLogic';

/** Call during component initialization; the SDK unsubscribes on unmount. */
export function subscribeToBeats(handler: (event: EmitterEventAnim) => void): void {
  eventEmitter.subscribeOnMount({
    animBeat: (event: EmitterEventAnim) => {
      // Presentation must never reject a book handler or join broadcastAsync's
      // awaited work. Directors retain ownership of round timing.
      try { handler(event); }
      catch (error) { console.warn('Piggy Firefighters rig beat failed', error); }
    },
  });
}
