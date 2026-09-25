#!/usr/bin/env python3
"""Measure the Trotter family layout against Claude's registered r2 delivery.

Writes rescued-layout.json: the registration hash it was measured against, the
shared bone points, and for each of the five skins its own neck, shoulders, hand
centres and (BY EYE) mouth centre on the 1024x1536 canvas. author_rescued.py refuses
a layout measured against a different registration.json. No pixel is repainted.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_rescued"
SKINS = ("grandma", "twins", "dad", "baby", "teen")

# Read BY EYE from qa grids of each skin's head.png (2026-09-25): the centre of the
# baked smile, where the open call/cheer/o mouths are laid so they cover it.
MOUTH_CENTRE = {"grandma": (520, 432), "twins": (515, 530), "dad": (490, 410),
                "baby": (508, 412), "teen": (520, 425)}
# Grandma's cat sits on her image-left shoulder (character right), so she calls for
# help with the other arm; every other skin waves the image-left arm (arm_right).
WAVE_SIDE = {"grandma": "l", "twins": "r", "dad": "r", "baby": "r", "teen": "r"}
# Grandma's image-left arm may not swing through the cat: cap its raise.
RAISE_CAP = {"grandma": {"r": 40}}


def alpha(path):
    return np.array(Image.open(path).convert("RGBA"))[:, :, 3] > 128


def hand_centre(path, rows=120):
    mask = alpha(path)
    ys, xs = np.nonzero(mask)
    keep = ys > ys.max() - rows
    return [round(float(xs[keep].mean()), 1), round(float(ys[keep].mean()), 1)]


def main():
    registration = PARTS / "registration.json"
    anchors = json.loads((PARTS / "anchors.json").read_text())
    joints = anchors["guidance"]["skin_joints"]["canvas"]
    master = alpha(PARTS / "master_pf_rescued.png")
    ys = np.nonzero(master.any(axis=1))[0]
    height = int(ys.max() - ys.min() + 1)
    layout = {
        "rig": "pf_rescued",
        "registration_sha256": hashlib.sha256(registration.read_bytes()).hexdigest(),
        "coordinate_basis": "canvas 1024x1536, x right, y down; root pivot = feet centre (512,1440)",
        "runtime_height_px": 260, "master_height_px": height, "spine_scale": 260 / height,
        "bones": {
            "root": [512, 1440], "feet": [512, 1440],
            "hips": [512, 905], "chest": [512, 720],
            "leg_r": [392, 905], "leg_l": [648, 905],
            "why": "hips at the trouser top under the shirt hem (the leg layers extend 140 px above it for hidden overlap); chest carries the heads and shoulders; leg pivots on each trouser column centre at the hip line",
        },
        "pieces": {
            "mouth_call": {"scale_to_canvas": 0.78}, "mouth_cheer": {"scale_to_canvas": 0.60},
            "mouth_o": {"scale_to_canvas": 0.75}, "wave_hand_front": {"scale_to_canvas": 0.68},
            "why": "BY EYE on qa overlays: each open mouth must cover the skin's baked smile (~150 px wide); the open palm must cover the baked closed hand",
        },
        "skins": {},
    }
    for skin in SKINS:
        folder = PARTS / "skins" / skin
        row = {
            "neck": joints[skin]["neck"]["canvas"],
            "shoulder_r": joints[skin]["shoulder_r"]["canvas"],
            "shoulder_l": joints[skin]["shoulder_l"]["canvas"],
            "hand_r": hand_centre(folder / "arm_right.png"),
            "hand_l": hand_centre(folder / "arm_left.png"),
            "mouth": list(MOUTH_CENTRE[skin]),
            "wave_side": WAVE_SIDE[skin],
            "raise_cap": RAISE_CAP.get(skin, {}),
        }
        for size_name in ("arm_right", "arm_left", "head", "body_no_head_no_arms", "leg_right", "leg_left"):
            assert Image.open(folder / f"{size_name}.png").size == (1024, 1536), size_name
        layout["skins"][skin] = row
    (HERE / "rescued-layout.json").write_text(json.dumps(layout, indent=2) + "\n")
    print(json.dumps({"scale": layout["spine_scale"], "skins": {k: v["hand_r"] for k, v in layout["skins"].items()}}))


if __name__ == "__main__":
    main()
