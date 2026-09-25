#!/usr/bin/env python3
"""Derive the PIGGY FIREFIGHTERS card art: buy cards, splash deck cards and the max-win cards. Art only: every
title, price and number is runtime text (no baked lettering, no currency).

One paid 1536x1024 painting per mode serves BOTH its buy card and its splash card (no second call):
  buycards/<betModeArt>.webp  768x512   window crop (zoom, fx, fy) at aspect 1.5. The HUD shows it object-fit:cover
                                        in a ~271x80 strip (the central ~44 % of the height) -> the focal read
                                        (faces, the alarm bell) must sit in that band; the contact sheet shows it.
  splash/card_<id>.webp       768x768   square crop of the same painting (payload budget <= 1.2 MB for splash/)
  maxwin/max_win_card_16x9.webp 1600x900 + max_win_card_portrait.webp 900x1400 (frontend placeholder sizes;
                                        true 16:9) cut from 1536x1024 / 1024x1536 paintings that keep the left 45 %
                                        (landscape) / top third (portrait) calm; maxwin/manifest.json carries the
                                        titleSafeArea and a measured calm ratio ("MAX WIN" + multiple drawn at runtime).

Default spec (override with --spec <json> using the same keys; sources are names under art-src/generated):
  buycards: ante, backdraft-spins, alarm-call, rescue, inferno   <- cards/card_{ante,backdraft,alarm,rescue,inferno}
  splash:   card_chief, card_lines, card_backdraft, card_alarm, card_rescue, card_maxwin (the last from the portrait
            max-win painting). Ids follow static/assets/splash/manifest.json (the frontend's mirror; never edited here).

Usage: python3 tools/art/derive_cards.py [buycards] [splash] [maxwin] [--spec s.json] [--out <assets root>]
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (QA, exists_src, label_font, load_rgb, out_root, prepare_out, rel, save_webp,  # noqa: E402
                        src_path, window, write_json)

SPEC = {
    # key -> [painting, zoom, fx, fy]
    "buycards": {
        "ante": ["cards/card_ante", 1.0, 0.5, 0.5],
        "backdraft-spins": ["cards/card_backdraft", 1.0, 0.5, 0.5],
        "alarm-call": ["cards/card_alarm", 1.0, 0.5, 0.5],
        "rescue": ["cards/card_rescue", 1.0, 0.5, 0.5],
        "inferno": ["cards/card_inferno", 1.0, 0.5, 0.5],
    },
    # id -> [painting, fx, fy]
    "splash": {
        "card_chief": ["cards/card_chief", 0.5, 0.5],
        "card_lines": ["cards/card_lines", 0.5, 0.5],
        "card_backdraft": ["cards/card_backdraft", 0.5, 0.5],
        "card_alarm": ["cards/card_alarm", 0.5, 0.5],
        "card_rescue": ["cards/card_rescue", 0.5, 0.5],
        "card_maxwin": ["cards/maxwin_portrait", 0.5, 0.58],
    },
    "maxwin": {
        "landscape": {"src": "cards/maxwin_16_9", "file": "max_win_card_16x9.webp", "size": [1600, 900],
                      "zoom": 1.0, "fx": 0.5, "fy": 0.5, "titleSafeArea": {"x": 0.04, "y": 0.24, "w": 0.46, "h": 0.64}},
        "portrait": {"src": "cards/maxwin_portrait", "file": "max_win_card_portrait.webp", "size": [900, 1400],
                     "zoom": 1.0, "fx": 0.5, "fy": 0.5, "titleSafeArea": {"x": 0.07, "y": 0.06, "w": 0.86, "h": 0.34}},
    },
}
BUY_SIZE, SPLASH_SIZE = (768, 512), (768, 768)
SPLASH_BUDGET = int(1.2 * 1024 * 1024)
HUD_BAND = 0.44  # the HUD strip shows the central 44 % of a buy card's height


def energy(im):
    g = np.asarray(im.convert("L")).astype(np.float32)
    return np.abs(np.diff(g, axis=0))[:, :-1] + np.abs(np.diff(g, axis=1))[:-1, :]


def calm_ratio(im, area):
    """Mean edge energy inside the title safe area / outside it (< ~0.6 reads calm enough for runtime text)."""
    e = energy(im)
    H, W = e.shape
    x0, y0 = int(area["x"] * W), int(area["y"] * H)
    x1, y1 = int((area["x"] + area["w"]) * W), int((area["y"] + area["h"]) * H)
    m = np.zeros_like(e, bool)
    m[y0:y1, x0:x1] = True
    inside, outside = e[m].mean(), e[~m].mean() if (~m).any() else 1.0
    return round(float(inside / max(outside, 1e-6)), 3)


def buycards(spec, root, pending, sheet):
    out = prepare_out(os.path.join(root, "buycards"))
    for key, (src, z, fx, fy) in spec.items():
        if not exists_src(src):
            pending.append(f"buycards/{key} <- {src}")
            continue
        im = window(load_rgb(src), z, fx, fy, BUY_SIZE[0] / BUY_SIZE[1]).resize(BUY_SIZE, Image.LANCZOS)
        n = save_webp(im, os.path.join(out, f"{key}.webp"), quality=90)
        print(f"buycards/{key}.webp {im.size} {n} B <- {rel(src_path(src))} (zoom {z}, focus {fx},{fy})")
        band = (BUY_SIZE[1] * (1 - HUD_BAND)) / 2
        strip = im.crop((0, round(band), BUY_SIZE[0], round(BUY_SIZE[1] - band)))
        sheet.append((f"buycards/{key}", im, strip))


def splash(spec, root, pending, sheet):
    out = prepare_out(os.path.join(root, "splash"))
    for cid, (src, fx, fy) in spec.items():
        if not exists_src(src):
            pending.append(f"splash/{cid} <- {src}")
            continue
        im = window(load_rgb(src), 1.0, fx, fy, 1.0).resize(SPLASH_SIZE, Image.LANCZOS)
        n = save_webp(im, os.path.join(out, f"{cid}.webp"), quality=90)
        print(f"splash/{cid}.webp {im.size} {n} B <- {rel(src_path(src))}")
        sheet.append((f"splash/{cid}", im, None))
    mp = os.path.join(out, "manifest.json")
    if os.path.isfile(mp):  # coverage only - the manifest is the frontend's mirror of SPLASH_DECK
        want = {c["art"] for c in json.load(open(mp)).get("cards", [])}
        have = {f for f in os.listdir(out) if f.startswith("card_") and f.endswith(".webp")}
        if want - have:
            print("splash manifest cards without art yet:", ", ".join(sorted(want - have)))
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out) if f.endswith(".webp"))
    print(f"splash/ payload {total / 1048576:.2f} MB (budget {SPLASH_BUDGET / 1048576:.1f} MB)")
    if total > SPLASH_BUDGET:
        raise SystemExit("splash/ over its payload budget")


def maxwin(spec, root, pending, sheet):
    out = prepare_out(os.path.join(root, "maxwin"))
    man_path = os.path.join(out, "manifest.json")
    man = {"files": {}, "size": {}, "titleSafeArea": {}, "calm_ratio": {}, "sources": {},
           "note": ("Title-free max-win art. 'MAX WIN' and the multiple (15,000x) are runtime text inside titleSafeArea "
                    "(fractions of the card); never a currency figure. Shown only for the real cap."),
           "generated_by": "tools/art/derive_cards.py maxwin"}
    for orient, c in spec.items():
        if not exists_src(c["src"]):
            pending.append(f"maxwin/{orient} <- {c['src']}")
            continue
        W, H = c["size"]
        im = window(load_rgb(c["src"]), c.get("zoom", 1.0), c.get("fx", 0.5), c.get("fy", 0.5), W / H)
        im = im.resize((W, H), Image.LANCZOS)
        n = save_webp(im, os.path.join(out, c["file"]), quality=88)
        cr = calm_ratio(im, c["titleSafeArea"])
        man["files"][orient], man["size"][orient] = c["file"], [W, H]
        man["titleSafeArea"][orient], man["calm_ratio"][orient] = c["titleSafeArea"], cr
        man["sources"][orient] = rel(src_path(c["src"]))
        print(f"maxwin/{c['file']} {im.size} {n} B calm ratio {cr}{'  <-- title area busy' if cr > 0.6 else ''}")
        sheet.append((f"maxwin/{orient}", im, c["titleSafeArea"]))
    if man["files"]:
        write_json(man_path, man)


def contact(sheet, path):
    font = label_font(14)
    tiles = []
    for label, im, extra in sheet:
        k = 300 / im.height
        t = im.resize((round(im.width * k), 300), Image.LANCZOS).convert("RGB")
        if isinstance(extra, dict):  # title safe area
            d = ImageDraw.Draw(t)
            d.rectangle([extra["x"] * t.width, extra["y"] * t.height, (extra["x"] + extra["w"]) * t.width,
                         (extra["y"] + extra["h"]) * t.height], outline=(0, 255, 120), width=3)
        can = Image.new("RGB", (t.width + 12, 300 + 30 + (100 if isinstance(extra, Image.Image) else 0)), (236, 236, 236))
        can.paste(t, (6, 24))
        if isinstance(extra, Image.Image):  # the HUD strip at its real size (~271x80)
            s = extra.resize((271, round(271 * extra.height / extra.width)), Image.LANCZOS)
            can.paste(s, (6, 330))
        ImageDraw.Draw(can).text((6, 4), label, fill=(30, 30, 30), font=font)
        tiles.append(can)
    if not tiles:
        return None
    W = sum(t.width for t in tiles)
    out = Image.new("RGB", (min(W, 3600), 10), (236, 236, 236))
    rows, row, x = [], [], 0
    for t in tiles:
        if x + t.width > 3600 and row:
            rows.append(row)
            row, x = [], 0
        row.append(t)
        x += t.width
    rows.append(row)
    H = sum(max(t.height for t in r) for r in rows)
    out = Image.new("RGB", (max(sum(t.width for t in r) for r in rows), H), (236, 236, 236))
    y = 0
    for r in rows:
        x = 0
        for t in r:
            out.paste(t, (x, y))
            x += t.width
        y += max(t.height for t in r)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    out.save(path)
    return path


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="*", help="buycards | splash | maxwin (default: all three)")
    ap.add_argument("--spec", default="")
    ap.add_argument("--out", default="")
    ap.add_argument("--contact", default=os.path.join(QA, "cards_contact.png"))
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    spec = json.loads(json.dumps(SPEC))
    if a.spec:
        for k, v in json.load(open(a.spec)).items():
            spec[k] = v
    every = ["buycards", "splash", "maxwin"]
    if [c for c in a.cmd if c not in every]:
        ap.error(f"subcommands are {every}")
    root, pending, sheet = out_root(a.out), [], []
    for c in a.cmd or every:
        {"buycards": buycards, "splash": splash, "maxwin": maxwin}[c](spec[c], root, pending, sheet)
    if sheet and a.contact:
        print("contact ->", rel(contact(sheet, a.contact)))
    if pending:
        print("PENDING (no accepted painting yet):", "; ".join(pending))
    if a.strict and pending:
        sys.exit(1)


if __name__ == "__main__":
    main()
