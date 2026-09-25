#!/usr/bin/env python3
"""Ember (pf_dog) geometric layout measured on the registered r2 delivery.

Writes dog-layout.json: bones at canvas points, UV polygon sub-meshes of the
registered layers (face / ears from head_no_helmet, tail from the master), region
placements for the layers and the muzzle overlays, and white-fur cover patches
(UV selections of the head's own fur) that sit under the eye/brow sub-meshes so a
blink or brow raise never exposes the painted feature underneath. No pixel is
repainted or generated: every surface is a geometric selection of an original
registered PNG. Canvas basis: 1024x1536, feet centre (512,1440), y down.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_dog"
CANVAS = (1024, 1536)

# White fur sample on the crown (under the helmet): measured largest plain square.
WHITE_PATCH = {"centre": (660, 448), "half": 52}

# Polygons in canvas pixels (y down). Winding is normalised by the author.
NEAR_EAR = [(262, 610), (300, 540), (350, 505), (430, 488), (528, 488), (530, 600), (528, 690), (516, 722),
            (504, 744), (490, 762), (470, 780), (462, 810), (448, 840), (430, 858), (350, 866), (300, 830),
            (270, 760), (258, 690)]
FAR_EAR = [(846, 445), (905, 445), (948, 540), (1006, 590), (1006, 700), (1000, 762), (958, 814), (905, 804),
           (898, 778), (910, 764), (918, 744), (925, 722), (929, 703), (927, 684), (922, 662), (912, 644),
           (890, 634), (876, 618), (870, 598), (862, 545), (860, 470)]
FACE = [(400, 356), (850, 356), (850, 440), (840, 470), (848, 520), (858, 556), (866, 580), (872, 600),
        (872, 618), (890, 634), (912, 645), (924, 662), (930, 684), (931, 703), (927, 722), (920, 742),
        (914, 760), (894, 780), (876, 800), (856, 826), (836, 850), (780, 858), (740, 880), (720, 935),
        (600, 935), (540, 905), (520, 850), (500, 806), (490, 784), (497, 762), (497, 730), (503, 710),
        (508, 690), (508, 650), (510, 600), (512, 560), (515, 488), (400, 488)]
TAIL = [(20, 640), (60, 575), (150, 572), (200, 640), (225, 720), (245, 820), (268, 880), (292, 922),
        (232, 952), (170, 926), (100, 870), (40, 790), (18, 700)]
NEAR_BROW = [(582, 552), (600, 530), (625, 512), (650, 506), (670, 512), (674, 526), (656, 539), (626, 549),
             (602, 566), (586, 567)]
FAR_BROW = [(772, 492), (790, 479), (812, 481), (827, 494), (836, 512), (831, 526), (815, 528), (795, 516),
            (774, 508)]


def ellipse(centre, rx, ry, cut_below=None, n=20):
    import math
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = centre[0] + rx * math.cos(t), centre[1] + ry * math.sin(t)
        pts.append((round(x, 1), round(min(y, cut_below) if cut_below else y, 1)))
    # Collapse the clipped run to a flat bottom edge.
    out = []
    for p in pts:
        if out and out[-1][1] == p[1] == cut_below and len(out) > 1 and out[-2][1] == cut_below:
            out[-1] = p
        else:
            out.append(p)
    return out


NEAR_EYE = ellipse((650, 611), 62, 66, cut_below=664)
FAR_EYE = ellipse((814, 585), 50, 60, cut_below=628)


def make_layout(parts=PARTS):
    record = json.loads((parts / "registration.json").read_text())
    sizes = {name: Image.open(parts / f"{name}.png").size for name in (
        "master_pf_dog", "body_no_head_no_legs", "head_no_helmet", "helmet_front",
        "leg_hind_right", "leg_hind_left", "leg_front_right", "leg_front_left")}
    for name in ("muzzle_closed", "muzzle_bark", "muzzle_pant", "muzzle_sad"):
        sizes[name] = Image.open(parts / "pieces" / f"{name}.png").size
    guidance = json.loads((parts / "anchors.json").read_text())["guidance"]["muzzle_nose"]
    nose = guidance["head_canvas"]
    muzzle_scale = guidance["piece_scale_to_canvas"]

    bones = [
        {"name": "root", "point": [512, 1440]},
        {"name": "pelvis", "parent": "root", "point": [300, 990]},
        {"name": "leg_hind_right", "parent": "pelvis", "point": [255, 950]},
        {"name": "leg_hind_left", "parent": "pelvis", "point": [410, 925]},
        {"name": "tail", "parent": "pelvis", "point": [245, 900]},
        {"name": "body", "parent": "pelvis", "point": [300, 990]},
        {"name": "chest", "parent": "body", "point": [640, 980]},
        {"name": "leg_front_right", "parent": "chest", "point": [530, 955]},
        {"name": "leg_front_left", "parent": "chest", "point": [838, 1112]},
        {"name": "neck", "parent": "chest", "point": [620, 870]},
        {"name": "head", "parent": "neck", "point": [640, 830]},
        {"name": "ear_right", "parent": "head", "point": [470, 500]},
        {"name": "ear_left", "parent": "head", "point": [870, 470]},
        {"name": "helmet", "parent": "head", "point": [620, 450]},
        {"name": "brow_right", "parent": "head", "point": [628, 537]},
        {"name": "brow_left", "parent": "head", "point": [804, 504]},
        {"name": "eye_right", "parent": "head", "point": [650, 664]},
        {"name": "eye_left", "parent": "head", "point": [814, 628]},
        {"name": "muzzle", "parent": "head", "point": list(nose)},
        {"name": "jaw", "parent": "head", "point": [650, 790]},
        {"name": "sheet_r", "parent": "jaw", "point": [861, 751]},
        {"name": "sheet_l", "parent": "jaw", "point": [835, 775]},
    ]

    def region(name, image, bone, scale=1.0, origin=(0, 0), slot=None, setup=True):
        return {"kind": "region", "name": name, "slot": slot or name, "image": image, "bone": bone,
                "image_size": list(sizes[image]), "scale": scale, "origin": list(origin), "setup": setup}

    def polygon(name, image, bone, points, slot=None, cover=None):
        surface = {"kind": "polygon", "name": name, "slot": slot or name, "image": image, "bone": bone,
                   "image_size": list(sizes[image]), "points": [list(p) for p in points]}
        if cover:
            surface["uv_patch"] = cover
        return surface

    # Draw order back to front.  The body (collar) is drawn over the head's neck fur,
    # exactly as the master layers it, so a nod tucks the chin into the collar.
    surfaces = [
        polygon("tail", "master_pf_dog", "tail", TAIL),
        polygon("ear_left", "head_no_helmet", "ear_left", FAR_EAR),
        region("leg_hind_left", "leg_hind_left", "leg_hind_left"),
        region("leg_front_left", "leg_front_left", "leg_front_left"),
        polygon("face", "head_no_helmet", "head", FACE),
        polygon("eye_cover_right", "head_no_helmet", "head", NEAR_EYE, cover=WHITE_PATCH),
        polygon("eye_right", "head_no_helmet", "eye_right", NEAR_EYE),
        polygon("eye_cover_left", "head_no_helmet", "head", FAR_EYE, cover=WHITE_PATCH),
        polygon("eye_left", "head_no_helmet", "eye_left", FAR_EYE),
        polygon("brow_cover_right", "head_no_helmet", "head", NEAR_BROW, cover=WHITE_PATCH),
        polygon("brow_right", "head_no_helmet", "brow_right", NEAR_BROW),
        polygon("brow_cover_left", "head_no_helmet", "head", FAR_BROW, cover=WHITE_PATCH),
        polygon("brow_left", "head_no_helmet", "brow_left", FAR_BROW),
    ]
    for name in ("muzzle_closed", "muzzle_bark", "muzzle_pant", "muzzle_sad"):
        nx, ny = guidance["pieces"][f"pieces/{name}.png"]["nose_piece_xy"]
        origin = (nose[0] - nx * muzzle_scale, nose[1] - ny * muzzle_scale)
        surfaces.append(region(name, name, "muzzle", scale=muzzle_scale, origin=origin, slot="muzzle", setup=False))
    surfaces += [
        polygon("ear_right", "head_no_helmet", "ear_right", NEAR_EAR),
        region("helmet", "helmet_front", "helmet"),
        region("body", "body_no_head_no_legs", "body"),
        region("leg_hind_right", "leg_hind_right", "leg_hind_right"),
        region("leg_front_right", "leg_front_right", "leg_front_right"),
    ]
    return {
        "rig": "pf_dog", "canvas": list(CANVAS), "feet": [512, 1440], "standing_height_px": 220,
        "registration_sha256": hashlib.sha256((parts / "registration.json").read_bytes()).hexdigest(),
        "note": "Measured by eye on head_no_helmet / master_pf_dog zooms (2026-09-25); polygons are UV selections "
                "of registered originals, never repainted. Near = image-left = Ember's RIGHT side.",
        "bones": bones, "surfaces": surfaces,
    }


if __name__ == "__main__":
    layout = make_layout()
    target = HERE / "dog-layout.json"
    target.write_text(json.dumps(layout, indent=1) + "\n")
    print(target, len(layout["bones"]), "bones", len(layout["surfaces"]), "surfaces")
