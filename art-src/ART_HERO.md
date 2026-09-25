# ART_HERO — Chief Hamm identity sheet (art lane, 2026-09-25)

**Master of record:** `art-src/generated/hero/chief_hamm_master.png` (1024x1536, genuine RGBA alpha, raw model
output, never edited). It is the one-edit must-fix pass over the accepted candidate `hero/hero_c.png`; the call
is row `hero/chief_hamm_master` in `art-src/generated/source-record.json`. Every character, WILD, card, rig part and
thumbnail uses this PNG as the **first reference image** in an edits call, and the costume is also described in
words (the model drifts when only the picture carries it).

Must-fix notes applied (judged against the master at full size and at 40 px): the brows are near-level and
confident (no V scowl); the far eye has a larger white clear of the snout and ear; both pupils carry one hard white
catch-light upper-left; the belt hand is a defined hand (thumb + separated fingers) gripping the bugle's brass
ring; the pointing hand shows separated curled fingers and keeps a ~30 px margin inside the canvas.

## Proportions (measured on the master, figure 1373 px tall from helmet crown to boot sole)

| Part | Share of height | Notes |
|---|---|---|
| Helmet + head (crown to chin) | ~40 % | about 2.5 heads tall; the head is the read at 40 px |
| Helmet alone (crown to brim) | ~21 % | brim wider than the head; worn low and slightly forward |
| Torso (collar to coat hem) | ~33 % | square-shouldered, hydrant-stout, chest out |
| Legs + boots | ~27 % | short, wide stance; boots big and rounded, soles flat |
| Hands | fist ~ the snout's width | four-fingered cartoon hand with a thumb; fingers separated by ink |

Face: short, flat, wide snout (two dark oval nostrils), white almond-to-round eyes with round black pupils and one
white catch-light each, heavy but **level** brows, a thick dark-brown chevron moustache, open warm smile with a pink
tongue, soft cheek blush. Ears: pink, triangular, folded slightly forward, outside the helmet brim.

## Colours (sampled from the master; the theme hexes are the targets)

| Role | Master sample | Theme target |
|---|---|---|
| Pig skin | `#F39F7B` (light) | pig pink, blush a darker salmon |
| Turnout coat | `#EC1F1A` | engine red `#D7262B` |
| Reflective bands | `#FDF656` | hydrant yellow `#F5D23C` |
| Badge, bugle, buckle, clasps | `#F9C761` | brass gold `#E9B23B` |
| Helmet shell | `#FBF5F0` | hose cream `#F4E9D2` shadowed; white shell |
| Trousers / collar lining | `#2A282F` | dusk navy `#1E2A4A` |
| Moustache, brows | `#5E2317` | dark brown |
| Ink outline | `#2A0704` | thick dark-brown ink, never pure black |
| Boots | `#2A282F` + grey highlight | black-brown rubber |

Flame orange `#FF7A1A` is FX only and never part of his costume. Smoke blue-grey `#7C8AA0` is for environment.

## Costume rules (every depiction)

1. White fire helmet with a front **brass shield plate that is BLANK** (smooth, no numbers or letters in art; a
   "13" or any lettering is added locally with `tools/art/make_symbol_labels.py` when a surface needs it).
2. Deep engine-red turnout coat, hip length, with hydrant-yellow reflective bands on both sleeves (two bands),
   across the chest and at the hem; brass toggle clasps down the front; dusk-navy collar lining.
3. Black belt with a square brass buckle; the polished brass bugle hangs from a brass ring on his right hip (his
   left hand side of the picture).
4. Dusk-navy trousers with a yellow band above the boot; black rounded fire boots with thick soles.
5. Pink pig skin, curly tail visible behind the coat hem, moustache always present.

## What never changes

- Identity: moustache shape, flat wide snout, level confident brows, white eyes with catch-lights, stout hydrant
  silhouette, helmet worn low. He is warm-heroic, never angry, never a caricature; nobody is ever hurt.
- Style: thick dark-brown ink around every shape, chunky rounded forms, flat cel shading with ONE hard shadow tone
  and one small cream highlight, light from the top left, no gradients, no airbrush glow, no 3D render look.
- No text, numbers or logos in generated art (letter locally). No hard hats, hi-vis vests, construction tools,
  police, lanterns or dragons. No flames on him except the Blaze Wild FX layer.

## Supporting cast (same grammar; detail in `art-src/animation/parts/REGISTRATION.md` and each rig master)

- **Sprocket** (rookie): lanky young pig, same coat/band scheme but a helmet visibly too big (brim over the brows),
  no moustache, freckled snout, eager wide eyes.
- **Ember** (dog): Dalmatian pup, white with black spots, a tiny red helmet with a blank brass plate, red collar.
- **Trotter family** (rescued): civilian pigs, no firefighter kit; grandma + cat, twins, dad in a bathrobe, baby in
  a blanket, teen with headphones.
