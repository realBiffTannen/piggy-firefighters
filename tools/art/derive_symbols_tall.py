#!/usr/bin/env python3
"""Derive the PORTRAIT (tall, 384x500) reel-symbol tiles for PIGGY FIREFIGHTERS (mobile portrait cells are 1.3x
taller than wide; the family's "86 x 92" box).

Sources: gpt-image edits of the ACCEPTED square sources re-composed ~1:1.4 at 1024x1536 ("Compose it for a TALL
portrait 2:3 canvas so the object is about 1.4 times taller than it is wide and fills the canvas from top to
bottom"), default names "symbols/sym_tall_<id>", overridden by art-src/generated/symbols_tall.sources.json,
--map, --src. With --from-square a missing tall source falls back to the square source (width-bound tile) so the
set is always complete.

Per symbol: clean specks, trim to the INK box, fit so the object touches 86 % of the width or 92 % of the height,
whichever limits first, centre on 384x500, lossless WEBP -> sprites/symbolsCartoonTall/symT_<ID>.webp + manifest.
W / W_blaze are lettered exactly as the square set; W_blaze and pose B are tiled at their base symbol's scale.
ALARM / GALARM with --bonus-tag: alarm above, BONUS tag at the foot, composed at the box aspect.
Runtime keys: symT_H1 ... symT_W_BLAZE, symT_ALARM (ReelStrips swaps sym_ -> symT_ in stacked layouts).

Usage:
  python3 tools/art/derive_symbols_tall.py [--tile-w 384 --tile-h 500 --fill 0.92 --fill-w 0.86]
      [--from-square] [--bonus-tag] [--only ...] [--map m.json] [--src ID=path] [--out <assets root>]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (GEN, QA, contact_sheet, exists_src, fill_ratio, fit_to_box, matched_scale,  # noqa: E402
                        out_root, prepare_out, rel, src_path, save_webp, write_json)
from derive_symbols import (ALL_IDS, MATCHED, OPTIONAL, file_name, load_map, place_box, prepare_sources,  # noqa: E402
                            runtime_key)

TALL_MAP_FILE = os.path.join(GEN, "symbols_tall.sources.json")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tile-w", type=int, default=384)
    ap.add_argument("--tile-h", type=int, default=500)
    ap.add_argument("--fill", type=float, default=0.92, help="fraction of the tile HEIGHT the ink may touch")
    ap.add_argument("--fill-w", type=float, default=0.86, help="fraction of the tile WIDTH the ink may touch")
    ap.add_argument("--only", default="")
    ap.add_argument("--map", default="")
    ap.add_argument("--src", action="append", default=[])
    ap.add_argument("--from-square", action="store_true", help="fall back to the square source when no tall one")
    ap.add_argument("--square-map", default="", help="square source map json for --from-square (as derive_symbols --map)")
    ap.add_argument("--bonus-tag", action="store_true")
    ap.add_argument("--wild-style", default="red-on-cream", choices=("red-on-cream", "cream-on-red"))
    ap.add_argument("--allow-blank-blaze", action="store_true")
    ap.add_argument("--no-writeback", action="store_true")
    ap.add_argument("--out", default="")
    ap.add_argument("--contact", default=os.path.join(QA, "symbols_tall_contact.png"))
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()

    tall = load_map(a.map, a.src, kind="tall", map_file=TALL_MAP_FILE)
    square = load_map(a.square_map) if a.from_square else {}
    srcs, route = {}, {}
    for sid in ALL_IDS:
        if sid in tall and exists_src(tall[sid]):
            srcs[sid], route[sid] = tall[sid], "tall"
        elif sid in square and exists_src(square[sid]):
            srcs[sid], route[sid] = square[sid], "square-fallback"
    ids = [s for s in ALL_IDS if not a.only or s in a.only.split(",")]
    need = sorted(set(ids) | {MATCHED[s] for s in ids if s in MATCHED})
    ims, pending, badges = prepare_sources(need, srcs, a.wild_style, a.allow_blank_blaze, not a.no_writeback)
    TW, TH, FH, FW = a.tile_w, a.tile_h, a.fill, a.fill_w
    out_dir = prepare_out(os.path.join(out_root(a.out), "sprites", "symbolsCartoonTall"))
    man_path = os.path.join(out_dir, "manifest.json")
    man = json.load(open(man_path)) if os.path.isfile(man_path) else {}
    man.update({"tile": [TW, TH], "fill": FH, "fill_w": FW, "generated_by": "tools/art/derive_symbols_tall.py",
                "rule": "ink (alpha>24) touches fill_w of the width or fill of the height, whichever limits first"})
    for k in ("files", "sources", "route", "ink", "labels"):
        man.setdefault(k, {})
    tiles = []
    for sid in ids:
        if sid not in ims:
            continue
        k = None
        if sid in MATCHED:
            base = MATCHED[sid]
            if base not in ims:
                pending.append(f"{sid} (needs {base})")
                continue
            ref = ims[base]
            if route.get(sid) != route.get(base) and route.get(sid) == "square-fallback" and base in square:
                # the matched pose must be scaled against its base drawn on the SAME canvas (square source)
                from art_common import load_clean

                ref = load_clean(square[base])
                print(f"  {sid}: square-fallback, scaled against the square {base}")
            k = matched_scale(ref, TW, TH, FW, FH)
            tile = fit_to_box(ims[sid], TW, TH, FW, FH, scale=k)[0]
        elif sid in ("ALARM", "GALARM") and a.bonus_tag:
            from make_symbol_labels import bonus_tall

            tile = bonus_tall(ims[sid], sid, TW, TH, FW, FH)
            man["labels"][runtime_key(sid, "symT_")] = "bonus_tag"
        else:
            tile = fit_to_box(ims[sid], TW, TH, FW, FH)[0]
            man["labels"].pop(runtime_key(sid, "symT_"), None)
        key = runtime_key(sid, "symT_")
        fn = file_name(sid, "symT_")
        save_webp(tile, os.path.join(out_dir, fn), lossless=True, quality=100)
        fw, fh = fill_ratio(tile)
        man["files"][key] = fn
        man["sources"][key] = rel(src_path(srcs[sid]))
        man["route"][key] = route[sid]
        man["ink"][key] = [round(fw, 3), round(fh, 3)]
        if sid in badges:
            man.setdefault("wild_badge", {})[key] = place_box(ims[sid], badges[sid], TW, TH, FW, FH, scale=k)
        print(f"{sid:8s} {route[sid]:15s} -> {fn}  ink {fw * 100:.0f}% x {fh * 100:.0f}%")
        tiles.append((key, tile))
    write_json(man_path, man)
    if tiles and a.contact:
        print("contact ->", rel(contact_sheet(tiles, a.contact)))
    pending = [p for p in pending if p.split(" ")[0] not in OPTIONAL]
    if pending:
        print("PENDING (no accepted source yet):", ", ".join(pending))
    print(f"wrote {len(tiles)} tall tiles -> {rel(out_dir)}")
    if a.strict and pending:
        sys.exit(1)


if __name__ == "__main__":
    main()
