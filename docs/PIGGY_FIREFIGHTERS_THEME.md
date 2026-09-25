# PIGGY FIREFIGHTERS — theme bible (v1, 2026-09-25)

Owner brief (verbatim intent): "a game based on firefighting named Piggy Firefighters that follows the same look
and feel of the other games but with a firefighting type theme"; "focus on making perfect animations, sound
effects, visual effects, transitions, cards, win rungs, gameplay thoroughness, bonus uniqueness, asset
quality"; "all of the artwork and assets should be unique to piggy firefighters"; the other repositories are
"source material reference for inspiration" only. Spend on the highest-quality sound, images and other assets
is authorized (owner, 2026-09-25, via Codex) — the target is a **3-star title**. Platform name in every
player-facing string: **Engine**.

Internal ids (symbol codes, bet-mode keys, book event types) are in `docs/GAME_CONTRACT.md` and never change; this
file is what the player sees and hears.

## 1. World and tone

**Station 13 of the Piggy Fire Department**, a red-brick firehouse on the edge of a cartoon city at dusk. The
crew are pigs (this is the Piggy family: pigs are the cast, unlike LUCKY). Tone: warm, heroic-comic, never
grim — fire here is a bright, bouncy cartoon element; nobody is ever hurt, the rescued family waves and the
dog steals the show. Comedy is situational (the rookie tangled in hose, the cat that will not come down, the
chief's helmet that never fits) — no ethnic or body caricature, no violence, no real-world brands or badges.

Art style = the Piggy family cartoon grammar: **thick dark-brown ink**, chunky rounded shapes, flat cel shading
with one hard shadow tone, small saturated palette — **engine red (#D7262B), brass gold (#E9B23B), hydrant yellow
(#F5D23C), hose cream (#F4E9D2), smoke blue-grey (#7C8AA0), dusk navy (#1E2A4A)**, flame orange (#FF7A1A) reserved
for fire/Backdraft/win FX so it always means "something is happening". Everything must read at reel scale
(~85 px desktop, ~40 px phone). All art is original (OpenAI gpt-image via `tools/art/gen_art.py`, donor assets
used as composition references only), every paid call recorded in the lane's `source-record.json`.

## 2. Characters

| Role | Name | Notes |
|---|---|---|
| Hero / WILD / splash | **Chief Hamm** — stout pig fire chief, white helmet with a brass "13" shield, red turnout coat with yellow reflective bands, moustache, brass bugle on the belt | WILD symbol (holds a WILD badge), mascot beside the reels, spray hero in the bonus |
| Rookie | **Sprocket** — lanky young pig, helmet too big, always mid-fumble with the hose | Ambient loops, Backdraft reaction, Alarm Call card presenter |
| Dog | **Ember** — Dalmatian pup in a tiny helmet (the only non-pig) | Ambient, celebrates wins, barks at the alarm |
| The rescued | **The Trotter family** — five skins of one rig: `grandma` (with her cat), `twins`, `dad` (bathrobe), `baby` (blanket), `teen` (headphones, oblivious) | One per room; room r of building b shows skin `[(r + b) mod 5]` so rescues vary across buildings; distinct silhouettes |

## 3. Reel symbols (contract §3)

| Id | Player name | Art direction |
|---|---|---|
| H1 | Fire Truck | three-quarter red ladder engine, brass bell, "13" on the door, chrome grille |
| H2 | Fire Helmet | red leather helmet, brass front shield with the PFD crest (a pig snout in a flame) |
| H3 | Axe & Halligan | crossed red-handled axe and black halligan bar, brass rivets |
| H4 | Extinguisher | brass-and-red extinguisher with a black hose, gauge needle in the green |
| L1 | Brass Nozzle | coiled cream hose with a brass nozzle |
| L2 | Water Bucket | wooden bucket, water sloshing, one drop mid-air |
| L3 | Ladder | short wooden-and-brass ladder section |
| L4 | Fire Boots | black rubber boots with yellow trim |
| W | Chief Hamm WILD | Chief Hamm bust holding a red badge reading WILD |
| Blaze Wild | (W on fire) | the WILD plate wrapped in orange flame with embers — Backdraft only |
| ALARM | Fire Alarm | brass alarm bell on a red box, glowing when it lands; the bonus symbol |
| GALARM | Golden Alarm | gold bell, gold box, warm rim light — rare, routes to Inferno Rescue |

Two symbol sheets (square 88×88 and portrait 86×92) as the family uses, plus tall alarm tiles for the
anticipation reel. Every symbol sits in the same fit-box as the donor's.

## 4. Scenes

- **Base game:** the truck bay of Station 13 seen from the street at dusk. The reel frame is the side of the
  ladder truck (red panel, chrome rail, brass line-number plates). Chief Hamm stands left of the reels; Ember
  sits right. Windows glow, a hydrant on the kerb, the alarm bell over the bay door (it swings on scatter lands).
- **Backdraft:** the bay door blows open in a flash, a wave of cartoon flame rolls across the reels and the
  ignited cells burst into Blaze Wilds; embers drift up; the frame's chrome catches an orange rim light for one
  second.
- **Rescue Spins:** night, the truck has pulled up to a five-room apartment block that sits ABOVE the reels
  (one window per reel column). The ladder rises from the truck to the block. Each room burns at level 2/1/0
  (roaring / smouldering / dark-and-safe with a pig waving from the sill). A W on reel r fires the hose from the
  truck nozzle to window r (spray arc, steam), a rescued pig slides down the ladder into a jump sheet held by
  Sprocket and Ember, and the multiplier badge on the truck door ticks up.
- **Inferno Rescue:** the same block at night with a red sky, embers everywhere, gold-rimmed windows, the
  ladder in brass; rescues shower coins (the instant prize) and the badge ticks +2.
- **Building cleared:** the truck reverses out, a new block slides in from the right with the siren; "NEXT
  BUILDING · +5 SPINS".
- **Alarm Call:** Sprocket at the station dispatch board; the card flips to Rescue / Inferno / False Alarm
  (the false alarm is a cat in a tree — Ember barks, nobody pays).
- **Backdraft Spins:** the base scene with the bay door held open and the 5-spin counter on a brass plate.

## 5. Modes and copy hooks (contract §2)

| Key | Cost | Title | Card line |
|---|---|---|---|
| ante | 1.5x | ALARM BOOST | 2x the chance to trigger Rescue Spins and Inferno Rescue |
| backdraft_spins | 25x | BACKDRAFT SPINS | 5 spins, every spin a Backdraft of 3–5 Blaze Wilds carrying x2–x10 that ADD UP along a line |
| alarm_call | 40x | ALARM CALL | Rescue Spins · Inferno Rescue · or a False Alarm that wins nothing |
| rescue | 60x | RESCUE SPINS | 10 spins, five rooms, every rescue +1x and +1 spin |
| inferno | 300x | INFERNO RESCUE | 10 spins, rooms fall in one spray, every rescue +2x, +1 spin and a prize |

Win rungs (art themed, names conventional and jurisdiction-safe): **BIG WIN** (≥ 15x) → **HUGE WIN** (≥ 30x) →
**MEGA WIN** (≥ 50x) → **EPIC WIN** (≥ 100x) → **MAX WIN** (cap). Thresholds are x bet on the round total,
derived client-side from the booked round total (family ruling 2026-09-24); no celebration when the return is
≤ the bet (UKGC-style rule, docs/AUDIO_MAP.md).

## 6. Audio direction (docs/AUDIO_MAP.md holds the cue list)

Warm brass-band-meets-modern-slot: a firehouse march motif on brass and glockenspiel in the base bed, a
driving siren-tinged bonus track, all mixed pleasant-first (the panel rule: abrasive gets muted). Anticipation
= a rising alarm-bell ostinato that steps up on the 2nd alarm and resolves on the trigger; reel stops vary per
reel (never the same click); Backdraft = whoosh + flame roar + a bright chord; hose spray = water rush +
steam hiss; rescue = a two-note brass "ta-da" that steps up with the multiplier; win tiers get their own
stingers with count-up loops; voiceover sparse (Chief Hamm: "Move out!", "Nice save!") with its own toggle
respect. ElevenLabs for every SFX/music/VO; every call recorded in `audio/source-record.json`.
