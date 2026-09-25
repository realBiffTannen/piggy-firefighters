#!/usr/bin/env python3
"""PIGGY FIREFIGHTERS game tiles, PF-THUMB-01 (thumbnail/instructions.md is Codex's brief; this tool never edits it).

One character (Chief Hamm) per tile over a LOW-COLOUR background (one dominant hue + at most two related tones),
the same accepted painting laid out per aspect (no second paid call needed):
  3:4   1536x2048  hero large and centred, a QUIET TITLE AREA ABOVE him (title zone kept free of the figure)
  16:9  2048x1152  hero toward the RIGHT, quiet title area on the LEFT
Files written to thumbnail/ (same full-canvas coordinates, align at (0,0)):
  foreground_3_4.png / foreground_16_9.png   RGBA, genuine alpha, title-free
  background_3_4.png / background_16_9.png   opaque RGB; the dominant fill snapped to ONE exact hex
  preview_3_4.png / preview_16_9.png         flattened background + foreground (no title)
  review/review_<aspect>_<w>x<h>.png         small-size reviews at 120x160 / 320x180 (+2x) WITH a title mock in the
                                             title zone, plus a grey-value check; review/ is for review, not delivery
  source-record.json                         provenance of the hero painting (rows from art-src/generated/
                                             source-record.json), background hex/RGB/tones, sha256 + size + mode +
                                             alpha inspection of every delivered file, every check and its result
Background routes: --bg '#RRGGBB' -> procedural flat-cel 3-tone plate (dominant fill, one lighter disc behind the
hero kept out of the title zone, one darker corner band; tones derived from the hex or given with --tones), or
--bg-34 / --bg-169 <painting> -> cover-crop and snap every pixel near the dominant colour to the exact hex.
Checks (exit 1 on a FAIL unless --no-fail): sizes and modes; genuine alpha; figure >= 5 % inside the top/left/right
edges (bottom bleed allowed for a bust); title zone clear of the figure; exactly one figure (one dominant alpha
component); low-colour background (top-3 colours cover >= 90 %, dominant hue share); pig-skin (face) blob height at
the small review size. Agent checks only - NOT human sign-off.

Usage:
  python3 tools/art/make_thumbnails.py --hero thumb/chief_hero [--hero-169 ...] --bg '#1E2A4A' [--tones '#..,#..']
      [--wordmark <png>] [--layout layout.json] [--out thumbnail] [--only 3_4]
"""
import argparse
import colorsys
import datetime
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (RECORD, REPO, STATIC, alpha_report, cover, hex_rgb, load_rgb, load_rgba, rel,  # noqa: E402
                        rgb_hex, sha256_file, src_path, write_json)

LAYOUTS = {
    "3_4": {"size": [1536, 2048], "hero_h": 0.80, "max_w": 0.90, "center_x": 0.5, "bottom": 1.0, "bleed_bottom": True,
            "title_zone": [0.07, 0.035, 0.93, 0.20], "review": [[120, 160], [240, 320]]},
    "16_9": {"size": [2048, 1152], "hero_h": 0.95, "max_w": 0.56, "center_x": 0.70, "bottom": 1.0, "bleed_bottom": True,
             "title_zone": [0.045, 0.14, 0.43, 0.86], "review": [[320, 180], [640, 360]]},
}
INSET = 0.05


def derive_tones(hexcol):
    r, g, b = [c / 255 for c in hex_rgb(hexcol)]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    light = colorsys.hsv_to_rgb(h, max(0, s * 0.88), min(1, v * 1.18 + 0.04))
    dark = colorsys.hsv_to_rgb(h, min(1, s * 1.05), v * 0.78)
    return [rgb_hex([round(c * 255) for c in light]), rgb_hex([round(c * 255) for c in dark])]


def rect_px(zone, size):
    W, H = size
    return [zone[0] * W, zone[1] * H, zone[2] * W, zone[3] * H]


def dist_to_rect(cx, cy, r):
    dx = max(r[0] - cx, 0, cx - r[2])
    dy = max(r[1] - cy, 0, cy - r[3])
    return (dx * dx + dy * dy) ** 0.5


def place_hero(hero, spec):
    W, H = spec["size"]
    s = spec["hero_h"] * H / hero.height
    s = min(s, spec["max_w"] * W / hero.width)
    h = hero.resize((max(1, round(hero.width * s)), max(1, round(hero.height * s))), Image.LANCZOS)
    x = round(spec["center_x"] * W - h.width / 2)
    y = round(spec["bottom"] * H - h.height)
    fg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fg.alpha_composite(h, (x, y)) if x >= 0 and y >= 0 else fg.paste(h, (x, y), h)
    return fg, (x, y, x + h.width, y + h.height)


def procedural_bg(size, base, tones, hero_box, title_rect, ss=2):
    W, H = size
    light, dark = tones
    im = Image.new("RGB", (W * ss, H * ss), hex_rgb(base))
    d = ImageDraw.Draw(im)
    # one darker band in the corners (flat cel vignette): everything outside a big ellipse
    mask = Image.new("L", im.size, 255)
    ImageDraw.Draw(mask).ellipse([-0.10 * W * ss, -0.12 * H * ss, 1.10 * W * ss, 1.12 * H * ss], fill=0)
    im.paste(hex_rgb(dark), (0, 0), mask)
    # one lighter disc behind the hero's chest, never entering the title zone
    x0, y0, x1, y1 = hero_box
    cx, cy = (x0 + x1) / 2, y0 + 0.45 * (y1 - y0)
    r = min(0.62 * (x1 - x0), 0.46 * min(W, H), dist_to_rect(cx, cy, title_rect) - 0.02 * min(W, H))
    if r > 0.08 * min(W, H):
        d.ellipse([(cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss], fill=hex_rgb(light))
    return im.resize((W, H), Image.LANCZOS), {"disc": [round(cx), round(cy), round(r)]}


def snap(im, hexcol, tol=14):
    """Every pixel within `tol` (sum of |dRGB|) of the painted dominant fill becomes the exact editor hex."""
    a = np.asarray(im).astype(np.int32)
    target = np.array(hex_rgb(hexcol))
    near = np.abs(a - target).sum(axis=2) < 40
    med = np.median(a[near], axis=0) if near.any() else target
    hit = np.abs(a - med).sum(axis=2) <= tol
    a[hit] = target
    return Image.fromarray(a.astype(np.uint8), "RGB"), round(float(hit.mean()), 4)


def palette_stats(im):
    q = im.convert("RGB").quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:24]
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    top = [{"hex": rgb_hex(pal[i * 3:i * 3 + 3]), "share": round(c / total, 4)} for c, i in counts[:4]]
    arr = np.asarray(im.convert("RGB")).astype(np.float32) / 255
    mx, mn = arr.max(axis=2), arr.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hsv = np.asarray(im.convert("HSV")).astype(np.float32)
    hue = hsv[:, :, 0] * 360 / 255
    chroma = sat > 0.12
    if chroma.any():
        hist, edges = np.histogram(hue[chroma], bins=36, range=(0, 360))
        peak = (edges[np.argmax(hist)] + 5) % 360
        dh = np.abs(((hue - peak) + 180) % 360 - 180)
        related = (~chroma) | (dh <= 25)
    else:
        peak, related = None, np.ones_like(chroma)
    return {"top_colours": top, "top3_share": round(sum(t["share"] for t in top[:3]), 4),
            "dominant_hue_deg": None if peak is None else round(float(peak), 1),
            "related_hue_share": round(float(related.mean()), 4)}


def skin_blob_px(fg, scale):
    a = np.asarray(fg.convert("RGBA")).astype(int)
    skin = (a[:, :, 0] > 200) & (a[:, :, 1] > 110) & (a[:, :, 1] < 205) & (a[:, :, 2] > 110) & (a[:, :, 2] < 210) \
        & (a[:, :, 0] - a[:, :, 1] > 25) & (a[:, :, 3] > 200)
    skin = ndi.binary_opening(skin, iterations=2)
    lab, n = ndi.label(skin)
    if not n:
        return 0.0
    sizes = ndi.sum(skin, lab, range(1, n + 1))
    ys, _ = np.where(lab == int(np.argmax(sizes)) + 1)
    return round(float((ys.max() - ys.min()) * scale), 1)


def title_mock(size, zone, wordmark):
    W, H = size
    r = rect_px(zone, size)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if wordmark and os.path.isfile(wordmark):
        wm = Image.open(wordmark).convert("RGBA")
        wm = wm.crop(wm.getbbox())
        k = min((r[2] - r[0]) / wm.width, (r[3] - r[1]) / wm.height)
        wm = wm.resize((round(wm.width * k), round(wm.height * k)), Image.LANCZOS)
        lay.alpha_composite(wm, (round((r[0] + r[2]) / 2 - wm.width / 2), round((r[1] + r[3]) / 2 - wm.height / 2)))
    else:
        ImageDraw.Draw(lay).rectangle(r, outline=(255, 255, 255, 220), width=max(2, W // 300))
    return lay


def provenance(src):
    rows = []
    if os.path.isfile(RECORD):
        try:
            for row in json.load(open(RECORD)):
                if row.get("output") == rel(src):
                    rows.append({k: row.get(k) for k in ("asset", "batch", "requested_model", "actual_model", "size",
                                                           "quality", "transparent", "prompt", "reference_paths",
                                                           "cost_estimate_usd", "status", "ts", "sha256")})
        except Exception:
            pass
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hero", required=True, help="accepted transparent hero painting (both aspects)")
    ap.add_argument("--hero-34", default="")
    ap.add_argument("--hero-169", default="")
    ap.add_argument("--bg", default="#1E2A4A", help="dominant background hex (procedural route or snap target)")
    ap.add_argument("--tones", default="", help="two related tones '#light,#dark' (default derived from --bg)")
    ap.add_argument("--bg-34", default="", help="background painting for 3:4 (else procedural)")
    ap.add_argument("--bg-169", default="", help="background painting for 16:9 (else procedural)")
    ap.add_argument("--wordmark", default=os.path.join(STATIC, "branding", "wordmark.png"))
    ap.add_argument("--layout", default="", help="json overriding LAYOUTS keys per aspect")
    ap.add_argument("--only", default="")
    ap.add_argument("--out", default=os.path.join(REPO, "thumbnail"))
    ap.add_argument("--no-fail", action="store_true")
    a = ap.parse_args()
    layouts = json.loads(json.dumps(LAYOUTS))
    if a.layout:
        for k, v in json.load(open(a.layout)).items():
            layouts[k].update(v)
    out = os.path.abspath(a.out)
    os.makedirs(os.path.join(out, "review"), exist_ok=True)
    tones = [t.strip() for t in a.tones.split(",")] if a.tones else derive_tones(a.bg)
    rec = {"spec": "PF-THUMB-01", "tool": "tools/art/make_thumbnails.py",
           "generated": datetime.datetime.now().isoformat(timespec="seconds"),
           "note": "Agent checks only; NOT human sign-off and NOT platform approval. thumbnail/instructions.md is "
                   "Codex's brief and is not edited by this tool.",
           "hero": {}, "background": {}, "layout": {}, "files": [], "checks": [], "reviews": []}
    checks = rec["checks"]

    def check(name, ok, detail):
        checks.append({"name": name, "pass": bool(ok), "detail": detail})
        print(("PASS " if ok else "FAIL ") + f"{name}: {detail}")

    for aspect, spec in layouts.items():
        if a.only and aspect not in a.only.split(","):
            continue
        W, H = spec["size"]
        hsrc = {"3_4": a.hero_34, "16_9": a.hero_169}.get(aspect) or a.hero
        hero = Image.fromarray(load_rgba(hsrc), "RGBA")
        hero = hero.crop(hero.getbbox())
        fg, box = place_hero(hero, spec)
        tz = rect_px(spec["title_zone"], (W, H))
        bgsrc = {"3_4": a.bg_34, "16_9": a.bg_169}[aspect]
        if bgsrc:
            bg, snapped = snap(cover(load_rgb(bgsrc), (W, H)), a.bg)
            rec["background"][aspect] = {"route": "painting", "source": rel(src_path(bgsrc)), "hex": a.bg.upper(),
                                         "rgb": list(hex_rgb(a.bg)), "snapped_share": snapped}
        else:
            bg, geo = procedural_bg((W, H), a.bg, tones, box, tz)
            snapped = round(float((np.asarray(bg) == np.array(hex_rgb(a.bg))).all(axis=2).mean()), 4)
            rec["background"][aspect] = {"route": "procedural flat-cel 3-tone", "hex": a.bg.upper(),
                                         "rgb": list(hex_rgb(a.bg)), "tones": [t.upper() for t in tones],
                                         "tones_rgb": [list(hex_rgb(t)) for t in tones], "exact_hex_share": snapped, **geo}
        rec["hero"][aspect] = {"source": rel(src_path(hsrc)), "sha256": sha256_file(src_path(hsrc)),
                               "placed_box": list(box), "provenance": provenance(src_path(hsrc))}
        rec["layout"][aspect] = spec
        pv = bg.convert("RGBA")
        pv.alpha_composite(fg)
        pv = pv.convert("RGB")
        files = {f"foreground_{aspect}.png": fg, f"background_{aspect}.png": bg.convert("RGB"), f"preview_{aspect}.png": pv}
        for fn, im in files.items():
            p = os.path.join(out, fn)
            im.save(p, "PNG", optimize=True)
            rec["files"].append({"file": fn, "size": list(im.size), "mode": im.mode, "bytes": os.path.getsize(p),
                                 "sha256": sha256_file(p), "alpha": alpha_report(Image.open(p))})
        # ------------------------------------------------------------------ checks
        fa = np.asarray(fg)[:, :, 3]
        rep = alpha_report(fg)
        check(f"{aspect} sizes/modes", fg.size == (W, H) and bg.size == (W, H) and fg.mode == "RGBA" and bg.mode == "RGB",
              f"fg {fg.size} {fg.mode}, bg {bg.size} {bg.mode}")
        check(f"{aspect} genuine alpha", rep["genuine"] and rep["transparent"] > 0.15 and rep["soft_edge"] > 0,
              f"alpha [{rep['alpha_min']},{rep['alpha_max']}] transparent {rep['transparent']} soft {rep['soft_edge']}")
        ys, xs = np.where(fa > 24)
        bb = (xs.min() / W, ys.min() / H, (xs.max() + 1) / W, (ys.max() + 1) / H)
        inset_ok = bb[0] >= INSET and bb[2] <= 1 - INSET and bb[1] >= INSET and (spec["bleed_bottom"] or bb[3] <= 1 - INSET)
        check(f"{aspect} figure inside 5 % inset", inset_ok, "ink box x %.3f-%.3f y %.3f-%.3f%s" % (
            *bb[::2], *bb[1::2], " (bottom bleed allowed)" if spec["bleed_bottom"] else ""))
        z = [int(round(v)) for v in tz]
        intr = float((fa[z[1]:z[3], z[0]:z[2]] > 24).mean())
        check(f"{aspect} title zone clear", intr <= 0.002, f"figure covers {intr * 100:.2f} % of the title zone {spec['title_zone']}")
        lab, n = ndi.label(fa > 24)
        big = [s for s in ndi.sum(fa > 24, lab, range(1, n + 1)) if s > 0.01 * (fa > 24).sum()] if n else []
        check(f"{aspect} one figure", len(big) == 1, f"{len(big)} major alpha component(s)")
        ps = palette_stats(bg)
        rec["background"][aspect]["palette"] = ps
        check(f"{aspect} low-colour background", ps["top3_share"] >= 0.90 and ps["related_hue_share"] >= 0.85,
              f"top-3 colours {ps['top3_share']}, related-hue share {ps['related_hue_share']}, dominant hue {ps['dominant_hue_deg']}")
        rs = spec["review"][0]
        face = skin_blob_px(fg, rs[0] / W)
        check(f"{aspect} face readable at {rs[0]}x{rs[1]}", face >= 6, f"pig-skin blob {face} px tall")
        # ------------------------------------------------------------------ reviews
        mock = pv.convert("RGBA")
        mock.alpha_composite(title_mock((W, H), spec["title_zone"], a.wordmark))
        for w, h in spec["review"]:
            p = os.path.join(out, "review", f"review_{aspect}_{w}x{h}.png")
            mock.convert("RGB").resize((w, h), Image.LANCZOS).save(p)
            rec["reviews"].append({"file": rel(p) if p.startswith(REPO) else p, "size": [w, h], "with_title_mock": True})
        p = os.path.join(out, "review", f"review_{aspect}_grey.png")
        ImageOps.grayscale(mock.convert("RGB")).resize(spec["review"][-1], Image.LANCZOS).save(p)
        rec["reviews"].append({"file": rel(p) if p.startswith(REPO) else p, "size": spec["review"][-1], "grey_value_check": True})
    rp = os.path.join(out, "source-record.json")
    if os.path.isfile(rp):
        try:
            prev = json.load(open(rp))
            rec["history"] = (prev.get("history") or [])[-9:] + [{"generated": prev.get("generated"),
                                                                    "files": [(f["file"], f["sha256"]) for f in prev.get("files", [])]}]
        except Exception:
            pass
    write_json(rp, rec)
    fails = [c for c in checks if not c["pass"]]
    print(f"{len(checks) - len(fails)}/{len(checks)} checks pass -> {rel(rp) if rp.startswith(REPO) else rp}")
    if fails and not a.no_fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
