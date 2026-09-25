#!/usr/bin/env python3
"""Chief-specific native UV layout measured from original delivery 62725b3.

Uses the intact face sheet: the automatic piece splitter mislabeled/grouped several
features. Body UVs supply correctly scaled legs and coat; registered standalone
leg/coat fits are undersized. These are geometric selections, not replacement art.
"""
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

from author_pilot import HERE, PARTS, load_delivery, standing_scale


def make_layout(parts=PARTS, full=False):
    record, files = load_delivery(parts)
    used_images = ("master_pf_chief", "body_no_head_no_arms", "head_blank", "helmet_only",
                   "arm_right", "arm_left", "face_sheet", "hand_l_grip", "hand_r_grip", "nozzle", "shield_13", "hose_original")
    if full:
        used_images += ("hand_r_open", "hand_r_point", "hand_r_thumb", "bugle")
    images = {name: Image.open(files[name]) for name in used_images}
    bounds = images["master_pf_chief"].getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
    scale = standing_scale(bounds)
    bones, surfaces, ik, transforms = [], [], [], []

    def bone(name, parent, point, angle=0, length=0):
        result = {"name": name, "point": list(point), "angle": angle}
        if parent:
            result["parent"] = parent
        if length:
            result["length"] = length
        bones.append(result)

    def strip(name, image, slot_bone, rows, horizontal=True):
        # Boundary vertices first, as required by Spine's mesh hull representation.
        left, right = [], []
        for level, lower, upper, weights in rows:
            for edge, position in ((left, lower), (right, upper)):
                point = (position, level) if horizontal else (level, position)
                edge.append({"uv": list(point), "point": list(point), "weights": weights})
        vertices = left + right[::-1]
        count = len(rows)
        triangles = []
        for i in range(count - 1):
            a, b, c, d = i, i + 1, 2 * count - 2 - i, 2 * count - 1 - i
            triangles.extend([a, b, c, a, c, d])
        if not horizontal:
            # Spine attachment packing treats reversed hull winding as a subtractive
            # mask when several meshes share an image; keep the same winding as quads.
            vertices.reverse()
            triangles = [len(vertices) - 1 - index for index in triangles]
        surfaces.append({"name": name, "image": image, "bone": slot_bone,
                         "image_size": list(images[image].size), "vertices": vertices,
                         "triangles": triangles, "hull": len(vertices)})

    def quad(name, image, slot_bone, crop, target=None, angle=0, anchor=None):
        x0, y0, x1, y1 = crop
        if target is None:
            target = crop
        tx0, ty0, tx1, ty1 = target
        coords = [(tx0, ty0), (tx0, ty1), (tx1, ty1), (tx1, ty0)]
        if angle:
            ax, ay = anchor or ((tx0 + tx1) / 2, (ty0 + ty1) / 2)
            a = math.radians(-angle)  # canvas y points down.
            coords = [(ax + (x - ax) * math.cos(a) - (y - ay) * math.sin(a),
                       ay + (x - ax) * math.sin(a) + (y - ay) * math.cos(a)) for x, y in coords]
        surfaces.append({"name": name, "image": image, "bone": slot_bone,
                         "image_size": list(images[image].size), "hull": 4,
                         "vertices": [{"uv": list(uv), "point": list(point), "weights": {slot_bone: 1}}
                                      for uv, point in zip([(x0, y0), (x0, y1), (x1, y1), (x1, y0)], coords)],
                         "triangles": [0, 1, 2, 0, 2, 3]})

    bone("root", None, (512, 1440))
    bone("body", "root", (512, 875))
    bone("chest", "body", (512, 645))
    bone("head", "chest", (528, 542))
    bone("helmet", "head", (529, 245))
    bone("head_top", "helmet", (544, 18))
    bone("moustache", "head", (572, 431))
    bone("eyes", "head", (546, 332))
    bone("brows", "head", (541, 278))
    bone("mouth", "head", (575, 462))
    bone("ear_r", "head", (340, 347))
    bone("ear_l", "head", (658, 298))
    bone("coat_r", "body", (383, 870))
    bone("coat_l", "body", (619, 870))
    bone("boot_r", "root", (289, 1392))
    bone("boot_l", "root", (724, 1392))

    nozzle_center = (512 + 33 / scale, 1440 - 164 / scale)
    nozzle_angle = -28
    bone("nozzle", "root", nozzle_center, nozzle_angle)

    def nozzle_point(x, y):
        a = math.radians(nozzle_angle)
        dx, dy = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
        return (nozzle_center[0] + dx / scale, nozzle_center[1] - dy / scale)

    bone("nozzle_tip", "nozzle", nozzle_point(62, 0), nozzle_angle)
    # Actual grip holes and cuff centres measured in the supplied 307/304px pieces.
    hand_specs = {"r": {"hole": (174, 216), "cuff": (100, 68), "grip": -30, "width": 42},
                  "l": {"hole": (133, 212), "cuff": (214, 66), "grip": 24, "width": 39}}
    for side, spec in hand_specs.items():
        bone(f"grip_{side}", "nozzle", nozzle_point(spec["grip"], 0), nozzle_angle)
        image = f"hand_{side}_grip"
        factor = spec["width"] / images[image].width
        hx, hy = spec["hole"]
        cx, cy = spec["cuff"]
        wrist = nozzle_point(spec["grip"] + (cx - hx) * factor, -(cy - hy) * factor)
        bone(f"wrist_target_{side}", "nozzle", wrist, nozzle_angle)

    # Bind in the painted down-arm pose. IK then bends that continuous sleeve toward
    # the nozzle's actual wrist points; no cut/paint is introduced at the elbows.
    arm_points = {"r": [(307, 579), (212, 720), (130, 868)],
                  "l": [(712, 579), (805, 720), (884, 866)]}
    for side, (shoulder, elbow, wrist) in arm_points.items():
        angle1 = math.degrees(math.atan2(shoulder[1] - elbow[1], elbow[0] - shoulder[0]))
        angle2 = math.degrees(math.atan2(elbow[1] - wrist[1], wrist[0] - elbow[0]))
        bone(f"upper_{side}", "chest", shoulder, angle1, math.dist(shoulder, elbow))
        bone(f"fore_{side}", f"upper_{side}", elbow, angle2, math.dist(elbow, wrist))
        bone(f"elbow_{side}", f"upper_{side}", elbow, (angle1 + angle2) / 2)
        ik.append({"name": f"grip_ik_{side}", "order": len(ik),
                   "bones": [f"upper_{side}", f"fore_{side}"], "target": f"wrist_target_{side}",
                   "mix": 1, "bendPositive": True, "stretch": False, "compress": False})
        transforms.append({"name": f"elbow_volume_{side}", "order": 2 + len(transforms),
                           "bones": [f"elbow_{side}"], "target": f"fore_{side}",
                           "local": True, "relative": False, "mixRotate": .5,
                           "mixX": 0, "mixY": 0, "mixScaleX": 0, "mixScaleY": 0, "mixShearY": 0})

    # Legs are selected from the same correctly-scaled body source, removing double
    # contours and preserving the source's sole line; only upper trouser vertices brace.
    for side, x0, x1 in (("r", 110, 512), ("l", 512, 908)):
        strip(f"leg_{side}", "body_no_head_no_arms", f"boot_{side}", [
            (996, x0, x1, {"body": 1}), (1080, x0, x1, {"body": .45, f"boot_{side}": .55}),
            (1220, x0, x1, {f"boot_{side}": 1}), (1445, x0, x1, {f"boot_{side}": 1})])

    # Far arm, before the torso; near arm is appended after torso/head.
    def sleeve(side):
        image = "arm_right" if side == "r" else "arm_left"
        samples = {"r": [(530, 281, 333), (570, 226, 363), (640, 165, 348),
                          (710, 121, 308), (765, 87, 270), (817, 57, 239), (867, 50, 204)],
                   "l": [(530, 687, 738), (570, 653, 790), (640, 670, 853),
                          (710, 712, 900), (765, 750, 933), (817, 778, 967), (867, 815, 966)]}[side]
        rows = []
        for i, (y, x0, x1) in enumerate(samples):
            weights = [{f"upper_{side}": 1}, {f"upper_{side}": 1},
                       {f"upper_{side}": .75, f"elbow_{side}": .25},
                       {f"elbow_{side}": 1}, {f"elbow_{side}": .25, f"fore_{side}": .75},
                       {f"fore_{side}": 1}, {f"fore_{side}": 1}][i]
            rows.append((y, x0, x1, weights))
        strip(f"sleeve_{side}", image, f"upper_{side}", rows)
        # A horizontal sample crosses the diagonal painted forearm obliquely and
        # becomes a long triangular lip after IK. Use a true transverse section,
        # gently narrowing the final sleeve span to the independent grip cuff.
        elbow, wrist = arm_points[side][1:]
        ax, ay = wrist[0]-elbow[0], wrist[1]-elbow[1]
        length = math.hypot(ax, ay)
        nx, ny = -ay/length, ax/length
        center = (wrist[0]-ax/length*54, wrist[1]-ay/length*54)
        for index, sign in ((len(rows)-2, 1), (len(rows)+1, -1)):
            vertex = surfaces[-1]["vertices"][index]
            vertex["uv"] = [center[0]+sign*nx*72, center[1]+sign*ny*72]
            vertex["point"] = [center[0]+sign*nx*44, center[1]+sign*ny*44]
        # End perpendicular to the painted forearm, beneath the independent hand's
        # navy cuff. A horizontal UV cut left a flared red corner projecting upward.
        endpoints = {"r": ((73, 836), (187, 899)), "l": ((827, 893), (941, 831))}[side]
        # The painted sleeve is broader than the separate grip's navy cuff. Seat
        # its final cross-section in that actual cuff, inheriting wrist orientation
        # instead of the forearm's IK angle; otherwise a red corner lifts away mid-aim.
        cuff_edges = {"r": ((23, 103), (159, 18)), "l": ((144, 29), (296, 111))}[side]
        spec = hand_specs[side]
        factor = spec["width"] / images[f"hand_{side}_grip"].width
        hx, hy = spec["hole"]
        for index, uv, (cx, cy) in zip((len(rows) - 1, len(rows)), endpoints, cuff_edges):
            vertex = surfaces[-1]["vertices"][index]
            vertex["uv"] = list(uv)
            vertex["point"] = list(nozzle_point(spec["grip"] + (cx-hx)*factor, -(cy-hy)*factor))
            vertex["weights"] = {f"wrist_target_{side}": 1}

    for side, x0, x1 in (("r", 199, 477), ("l", 477, 814)):
        strip(f"coat_{side}", "body_no_head_no_arms", f"coat_{side}", [
            (850, x0, x1, {"body": 1}), (901, x0, x1, {"body": .8, f"coat_{side}": .2}),
            (982, x0, x1, {f"coat_{side}": 1}), (1063, x0, x1, {f"coat_{side}": 1})])
    strip("torso", "body_no_head_no_arms", "body", [
        (430, 405, 627, {"chest": 1}), (470, 340, 681, {"chest": 1}),
        (560, 294, 728, {"chest": 1}), (730, 280, 733, {"chest": .7, "body": .3}),
        (817, 265, 747, {"chest": .15, "body": .85}), (910, 266, 747, {"body": 1})])
    sleeve("l")

    quad("helmet_back", "helmet_only", "helmet", (176, 9, 770, 427))
    quad("ear_r", "face_sheet", "ear_r", (1230, 765, 1484, 971), (235, 287, 378, 411))
    quad("ear_l", "face_sheet", "ear_l", (840, 765, 1093, 975), (638, 239, 731, 341))
    quad("head", "head_blank", "head", (309, 189, 742, 608), (309, 174, 742, 593))
    quad("mouth", "face_sheet", "mouth", (49, 601, 338, 709), (516, 444, 644, 492))
    quad("eyes", "face_sheet", "eyes", (44, 166, 352, 289), (440, 291, 648, 374))
    quad("brows", "face_sheet", "brows", (46, 96, 342, 175), (436, 252, 641, 307))
    quad("moustache", "face_sheet", "moustache", (46, 827, 355, 938), (435, 397, 717, 481))
    strip("helmet_front", "helmet_only", "helmet", [
        (176, 9, 427, {"helmet": 1}), (229, 9, 369, {"helmet": 1}),
        (280, 9, 327, {"helmet": 1}), (336, 9, 295, {"helmet": 1}),
        (382, 9, 291, {"helmet": 1}), (450, 9, 266, {"helmet": 1}),
        (525, 9, 249, {"helmet": 1}), (600, 9, 244, {"helmet": 1}),
        (681, 9, 252, {"helmet": 1}), (731, 9, 274, {"helmet": 1}),
        (770, 9, 291, {"helmet": 1})], horizontal=False)
    sw, sh = images["shield_13"].size
    # Approved v005 placement measured against the master, independent of the
    # corrected sheet splitter's changed scale estimate. Source pixels are unchanged.
    fit = {"s": .5601959876688996, "tx": 459.7592160493244, "ty": 21.7592160493244}
    quad("shield_13", "shield_13", "helmet", (0, 0, sw, sh),
         (fit["tx"], fit["ty"], fit["tx"] + fit["s"] * sw, fit["ty"] + fit["s"] * sh))
    sleeve("r")

    # Prop and two independently posed grip sprites are driven by the same nozzle.
    width, height = images["nozzle"].size
    factor = 130 / width / scale
    nx, ny = nozzle_center
    quad("nozzle", "nozzle", "nozzle", (0, 0, width, height),
         (nx - width * factor / 2, ny - height * factor / 2,
          nx + width * factor / 2, ny + height * factor / 2), nozzle_angle, nozzle_center)
    for side in ("l", "r"):
        spec = hand_specs[side]
        image = f"hand_{side}_grip"
        width, height = images[image].size
        factor = spec["width"] / width / scale
        hx, hy = spec["hole"]
        # First place the image around the unrotated grip, then rotate with nozzle.
        gx, gy = nx + spec["grip"] / scale, ny
        quad(f"hand_{side}", image, f"wrist_target_{side}" if full else f"grip_{side}", (0, 0, width, height),
             (gx - hx * factor, gy - hy * factor, gx + (width - hx) * factor, gy + (height - hy) * factor),
             nozzle_angle, nozzle_center)

    if full:
        # Expressions select original pixels from the intact sheet. Each variant
        # belongs to the existing slot; no extra visible face is stacked over it.
        variants = [
            ("eyes_closed", "eyes", (420, 193, 737, 267), (440, 322, 648, 370)),
            ("eyes_happy", "eyes", (811, 198, 1120, 270), (440, 322, 648, 370)),
            ("brows_worried", "brows", (826, 398, 1104, 476), (436, 252, 641, 307)),
            ("brows_raised", "brows", (426, 368, 741, 474), (436, 237, 641, 307)),
            ("mouth_smile", "mouth", (831, 560, 1127, 744), (506, 426, 654, 518)),
        ]
        for name, slot, uv, target in variants:
            quad(name, "face_sheet", slot, uv, target)
            surfaces[-1].update(slot=slot, setup_attachment=slot)

        # Cuff pivots/axes measured from delivered variants, not their image centers.
        # Register the cuff normal to the pilot grip's 63.435° canvas axis.
        for name, cuff, axis in (("hand_r_open", (243.5, 66.1), 126.0),
                                  ("hand_r_point", (72.23, 83.53), 37.62),
                                  ("hand_r_thumb", (48.76, 207.76), 3.43)):
            width, height = images[name].size
            factor = hand_specs["r"]["width"] / images["hand_r_grip"].width / scale
            wrist = next(b["point"] for b in bones if b["name"] == "wrist_target_r")
            cx, cy = cuff
            quad(name, name, "wrist_target_r", (0, 0, width, height),
                 (wrist[0]-cx*factor, wrist[1]-cy*factor,
                  wrist[0]+(width-cx)*factor, wrist[1]+(height-cy)*factor),
                 nozzle_angle + axis - math.degrees(math.atan2(148, 74)), wrist)
            surfaces[-1].update(slot="hand_r", setup_attachment="hand_r")

        width, height = images["bugle"].size
        factor = 75 / width / scale
        gx, gy = nx - 30 / scale, ny
        quad("bugle_hand", "bugle", "wrist_target_r", (0, 0, width, height),
             (gx-174*factor, gy-174*factor, gx+(width-174)*factor, gy+(height-174)*factor),
             nozzle_angle, nozzle_center)
        held = surfaces.pop()
        held["setup_attachment"] = None
        # Matching belt/hand transforms at the pickup and return frames. The belt
        # attachment follows the torso while parked; the held copy follows the grip.
        from copy import deepcopy
        parked = deepcopy(held)
        parked.update(name="bugle_belt", bone="body", setup_attachment="bugle_belt")
        wx, wy = next(b["point"] for b in bones if b["name"] == "wrist_target_r")
        angle = math.radians(10)  # -10° world / canvas y-down.
        for vertex in parked["vertices"]:
            x, y = vertex["point"]
            vertex["point"] = [wx+(x-wx)*math.cos(angle)-(y-wy)*math.sin(angle)-40/scale,
                               wy+(x-wx)*math.sin(angle)+(y-wy)*math.cos(angle)+32/scale]
            vertex["weights"] = {"body": 1}
        # Both props precede the hands so fingers visibly wrap around the tube.
        insert = next(i for i, surface in enumerate(surfaces) if surface["name"] == "nozzle")
        surfaces[insert:insert] = [parked, held]

    # The same game's intact rookie hose supplies all hose pixels. UVs select only
    # its flexible cream/red fabric span, excluding both brass end fittings.
    def cubic(points, t):
        a, b, c, d = points
        return tuple((1-t)**3*a[i] + 3*(1-t)**2*t*b[i] + 3*(1-t)*t*t*c[i] + t**3*d[i] for i in (0, 1))

    end_canvas = nozzle_point(-64, 0)
    end_world = ((end_canvas[0] - 512) * scale, (1440 - end_canvas[1]) * scale)
    lower_curve = [(-171, 8), (-138, 8), (-95, 3), (-92, 58)]
    upper_curve = [(-92, 58), (-94, 135), (-104, 189), end_world]
    centers = [cubic(lower_curve, i / 12) for i in range(12)] + [cubic(upper_curve, i / 16) for i in range(17)]
    upper_edge, lower_edge = [], []
    for i, center in enumerate(centers):
        previous, following = centers[max(0, i-1)], centers[min(len(centers)-1, i+1)]
        dx, dy = following[0] - previous[0], following[1] - previous[1]
        length = math.hypot(dx, dy)
        t = i / (len(centers)-1)
        mix = max(0, (t - .62) / .38)
        mix = mix * mix * (3 - 2 * mix)
        weights = {name: weight for name, weight in (("root", 1-mix), ("nozzle", mix)) if weight > 1e-8}
        half_width = 7.5 + 2 * t**4
        for edge, sign, v in ((lower_edge, -1, 144), (upper_edge, 1, 23)):
            wx, wy = center[0] - sign * dy / length * half_width, center[1] + sign * dx / length * half_width
            edge.append({"uv": [147 + t * 1090, v], "point": [512 + wx / scale, 1440 - wy / scale], "weights": weights})
    vertices = lower_edge + upper_edge[::-1]
    n = len(centers)
    triangles = []
    for i in range(n - 1):
        a, b, c, d = i, i + 1, 2*n-2-i, 2*n-1-i
        triangles.extend([a, b, c, a, c, d])
    surfaces.insert(0, {"name": "hose", "image": "hose_original", "bone": "root",
                        "image_size": list(images["hose_original"].size), "vertices": vertices,
                        "triangles": triangles, "hull": len(vertices)})

    return {"registration_sha256": hashlib.sha256((parts / "registration.json").read_bytes()).hexdigest(),
            "source_delivery": "62725b3", "status": "UNREVIEWED_FIRST_ASSEMBLY",
            "coordinate_basis": "1024x1536 registered source pixels; y down; feet512,1440",
            "notes": ["Original pixels only; native UV selections compensate incorrect auto cuts/fits",
                      "Shared source PNGs are frozen byte-for-byte into each draft"],
            "bones": bones, "ik": ik, "transform": transforms, "surfaces": surfaces}


if __name__ == "__main__":
    output = HERE / "pilot-layout.json"
    if output.exists():
        raise SystemExit("Preserving measured pilot-layout.json; edit deliberately instead of overwriting")
    output.write_text(json.dumps(make_layout(), indent=2) + "\n")
    print(output)
