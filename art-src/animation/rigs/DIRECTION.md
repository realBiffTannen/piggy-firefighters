# Character motion direction — Piggy Firefighters

Authoring brief, not accepted animation. Original parts and exports are still pending.
`docs/ANIMATION_CONTRACT.md` controls names, sizes, durations, events and ownership.
This brief supplies acting and review criteria inside that interface; it changes no game rules.

## The standard to hit

The cast should look as though it performs each action, with clear weight, contact and intention.
Eyes lead the gesture; the torso commits; hands and props follow a believable path; helmet, ears,
moustache, coat and tail settle afterward. Do not animate a flat character by continuously scaling,
floating or rotating the entire cutout. Keep every root neutral and translate the ladder actor only
in the runtime. The rig should provide useful motion when the particle effects are disabled.

Use the thick illustrated outline and a single coherent light direction. Preserve face shapes and
silhouettes through turns and deformation. Hide joints with painted overlap, not extreme stretching.
No joint opens a transparent crack, no limb clips through a prop, and no hand releases a grip unless
that release is visible. Preview at the intended in-game size throughout authoring.

## Acting choices

| Performer | Character of motion | Distinctive secondary action |
| --- | --- | --- |
| Chief Hamm | Grounded and capable; compact anticipation followed by a decisive gesture. | Moustache and coat settle after his chest; helmet shifts subtly and returns. |
| Sprocket | Eager, a little overcommitted, then visibly regains control. | Eye dart and small hand correction sell the fumble; keep the face readable. |
| Ember | Alert, low to the ground, quick head lead followed by body and tail. | Ear follow-through and a distinct bark jaw shape, not a whole-body pulse. |
| Trotter family | Danger gives way to relief; gestures stay readable at room size. | Preserve each silhouette, grandma's cat contact, both twins, and the baby's supported pose. |

## Priority sequences

**Chief spray: `spray_start` → `spray_loop` → `spray_end`.** Within the 0.6 s start,
Chief looks toward the target, lowers his weight, brings the nozzle into its firing pose and braces
both hands. Place `spray_on` at the moment the nozzle is aimed and both grips are secure. The loop
uses a restrained recoil through wrists, elbows and shoulders while feet remain planted. The
nozzle anchor must follow the muzzle exactly. On the 0.5 s end, place `spray_off` before lowering
the nozzle, release the brace, then let coat and helmet settle. The start's last pose must match
the loop's first pose without relying on a crossfade to hide a discontinuity. Inspect interruptions
during all three clips; no residual spray, stuck prop or pose jump may survive the interruption.

**Rescue: `wave_window` → `slide` → `land`; sheet `hold_sheet` → `catch`.** The wave
reads above the window edge, alternating a call for help with a brief held silhouette. In the 1.2 s
slide, the actor's root stays still: the game moves the rig along the ladder. Lean, hands and feet
should communicate travel without drifting away from that path. Prepare for contact near the end.
The 0.6 s land compresses at contact, rebounds modestly, then finds balance. Time the `land` event
to actual feet contact. Sprocket's 0.7 s catch begins on arrival, not departure: bend elbows/knees,
absorb weight, then recover while hands stay on the sheet anchors. Ember maintains his corner.
The landing reaction must still read without a dust burst. Review every family skin; cats and twins
must travel as supported characters rather than disconnected attachments.

**Readable wins.** `win` is a single compact fist pump with a settled end; `big_win` has a stronger
anticipation and a clearly different silhouette. `celebrate` may use an additional gesture but must
return cleanly to its loop. `point_reels` leads with the gaze, then arm, then a short readable hold.
Tier-zero outcomes stay neutral; the director decides eligibility from the actual round return.
Do not embed screen shake, coins, water, flames, lettering or audio in character rigs.

**Ambient and card acting.** Chief's 4–6 s idle breath is visible in chest and shoulder motion,
with a much smaller delayed helmet response. `idle_alt` has one readable watch/bugle business,
then returns to a compatible pose. Avoid a mechanical blink at identical points in every gesture.
Sprocket's card flip includes a hand lead, edge-on turn, readable reveal and grip recovery;
`flip` marks the visual turnover. The fumble is staged as anticipation, mistake, recognition and
recovery within 2.5 s. Ember's bark has a distinct intake and jaw opening; key `bark` on the vocal
action. False-alarm sadness is brief and restrained, ending without a frozen extreme expression.

## Authoring and review sequence

1. Build the Chief spray pilot with accepted original parts. Check pivots, hidden paint and anchors
   before extending the rig. Do not propagate a flawed shoulder/hand setup to every clip.
2. Review normal-speed clips first, then quarter speed for seams and contact. Check first/last
   loop frames, the join to idle, and crossfades from unrelated poses.
3. Review the complete rescue/catch pair in one scene, including two or more queued rescues,
   all five skins, interrupted playback, and a building change. Individual clips cannot prove
   that their contact points and timings work together.
4. Inspect desktop, portrait and smallest supported popout sizes. Faces, props and the main
   gesture must survive at those sizes; unclipped room/mascot/HUD boundaries are required.
5. Capture each clip and both complete sequences against the exact export hash. Include normal,
   turbo, super-turbo and reduced-motion completion in runtime evidence. A static validator pass
   does not certify motion quality, and an empty readiness page does not constitute a viewer test.

Before accepting a rig, record: export hashes, clip/skin coverage, runtime/build identity, viewport,
playback speed, capture paths, reviewer observations and unresolved defects. A hero contact sheet
or promising single frame is useful art evidence, but the acceptance decision uses recorded motion.
