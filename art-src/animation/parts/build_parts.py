#!/usr/bin/env python3
"""Build the rig part deliveries under art-src/animation/parts/<rig>/ from the raw paid outputs in
art-src/generated/rig_<rig>/ (local, deterministic, free; raw outputs are never modified).

  python3 art-src/animation/parts/build_parts.py [--rig pf_chief ...]

Writes, per rig: registered PNGs on the common canvas (1024x1536, feet y 1440, feet centre x 512), split pieces,
sheet pieces under pieces/, registration.json (fit per part), and qa/art/parts/<rig>_*.png overlays.
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from register_parts import CANVAS, FEET_X, FEET_Y, feet, fit, master_shift, place, rgba  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
GEN = os.path.join(REPO, "art-src", "generated")
QA = os.path.join(REPO, "qa", "art", "parts")

# same-framing parts: raw name -> (output name, split names left->right in IMAGE order or None)
# image-left arm/leg = the character's RIGHT (near side: the cast faces three-quarter to screen right)
SAME = {
    "pf_chief": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head_no_helmet": ("head_no_helmet", None),
                 "head_blank": ("head_blank", None), "helmet_only": ("helmet_only", None),
                 "arms_down": ("arms_down", ["arm_right", "arm_left"]), "legs": ("legs", ["leg_right", "leg_left"]),
                 "coat_tails": ("coat_tails", None)},
    "pf_rookie": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head_no_helmet": ("head_no_helmet", None),
                  "head_blank": ("head_blank", None), "helmet_only": ("helmet_only", None),
                  "arms_down": ("arms_down", ["arm_right", "arm_left"]), "legs": ("legs", ["leg_right", "leg_left"]),
                  "coat_tails": ("coat_tails", None)},
    "pf_dog": {"body_no_head_no_legs_r2": ("body_no_head_no_legs", None), "head_no_helmet": ("head_no_helmet", None),
               "helmet_only": ("helmet_only", None), "legs": ("legs", None)},
    "pf_rescued": {"body_no_head_no_arms": ("body_no_head_no_arms", None), "head": ("head", None),
                   "head_blank": ("head_blank", None), "arms_down": ("arms_down", ["arm_right", "arm_left"]),
                   "legs": ("legs", ["leg_right", "leg_left"]),
                   "skin_grandma": ("skin_grandma", None), "skin_twins": ("skin_twins", None),
                   "skin_dad": ("skin_dad", None), "skin_baby": ("skin_baby", None), "skin_teen": ("skin_teen", None)},
}
# sheets: raw name -> rows of piece names (row-major, image order)
SHEETS = {
    "pf_chief": {
        "hands_sheet": [["hand_r_open", "hand_r_grip", "hand_r_point", "hand_r_thumb"],
                        ["hand_l_open", "hand_l_grip", "hand_l_point", "hand_l_thumb"]],
        "face_sheet": [["eyes_open", "eyes_closed", "eyes_happy", "eyes_wide"],
                       ["brows_level", "brows_raised", "brows_worried", "brows_determined"],
                       ["mouth_closed", "mouth_open", "mouth_smile", "mouth_shout"],
                       ["moustache", "moustache_grin", "ear_left", "ear_right"]],
        "props": [["badge_blank", "shield_plate"], ["nozzle", "bugle"]],
    },
    "pf_rookie": {
        "hands_sheet": [["hand_r_open", "hand_r_grip", "hand_r_point", "hand_r_catch", "hand_r_pinch"],
                        ["hand_l_open", "hand_l_grip", "hand_l_point", "hand_l_catch", "hand_l_pinch"]],
        "face_sheet": [["eyes_open", "eyes_closed", "eyes_happy", "eyes_dart"],
                       ["brows_neutral", "brows_raised", "brows_worried", "brows_embarrassed"],
                       ["mouth_closed", "mouth_open", "mouth_smile", "mouth_oops"],
                       ["mouth_sad", "mouth_shout", "ear_left", "ear_right"]],
        "props": [["hose_flexible"], ["hose_coil"], ["card_blank", "card_back"]],
    },
    "pf_dog": {
        "parts_sheet": [["ear_left", "ear_right", "tail"], ["jaw", "head_no_jaw", "tongue"]],
        "face_sheet": [["eyes_open", "eyes_closed", "eyes_happy", "eyes_sad"],
                       ["brows_neutral", "brows_alert", "brows_sad", "brows_excited"],
                       ["mouth_closed", "mouth_bark", "mouth_pant", "mouth_sad"]],
    },
    "pf_rescued": {
        "face_sheet": [["eyes_open", "eyes_closed", "eyes_happy", "eyes_scared"],
                       ["brows_neutral", "brows_relieved", "brows_worried", "brows_joyful"],
                       ["mouth_closed", "mouth_call", "mouth_cheer", "mouth_worried"],
                       ["ear_left", "ear_right", "mouth_sigh", "mouth_o"]],
        "wave_arm": [["wave_arm_up", "wave_arm_left", "wave_arm_right"],
                     ["wave_hand_front", "wave_hand_left", "wave_hand_right"]],
        "slide_poses": [["pose_slide", "pose_land", "pose_cheer"]],
    },
}
IDENTITY = {"coat_tails"}
# placement priors (vertical centre as a fraction of the master height)
YRANGE = {"head_no_helmet": (0.0, 0.5), "head_blank": (0.0, 0.5), "head": (0.0, 0.5), "helmet_only": (0.0, 0.4),
          "legs": (0.5, 1.0), "coat_tails": (0.45, 0.85)}
SRANGE = {"coat_tails": (0.75, 1.35), "helmet_only": (0.7, 1.4), "body_no_head_no_arms": (0.6, 1.6), "body_no_head_no_legs": (0.6, 1.6),
          "legs": (0.5, 1.6)}
SHEET_REF = {  # (reference piece, registered counterpart, method[, colour])
    "pf_chief": {"hands_sheet": ("hand_r_open", "arm_right", "colour", "skin"),
                 "face_sheet": ("moustache", "head_no_helmet", "colour", "brown"),
                 "props": ("shield_plate", "helmet_only", "colour", "brass")},
    "pf_rookie": {"hands_sheet": ("hand_r_open", "arm_right", "colour", "skin"),
                  "face_sheet": ("eyes_open", "head_no_helmet", "colour", "white"),
                  "props": ("@hands_sheet",)},
    "pf_dog": {"parts_sheet": ("head_no_jaw", "head_no_helmet", "width"),
               "face_sheet": ("eyes_open", "head_no_helmet", "fixed", 0.9)},
    "pf_rescued": {"face_sheet": ("eyes_open", "head", "colour", "white"), "wave_arm": ("wave_arm_up", "arm_right", "area"),
                   "slide_poses": ("pose_cheer", "master", "colour", "cream")},
}
COLOURS = {
    "white": lambda r, g, b: (r > 225) & (g > 225) & (b > 225),
    "skin": lambda r, g, b: (r > 215) & (g > 120) & (g < 205) & (b > 90) & (b < 190) & (r - b > 40),
    "brown": lambda r, g, b: (r > 50) & (r < 150) & (g < 75) & (b < 55) & (r > g + 20),
    "cream": lambda r, g, b: (r > 215) & (g > 200) & (b > 150) & (b < 228) & (r - b > 12),
    "brass": lambda r, g, b: (r > 200) & (g > 150) & (b < 120),
}


def colour_area(a, name):
    r, g, bl = (a[..., i].astype(int) for i in range(3))
    m = COLOURS[name](r, g, bl) & (a[..., 3] > 128)
    m = ndimage.binary_closing(m, iterations=2)
    lab, n = ndimage.label(m)
    if n == 0:
        return 0
    return int(np.bincount(lab.ravel())[1:].max())


# raised arms: placed at the shoulder of the registered down arm, scaled by area
RAISED = {"pf_chief": "arms_raised", "pf_rookie": "arms_raised"}
# pieces whose scale is taken from a registration against the master (others use the sheet median)


def red_bottom(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    m = (r > 180) & (g < 80) & (b < 80) & (a[..., 3] > 128)
    return int(np.nonzero(m.sum(axis=1) > 20)[0].max())


def helmet_front(helmet, head, master):
    h = helmet.copy()
    inner = ndimage.binary_erosion(head[..., 3] > 128, iterations=4)
    diff = np.abs(h[..., :3].astype(int) - master[..., :3].astype(int)).sum(-1)
    drop = inner & (h[..., 3] > 0) & ((diff > 90) | (master[..., 3] < 128))
    drop = ndimage.binary_opening(drop, iterations=1) | (drop & ndimage.binary_dilation(drop, iterations=2))
    h[drop] = 0
    lab, n = ndimage.label(h[..., 3] > 0)
    if n > 1:
        sizes = np.bincount(lab.ravel())[1:]
        h[(lab > 0) & (lab != int(np.argmax(sizes)) + 1)] = 0
    return h


def feet_fit(master, part):
    """Full-figure costume edits keep the template framing (measured: same sole line and width), so they are placed
    by their feet: identity when the soles already sit within 6 px of the master's; otherwise scaled down to fit the
    canvas (never up) and aligned on the sole line and feet centre."""
    my1, mcx = feet(master)
    py1, pcx = feet(part)
    ys = np.nonzero((part[..., 3] > 128).any(axis=1))[0]
    if abs(py1 - my1) <= 6:
        return {"s": 1.0, "tx": 0.0, "ty": 0.0, "mode": "feet (identity: soles within 6 px)"}
    s = min(1.0, (my1 - 20) / float(py1 - ys.min()))
    return {"s": s, "tx": float(mcx - s * pcx), "ty": float(my1 - s * py1), "mode": "feet (scaled to fit, soles aligned)"}


def save(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    a = arr.copy()
    a[a[..., 3] == 0, :3] = 0
    Image.fromarray(a, "RGBA").save(path, optimize=True)
    return os.path.relpath(path, REPO)


def comps(a, min_area=400):
    m = a[..., 3] > 40
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sl = ndimage.find_objects(lab)
    out = []
    for i, s in enumerate(sl):
        area = int((lab[s] == i + 1).sum())
        if area < min_area:
            continue
        ys, xs = s
        out.append({"i": i + 1, "box": (xs.start, ys.start, xs.stop, ys.stop), "area": area,
                    "cx": (xs.start + xs.stop) / 2, "cy": (ys.start + ys.stop) / 2})
    return lab, out


def isolate(a, lab, ids):
    m = np.isin(lab, ids)
    out = a.copy()
    out[~m] = 0
    return out


def trim(a, pad=4):
    ys, xs = np.nonzero(a[..., 3] > 0)
    y0, y1, x0, x1 = max(0, ys.min() - pad), ys.max() + 1 + pad, max(0, xs.min() - pad), xs.max() + 1 + pad
    return a[y0:y1, x0:x1], (int(x0), int(y0))


def kmeans1d(vals, k):
    vals = np.asarray(vals, float)
    c = np.quantile(vals, (np.arange(k) + 0.5) / k)
    for _ in range(50):
        lab = np.argmin(np.abs(vals[:, None] - c[None]), axis=1)
        c2 = np.array([vals[lab == j].mean() if (lab == j).any() else c[j] for j in range(k)])
        if np.allclose(c, c2):
            break
        c = c2
    order = np.argsort(c)
    rank = np.empty(k, int)
    rank[order] = np.arange(k)
    return rank[lab]


def _bands(profile, n, min_gap=6):
    """Split a 1-D occupancy profile into exactly n runs: occupied runs separated by empty gaps; if there are more
    runs than n, the narrowest gaps are merged first (a gap inside a cell is narrower than a gap between cells)."""
    occ = profile > 0
    runs, i, L = [], 0, len(occ)
    while i < L:
        if occ[i]:
            j = i
            while j < L and occ[j]:
                j += 1
            runs.append([i, j])
            i = j
        else:
            i += 1
    if not runs:
        return []
    # close gaps below min_gap
    merged = [runs[0]]
    for r in runs[1:]:
        if r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    while len(merged) > n:
        gaps = [merged[k + 1][0] - merged[k][1] for k in range(len(merged) - 1)]
        k = int(np.argmin(gaps))
        merged[k][1] = merged[k + 1][1]
        del merged[k + 1]
    return merged if len(merged) == n else None


def split_grid(a, rows, min_area=400):
    """Group the sheet's components into the named grid cells. The sheets were requested as regular grids and the
    model keeps that layout, so the content box is divided into equal rows, and each row's own content span into
    equal columns; a component belongs to the cell holding its centre. (Gap-based banding merged the eye row into
    the brow row on two sheets; this uniform split was checked by eye on all eleven sheets.)"""
    lab, cs = comps(a, min_area)
    big = max(c["area"] for c in cs)
    keep = [c for c in cs if c["area"] >= max(min_area, big * 0.004)]
    m = np.isin(lab, [c["i"] for c in keep])
    ys = np.nonzero(m.any(axis=1))[0]
    y0, y1 = ys.min(), ys.max() + 1
    for c in keep:
        c["ri"] = min(len(rows) - 1, int((c["cy"] - y0) / ((y1 - y0) / len(rows))))
    cells = {}
    for ri, names in enumerate(rows):
        rc = [c for c in keep if c["ri"] == ri]
        if not rc:
            continue
        rx = np.nonzero(np.isin(lab, [c["i"] for c in rc]).any(axis=0))[0]
        x0, x1 = rx.min(), rx.max() + 1
        for c in rc:
            ci = min(len(names) - 1, int((c["cx"] - x0) / ((x1 - x0) / len(names))))
            cells.setdefault(names[ci], []).append(c["i"])
    return lab, cells


def overlay(master, part, path):
    bg = Image.fromarray(master).convert("RGBA")
    white = Image.new("RGBA", bg.size, (255, 255, 255, 255))
    base = Image.blend(white, Image.alpha_composite(white, bg), 0.35)
    base.alpha_composite(Image.fromarray(part))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    base.convert("RGB").resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS).save(path)


def shoulder_cap(piece, top=True):
    """centroid of the 12 % of the piece's alpha nearest its top (down arm) or bottom (raised arm)."""
    ys, xs = np.nonzero(piece[..., 3] > 128)
    h = ys.max() - ys.min()
    sel = ys <= ys.min() + 0.12 * h if top else ys >= ys.max() - 0.12 * h
    return float(xs[sel].mean()), float(ys[sel].mean())


def build(rig, pieces_only=False):
    raw_dir = os.path.join(GEN, f"rig_{rig}")
    out_dir = os.path.join(HERE, rig)
    rec = {"rig": rig, "canvas": list(CANVAS), "feet_y": FEET_Y, "feet_x": FEET_X, "parts": {}, "pieces": {}}
    m_raw = rgba(os.path.join(raw_dir, f"master_{rig}.png"))
    band = 0.05 if rig == "pf_dog" else 0.02
    sx, sy = master_shift(m_raw, band)
    master = place(m_raw, {"s": 1.0, "tx": 0.0, "ty": 0.0}, (sx, sy))
    # exact integer shift (no resampling) for the master
    m = np.zeros_like(m_raw)
    H, W = m_raw.shape[:2]
    ys0, xs0 = max(0, sy), max(0, sx)
    m[ys0:min(H, H + sy), xs0:min(W, W + sx)] = m_raw[max(0, -sy):min(H, H - sy), max(0, -sx):min(W, W - sx)]
    master = m
    rec["master"] = {"file": save(master, os.path.join(out_dir, f"master_{rig}.png")), "raw_shift": [sx, sy],
                     "raw": os.path.relpath(os.path.join(raw_dir, f"master_{rig}.png"), REPO)}
    y1, cx = feet(master, band)
    ys, xs = np.nonzero(master[..., 3] > 128)
    rec["master"]["bbox"] = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    rec["master"]["height_px"] = int(ys.max() - ys.min() + 1)
    rec["master"]["feet_measured"] = [round(cx, 1), y1]
    registered = {}
    if pieces_only:  # reuse the registered parts on disk; redo only the sheets
        old = json.load(open(os.path.join(out_dir, "registration.json")))
        rec["parts"] = old["parts"]
        for nm in list(old["parts"]) + ["arm_right", "arm_left", "leg_right", "leg_left"]:
            fp = os.path.join(out_dir, f"{nm}.png")
            if os.path.exists(fp):
                registered[nm] = np.array(Image.open(fp).convert("RGBA"))
    for rawname, (outname, split) in ({} if pieces_only else SAME.get(rig, {})).items():
        p = rgba(os.path.join(raw_dir, f"{rawname}.png"))
        if rawname.startswith("skin_"):
            f = feet_fit(m_raw, p)
        elif rawname in IDENTITY:
            dy = red_bottom(m_raw) - red_bottom(p)
            f = {"s": 1.0, "tx": 0.0, "ty": float(dy), "mode": f"raw scale kept, shifted {dy} px so the red hem's lowest "
                 "row matches the master's (colour/ink fits lock onto the chest bands)"}
        else:
            f = fit(m_raw, p, yrange=YRANGE.get(rawname), srange=SRANGE.get(rawname, (0.35, 1.6)))
            f["mode"] = "colour"
        placed = place(p, f, (sx, sy))
        registered[outname] = placed
        entry = {"raw": os.path.relpath(os.path.join(raw_dir, f"{rawname}.png"), REPO), "fit": f,
                 "file": save(placed, os.path.join(out_dir, f"{outname}.png"))}
        overlay(master, placed, os.path.join(QA, f"{rig}_{outname}.png"))
        if split:
            lab, cs = comps(placed, 800)
            cs = sorted(cs, key=lambda c: -c["area"])[:len(split)]
            cs = sorted(cs, key=lambda c: c["cx"])
            if len(cs) == len(split):
                entry["split"] = {}
                for nm, c in zip(split, cs):
                    piece = isolate(placed, lab, [c["i"]])
                    registered[nm] = piece
                    entry["split"][nm] = save(piece, os.path.join(out_dir, f"{nm}.png"))
            else:
                entry["split_error"] = f"expected {len(split)} components, found {len(cs)}"
        rec["parts"][outname] = entry
    if pieces_only:
        pass
    # helmet_front: over the head, keep a helmet pixel only where the MASTER shows the same colour there (the master
    # is the truth of what sits in front of the face); the painted lining and the far brim arc drop out
    if not pieces_only and "helmet_only" in registered and registered.get("head_no_helmet") is not None:
        h = helmet_front(registered["helmet_only"], registered["head_no_helmet"], master)
        registered["helmet_front"] = h
        rec["parts"]["helmet_front"] = {"derived_from": "helmet_only", "method": "inside the registered head "
                                        "(eroded 4 px) a helmet pixel is kept only where the master pixel matches it "
                                        "(RGB distance < 90); the largest component is kept",
                                        "file": save(h, os.path.join(out_dir, "helmet_front.png"))}
    if rig in RAISED and not pieces_only:
        p = rgba(os.path.join(raw_dir, f"{RAISED[rig]}.png"))
        lab, cs = comps(p, 800)
        cs = sorted(sorted(cs, key=lambda c: -c["area"])[:2], key=lambda c: c["cx"])
        entry = {"raw": os.path.relpath(os.path.join(raw_dir, f"{RAISED[rig]}.png"), REPO), "method":
                 "scale = sqrt(area of the registered down arm / area of the raised arm); the raised arm's shoulder "
                 "cap (bottom 12 %) is placed on the down arm's shoulder cap (top 12 %)", "split": {}}
        canvas_all = np.zeros_like(master)
        for nm, c in zip(["arm_right", "arm_left"], cs):
            if nm not in registered:
                continue
            piece = isolate(p, lab, [c["i"]])
            down = registered[nm]
            s = float(np.sqrt((down[..., 3] > 128).sum() / max(1, (piece[..., 3] > 128).sum())))
            px, py = shoulder_cap(piece, top=False)
            dx, dy = shoulder_cap(down, top=True)
            f = {"s": s, "tx": dx - s * px, "ty": dy - s * py}
            placed = place(piece, f)
            canvas_all = np.where(placed[..., 3:4] > 0, placed, canvas_all)
            entry["split"][nm + "_raised"] = {"file": save(placed, os.path.join(out_dir, f"{nm}_raised.png")),
                                              "fit": f, "shoulder_pivot": [round(dx, 1), round(dy, 1)]}
        entry["file"] = save(canvas_all, os.path.join(out_dir, "arms_raised.png"))
        overlay(master, canvas_all, os.path.join(QA, f"{rig}_arms_raised.png"))
        rec["parts"]["arms_raised"] = entry
    # sheets: keep the whole sheet (alpha-cleaned) + split pieces; estimate each piece's scale vs the master
    for rawname, rows in SHEETS.get(rig, {}).items():
        p = rgba(os.path.join(raw_dir, f"{rawname}.png"))
        sheet_file = save(p, os.path.join(out_dir, f"{rawname}.png"))
        lab, cells = split_grid(p, rows)
        pieces = {}
        for nm, ids in cells.items():
            piece, origin = trim(isolate(p, lab, ids))
            pieces[nm] = {"file": save(piece, os.path.join(out_dir, "pieces", f"{nm}.png")),
                          "size": [piece.shape[1], piece.shape[0]], "sheet_origin": list(origin),
                          "components": len(ids), "_arr": piece}
        # one scale per sheet, measured on ONE reference piece against its registered counterpart on the canvas
        ref = SHEET_REF.get(rig, {}).get(rawname)
        med, how = None, "no counterpart on the master: size it by eye in Spine"
        if ref and ref[0].startswith("@"):
            other = rec["pieces"].get(ref[0][1:])
            if other and other["sheet_scale_to_canvas"]:
                med = other["sheet_scale_to_canvas"]
                how = f"assumed equal to the {ref[0][1:]} scale (no counterpart on the master; hose ~ grip hole)"
        elif ref and ref[0] in pieces:
            pnm, target, method = ref[:3]
            tgt = master if target == "master" else registered.get(target)
            arr = pieces[pnm]["_arr"]
            if tgt is not None and method == "area":
                med = float(np.sqrt((tgt[..., 3] > 128).sum() / max(1, (arr[..., 3] > 128).sum())))
                how = f"sqrt(alpha area of {target} / {pnm}) (approximate: poses differ)"
            elif tgt is not None and method == "colour":
                at, ap = colour_area(tgt, ref[3]), colour_area(arr, ref[3])
                if at and ap:
                    med = float(np.sqrt(at / ap))
                    how = f"sqrt(largest {ref[3]} region of {target} / of {pnm})"
            elif tgt is not None and method == "width":
                w = lambda x: np.ptp(np.nonzero((x[..., 3] > 128).any(axis=0))[0]) + 1
                med = float(w(tgt) / w(arr))
                how = f"width of {target} / width of {pnm}"
            elif method == "fixed":
                med = float(ref[3])
                how = f"{ref[3]} matched BY EYE: {pnm} eye width and the nose width against the {target} (the white fur defeats the colour measure)"
            elif tgt is not None and method == "fitcrop":
                ys, xs = np.nonzero(tgt[..., 3] > 0)
                crop = tgt[max(0, ys.min() - 20):ys.max() + 20, max(0, xs.min() - 20):xs.max() + 20]
                f = fit(crop, arr, q=2, srange=(0.1, 1.3))
                med = f["s"]
                how = f"{pnm} registered inside the {target} crop (score {f['score']})"
        for nm, v in pieces.items():
            v.pop("_arr")
            v["scale_to_canvas"] = round(med, 4) if med else None
        missing = [n for r in rows for n in r if n not in pieces]
        rec["pieces"][rawname] = {"sheet": sheet_file, "raw": os.path.relpath(os.path.join(raw_dir, f"{rawname}.png"),
                                  REPO), "sheet_scale_to_canvas": med, "scale_method": how, "pieces": pieces, "missing": missing}
    # reassembly check (same-framing layers stacked in rig order)
    order = {"pf_chief": ["legs", "coat_tails", "body_no_head_no_arms", "arms_down", "head_no_helmet", "helmet_front"],
             "pf_rookie": ["legs", "coat_tails", "body_no_head_no_arms", "arms_down", "head_no_helmet", "helmet_front"],
             "pf_dog": ["legs", "body_no_head_no_legs", "head_no_helmet", "helmet_front"],
             "pf_rescued": ["legs", "body_no_head_no_arms", "arms_down", "head"]}[rig]
    stack = np.zeros_like(master)
    for nm in order:
        if nm in registered:
            L = registered[nm].astype(np.float32) / 255
            S = stack.astype(np.float32) / 255
            a = L[..., 3:4] + S[..., 3:4] * (1 - L[..., 3:4])
            rgb = (L[..., :3] * L[..., 3:4] + S[..., :3] * S[..., 3:4] * (1 - L[..., 3:4])) / np.maximum(a, 1e-6)
            stack = (np.concatenate([rgb, a], -1) * 255).astype(np.uint8)
    os.makedirs(QA, exist_ok=True)
    side = Image.new("RGB", (CANVAS[0], CANVAS[1] // 2), (150, 170, 150))
    for i, arr in enumerate([master, stack]):
        im = Image.fromarray(arr).resize((CANVAS[0] // 2, CANVAS[1] // 2), Image.LANCZOS)
        side.paste(im, (i * CANVAS[0] // 2, 0), im)
    d = ImageDraw.Draw(side)
    d.line([(0, FEET_Y // 2), (CANVAS[0], FEET_Y // 2)], fill=(200, 0, 0), width=1)
    side.save(os.path.join(QA, f"{rig}_reassembly.png"))
    rec["qa"] = {"reassembly": os.path.relpath(os.path.join(QA, f"{rig}_reassembly.png"), REPO)}
    with open(os.path.join(out_dir, "registration.json"), "w") as fh:
        json.dump(rec, fh, indent=2)
    return rec


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rig", nargs="*", default=["pf_chief", "pf_rookie", "pf_dog", "pf_rescued"])
    ap.add_argument("--pieces-only", action="store_true", help="re-cut the sheets only; keep the registered parts")
    a = ap.parse_args()
    for r in a.rig:
        rec = build(r, a.pieces_only)
        print(r, "master h", rec["master"]["height_px"], {k: (round(v["fit"]["score"], 2) if "score" in v["fit"] else v["fit"]["mode"]) for k, v in rec["parts"].items() if "fit" in v})
        for sh, v in rec["pieces"].items():
            print("  ", sh, "pieces", len(v["pieces"]), "missing", v["missing"], "sheet scale", v["sheet_scale_to_canvas"])
