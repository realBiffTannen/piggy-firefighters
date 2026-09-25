#!/usr/bin/env python3
"""Author Sprocket (pf_rookie) from the registered r2 parts; no raster painting.

Chief pattern (art-src/animation/rigs/pf_chief/author_pilot.py): read the registered
delivery, measure the layout from the actual pixels, freeze byte-identical copies of
the used PNGs into a fresh draft, and write pf_rookie.json (Spine 4.2.43 JSON) for a
NEW native project. Layers are the full 1024x1536 canvas PNGs; sleeves and torso are
UV strip meshes (sleeve cut above the painted hand so the delivered hand variants sit
on the wrist); face/hand/prop pieces are region attachments at their family scale.
Root at the feet (512,1440); standing height 380 px; root unkeyed in every clip.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

from rookie_performances import make_clips

HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_rookie"
HEIGHT = 380
CANVAS = (1024, 1536)
FEET = (512, 1440)


class Blocked(RuntimeError):
    pass


# ---------------------------------------------------------------- geometry helpers
def canvas_point(point, scale):
    return ((point[0] - FEET[0]) * scale, (FEET[1] - point[1]) * scale)


def local_point(point, transform):
    x, y, angle = transform
    dx, dy = point[0] - x, point[1] - y
    return (dx * math.cos(angle) + dy * math.sin(angle),
            -dx * math.sin(angle) + dy * math.cos(angle))


def rotate(vector, degrees):
    a = math.radians(degrees)
    return (vector[0] * math.cos(a) - vector[1] * math.sin(a),
            vector[0] * math.sin(a) + vector[1] * math.cos(a))


def timeline(samples, channel):
    """Spine 4.2 absolute cubic handles per channel (35 % ease), as in the Chief pilot."""
    keys = [dict(time=round(t, 4), **dict(zip(channel, values))) for t, values in samples]
    for first, second in zip(keys, keys[1:]):
        dt = second["time"] - first["time"]
        first["curve"] = [number for name in channel for number in (
            round(first["time"] + dt * .35, 6), first[name],
            round(second["time"] - dt * .35, 6), second[name])]
    return keys


# ---------------------------------------------------------------- pixel measurements
def rgba(path):
    return np.array(Image.open(path).convert("RGBA")).astype(np.int32)


def masks(pixels):
    r, g, b, a = (pixels[..., i] for i in range(4))
    navy = (a > 200) & (b > 80) & (b > r * 1.6) & (b > g * 1.25) & (r < 120)
    pink = (a > 200) & (r > 190) & (g > 110) & (g < 205) & (b > 110) & (b < 205) & (r > g + 25)
    return navy, pink


def centroid(mask):
    ys, xs = np.nonzero(mask)
    if not len(xs):
        raise Blocked("Measurement found no pixels")
    return (float(xs.mean()), float(ys.mean()))


def cuff_axis(pixels):
    """Cuff centre and the arm axis (image degrees, y down) from the navy band's minor axis."""
    navy, pink = masks(pixels)
    cx, cy = centroid(navy)
    ys, xs = np.nonzero(navy)
    cov = np.cov(np.stack([xs - cx, ys - cy]))
    values, vectors = np.linalg.eigh(cov)
    minor = vectors[:, int(np.argmin(values))]
    px, py = centroid(pink)
    if minor[0] * (px - cx) + minor[1] * (py - cy) < 0:
        minor = -minor
    return (cx, cy), math.degrees(math.atan2(minor[1], minor[0]))


def farthest_pink(pixels, origin):
    navy, pink = masks(pixels)
    ys, xs = np.nonzero(pink)
    index = int(np.argmax((xs - origin[0]) ** 2 + (ys - origin[1]) ** 2))
    return (float(xs[index]), float(ys[index]))


def fit_piece(master, piece, scale, guess, window=44):
    """Translate-only masked colour fit of a scaled piece on the master; returns its canvas centre."""
    w, h = piece.size
    small = piece.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    p = np.array(small.convert("RGBA")).astype(np.int32)
    alpha = p[..., 3] > 128
    if alpha.sum() < 50:
        raise Blocked("Piece has no opaque pixels to fit")
    ph, pw = alpha.shape
    m = master
    best = None
    for step, radius, centre in ((3, window, guess), (1, 4, None)):
        centre = centre or best[1]
        for dy in range(-radius, radius + 1, step):
            for dx in range(-radius, radius + 1, step):
                x0 = int(round(centre[0] + dx - pw / 2))
                y0 = int(round(centre[1] + dy - ph / 2))
                if x0 < 0 or y0 < 0 or x0 + pw > m.shape[1] or y0 + ph > m.shape[0]:
                    continue
                target = m[y0:y0 + ph, x0:x0 + pw]
                visible = alpha & (target[..., 3] > 128)
                if visible.sum() < alpha.sum() * .6:
                    continue
                diff = np.abs(target[..., :3] - p[..., :3]).sum(axis=2)
                score = float(diff[visible].mean()) + 60 * (1 - visible.sum() / alpha.sum())
                if best is None or score < best[0]:
                    best = (score, (x0 + pw / 2, y0 + ph / 2))
    if best is None:
        raise Blocked("Piece fit found no overlap")
    return best[1], best[0]


def scan_extent(alpha, centre, normal, reach=130, threshold=40):
    found = []
    h, w = alpha.shape
    for t in range(-reach, reach + 1):
        x = int(round(centre[0] + normal[0] * t))
        y = int(round(centre[1] + normal[1] * t))
        if 0 <= x < w and 0 <= y < h and alpha[y, x] > threshold:
            found.append(t)
    return (min(found), max(found)) if found else None


# ---------------------------------------------------------------- rig assembly
class Rig:
    def __init__(self, scale):
        self.scale = scale
        self.bones, self.world, self.index = [], {}, {}
        self.slots, self.attachments, self.surfaces = [], {}, []

    def bone(self, name, parent, canvas, angle=0.0, length=0.0):
        """Bone at a canvas point with a world angle (Spine degrees, y up)."""
        wx, wy = canvas_point(canvas, self.scale)
        return self._add(name, parent, (wx, wy, math.radians(angle)), length)

    def bone_local(self, name, parent, x, y, rotation=0.0, length=0.0):
        px, py, pa = self.world[parent]
        rx, ry = rotate((x, y), math.degrees(pa))
        return self._add(name, parent, (px + rx, py + ry, pa + math.radians(rotation)), length)

    def _add(self, name, parent, transform, length):
        bone = {"name": name}
        if parent:
            base = self.world[parent]
            lx, ly = local_point(transform[:2], base)
            bone.update(parent=parent, x=round(lx, 3), y=round(ly, 3))
            rot = math.degrees(transform[2] - base[2])
            if abs(rot) > 1e-9:
                bone["rotation"] = round(rot, 3)
        elif transform != (0.0, 0.0, 0.0):
            raise Blocked("Root setup must be the neutral feet origin")
        if length:
            bone["length"] = round(length * self.scale, 3)
        self.index[name] = len(self.bones)
        self.bones.append(bone)
        self.world[name] = transform
        return name

    def world_point(self, bone, x, y):
        px, py, pa = self.world[bone]
        rx, ry = rotate((x, y), math.degrees(pa))
        return (px + rx, py + ry)

    def slot(self, name, bone, setup):
        if name in self.attachments:
            raise Blocked(f"Slot declared twice: {name}")
        slot = {"name": name, "bone": bone}
        if setup:
            slot["attachment"] = setup
        self.slots.append(slot)
        self.attachments[name] = {}

    def region_local(self, slot, name, image, size, x, y, rotation, scale):
        self.attachments[slot][name] = {"path": image, "x": round(x, 3), "y": round(y, 3),
                                        "rotation": round(rotation, 3), "scaleX": round(scale, 6),
                                        "scaleY": round(scale, 6), "width": size[0], "height": size[1]}
        self.surfaces.append({"slot": slot, "attachment": name, "image": image, "kind": "region"})

    def region_canvas(self, slot, name, image, size, bone, centre, family_scale, rotation=0.0):
        """Piece centred on a canvas point, drawn upright (plus rotation) in the setup pose."""
        world = canvas_point(centre, self.scale)
        x, y = local_point(world, self.world[bone])
        self.region_local(slot, name, image, size, x, y,
                          rotation - math.degrees(self.world[bone][2]), family_scale * self.scale)

    def strip(self, slot, name, image, size, stations):
        """Weighted quad strip; hull first (left edge down, right edge back up)."""
        left, right = [], []
        for centre, normal, half_left, half_right, weights in stations:
            left.append(((centre[0] + normal[0] * half_left, centre[1] + normal[1] * half_left), weights))
            right.append(((centre[0] - normal[0] * half_right, centre[1] - normal[1] * half_right), weights))
        ordered = left + right[::-1]
        uvs, vertices = [], []
        for point, weights in ordered:
            uvs.extend([round(point[0] / size[0], 6), round(point[1] / size[1], 6)])
            world = canvas_point(point, self.scale)
            if abs(sum(weights.values()) - 1) > 1e-6:
                raise Blocked("Vertex weights must total one")
            vertices.append(len(weights))
            for bone, weight in weights.items():
                lx, ly = local_point(world, self.world[bone])
                vertices.extend([self.index[bone], round(lx, 4), round(ly, 4), round(weight, 6)])
        n = len(stations)
        triangles = []
        for i in range(n - 1):
            a, b, c, d = i, i + 1, 2 * n - 2 - i, 2 * n - 1 - i
            triangles.extend([a, b, c, a, c, d])
        edges = set()
        for i in range(0, len(triangles), 3):
            a, b, c = triangles[i:i + 3]
            edges.update(tuple(sorted(pair)) for pair in ((a, b), (b, c), (c, a)))
        self.attachments[slot][name] = {"type": "mesh", "path": image, "width": size[0], "height": size[1],
                                        "uvs": uvs, "vertices": vertices, "triangles": triangles,
                                        "hull": len(ordered),
                                        "edges": [index * 2 for edge in sorted(edges) for index in edge]}
        self.surfaces.append({"slot": slot, "attachment": name, "image": image, "kind": "mesh",
                              "hull_canvas": [list(p) for p, _ in ordered]})


# ---------------------------------------------------------------- delivery
LAYERS = ("master_pf_rookie", "body_no_head_no_arms", "head_blank", "helmet_front", "coat_tails",
          "leg_left", "leg_right", "arm_left", "arm_right")
PIECES = {
    "eyes": ("eyes_open", "eyes_closed", "eyes_happy", "eyes_dart"),
    "brows": ("brows_neutral", "brows_raised", "brows_worried", "brows_embarrassed"),
    "mouth": ("mouth_closed", "mouth_open", "mouth_smile", "mouth_oops", "mouth_sad", "mouth_shout"),
    "ears": ("ear_right", "ear_left"),
    "hands": ("hand_r_open", "hand_r_grip", "hand_r_pinch", "hand_r_catch",
              "hand_l_open", "hand_l_grip", "hand_l_pinch", "hand_l_catch"),
    "cards": ("card_blank", "card_back"),
    "hose": ("hose_coil", "hose_flexible"),
}


def load_delivery(parts):
    manifest_path = parts / "registration.json"
    if not manifest_path.is_file():
        raise Blocked(f"Registered rookie registration.json is missing: {manifest_path}")
    record = json.loads(manifest_path.read_text())
    if record.get("rig") != "pf_rookie" or record.get("canvas") != list(CANVAS) or (
            record.get("feet_x"), record.get("feet_y")) != FEET:
        raise Blocked("Rookie registration uses an unexpected rig/canvas/feet basis")
    anchors = json.loads((parts / "anchors.json").read_text())
    files, scales = {}, {}
    for name in LAYERS:
        files[name] = parts / f"{name}.png"
    for sheet in record["pieces"].values():
        if sheet["missing"]:
            raise Blocked(f"Registered sheet has missing pieces: {sheet['missing']}")
        for name, piece in sheet["pieces"].items():
            files[name] = parts / "pieces" / f"{name}.png"
            scales[name] = piece["scale_to_canvas"]
    needed = [name for family in PIECES.values() for name in family]
    absent = sorted(set(needed) - files.keys()) + [str(p) for p in files.values() if not p.is_file()]
    if absent:
        raise Blocked(f"Registered rookie pieces are incomplete: {absent}")
    return record, anchors, files, scales


def standing_scale(master):
    bounds = master.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
    height = bounds[3] - bounds[1]
    if height <= 0:
        raise Blocked("Master has no standing silhouette")
    return HEIGHT / height, bounds


# ---------------------------------------------------------------- layout
def make_layout(parts=PARTS):
    record, anchors, files, scales = load_delivery(parts)
    images = {name: Image.open(files[name]) for name in files}
    master = images["master_pf_rookie"]
    scale, master_bounds = standing_scale(master)
    master_px = rgba(files["master_pf_rookie"])
    layout = {"registration_sha256": hashlib.sha256((parts / "registration.json").read_bytes()).hexdigest(),
              "standing_scale": scale, "master_bounds": list(master_bounds),
              "coordinate_basis": "1024x1536 registered canvas pixels; y down; feet 512,1440",
              "fits": {}, "arms": {}, "hands": {}}

    # Face pieces: measured against the master (translate-only, family scale from registration).
    # Guesses read on the master (2026-09-25); thin brow/mouth strokes get a tight window so the
    # fit cannot slide onto the helmet brim or snout outline.
    # Guesses read on the master (2026-09-25). Thin brow/mouth strokes are placed directly
    # (window 0): a colour fit slides them onto the helmet brim or the snout outline.
    guesses = {"eyes_open": ((560, 272), 44), "brows_neutral": ((562, 224), 0), "mouth_closed": ((596, 364), 0),
               "ear_right": ((378, 318), 44), "ear_left": ((680, 256), 44)}
    for name, (guess, window) in guesses.items():
        if window:
            centre, score = fit_piece(master_px, images[name], scales[name], guess, window)
        else:
            centre, score = guess, None
        layout["fits"][name] = {"centre": [round(centre[0], 2), round(centre[1], 2)],
                                "scale": scales[name], "score": None if score is None else round(score, 2),
                                "guess": list(guess), "measured_by": "colour fit" if window else "read on the master"}

    # Arms: shoulder pivots from the registered raised-arm split; cuff centre from the navy band.
    shoulders = {"r": tuple(record["parts"]["arms_raised"]["split"]["arm_right_raised"]["shoulder_pivot"]),
                 "l": tuple(record["parts"]["arms_raised"]["split"]["arm_left_raised"]["shoulder_pivot"])}
    for side in ("r", "l"):
        image = "arm_right" if side == "r" else "arm_left"
        cuff, _ = cuff_axis(rgba(files[image]))
        layout["arms"][side] = {"image": image, "shoulder": list(shoulders[side]),
                                "cuff": [round(cuff[0], 2), round(cuff[1], 2)]}
    for name in PIECES["hands"]:
        pixels = rgba(files[name])
        cuff, axis = cuff_axis(pixels)
        layout["hands"][name] = {"cuff": [round(cuff[0], 2), round(cuff[1], 2)], "axis_deg": round(axis, 3),
                                 "size": list(images[name].size), "scale": scales[name]}
    for name in ("hand_r_pinch", "hand_l_pinch"):
        tip = farthest_pink(rgba(files[name]), layout["hands"][name]["cuff"])
        layout["hands"][name]["pinch_tip"] = [round(tip[0], 1), round(tip[1], 1)]
    for side in ("r", "l"):
        anchor = anchors["anchors"][f"sheet_{side}"]
        piece = Path(anchor["piece"]).stem
        if anchor["piece_scale_to_canvas"] != scales[piece]:
            raise Blocked("anchors.json hand scale differs from the registered piece scale")
        layout["hands"][piece]["sheet_tip"] = list(anchor["piece_xy"])
    layout["scales"] = {name: scales[name] for family in PIECES.values() for name in family}
    return layout


def build_rig(layout, files, images):
    S = layout["standing_scale"]
    rig = Rig(S)
    size_of = {name: list(images[name].size) for name in images}
    fits = layout["fits"]

    rig.bone("root", None, FEET)
    rig.bone("body", "root", (512, 790))
    rig.bone("chest", "body", (512, 640))
    rig.bone("head", "chest", (524, 440))
    rig.bone("helmet", "head", (520, 230))
    ear_r = fits["ear_right"]["centre"]
    ear_l = fits["ear_left"]["centre"]
    er_w = size_of["ear_right"][0] * fits["ear_right"]["scale"]
    el_w = size_of["ear_left"][0] * fits["ear_left"]["scale"]
    rig.bone("ear_r", "head", (ear_r[0] + .4 * er_w, ear_r[1] + .15 * er_w))
    rig.bone("ear_l", "head", (ear_l[0] - .35 * el_w, ear_l[1] + .3 * el_w))
    rig.bone("brows", "head", tuple(fits["brows_neutral"]["centre"]))
    rig.bone("eyes", "head", tuple(fits["eyes_open"]["centre"]))
    rig.bone("mouth", "head", tuple(fits["mouth_closed"]["centre"]))
    rig.bone("coat", "body", (540, 772))
    rig.bone("leg_r", "root", (352, 1418))
    rig.bone("leg_l", "root", (690, 1418))
    rig.bone("hose", "body", (512, 880))

    # Arm chains: shoulder -> elbow (mid-axis) -> wrist (cuff centre); x axis along the arm.
    arm_axes = {}
    for side in ("r", "l"):
        arm = layout["arms"][side]
        sx, sy = arm["shoulder"]
        wx, wy = arm["cuff"]
        ex, ey = (sx + wx) / 2, (sy + wy) / 2
        angle_up = math.degrees(math.atan2(-(ey - sy), ex - sx))
        angle_fore = math.degrees(math.atan2(-(wy - ey), wx - ex))
        rig.bone(f"arm_{side}", "chest", (sx, sy), angle_up, math.dist((sx, sy), (ex, ey)))
        rig.bone(f"fore_{side}", f"arm_{side}", (ex, ey), angle_fore, math.dist((ex, ey), (wx, wy)))
        rig.bone(f"hand_{side}", f"fore_{side}", (wx, wy), angle_fore, 22 / S)
        arm_axes[side] = ((sx, sy), (ex, ey), (wx, wy))

    def hand_local(piece, point):
        """A piece pixel in the wrist bone's frame once the cuff sits on the wrist, axis along the bone."""
        spec = layout["hands"][piece]
        k = spec["scale"] * S
        cx, cy = spec["cuff"]
        d = ((point[0] - cx) * k, -(point[1] - cy) * k)
        return rotate(d, spec["axis_deg"])

    for side in ("r", "l"):
        tip = hand_local(f"hand_{side}_catch", layout["hands"][f"hand_{side}_catch"]["sheet_tip"])
        rig.bone_local(f"sheet_{side}", f"hand_{side}", tip[0], tip[1])
    pinch = hand_local("hand_r_pinch", layout["hands"]["hand_r_pinch"]["pinch_tip"])
    rig.bone_local("card", "hand_r", pinch[0], pinch[1], -math.degrees(rig.world["hand_r"][2]))
    coil_w = size_of["hose_coil"][0] * layout["scales"]["hose_coil"] * S
    rig.bone_local("hose_tail", "hose", -coil_w / 2 + 9, -2, -118)

    # ---- draw order: back to front
    def canvas_region(slot, name, image, bone, setup=True):
        rig.region_canvas(slot, name, image, size_of[image], bone, (CANVAS[0] / 2, CANVAS[1] / 2), 1.0)

    rig.slot("hose_tail", "hose_tail", None)
    tail_len = size_of["hose_flexible"][0] * layout["scales"]["hose_flexible"] * S
    rig.region_local("hose_tail", "hose_flexible", "hose_flexible", size_of["hose_flexible"],
                     tail_len / 2 - 6, 0, 0, layout["scales"]["hose_flexible"] * S)
    rig.slot("leg_l", "leg_l", "leg_left")
    canvas_region("leg_l", "leg_left", "leg_left", "leg_l")
    rig.slot("leg_r", "leg_r", "leg_right")
    canvas_region("leg_r", "leg_right", "leg_right", "leg_r")
    rig.slot("coat", "coat", "coat_tails")
    canvas_region("coat", "coat_tails", "coat_tails", "coat")

    # Torso strip: collar follows the chest, belt follows the hips.
    body_alpha = rgba(files["body_no_head_no_arms"])[..., 3]
    stations = []
    for y, weights in ((352, {"chest": 1}), (420, {"chest": 1}), (500, {"chest": 1}), (580, {"chest": 1}),
                       (660, {"chest": .85, "body": .15}), (730, {"chest": .4, "body": .6}),
                       (790, {"body": 1}), (848, {"body": 1})):
        extent = scan_extent(body_alpha, (529, y), (1, 0), reach=220, threshold=20)
        if extent is None:
            continue
        stations.append(((529, y), (-1, 0), -extent[0] + 4, extent[1] + 4, weights))
    rig.slot("torso", "chest", "torso")
    rig.strip("torso", "torso", "body_no_head_no_arms", size_of["body_no_head_no_arms"], stations)

    rig.slot("head", "head", "head_blank")
    canvas_region("head", "head_blank", "head_blank", "head")
    rig.slot("helmet", "helmet", "helmet_front")
    canvas_region("helmet", "helmet_front", "helmet_front", "helmet")
    rig.slot("ear_l", "ear_l", "ear_left")
    rig.region_canvas("ear_l", "ear_left", "ear_left", size_of["ear_left"], "ear_l", ear_l, fits["ear_left"]["scale"])
    rig.slot("ear_r", "ear_r", "ear_right")
    rig.region_canvas("ear_r", "ear_right", "ear_right", size_of["ear_right"], "ear_r", ear_r, fits["ear_right"]["scale"])

    # Expression families share the fitted neutral piece's centre (pieces are cut with equal padding).
    # Variants are registered to the neutral piece: brows by their base line (raised arches go up),
    # mouths by the upper lip (jaws drop), closed/happy eyes on the open eyes' lower lids.
    for slot, family, neutral, align in (("brows", "brows", "brows_neutral", "bottom"),
                                         ("eyes", "eyes", "eyes_open", "lid"),
                                         ("mouth", "mouth", "mouth_closed", "top")):
        rig.slot(slot, slot, neutral)
        cx, cy = fits[neutral]["centre"]
        h0 = size_of[neutral][1] * layout["scales"][neutral]
        for name in PIECES[family]:
            h = size_of[name][1] * layout["scales"][name]
            if align == "bottom":
                dy = (h0 - h) / 2
            elif align == "top":
                dy = (h - h0) / 2
            else:
                dy = 0 if name in ("eyes_open", "eyes_dart") else (.62 - .5) * h0
            rig.region_canvas(slot, name, name, size_of[name], slot, (cx, cy + dy), layout["scales"][name])

    rig.slot("hose", "hose", None)
    rig.region_local("hose", "hose_coil", "hose_coil", size_of["hose_coil"], 0, 0, 0,
                     layout["scales"]["hose_coil"] * S)

    def sleeve(side):
        image = layout["arms"][side]["image"]
        alpha = rgba(files[image])[..., 3]
        shoulder, elbow, wrist = arm_axes[side]
        axis = (wrist[0] - shoulder[0], wrist[1] - shoulder[1])
        length = math.hypot(*axis)
        d = (axis[0] / length, axis[1] / length)
        n = (-d[1], d[0])
        rows = []
        widths = []
        params = [-.16, -.09, -.02, .06, .16, .27, .38, .5, .62, .74, .84, .91, .965]
        for u in params:
            centre = (shoulder[0] + d[0] * length * u, shoulder[1] + d[1] * length * u)
            extent = scan_extent(alpha, centre, n, reach=135)
            if extent is None:
                continue
            mix = min(1, max(0, (u - .40) / .20))
            mix = mix * mix * (3 - 2 * mix)
            weights = {k: v for k, v in ((f"arm_{side}", 1 - mix), (f"fore_{side}", mix)) if v > 1e-8}
            rows.append([centre, n, -extent[0] + 3, extent[1] + 3, weights])
            if .2 < u < .8:
                widths.append(rows[-1][2] + rows[-1][3])
        cap = 1.3 * (sum(widths) / len(widths)) if widths else 1e9
        for row in rows:
            if row[2] + row[3] > cap:  # keep the painted thumb/fingers out of the sleeve end
                excess = row[2] + row[3] - cap
                row[2] -= excess / 2
                row[3] -= excess / 2
        rig.strip(f"sleeve_{side}", f"sleeve_{side}", image, size_of[image],
                  [tuple(row) for row in rows])

    def hand_slot(side):
        rig.slot(f"hand_{side}", f"hand_{side}", f"hand_{side}_open")
        for name in PIECES["hands"]:
            if not name.startswith(f"hand_{side}_"):
                continue
            spec = layout["hands"][name]
            k = spec["scale"] * S
            w, h = spec["size"]
            cx, cy = spec["cuff"]
            d = ((cx - w / 2) * k, (h / 2 - cy) * k)
            offset = rotate(d, spec["axis_deg"])
            rig.region_local(f"hand_{side}", name, name, spec["size"], -offset[0], -offset[1], spec["axis_deg"], k)

    rig.slot("sleeve_l", "arm_l", "sleeve_l")
    sleeve("l")
    hand_slot("l")
    rig.slot("sleeve_r", "arm_r", "sleeve_r")
    sleeve("r")
    hand_slot("r")
    rig.slot("card", "card", None)
    for name in PIECES["cards"]:
        k = layout["scales"][name] * S
        rig.region_local("card", name, name, size_of[name], 0, size_of[name][1] * k / 2 - 2, 0, k)

    skeleton = {"skeleton": {"spine": "4.2.43", "images": "./images/", "x": -110, "y": 0,
                             "width": 220, "height": HEIGHT},
                "bones": rig.bones, "slots": rig.slots,
                "skins": [{"name": "default", "attachments": rig.attachments}],
                "events": {"flip": {}, "catch": {}},
                "animations": make_clips(timeline)}
    return skeleton, rig


# ---------------------------------------------------------------- preview (setup only)
def preview(skeleton, rig, images, path):
    """Composite the setup pose in canvas space from the same placements (region + strip hulls)."""
    S = rig.scale
    out = Image.new("RGBA", CANVAS, (70, 70, 70, 255))
    for surface in rig.surfaces:
        slot = next(s for s in rig.slots if s["name"] == surface["slot"])
        if slot.get("attachment") != surface["attachment"]:
            continue
        image = images[surface["image"]].convert("RGBA")
        if surface["kind"] == "mesh":
            from PIL import ImageDraw
            mask = Image.new("L", image.size, 0)
            ImageDraw.Draw(mask).polygon([tuple(p) for p in surface["hull_canvas"]], fill=255)
            layer = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
            layer.paste(image, (0, 0), mask)
            out.alpha_composite(layer)
            continue
        spec = rig.attachments[surface["slot"]][surface["attachment"]]
        bx, by, ba = rig.world[slot["bone"]]
        cx, cy = rotate((spec["x"], spec["y"]), math.degrees(ba))
        wx, wy = bx + cx, by + cy
        angle = math.degrees(ba) + spec["rotation"]
        k = spec["scaleX"] / S
        scaled = image.resize((max(1, round(image.width * k)), max(1, round(image.height * k))), Image.LANCZOS)
        rotated = scaled.rotate(angle, resample=Image.BICUBIC, expand=True)
        px, py = wx / S + FEET[0], FEET[1] - wy / S
        layer = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        layer.alpha_composite(rotated, (int(round(px - rotated.width / 2)), int(round(py - rotated.height / 2))))
        out.alpha_composite(layer)
    from PIL import ImageDraw
    draw = ImageDraw.Draw(out)
    for name, (x, y, _) in rig.world.items():
        px, py = x / S + FEET[0], FEET[1] - y / S
        draw.ellipse((px - 4, py - 4, px + 4, py + 4), outline=(0, 255, 255, 255))
    out.save(path)


# ---------------------------------------------------------------- author
def author(parts, output, preview_only=False):
    parts, output = Path(parts), Path(output)
    if (output / "pf_rookie.spine").exists():
        raise Blocked("Existing native project is authoritative; use a fresh draft directory")
    if output.exists():
        raise Blocked("Draft output already exists; preserve it and choose a new draft")
    record, anchors, files, scales = load_delivery(parts)
    layout = make_layout(parts)
    images = {name: Image.open(path) for name, path in files.items()}
    skeleton, rig = build_rig(layout, files, images)
    used = sorted({surface["image"] for surface in rig.surfaces})
    output.mkdir(parents=True)
    preview(skeleton, rig, images, output / "setup-preview.png")
    if preview_only:
        (output / "rookie-layout.json").write_text(json.dumps(layout, indent=2) + "\n")
        return output / "setup-preview.png"
    (output / "images").mkdir()
    for name in used:
        shutil.copyfile(files[name], output / "images" / f"{name}.png")
    shutil.copyfile(parts / "registration.json", output / "registration.json")
    (output / "rookie-layout.json").write_text(json.dumps(layout, indent=2) + "\n")
    (output / "pf_rookie.json").write_text(json.dumps(skeleton, indent=2) + "\n")
    (output / "source-record.json").write_text(json.dumps({
        "status": "FULL_RIG_UNREVIEWED", "rig": "pf_rookie", "editor": "4.2.43",
        "registration_sha256": layout["registration_sha256"], "standing_scale": layout["standing_scale"],
        "source_files": {name: {"path": str(files[name].resolve()),
                               "sha256": hashlib.sha256((output / "images" / f"{name}.png").read_bytes()).hexdigest()}
                         for name in used},
        "derivation": "Region attachments and UV strip meshes over registered r2 parts; source PNG bytes unchanged",
        "paid_generation": "none", "motion_review": "NOT RUN",
    }, indent=2) + "\n")
    return output / "pf_rookie.json"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parts", type=Path, default=PARTS)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--preview-only", action="store_true", help="Only write the setup composite + layout")
    args = parser.parse_args()
    try:
        print(author(args.parts, args.output, args.preview_only))
    except Blocked as error:
        print(f"BLOCKED: {error}")
        raise SystemExit(2)
