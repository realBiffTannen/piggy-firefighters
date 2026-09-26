#!/usr/bin/env python3
"""Cut the splash-furniture and sign-plate sheets into shipped tiles (free; local).

   python3 tools/art/derive_furniture.py            # both sheets

Items are found as alpha connected components (alpha > 24) on a 2x-downsampled mask, pieces closer than MERGE_PX
are merged (a plate's rail, a chain's links), ordered top-to-bottom by row then left-to-right, trimmed, and named
from FURNITURE / PLATES. The brass beam ships as its MIDDLE (end caps cut off) so it repeats along the splash frame.
Plates get a nine-slice `corner` = 20 % of their shorter side (the prompt keeps every decoration inside that
border). The loading-bar hazard tile is drawn here, flat, 28 x 28.

Sources: art-src/generated/scene/{splash_furniture,sign_plates}.png (gen_art.py, recorded).
Outputs: static/assets/splash/{board,chain,nail,beam,dust,hazard}.webp,
         static/assets/ui_scene/plates/{station,gold,hazard,win,chain}.webp + manifest.json
"""
import json
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import save_webp  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "art-src", "generated", "scene")
STATIC = os.path.join(ROOT, "apps", "piggy_firefighters", "static", "assets")
FURNITURE = ["board", "chain", "nail", "beam", "dust"]
PLATES = ["station", "gold", "hazard", "win", "chain"]
MAX_SIDE = {"board": 900, "chain": 200, "nail": 96, "beam": 1024, "dust": 256}
PLATE_MAX = 900
MERGE_PX = 16


def components(im):
    """Bounding boxes (full-res px) of the sheet's items, in reading order."""
    small = im.getchannel("A").resize((im.width // 2, im.height // 2), Image.NEAREST).point(lambda v: 255 if v > 24 else 0)
    w, h = small.size
    px = small.load()
    seen = bytearray(w * h)
    boxes = []
    for y in range(h):
        for x in range(w):
            if px[x, y] and not seen[y * w + x]:
                stack, x0, y0, x1, y1 = [(x, y)], x, y, x, y
                seen[y * w + x] = 1
                while stack:
                    cx, cy = stack.pop()
                    x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
                if (x1 - x0) * (y1 - y0) > 100:
                    boxes.append([x0 * 2, y0 * 2, (x1 + 1) * 2, (y1 + 1) * 2])
    merged = True
    while merged:  # join pieces of one item (a plate's rail, a chain's links)
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - MERGE_PX < b[2] and b[0] - MERGE_PX < a[2] and a[1] - MERGE_PX < b[3] and b[1] - MERGE_PX < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]
                    merged = True
                    break
            if merged:
                break
    out, band = [], []
    for b in sorted(boxes, key=lambda b: b[1]):  # rows by vertical overlap, left-to-right inside a row
        if band and b[1] > max(bb[3] for bb in band):
            out += sorted(band, key=lambda bb: bb[0])
            band = []
        band.append(b)
    return out + sorted(band, key=lambda bb: bb[0])


def fit(im, side):
    """Scale down to `side`, then snap near-opaque alpha back to 255 (a resize leaves the solid body at 254)."""
    k = min(1.0, side / max(im.size))
    if k < 1:
        im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    r, g, b, a = im.split()
    return Image.merge("RGBA", (r, g, b, a.point(lambda v: 255 if v >= 250 else v)))


def cut(sheet, names):
    im = Image.open(os.path.join(GEN, sheet)).convert("RGBA")
    boxes = components(im)
    if len(boxes) != len(names):
        sys.exit(f"{sheet}: found {len(boxes)} items {boxes}, need {len(names)} ({names})")
    return {n: im.crop(tuple(b)) for n, b in zip(names, boxes)}


def hazard_tile():
    t = Image.new("RGBA", (28, 28), (0xF5, 0xD2, 0x3C, 255))
    d = ImageDraw.Draw(t)
    for off in (-28, 0, 28):
        d.polygon([(off, 28), (off + 14, 28), (off + 28, 0), (off + 14, 0)], fill=(0xFF, 0x7A, 0x1A, 255))
    return t


def main():
    furn = cut("splash_furniture.png", FURNITURE)
    beam = furn["beam"]
    furn["beam"] = beam.crop((round(beam.width * 0.14), 0, round(beam.width * 0.86), beam.height))  # repeatable middle
    sizes = {}
    for n, im in furn.items():
        sizes[n] = save_webp(fit(im, MAX_SIDE[n]), os.path.join(STATIC, "splash", f"{n}.webp"))
    sizes["hazard"] = save_webp(hazard_tile(), os.path.join(STATIC, "splash", "hazard.webp"), lossless=True)
    plates = cut("sign_plates.png", PLATES)
    meta = {}
    for n, im in plates.items():
        im = fit(im, PLATE_MAX if n != "chain" else 200)
        save_webp(im, os.path.join(STATIC, "ui_scene", "plates", f"{n}.webp"))
        meta[n] = {"w": im.width, "h": im.height, "corner": round(min(im.size) * 0.2)}
    with open(os.path.join(STATIC, "ui_scene", "plates", "manifest.json"), "w") as f:
        json.dump({"generated_by": "tools/art/derive_furniture.py", "plates": meta}, f, indent=1)
        f.write("\n")
    print("derive_furniture: splash bytes", sizes, "\n  plates", meta)


if __name__ == "__main__":
    main()
