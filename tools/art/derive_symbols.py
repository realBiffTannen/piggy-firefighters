#!/usr/bin/env python3
"""Derive the SQUARE reel-symbol tiles (desktop / landscape) for PIGGY FIREFIGHTERS.

Reads accepted gpt-image sources under art-src/generated/** (NEVER modified; lettered masters are written BESIDE
them as <name>_lettered.png) and writes one standalone lossless WEBP per symbol with genuine alpha:

  apps/piggy_firefighters/static/assets/sprites/symbolsCartoon/sym_<ID>.webp   (+ manifest.json)

ids (docs/GAME_CONTRACT.md section 3, theme bible section 3):
  H1 Fire Truck  H2 Fire Helmet  H3 Axe & Halligan  H4 Extinguisher
  L1 Brass Nozzle  L2 Water Bucket  L3 Ladder  L4 Fire Boots
  W Chief Hamm WILD (badge lettered locally)   W_blaze the Blaze Wild (same framing as W, W's scale)
  ALARM Fire Alarm   GALARM Golden Alarm       (optional BONUS tag: --bonus-tag or make_symbol_labels.py --bonus)
  pose B (win cut) = "<ID>_b" for H1..H4 (and W_b if drawn), tiled with pose A's scale so it never changes size.

Box rule (the family's "88 x 88"): trim to the INK box (alpha > 24), the larger side = tile / (1 + 2 * pad)
= 384 / 1.136 = 338 px (88 %), centred. Default --pad IS 0.068 (the donor defaulted to 0.06 - a known footgun).
Runtime keys (game/assets.ts): sym_H1 ... sym_L4, sym_W, sym_W_BLAZE, sym_ALARM, sym_GALARM, sym_H1_b ...

Source map (id -> source): built-in defaults "symbols/sym_sq_<id>", overridden by
art-src/generated/symbols.sources.json when present, then --map <json>, then --src ID=<path> (repeatable).
Missing sources are reported PENDING and skipped (--strict turns that into a failure).

Usage:
  python3 tools/art/derive_symbols.py [--pad 0.068] [--tile 384] [--bonus-tag] [--only H1,W]
      [--map m.json] [--src H1=b2/sym_sq_h1_r2] [--out <assets root>] [--contact qa/art/symbols_contact.png]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (GEN, QA, STATIC, contact_sheet, exists_src, fill_ratio, fit_to_box, ink_bbox,  # noqa: E402
                        load_clean, matched_scale, out_root, prepare_out, rel, save_png, save_webp, src_path,
                        write_json)

BASE_IDS = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "W", "ALARM", "GALARM"]
MATCHED = {"W_blaze": "W", "H1_b": "H1", "H2_b": "H2", "H3_b": "H3", "H4_b": "H4", "W_b": "W"}
ALL_IDS = BASE_IDS[:9] + ["W_blaze"] + BASE_IDS[9:] + ["H1_b", "H2_b", "H3_b", "H4_b", "W_b"]
WILD_IDS = {"W", "W_blaze", "W_b"}
OPTIONAL = {"W_b"}  # drawn only if the W gets its own win pose
SQUARE_MAP_FILE = os.path.join(GEN, "symbols.sources.json")


def runtime_key(sid, prefix="sym_"):
    """H1 -> sym_H1, W_blaze -> sym_W_BLAZE, H1_b -> sym_H1_b (pose suffix stays lower case)."""
    if sid.endswith("_b"):
        return f"{prefix}{sid[:-2].upper()}_b"
    return f"{prefix}{sid.upper()}"


def file_name(sid, prefix="sym_"):
    return f"{prefix}{sid}.webp"


def default_sources(kind="sq"):
    return {sid: f"symbols/sym_{kind}_{sid.lower()}" for sid in ALL_IDS}


def load_map(path="", overrides=(), kind="sq", map_file=SQUARE_MAP_FILE):
    m = default_sources(kind)
    for p in (map_file, path):
        if p and os.path.isfile(p):
            with open(p) as f:
                m.update({k: v for k, v in json.load(f).items() if not k.startswith("_")})
    for o in overrides or ():
        k, _, v = o.partition("=")
        if not v:
            raise SystemExit(f"--src takes ID=path, got {o}")
        m[k] = v
    return m


def mark_manifest(path, key, label):
    if not os.path.isfile(path):
        return
    with open(path) as f:
        m = json.load(f)
    m.setdefault("labels", {})[key] = label
    write_json(path, m)


def lettered_path(src):
    base, _ = os.path.splitext(src_path(src))
    return base + "_lettered.png"


def place_box(im, box, tw, th, fill_w, fill_h, scale=None):
    """Where a source-px box lands in the fitted tile (same arithmetic as fit_to_box)."""
    bb = ink_bbox(im)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    k = scale if scale is not None else min(tw * fill_w / w, th * fill_h / h)
    ow, oh = max(1, round(w * k)), max(1, round(h * k))
    if ow > tw or oh > th:
        k *= min(tw / ow, th / oh)
        ow, oh = max(1, round(w * k)), max(1, round(h * k))
    ox, oy = (tw - ow) // 2, (th - oh) // 2
    x0, y0, x1, y1 = box
    return {"x": round(ox + (x0 - bb[0]) * k), "y": round(oy + (y0 - bb[1]) * k),
            "w": round((x1 - x0) * k), "h": round((y1 - y0) * k)}


def prepare_sources(ids, srcs, wild_style, allow_blank_blaze, writeback=True):
    """Load every present source (cleaned); letter the WILD badges. Returns (images, pending, badges)."""
    from make_symbol_labels import letter_wild

    ims, pending, badges = {}, [], {}
    for sid in ids:
        if sid not in srcs or not exists_src(srcs[sid]):
            pending.append(sid)
            continue
        im = load_clean(srcs[sid])
        if sid in WILD_IDS:
            try:
                im, box = letter_wild(im, wild_style)
                badges[sid] = box
                if writeback:
                    save_png(im, lettered_path(srcs[sid]))
            except SystemExit as e:
                if sid == "W" or not allow_blank_blaze:
                    raise SystemExit(f"{sid}: {e}")
                print(f"  {sid}: WARNING {e} - tiled without lettering (--allow-blank-blaze)")
        ims[sid] = im
    return ims, pending, badges


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--tile", type=int, default=384)
    ap.add_argument("--pad", type=float, default=0.068, help="0.068 -> ink fills 88 %% of the tile (family box)")
    ap.add_argument("--only", default="", help="comma list of ids to (re)derive")
    ap.add_argument("--map", default="")
    ap.add_argument("--src", action="append", default=[], help="ID=source override (repeatable)")
    ap.add_argument("--bonus-tag", action="store_true", help="set the BONUS tag on ALARM / GALARM here")
    ap.add_argument("--wild-style", default="red-on-cream", choices=("red-on-cream", "cream-on-red"))
    ap.add_argument("--allow-blank-blaze", action="store_true")
    ap.add_argument("--no-writeback", action="store_true", help="do not write <src>_lettered.png")
    ap.add_argument("--out", default="", help="assets root override (tests / staging)")
    ap.add_argument("--contact", default=os.path.join(QA, "symbols_contact.png"))
    ap.add_argument("--strict", action="store_true", help="fail on pending sources or a box outside 88 +/- 1 %%")
    a = ap.parse_args()

    srcs = load_map(a.map, a.src)
    ids = [s for s in ALL_IDS if not a.only or s in a.only.split(",")]
    need = sorted(set(ids) | {MATCHED[s] for s in ids if s in MATCHED})
    ims, pending, badges = prepare_sources(need, srcs, a.wild_style, a.allow_blank_blaze, not a.no_writeback)
    T, fill = a.tile, 1.0 / (1 + 2 * a.pad)
    out_dir = prepare_out(os.path.join(out_root(a.out), "sprites", "symbolsCartoon"))
    man_path = os.path.join(out_dir, "manifest.json")
    man = {}
    if os.path.isfile(man_path):
        with open(man_path) as f:
            man = json.load(f)
    man.update({"tile": T, "pad": a.pad, "box": round(fill, 4), "generated_by": "tools/art/derive_symbols.py",
                "rule": "ink (alpha>24) larger side = tile/(1+2*pad), centred; pose B / Blaze at pose A's scale"})
    for k in ("files", "sources", "fill", "labels"):
        man.setdefault(k, {})
    tiles, problems = [], []
    for sid in ids:
        if sid not in ims:
            continue
        if sid in MATCHED:
            base = MATCHED[sid]
            if base not in ims:
                pending.append(f"{sid} (needs {base})")
                continue
            k = matched_scale(ims[base], T, T, fill, fill)
            tile = fit_to_box(ims[sid], T, T, fill, fill, scale=k)[0]
        else:
            k = None
            if sid in ("ALARM", "GALARM") and a.bonus_tag:
                from make_symbol_labels import bonus_square

                tile = bonus_square(ims[sid], sid, T, fill)
                man["labels"][runtime_key(sid)] = "bonus_tag"
            else:
                tile = fit_to_box(ims[sid], T, T, fill, fill)[0]
                man["labels"].pop(runtime_key(sid), None)
        fn = file_name(sid)
        save_webp(tile, os.path.join(out_dir, fn), lossless=True, quality=100)
        key = runtime_key(sid)
        fw, fh = fill_ratio(tile)
        man["files"][key] = fn
        man["sources"][key] = rel(src_path(srcs[sid]))
        man["fill"][key] = [round(fw, 3), round(fh, 3)]
        if sid in badges:
            man.setdefault("wild_badge", {})[key] = place_box(ims[sid], badges[sid], T, T, fill, fill, scale=k)
        ok = sid in MATCHED or abs(max(fw, fh) - fill) <= 0.01
        if not ok:
            problems.append(f"{sid} box {max(fw, fh):.3f} != {fill:.3f}")
        print(f"{sid:8s} {rel(src_path(srcs[sid]))} -> {fn}  ink {fw * 100:.0f}% x {fh * 100:.0f}%{'' if ok else '  <-- BOX'}")
        tiles.append((key, tile))
    if "wild_badge" in man:
        man["wild_badge_note"] = ("tile px of the lettered WILD badge; frontend symbolMotion.WILD_BANNER.square must "
                                  "match sym_W (placeholder rect x 62, y 204, w 262, h 98)")
    write_json(man_path, man)
    if tiles and a.contact:
        print("contact ->", rel(contact_sheet(tiles, a.contact)))
    pending = [p for p in pending if p.split(" ")[0] not in OPTIONAL]
    if pending:
        print("PENDING (no accepted source yet):", ", ".join(pending))
    for p in problems:
        print("BOX:", p)
    print(f"wrote {len(tiles)} square tiles -> {rel(out_dir)}")
    if a.strict and (pending or problems):
        sys.exit(1)


if __name__ == "__main__":
    main()
