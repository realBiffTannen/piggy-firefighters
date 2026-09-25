#!/usr/bin/env python3
"""Measure anchor guidance for the Spine lane from the delivered parts (free, deterministic) -> <rig>/anchors.json.

Canvas coordinates are image pixels on the common canvas (x right, y down). Spine coordinates for the rig are
  spine_x = (x - 512) * scale,  spine_y = (1440 - y) * scale,  scale = runtime height / master height_px
Piece coordinates (pieces/*.png) are pixels inside that trimmed piece at sheet scale.
"""
import json
import os

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


def spine(pt, s):
    return [round((pt[0] - FEET[0]) * s, 1), round((FEET[1] - pt[1]) * s, 1)]


def main():
    for rig, H in RUNTIME_H.items():
        d = os.path.join(HERE, rig)
        reg = json.load(open(os.path.join(d, "registration.json")))
        s = H / reg["master"]["height_px"]
        out = {"rig": rig, "runtime_height_px": H, "master_height_px": reg["master"]["height_px"],
               "spine_scale": round(s, 5), "root_pivot_canvas": list(FEET), "anchors": {}}
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
                                                    "note": "muzzle centre at the right end; the nozzle axis runs along"
                                                            " piece x; bind as a child of the nozzle bone, rotated"
                                                            " with it"}
                for side, nm in (("grip_r", "hand_r_grip"), ("grip_l", "hand_l_grip")):
                    p = os.path.join(d, "pieces", f"{nm}.png")
                    if os.path.exists(p):
                        c = hole_centroid(A(p))
                        out["anchors"][side] = {"piece": f"pieces/{nm}.png", "piece_xy": c[:2] if c else None,
                                                "note": "centre of the empty fist tunnel the hose passes through"}
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
                                                "note": "fingertip point farthest from the cuff = where the sheet "
                                                        "edge sits"}
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
        if rig == "pf_rescued":
            out["anchors"]["feet"] = {"canvas": list(FEET), "spine": [0.0, 0.0],
                                      "note": "root pivot = feet centre on the feet line; land event at contact"}
        with open(os.path.join(d, "anchors.json"), "w") as f:
            json.dump(out, f, indent=2)
        print(rig, json.dumps(out["anchors"])[:400])


if __name__ == "__main__":
    main()
