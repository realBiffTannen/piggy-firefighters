# PIGGY FIREFIGHTERS — draft review introduction

**DRAFT, 2026-09-25. Not posted.** The final `game/dist` binding is the coordinator's and the human gates below are open. The reviewer-facing draft follows the brief, welcoming style of LUCKY's `docs/submission/STAKE_REVIEW_INTRODUCTION_COMMENT.md`, with this game's contract and evidence notes. Reconcile the pending items with the [pre-upload checklist](PRE_UPLOAD_CHECKLIST.md) before posting.

## Reviewer-facing draft

Thank you for reviewing PIGGY FIREFIGHTERS, our Piggy-family slot set at Station 13 of the Piggy Fire Department: a 5×3, 20-line game where Chief Hamm, the rookie Sprocket and Ember the Dalmatian pup douse rooms, rescue the Trotter family and chase a rising Rescue Multiplier. Everything in it is original to this title: the artwork, the four Spine character rigs, the music and sound, and the 3D-rendered win pieces. We hope you enjoy its warm, heroic-comic tone and appreciate your time and feedback.

PIGGY FIREFIGHTERS offers six modes. All costs below are multiples of the base bet; ALARM BOOST is a toggle on the ordinary spin and the four feature modes are buys, shown on the feature cards in ascending price.

| Mode | Internal key | Cost |
| --- | --- | ---: |
| Base game | `base` | 1x |
| ALARM BOOST (toggle: 2× the chance of each bonus) | `ante` | 1.5x |
| ALARM CALL (one call: Rescue Spins, Inferno Rescue or a False Alarm) | `alarm_call` | 12x |
| RESCUE SPINS (10 spins) | `rescue` | 18x |
| BACKDRAFT SPINS (5 spins, multiplier Blaze Wilds) | `backdraft_spins` | 50x |
| INFERNO RESCUE (10 spins, instant prizes) | `inferno` | 90x |

The advertised RTP is **96.70% in every mode**, and the maximum win is **15,000x the base bet per round in every mode**. A round that reaches the cap ends at once and pays the maximum.

Our previous Piggy title was declined for animation quality. This game was built to answer that: four original Spine 4.2 rigs (Chief Hamm with ten clips, Sprocket with seven, Ember with five, and the Trotter family as one rig with five skins) drive the mascot, the ambient crew and every rescue, with nineteen animation beats wired from the book events; the base, Backdraft, Rescue and Inferno scenes, symbols, cards and splash are new illustrations; the score and 232 sound cues are new and mastered to a shared loudness target; and the win rungs and fountain coin are rendered from 3D models. These are implemented changes, not a claim that a prior review outcome has been cleared.

Local production math verification passed on 1,840,000 simulation trials (3,630,001 published rows across the six modes), with an independent audit of the published weights. Final assembled-build checks and human acceptance remain separate: before submission we still owe a listening pass, a motion and usability pass on a real phone, and a recorded review of every rig clip. The final submission must identify the exact frontend and math versions covered by its completed checks.

## Coordinator notes — not part of the posted comment

- Mode keys, costs, RTP and cap above match `apps/piggy_firefighters/src/game/config.ts`, `apps/piggy_firefighters/src/game/names.ts`, `math/publish/index.json` and `docs/GAME_CONTRACT.md` §2/§9. Mode titles are `MODE_TITLE` in `names.ts`; the card order is ascending price (contract v1.2.1 §2).
- RTP is the LUT-exact 0.96699999 in every mode (`docs/math/MATH_PF_REPORT.md`); it displays as 96.70%. Do not promise an exact infinite-precision 0.967.
- The predecessor statement comes from `docs/ANIMATION_CONTRACT.md` line 3 ("deliver substantially better animations after Piggy Police's rejection"). The draft names no score, no reviewer and no tag, and does not say the rejection is cleared.
- Rig facts: `docs/ANIMATION_CONTRACT.md` (rig table), `check_contract.py` PASS ×4 and the four export commits in `PROGRESS.md` (`9185703`, `abdd623`, `df6f2dd`, `75b148a`). The recorded per-clip motion review the contract asks for was NOT RUN (owner's instruction); the draft lists it as owed rather than done.
- Art/audio/3D provenance: `art-src/generated/source-record.json` (134 OpenAI calls), `audio/source-record.json` (232 cues, −14 LUFS target, `measure.py` PASS 16/16 per `PROGRESS.md`), `art-src/3d/renders/source-record.json` (Blender turntables). Human listening pass NOT RUN.
- The math sentence describes the local production run and independent audit (`qa/codex/math/m3-audit.json` PASS). It is not evidence of Engine ingestion, a remote launch or approval.
- Remove or update the "we still owe" sentence only when the owner has recorded each item's outcome.
