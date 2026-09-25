# Prompt files (ART lane)

Every paid call's prompt lives here as a file and goes through `tools/art/gen_art.py`. The full final prompt (the
preambles plus this file) is also copied into `art-src/generated/source-record.json`.

- Name: `<batch>_<name>.txt` (for example `b2_sym_sq_h1.txt`), matching `gen_art.py <batch> <name>`. The output is
  `art-src/generated/<batch>/<name>.png`.
- Shared preambles, prepended with `--preamble`:
  - `_style_sprite.txt`: transparent sprites, reel symbols, props and sheets.
  - `_style_painting.txt`: opaque plates, cards and max-win art.
  - `_style_character.txt`: any prompt that draws a pig (combine it with one of the two above).
- Number the references and say what each one is for. For example, "Image 1 is our studio pig: redraw the SAME pose,
  framing and proportions EXACTLY"; "Image 2 shows the LAYOUT only".
- Never ask the model for lettering. Ask for a BLANK, flat, near-white panel facing the viewer instead
  (`make_symbol_labels.py` letters it locally).
- A redraw gets a new name (`_r2`) and a `--note` naming the defect, with one redraw per named defect. Accepted
  outputs are reused and never rerolled speculatively.
