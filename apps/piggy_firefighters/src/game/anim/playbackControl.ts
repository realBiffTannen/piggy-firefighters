import type { getContextSpine } from 'pixi-svelte';

type SpineActor = ReturnType<typeof getContextSpine>;

/** Ordinary transitions retain their outgoing TrackEntry, so Spine can mix it out. */
export function transitionRigClip(actor: Pick<SpineActor, 'state' | 'skeleton'>, animation: string, loop: boolean, resetPose = false) {
  if (resetPose) {
    // Initial mount and reduced-motion pose changes have no transitional motion.
    actor.state.clearTracks();
    actor.skeleton.setToSetupPose();
  }
  return actor.state.setAnimation(0, animation, loop);
}

/** AnimationState listeners run before bone world transforms. Drain only after update(). */
export function createFrameQueue(isCurrent: (epoch: number) => boolean) {
  const pending: { epoch: number; callback: () => void }[] = [];
  return {
    defer: (epoch: number, callback: () => void) => { pending.push({ epoch, callback }); },
    flush: () => {
      for (const item of pending.splice(0)) if (isCurrent(item.epoch)) item.callback();
    },
    clear: () => { pending.length = 0; },
  };
}

/** Internal rig-to-rig arrival cue; no shared emitter changes or awaited work. */
export function createLandingBus() {
  const subscribers = new Set<() => void>();
  return {
    subscribe: (callback: () => void) => {
      subscribers.add(callback);
      return () => { subscribers.delete(callback); };
    },
    publish: () => { for (const callback of subscribers) callback(); },
  };
}
export const landingBus = createLandingBus();

/** Current SvelteKit configuration is inline (_app/immutable/bundle.js). */
export function resolveRigAssetUrl(path: string, moduleUrl: string, development: boolean) {
  return new URL((development ? '../../../assets/' : '../../assets/') + path, moduleUrl).href;
}
