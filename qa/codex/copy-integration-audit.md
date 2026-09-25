# Player-copy integration audit

Read-only source review of `d19c366`, 2026-09-25. These are concrete Phase B copy
corrections for Claude-owned files. No browser, translation, live RGS or submission
acceptance is claimed. Recheck the landed source before applying; the port review
is still active.

| Location | Conflict with GAME_CONTRACT v1.2.2 | Suggested wording |
| --- | --- | --- |
| `apps/piggy_firefighters/src/game/rulesContent.ts`, symbols paragraph | "multiple of the total bet" can describe the charged ante/feature price, while awards use base amount B. The how-to section already correctly says base bet. | "as a multiple of the base bet" / social "base play amount" |
| Same file, WILD special | "all five reels in the features" incorrectly includes ordinary reel W in Backdraft Spins. Contract §3 restricts ordinary W to reels 2–5 in base, ante and Backdraft Spins; only Rescue/Inferno use all five. | "On reels 2–5 in the base game, ALARM BOOST and BACKDRAFT SPINS; on all five reels in RESCUE SPINS and INFERNO RESCUE. A Backdraft can create a Blaze Wild on any reel." |
| Same file, Backdraft note | "never inside a feature" contradicts Backdraft Spins, where every spin has a Backdraft. | "It never happens on a spin that starts Rescue Spins or Inferno Rescue, or during either rescue feature. Every Backdraft Spins spin has its own Backdraft." |
| `apps/piggy_firefighters/src/components/splash/copy.ts`, `SPLASH_CARD_CHIEF_BODY` | "every symbol on the line" includes ALARM/GALARM, which W never substitutes for. Keep the short card compatible with social wording. | "The chief of Station 13 is WILD: he substitutes for symbols that form line wins, but never for alarms." |

The authoritative values are contract §1 (base B versus charged S), §3 (W reel
availability/substitution), §4 (natural Backdraft exclusions) and §7 (Backdraft
Spins). Check any translated catalogue override for the same claims.

`MEASURED TODO` frequency strings remain a known production integration dependency:
replace them from the completed, audited M3 report and identify the exact report
fields. The active M3 library was not read during this review. Existing developer
comments with donor names are not being misreported as visible player-copy defects.
