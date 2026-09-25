# Piggy Firefighters — thumbnail commission and delivery instructions

Status: production brief prepared; final artwork and validation are pending. This file does not certify delivery or platform approval.

## Owner brief

Create the most appealing, premium AAA-quality game tiles possible for **Piggy Firefighters**, in **3:4** and **16:9**. Each tile must feature **one character** against a **low-color background**. The owner has explicitly authorized the expense needed to achieve the highest quality. These tiles support the release's three-star ambition; that ambition is not an awarded rating.

## Art direction

- Feature one original, charismatic pig firefighter from the game's final approved character design. Keep the same face, proportions, costume, helmet, emblem and illustration style in both formats. Establish that identity with Claude's game art direction before final rendering.
- Make the face and eyes the emotional focal point: brave, capable, warm and slightly mischievous. Use a clear heroic pose, an immediately readable helmet and turnout gear, and exceptionally polished anatomy, hands, facial expression, contour and material rendering.
- A hose nozzle or one similarly recognizable firefighting prop may support the pose. Keep the prop subordinate to the face. No additional people, animals, silhouettes or reflected characters.
- Interpret **low color** as a restrained background palette: one dominant hue with at most two closely related supporting tones. It must look deliberately art-directed, with subtle depth if useful, rather than unfinished. Choose the actual color against the final character palette and record its RGB/hex value below at delivery.
- Use strong value separation and controlled warm/cool lighting. Preserve the game's illustrated style; do not introduce a photorealistic or unrelated glossy 3D character solely for the tile.
- Background detail must stay quiet. No busy burning city, crowd, collage, thick smoke over the face, particle clutter or competing focal object. Avoid excessive bloom, sharpening halos and effects that muddy the silhouette at small sizes.
- All artwork must be original to Piggy Firefighters. Reference repositories inform craft and hierarchy, never copied, traced, recolored or transplanted character pixels.
- Deliver clean artwork layers without baked-in game titles, multipliers, star ratings, badges claiming approval, typography or watermarks. Keep room for the final wordmark as a separate editor element.

## Compose each aspect ratio deliberately

**3:4:** Use a portrait composition with a large expressive face, readable shoulders/helmet and a confident character silhouette. Leave a quiet upper area for a separate game title. Keep essential features comfortably inside the canvas and check how the silhouette reads under rounded tile corners.

**16:9:** Recompose for landscape with the same character identity. Place the hero toward the right, looking or gesturing into the composition, and preserve useful quiet space on the left for a separate title. Do not stretch the portrait, clip the helmet/face/prop, or deliver a careless center crop.

Keep the face, helmet emblem and essential prop details at least 5% inside the canvas edges. The visual hierarchy is face, firefighter silhouette, title space, then background. Adjust pose and crop per format to achieve this hierarchy.

## Required files

These are chosen production master sizes, not a claim about platform upload limits. If the game's actual media editor requires different sizes, retain these masters and record separately exported dimensions.

| File | Dimensions | Role |
| --- | --- | --- |
| `foreground_3_4.png` | 1536 × 2048 | Character and essential prop, PNG RGBA with real transparency |
| `background_3_4.png` | 1536 × 2048 | Restrained background, opaque PNG RGB |
| `preview_3_4.png` | 1536 × 2048 | Flattened character/background review composite |
| `foreground_16_9.png` | 2048 × 1152 | Landscape character composition, PNG RGBA with real transparency |
| `background_16_9.png` | 2048 × 1152 | Restrained background, opaque PNG RGB |
| `preview_16_9.png` | 2048 × 1152 | Flattened character/background review composite |
| `instructions.md` | This document | Composition, upload and verified delivery record |
| `source-record.json` | JSON | Actual generation model/tool, prompts, references, source paths and final hashes; no credentials |

Keep editable/high-resolution source artwork and rejected candidates under `thumbnail/source/` and `thumbnail/review/`. Do not present those as final deliverables.

## Commission and review process

1. Claude coordinates the thumbnail art family with the main game's character/art production. Codex supplies this brief and checks the delivered layers. Avoid duplicate generation batches by recording the active generation owner in `docs/codex/FROM_CLAUDE.md`.
2. Develop a small selection of distinct pose/composition candidates, each containing just one character. Choose the strongest face, silhouette and small-size appeal before polishing both final formats. Use high-quality generation and targeted refinements as needed; preserve character identity between iterations.
3. Review each complete tile at full size and at **120 × 160** (portrait) and **320 × 180** (landscape), against the actual intended title placement. Fix issues visible at tile size, not merely those visible when enlarged.
4. Inspect both aspect ratios together for identity/style consistency, expression, anatomy, clean edges and title clearance. Recompose when needed instead of compromising one format to save a render.
5. Validate the final files on disk and fill in the delivery record. An attractive tool preview is not proof that the saved files have the correct dimensions or alpha.

## Layer placement / editor instructions

- Load the matching opaque background first; place the matching transparent foreground above it.
- Both layers use the same full-canvas coordinates. Align at `(0, 0)` with identical scale; do not independently auto-crop the foreground to its visible bounds.
- Preserve the original foreground alpha. A painted checkerboard or solid-color matte is not transparency.
- Keep the game wordmark separate and use the quiet title area. Do not cover the face, helmet emblem or essential prop.
- The `preview_*.png` files are flattened review images, not substitutes for the separate foreground/background layers.
- Use sRGB for delivery and inspect edge quality on light, dark and intended-color backgrounds.

## Delivery record — fill with measured results

- Production owner / handoff commit: pending.
- Final selected character source and model/tool provenance: pending.
- Final background editor color, RGB and hex: pending color selection; do not invent a delivered color before the art is selected.
- Both exact aspect ratios and saved-file dimensions: NOT RUN.
- Foreground mode `RGBA`, transparent exterior/gaps, opaque character interior, clean alpha edges without matte spill: NOT RUN.
- Background mode `RGB`, full opacity and restrained palette: NOT RUN.
- Single-character count, consistent identity, anatomy, expression, composition and small-size visual review: NOT RUN.
- File hashes and final file inventory: NOT RUN.
- Platform editor upload / approval: NOT RUN.
