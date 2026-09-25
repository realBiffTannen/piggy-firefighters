#!/usr/bin/env python3
"""Fixed-grid sheet cutter (r2). Replaces the r1 connected-component clustering (`split_grid`).

Each rig's `<rig>/sheets.layout.json` is the layout of record: explicit cell rectangles (read from the sheet by eye,
boundaries in the measured transparent gutters) with a label and a per-cell rule. A component (alpha > 0, 8-connected)
belongs to the cell that holds its centroid; the cell's rule then decides which of its components form the piece:

  eyes    both eyes = the two largest components that are not brows; a brow is a solid dark stroke with another
          component below it (brows come only from the brow row)
  brows   the two largest components
  mouth   the mouth only = the largest component plus its own creases (small ink strokes within 30 px of it)
  single  the single largest component (ears, moustaches, dog ear/tail/jaw/tongue)
  hand    the whole hand (every component in the cell)
  plate   the plate = the largest component plus anything inside its box (blank badge / card / shield plate)
  whole   every component in the cell (props, wave arms, jawless head)
  figure  the largest component whose centroid is in the cell; it may overhang the rectangle (slide poses interlock)

A piece is the sheet pixels of its kept components only (never a rectangle crop), trimmed to the alpha bbox + 4 px.
Everything dropped is reported (box, area) so nothing disappears silently. Pure numpy/scipy, deterministic, free.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
PAD = 4
CREASE_GAP = 30


def load_layout(rig):
    with open(os.path.join(HERE, rig, "sheets.layout.json")) as fh:
        return json.load(fh)


def _components(a):
    m = a[..., 3] > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n == 0:
        return lab, []
    idx = np.arange(1, n + 1)
    areas = ndimage.sum(np.ones_like(lab), lab, idx).astype(int)
    cents = ndimage.center_of_mass(m, lab, idx)
    rgb = a[..., :3].astype(int)
    lum = rgb.max(-1)
    white = rgb.min(-1) > 200
    dark_n = ndimage.sum(lum < 110, lab, idx)
    white_n = ndimage.sum(white, lab, idx)
    out = []
    for k, s in enumerate(ndimage.find_objects(lab)):
        ys, xs = s
        out.append({"id": k + 1, "area": int(areas[k]), "cx": float(cents[k][1]), "cy": float(cents[k][0]),
                    "box": [int(xs.start), int(ys.start), int(xs.stop), int(ys.stop)],
                    "dark": float(dark_n[k] / areas[k]), "white": float(white_n[k] / areas[k])})
    return lab, out


def _hoverlap(a, b):
    lo, hi = max(a["box"][0], b["box"][0]), min(a["box"][2], b["box"][2])
    return max(0, hi - lo) / float(min(a["box"][2] - a["box"][0], b["box"][2] - b["box"][0]))


def _gap(a, b):
    """Gap between two component boxes in px (0 when they overlap)."""
    dx = max(0, max(a["box"][0], b["box"][0]) - min(a["box"][2], b["box"][2]))
    dy = max(0, max(a["box"][1], b["box"][1]) - min(a["box"][3], b["box"][3]))
    return (dx * dx + dy * dy) ** 0.5


def _is_brow(c, others):
    if c["dark"] < 0.85 or c["white"] > 0.02:
        return False
    return any(o is not c and o["cy"] > c["cy"] and o["box"][3] > c["box"][3] and _hoverlap(c, o) >= 0.3
               for o in others)


def apply_rule(rule, comps):
    """-> (kept, dropped) lists of component dicts."""
    by_area = sorted(comps, key=lambda c: -c["area"])
    if rule in ("hand", "whole"):
        return by_area, []
    if rule == "eyes":
        brows = [c for c in by_area if _is_brow(c, by_area)]
        rest = [c for c in by_area if c not in brows]
        return rest[:2], brows + rest[2:]
    if rule == "brows":
        return by_area[:2], by_area[2:]
    if rule == "mouth":
        # the mouth = the largest component plus its own creases: small solid ink strokes (corner dimples, a lip
        # arc) within CREASE_GAP px of it; anything else in the cell is dropped
        m = by_area[0]
        crease = [c for c in by_area[1:] if c["dark"] >= 0.85 and c["white"] <= 0.02 and c["area"] <= 0.15 * m["area"]
                  and _gap(c, m) <= CREASE_GAP]
        return [m] + crease, [c for c in by_area[1:] if c not in crease]
    if rule in ("single", "figure"):
        return by_area[:1], by_area[1:]
    if rule == "plate":
        p = by_area[0]
        inside = [c for c in by_area[1:] if c["box"][0] >= p["box"][0] and c["box"][1] >= p["box"][1]
                  and c["box"][2] <= p["box"][2] and c["box"][3] <= p["box"][3]]
        return [p] + inside, [c for c in by_area[1:] if c not in inside]
    raise ValueError(f"unknown rule {rule}")


def cut_sheet(a, sheet_layout, speck=64):
    """Cut one sheet (RGBA uint8 array) by its layout. Returns {label: record} with record['_arr'] = trimmed piece."""
    lab, comps = _components(a)
    specks = [c for c in comps if c["area"] < speck]
    comps = [c for c in comps if c["area"] >= speck]
    used = set()
    out = {}
    for row in sheet_layout["rows"]:
        y0, y1 = row["y"]
        for cell in row["cells"]:
            x0, x1 = cell["x"]
            inside = [c for c in comps if x0 <= c["cx"] < x1 and y0 <= c["cy"] < y1]
            if not inside:
                out[cell["label"]] = {"error": "empty cell", "cell": [x0, y0, x1, y1]}
                continue
            kept, dropped = apply_rule(cell["rule"], inside)
            used.update(c["id"] for c in inside)
            m = np.isin(lab, [c["id"] for c in kept])
            ys, xs = np.nonzero(m)
            bx0, by0, bx1, by1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            piece = np.zeros((by1 - by0 + 2 * PAD, bx1 - bx0 + 2 * PAD, 4), np.uint8)
            sub = a[by0:by1, bx0:bx1].copy()
            sub[~m[by0:by1, bx0:bx1]] = 0
            piece[PAD:PAD + by1 - by0, PAD:PAD + bx1 - bx0] = sub
            overhang = max(0, x0 - bx0, bx1 - x1, y0 - by0, by1 - y1)
            out[cell["label"]] = {
                "_arr": piece, "rule": cell["rule"], "cell": [x0, y0, x1, y1],
                "sheet_origin": [bx0 - PAD, by0 - PAD], "size": [piece.shape[1], piece.shape[0]],
                "components_kept": len(kept),
                "dropped": [{"box": c["box"], "area": c["area"], "why": "brow" if cell["rule"] == "eyes" and
                             _is_brow(c, inside) else f"rule {cell['rule']}"} for c in dropped],
                "overhang_px": int(overhang)}
    stray = [c for c in comps if c["id"] not in used]
    return out, {"components": len(comps), "specks": len(specks),
                 "outside_every_cell": [{"box": c["box"], "area": c["area"]} for c in stray]}
