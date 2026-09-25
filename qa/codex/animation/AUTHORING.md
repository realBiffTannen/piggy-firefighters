# Spine 4.2 authoring and export handoff

**Prepared, not delivered motion.** Original parts are pending. Pinned CLI help
returned exit 0 with `--update 4.2.43 --disable-audio`; the coordinator separately
verified 4.2.43 Professional. Original-asset import, native project save, atlas
export and motion acceptance remain **NOT RUN**. No production fixture was made.
Never open these projects in 4.3 or substitute `latest`/`4.2.xx` for **4.2.43**.

## Exact JSON syntax

Authority is the installed **spine-core 4.2.74** parser:
[`SkeletonJson.js`](../../../packages/pixi-svelte/node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js).
The [public format guide](https://en.esotericsoftware.com/spine-json-format)
still mixes older examples; use the pinned parser when they differ.

| Area | Required shape / exact behavior | Installed source lines |
| --- | --- | --- |
| Metadata/setup | `skeleton.spine: "4.2.43"`; positive exported bounds; parent bones before children; setup rotation is `rotation`, setup scale is `scaleX`/`scaleY`. | 59–113 |
| Bone clips | `animations[clip].bones[bone].rotate: [{time, value}]`; **not `angle`**. `translate`/`scale`/`shear` use `x`,`y`; single-axis variants use `value`. Names are case-sensitive. Translation/rotation are setup-relative; scale keys multiply setup scale. | 659–720; `Animation.js` 300–420, 468–471, 554–564 |
| Curves | Put `curve` on the earlier key. Omit for linear; use `"stepped"` for a hold. Bézier is four numbers **per channel**, `[handleTime1, handleValue1, handleTime2, handleValue2]`, in absolute clip seconds and that channel's units. `translate` has eight numbers (X then Y); `rgba` has sixteen (R,G,B,A). Do not reuse normalized 0–1 easing arrays as time/value data. | 1072–1131; `Animation.js` 209–230 |
| Slots | `animations[clip].slots[slot]` supports `attachment`, `rgba`, `rgb`, `alpha`, `rgba2`, `rgb2`. A color timeline is `rgba: [{time, color:"ffffffff"}]`, **not a timeline named `color`**. `attachment` keys use `name` (or null to hide). | 511–656 |
| Skins | `skins` is an array. Each item has `name` and `attachments[existingSlot][attachmentName]`. Region attachment `path` identifies its atlas region, without `.png`; `width`/`height` are required region dimensions. Slots are declared globally, never added by a skin. | 258–320, 364–389 |
| Events | Declare `events: {"spray_on": {}, "spray_off": {}}` at the skeleton root; key `animations[clip].events: [{"time":0.4,"name":"spray_on"}]`. Undeclared keyed events fail parsing. Omit `audio`: runtime owns sound/FX. | 339–351, 1031–1050 |
| Duration/loop | Times are seconds, ascending. Duration is the maximum last key time; no top-level clip `duration` or `loop` flag supplies it. Runtime chooses looping. End keys must preserve the agreed duration and loop seam. | 1052–1055 |

Illustrative rotation segment only (not a production clip):

```json
{"rotate":[
  {"time":0.2,"value":0,"curve":[0.3,0,0.5,12]},
  {"time":0.6,"value":12}
]}
```

The [official 4.2 source branch](https://github.com/EsotericSoftware/spine-runtimes/blob/4.2/spine-ts/spine-core/src/SkeletonJson.ts)
provides a public reference; the installed 4.2.74 copy above pins this checkout.
The static checker now rejects legacy `angle`, legacy slot `color`, and incorrectly
capitalized bone timeline names such as `Rotate`; 23 focused regressions pass.
It remains a limited preflight, not a replacement for the actual parser/editor.

## Native project and export commands

After accepted Chief parts arrive, work in `art-src/animation/rigs/pf_chief/`:
author `pf_chief.json` beside its `images/`, with `skeleton.images: "./images/"`.
Use only original accepted/derived parts and record their source hashes. Preserve
the feet-centre pivot and 420px standing scale. Import once; after editing, the
`.spine` project is authoritative. Never import over an existing edited project.

Run from the repository root. These are prepared commands, **not executed here**:

```sh
set -euo pipefail
PF_SPINE=/Applications/Spine.app/Contents/MacOS/Spine
PF_RIG=pf_chief
PF_RIG_DIR="$PWD/art-src/animation/rigs/$PF_RIG"
test -s "$PF_RIG_DIR/$PF_RIG.json"
test ! -e "$PF_RIG_DIR/$PF_RIG.spine"
"$PF_SPINE" --update 4.2.43 --disable-audio \
  -i "$PF_RIG_DIR/$PF_RIG.json" -o "$PF_RIG_DIR/$PF_RIG.spine" -r
```

The JSON basename sets the skeleton name, avoiding the import-renaming difference
between the installed launcher's `--to` help and older guide examples. The common
plain `-r` import form is also used by the existing pinned family authoring scripts.
CLI import creates a project when the output does not exist; export `-i`/`-o`
override the saved preset's paths. [Official CLI reference](https://en.esotericsoftware.com/spine-command-line-interface#Import)

Save a JSON export preset from **4.2.43's Export dialog** as
`export/pf_chief.export.json`. The following are the relevant verified setting
keys; keep any additional fields the editor saves:

```json
{
  "class":"export-json", "project":"", "output":"", "open":false,
  "extension":".json", "format":"JSON", "prettyPrint":true,
  "nonessential":true, "cleanUp":false, "warnings":true,
  "packSource":"attachments", "packTarget":"perskeleton",
  "packAtlas":{
    "stripWhitespaceX":true, "stripWhitespaceY":true,
    "maxWidth":2048, "maxHeight":2048, "outputFormat":"png",
    "premultiplyAlpha":false, "bleed":true, "bleedIterations":2,
    "scale":[1], "scaleSuffix":[""], "paddingX":4, "paddingY":4,
    "edgePadding":true, "rotation":false, "pot":true,
    "filterMin":"Linear", "filterMag":"Linear", "format":"RGBA8888",
    "atlasExtension":".atlas", "flattenPaths":false, "useIndexes":false
  }
}
```

This keeps straight alpha, trimmed regions, 1× desktop scale and pages at most
2048². Bleed protects straight-alpha filtered edges. Multiple pages are allowed;
do not silently downscale to force one page. Attachment packing uses its embedded
settings, not per-folder `pack.json`. [Texture packing settings](https://en.esotericsoftware.com/spine-texture-packer#JSON-Configuration)
Retain nonessential data for authoring round trips; native `.spine` remains the
editable source. Do not clean away intentional hold/end keys during the pilot.
[Export settings](https://en.esotericsoftware.com/spine-export#JSON)

```sh
test -s "$PF_RIG_DIR/$PF_RIG.spine"
test -s "$PF_RIG_DIR/export/$PF_RIG.export.json"
PF_CANDIDATE="$(mktemp -d "$PF_RIG_DIR/export/candidate.XXXXXX")"
"$PF_SPINE" --update 4.2.43 --disable-audio \
  -i "$PF_RIG_DIR/$PF_RIG.spine" -o "$PF_CANDIDATE/$PF_RIG" \
  -e "$PF_RIG_DIR/export/$PF_RIG.export.json"
python3 -B art-src/animation/tools/check_contract.py \
  --rig "$PF_RIG" --runtime-root "$PF_CANDIDATE"
```

Use a fresh candidate directory so stale pages cannot masquerade as new output.
Keep license/activation identity out of captured logs. Technical preset keys were
also cross-checked read-only against the family's existing 4.2.43 saved preset;
no donor images, skeletons, animation curves or its 0.5× texture scale were copied.

## Handoff boundary

Check all pages and all skins; `pma:true` is forbidden (the 4.2 atlas parser
defaults omitted `pma` to false: `TextureAtlas.js` 55–56, 237). Then hand off exact
JSON/atlas/PNG hashes for promotion to
`apps/piggy_firefighters/static/assets/spine/pf_chief/` and reload `/rigs`.
Missing original parts or export files mean **BLOCKED**, not a synthetic pass.

Follow `docs/ANIMATION_CONTRACT.md` and `art-src/animation/rigs/DIRECTION.md`:
every root neutral, two visibly moving bones per clip, correct anchors/events,
Chief spray pilot first, compatible spray joins, and all required clips/skins.
Capture normal/quarter-speed clip review and then director-level contact,
interruption, speed-tier and reduced-motion review. Static PASS and successful
Spine export do not certify motion craft or release acceptance.
