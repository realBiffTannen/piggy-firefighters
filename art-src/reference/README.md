# art-src/reference: style references only (NEVER shipped)

These files are **inputs to prompts** (`tools/art/gen_art.py --ref ...`). They never go into
`apps/piggy_firefighters/static/assets/**`, and no runtime pixel is derived from them.
`tools/art/verify_art.py` FAILS any runtime file that is byte-identical to a file here or to any LUCKY donor file.

| File | Origin | Use |
|---|---|---|
| `cartoon/pig.png` (1254x1254 RGBA) | Piggy family studio art (via `/home/user/lucky/art-src/reference/cartoon/pig.png`, read-only donor) | Character reference for Chief Hamm, Sprocket and the Trotters: head, snout, eyes, proportions, ink style, and the rig setup pose (canvas 1254, origin (634,1180)). **It wears the retired construction costume (hard hat, hi-vis vest, rolled plan). Every prompt must replace the costume in words** (`generated/prompts/_style_character.txt`). |
| `cartoon/paint.png` | same origin | STYLE ONLY for metal and liquid objects (bucket, extinguisher): ink weight, cel shading, highlight. Never copy the object. |
| `cartoon/woods.png` | same origin | STYLE ONLY for wood (ladder, bucket staves). |
| `cartoon/house-brick.png` | same origin | STYLE ONLY for red-brick buildings (Station 13, the apartment block). |
| `cartoon/tools.png` | same origin | COMPOSITION ONLY for a crossed pair (H3 Axe & Halligan). Shovel and hammer are construction tools and must never appear in an output. |

Rules: always say "the reference images define the STYLE ONLY, do not copy their objects" (see
`generated/prompts/_style_sprite.txt`). Never ship, trace, recolour or crop these pixels. Donor motion or design
videos are not kept here. `MANIFEST.json` records each file's sha256.

## Geometry references

- `geometry/board_frame_raw.png` (1536x1024 RGBA), the LUCKY donor frame raw from `/home/user/lucky/art-src/generated/board_frame_raw.png` (read-only). It is used as GEOMETRY ONLY for `scene/board_frame`: the outer rectangle, beam and post widths, corner blocks, mid-post brackets and the empty opening. Its timber and hazard stripe are retired construction art and must never appear. The derive warps our own painting, never these pixels.
