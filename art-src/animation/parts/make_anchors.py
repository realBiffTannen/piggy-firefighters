#!/usr/bin/env python3
"""Measure anchor guidance for the Spine lane from the delivered parts (free, deterministic) -> <rig>/anchors.json.

Canvas coordinates are image pixels on the common canvas (x right, y down). Spine coordinates for the rig are
  spine_x = (x - 512) * scale,  spine_y = (1440 - y) * scale,  scale = runtime height / master height_px
Piece coordinates (pieces/*.png) are pixels inside that trimmed piece at SHEET scale; multiply by the piece's
scale_to_canvas (registration.json, per family since r2) to get canvas pixels. r2: pieces are re-cut on the fixed
grid, so piece coordinates are re-measured here; the file is written atomically. r2.1 adds a `guidance` block
(not contract bones): Ember's muzzle-on-nose registration and the rescued skins' joint offsets.
"""
import json
import os
import tempfile

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RUNTIME_H = {"pf_chief": 420, "pf_rookie": 380, "pf_dog": 220, "pf_rescued": 260}
FEET = (512, 1440)


def A(path):
    return np.array(Image.open(path).convert("RGBA"))


def alpha(a):
    return a[..., 3] > 128


def hole_centroid(a):
    m = alpha(a)
    filled = ndimage.binary_fill_holes(m)
    hole = filled & ~m
    lab, n = ndimage.label(hole)
    if n == 0:
        return None
    sizes = np.bincount(lab.ravel())[1:]
    k = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == k)
    return [round(float(xs.mean()), 1), round(float(ys.mean()), 1), int(sizes.max())]


def tip(a, side="right"):
    m = alpha(a)
    xs = np.nonzero(m.any(axis=0))[0]
    x = xs.max() if side == "right" else xs.min()
    ys = np.nonzero(m[:, x])[0]
    return [int(x), round(float(ys.mean()), 1)]


def top_centre(a):
    m = alpha(a)
    ys = np.nonzero(m.any(axis=1))[0]
    y = ys.min()
    xs = np.nonzero(m[y + 3])[0]
    return [round(float(xs.mean()), 1), int(y)]


NOSE_BOX = (740, 600, 900, 740)  # Ember's nose on the canvas (x0, y0, x1, y1), read by eye: excludes the far eye


def dog_nose(a, box=None):
    """The neutral-black nose blob (the outline ink is red-brown, so it is excluded), highlight filled in."""
    r, g, b = (a[..., i].astype(int) for i in range(3))
    blk = (np.maximum(np.maximum(r, g), b) < 90) & (a[..., 3] > 128) & (np.abs(r - g) < 18) & (np.abs(r - b) < 18)
    if box is not None:
        m = np.zeros_like(blk)
        m[box[1]:box[3], box[0]:box[2]] = True
        blk &= m
    blk = ndimage.binary_fill_holes(ndimage.binary_closing(blk, iterations=2))
    lab, n = ndimage.label(blk)
    sz = np.bincount(lab.ravel())
    sz[0] = 0
    ys, xs = np.nonzero(lab == int(np.argmax(sz)))
    return {"cx": round(float(xs.mean()), 1), "cy": round(float(ys.mean()), 1), "w": int(np.ptp(xs) + 1)}


def spine(pt, s):
    return [round((pt[0] - FEET[0]) * s, 1), round((FEET[1] - pt[1]) * s, 1)]


def piece_scale(reg, name):
    for v in reg.get("pieces", {}).values():
        if name in v["pieces"]:
            return v["pieces"][name].get("scale_to_canvas")
    return None


def write_json(obj, path):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp_", suffix=".json")
    with os.fdopen(fd, "w") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


def main():
    for rig, H in RUNTIME_H.items():
        d = os.path.join(HERE, rig)
        reg = json.load(open(os.path.join(d, "registration.json")))
        s = H / reg["master"]["height_px"]
        out = {"rig": rig, "version": reg.get("version", "r1"), "runtime_height_px": H,
               "master_height_px": reg["master"]["height_px"], "spine_scale": round(s, 5),
               "root_pivot_canvas": list(FEET), "anchors": {}}
        master = A(os.path.join(d, f"master_{rig}.png"))
        if rig in ("pf_chief", "pf_rookie"):
            ht = top_centre(master)
            if rig == "pf_chief":
                out["anchors"]["head_top"] = {"canvas": ht, "spine": spine(ht, s),
                                              "note": "crown of the helmet; bind to the head bone"}
                noz = os.path.join(d, "pieces", "nozzle.png")
                if os.path.exists(noz):
                    t = tip(A(noz), "right")
                    out["anchors"]["nozzle_tip"] = {"piece": "pieces/nozzle.png", "piece_xy": t,
                                                    "piece_scale_to_canvas": piece_scale(reg, "nozzle"),
                                                    "note": "muzzle centre at the right end; the nozzle axis runs along"
                                                            " piece x; bind as a child of the nozzle bone, rotated"
                                                            " with it"}
                for side, nm in (("grip_r", "hand_r_grip"), ("grip_l", "hand_l_grip")):
                    p = os.path.join(d, "pieces", f"{nm}.png")
                    if os.path.exists(p):
                        c = hole_centroid(A(p))
                        sc = piece_scale(reg, nm)
                        diam = 2 * float(np.sqrt(c[2] / np.pi)) if c else None
                        out["anchors"][side] = {"piece": f"pieces/{nm}.png", "piece_xy": c[:2] if c else None,
                                                "piece_scale_to_canvas": sc,
                                                "tunnel_diameter_px": {"piece": round(diam, 1),
                                                                       "canvas": round(diam * sc, 1)} if c else None,
                                                "note": "centre of the empty fist tunnel the hose passes through "
                                                        "(r2.1: hand scale 0.58, was 0.47)"}
            else:
                for side, nm in (("sheet_r", "hand_r_catch"), ("sheet_l", "hand_l_catch")):
                    p = os.path.join(d, "pieces", f"{nm}.png")
                    if os.path.exists(p):
                        a = A(p)
                        m = alpha(a)
                        ys, xs = np.nonzero(m)
                        # fingertips: the curled fingers are the piece end farthest from the cuff (cuff = navy)
                        navy = (a[..., 2].astype(int) > a[..., 0].astype(int) + 15) & m
                        cy, cx = (np.nonzero(navy)[0].mean(), np.nonzero(navy)[1].mean()) if navy.any() else (ys.mean(), xs.mean())
                        dist = (xs - cx) ** 2 + (ys - cy) ** 2
                        k = int(np.argmax(dist))
                        out["anchors"][side] = {"piece": f"pieces/{nm}.png", "piece_xy": [int(xs[k]), int(ys[k])],
                                                "piece_scale_to_canvas": piece_scale(reg, nm),
                                                "note": "fingertip point farthest from the cuff = where the sheet "
                                                        "edge sits (r2.1: hand scale 0.60, was 0.45)"}
        if rig == "pf_dog":
            head = A(os.path.join(d, "head_no_helmet.png"))
            m = alpha(head)
            ys, xs = np.nonzero(m)
            r, g, b = (head[..., i].astype(int) for i in range(3))
            blk = ndimage.binary_opening((r < 70) & (g < 70) & (b < 70) & m, iterations=3)
            lab, n = ndimage.label(blk)
            best = None
            for i in range(1, n + 1):
                cy, cx = np.nonzero(lab == i)
                area = len(cx)
                # the nose: a big solid black blob in the right 45 % and the lower 60 % of the head (not the outline)
                if area > 40000 or area < 3000:
                    continue
                if cx.mean() < xs.min() + 0.55 * np.ptp(xs) or cy.mean() < ys.min() + 0.4 * np.ptp(ys):
                    continue
                if best is None or area > best[0]:
                    best = (area, cx, cy)
            if best:
                _, cx, cy = best
                t = [int(cx.max()) - 10, int(cy.max()) - 25]
            else:
                t = tip(head, "right")
            out["anchors"]["sheet_r"] = {"canvas": t, "spine": spine(t, s),
                                         "note": "front of the mouth just under the nose: Ember holds the near sheet "
                                                 "corner in his mouth; bind to the jaw bone"}
            out["anchors"]["sheet_l"] = {"canvas": t, "spine": spine(t, s),
                                         "note": "Ember holds ONE corner; if the rig needs both, put sheet_l on the "
                                                 "same jaw bone offset along the sheet edge"}
            # r2.1: the muzzle_* face pieces carry their own nose, so they register nose-on-nose with the head
            hn = dog_nose(head, NOSE_BOX)
            muz = {}
            for f in sorted(os.listdir(os.path.join(d, "pieces"))):
                if f.startswith("muzzle_"):
                    n = dog_nose(A(os.path.join(d, "pieces", f)))
                    muz[f"pieces/{f}"] = {"nose_piece_xy": [n["cx"], n["cy"]], "nose_w": n["w"]}
            out.setdefault("guidance", {})["muzzle_nose"] = {
                "head_canvas": [hn["cx"], hn["cy"]], "head_spine": spine([hn["cx"], hn["cy"]], s),
                "head_nose_w": hn["w"], "pieces": muz,
                "piece_scale_to_canvas": piece_scale(reg, "muzzle_closed"),
                "note": ("not a contract bone: muzzle_* are opaque muzzle overlays that include the black nose; place each "
                         "so its nose_piece_xy (x piece_scale_to_canvas) lands on head_canvas, on the head/jaw bone. "
                         "Centres are the neutral-black nose blob (highlight included), measured the same way on the "
                         "head and on each piece")}
        if rig == "pf_rescued":
            out["anchors"]["feet"] = {"canvas": list(FEET), "spine": [0.0, 0.0],
                                      "note": "root pivot = feet centre on the feet line; land event at contact"}
            sj = reg.get("skin_slots", {}).get("joints")
            if sj:
                out.setdefault("guidance", {})["skin_joints"] = {
                    "canvas": sj,
                    "note": ("not contract bones: where each skin's neck (centre of the head slot's lowest 25 rows) and "
                             "shoulders (centre of each arm slot's top 60 rows) sit on the canvas, measured the same way on "
                             "the template layers and on every skin, with the offset from the template joint. Spine shares "
                             "one set of bones across skins, so a skin with a large offset turns about the template pivot: "
                             "the twins' neck sits ~84 px right / 75 px lower and both shoulders ~150-160 px lower than the "
                             "template's (the lower twin carries his brother), so keep the twins' head and arms at or near "
                             "rest, or place that skin's attachments on skin-specific bones at these points; the other "
                             "skins are within ~40 px (teen shoulder_l 55 px lower)")}
        path = os.path.join(d, "anchors.json")
        old = open(path).read() if os.path.exists(path) else None
        write_json(out, path)
        print(rig, "changed" if open(path).read() != old else "unchanged", json.dumps(out["anchors"])[:300])


if __name__ == "__main__":
    main()
