#!/usr/bin/env python3
"""Author the Trotter family rig (pf_rescued) from Claude's registered r2 parts.

ONE skeleton, FIVE skins (grandma, twins, dad, baby, teen). Every skin binds its six
cut slots (head, body, arms, legs) plus the shared open mouths and open palm as
weighted quad meshes on its own pivot bones, so a skin whose joints sit far from the
template's (the twins) still turns about its own neck and shoulders. Skins add no
slots. Draft images are byte-identical copies of the delivered PNGs, renamed per
skin so one atlas can hold all five. Import each draft into a NEW Spine 4.2.43
project; never overwrite a native project.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_rescued"
SKINS = ("grandma", "twins", "dad", "baby", "teen")
SLOT_FILES = {"leg_left": "leg_left", "leg_right": "leg_right", "arm_left": "arm_left",
              "body": "body_no_head_no_arms", "head": "head", "arm_right": "arm_right"}
PIECES = ("mouth_call", "mouth_cheer", "mouth_o", "wave_hand_front")
CANVAS = (1024, 1536)


class Blocked(RuntimeError):
    pass


def freeze_source(source, target):
    if target.exists():
        raise Blocked(f"Preserving existing draft texture: {target}")
    shutil.copyfile(source, target)


def timeline(samples, channel):
    """Ease using Spine 4.2's absolute time/value cubic handles, per channel."""
    keys = [dict(time=t, **dict(zip(channel, values))) for t, values in samples]
    for first, second in zip(keys, keys[1:]):
        dt = second["time"] - first["time"]
        first["curve"] = [number for name in channel for number in (
            round(first["time"] + dt * .35, 6), first[name],
            round(second["time"] - dt * .35, 6), second[name])]
    return keys


class Rig:
    def __init__(self, layout):
        self.scale = layout["spine_scale"]
        self.bones, self.world, self.index = [], {}, {}

    def spine(self, point):
        return ((point[0] - 512) * self.scale, (1440 - point[1]) * self.scale)

    def bone(self, name, point, parent=None):
        world = self.spine(point)
        bone = {"name": name}
        if parent:
            px, py = self.world[parent]
            bone.update(parent=parent, x=round(world[0] - px, 6), y=round(world[1] - py, 6), rotation=0.0)
        elif world != (0.0, 0.0):
            raise Blocked("Root setup must be the neutral feet origin")
        self.index[name] = len(self.bones)
        self.world[name] = world
        self.bones.append(bone)

    def quad(self, image, size, bone, centre=None, k=1.0, rotation=0.0, box=None):
        """A four-vertex weighted mesh over the image's painted box, bound to one bone.

        `box` is the image's opaque bounding rectangle (x0, y0, x1, y1) in image pixels;
        the hull and UVs hug it so the packer strips the transparent canvas around it.
        Without `centre` the image is the registered canvas; with `centre` (canvas
        point) and `k` the piece is laid over the canvas at that scale, optionally
        turned about the bone origin so it reads upright when the bone is posed."""
        width, height = size
        x0, y0, x1, y1 = box or (0, 0, width, height)
        if centre is None:
            corners = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]                     # TL, BL, BR, TR (canvas)
        else:
            cx, cy = centre
            ox, oy = cx - width * k / 2, cy - height * k / 2                       # canvas origin of the piece
            corners = [(ox + x0 * k, oy + y0 * k), (ox + x0 * k, oy + y1 * k),
                       (ox + x1 * k, oy + y1 * k), (ox + x1 * k, oy + y0 * k)]
        uvs = [x0 / width, y0 / height, x0 / width, y1 / height, x1 / width, y1 / height, x1 / width, y0 / height]
        bx, by = self.world[bone]
        angle = math.radians(rotation)
        vertices = []
        for corner in corners:
            wx, wy = self.spine(corner)
            dx, dy = wx - bx, wy - by
            lx = dx * math.cos(angle) - dy * math.sin(angle)
            ly = dx * math.sin(angle) + dy * math.cos(angle)
            vertices.extend([1, self.index[bone], round(lx, 6), round(ly, 6), 1])
        return {"type": "mesh", "path": image, "width": width, "height": height,
                "uvs": [round(v, 6) for v in uvs], "vertices": vertices,
                "triangles": [0, 1, 2, 0, 2, 3], "hull": 4, "edges": [0, 2, 0, 4, 0, 6, 2, 4, 4, 6]}


def painted_box(image, margin=4):
    """Opaque bounding box grown by a margin so filtered edges stay inside the hull."""
    box = image.convert("RGBA").getchannel("A").getbbox()
    if not box:
        raise Blocked("An image has no painted pixels")
    return (max(0, box[0] - margin), max(0, box[1] - margin),
            min(image.width, box[2] + margin), min(image.height, box[3] + margin))


def build_rig(layout, sizes, boxes):
    from rescued_performances import make_clips
    rig = Rig(layout)
    points = layout["bones"]
    rig.bone("root", points["root"])
    rig.bone("feet", points["feet"], "root")
    rig.bone("hips", points["hips"], "root")
    rig.bone("chest", points["chest"], "hips")
    rig.bone("leg_r", points["leg_r"], "root")
    rig.bone("leg_l", points["leg_l"], "root")
    for skin in SKINS:
        row = layout["skins"][skin]
        rig.bone(f"head_{skin}", row["neck"], "chest")
        rig.bone(f"arm_r_{skin}", row["shoulder_r"], "chest")
        rig.bone(f"hand_r_{skin}", row["hand_r"], f"arm_r_{skin}")
        rig.bone(f"arm_l_{skin}", row["shoulder_l"], "chest")
        rig.bone(f"hand_l_{skin}", row["hand_l"], f"arm_l_{skin}")
    slots = [{"name": "leg_left", "bone": "leg_l", "attachment": "leg_left"},
             {"name": "leg_right", "bone": "leg_r", "attachment": "leg_right"},
             {"name": "arm_left", "bone": "chest", "attachment": "arm_left"},
             {"name": "body", "bone": "hips", "attachment": "body"},
             {"name": "head", "bone": "chest", "attachment": "head"},
             {"name": "mouth", "bone": "chest"},
             {"name": "arm_right", "bone": "chest", "attachment": "arm_right"},
             {"name": "wave_hand", "bone": "chest"}]
    slot_bone = {"leg_left": "leg_l", "leg_right": "leg_r", "body": "hips"}
    skins = []
    for skin in SKINS:
        row = layout["skins"][skin]
        side = row["wave_side"]
        attachments = {}
        for slot in SLOT_FILES:
            bone = slot_bone.get(slot) or {"arm_left": f"arm_l_{skin}", "arm_right": f"arm_r_{skin}", "head": f"head_{skin}"}[slot]
            attachments[slot] = {slot: rig.quad(f"{skin}_{slot}", CANVAS, bone, box=boxes[f"{skin}_{slot}"])}
        attachments["mouth"] = {name: rig.quad(name, sizes[name], f"head_{skin}", row["mouth"],
                                               layout["pieces"][name]["scale_to_canvas"], box=boxes[name])
                                for name in ("mouth_call", "mouth_cheer", "mouth_o")}
        # The palm is drawn fingers-up; the waving arm is raised ~150°, so pre-turn it back.
        attachments["wave_hand"] = {"wave_hand_front": rig.quad(
            "wave_hand_front", sizes["wave_hand_front"], f"hand_{side}_{skin}", row[f"hand_{side}"],
            layout["pieces"]["wave_hand_front"]["scale_to_canvas"], rotation=150 if side == "r" else -150,
            box=boxes["wave_hand_front"])}
        skins.append({"name": skin, "attachments": attachments})
    performers = {skin: {"wave_side": layout["skins"][skin]["wave_side"], "raise_cap": layout["skins"][skin].get("raise_cap", {})}
                  for skin in SKINS}
    return {"skeleton": {"spine": "4.2.43", "images": "./images/", "x": -70, "y": 0, "width": 140, "height": 260},
            "bones": rig.bones, "slots": slots, "skins": skins, "events": {"land": {}},
            "animations": make_clips(timeline, performers)}


def load_delivery(parts):
    manifest_path = parts / "registration.json"
    if not manifest_path.is_file():
        raise Blocked(f"Registered pf_rescued registration.json is missing: {manifest_path}")
    record = json.loads(manifest_path.read_text())
    if record.get("rig") != "pf_rescued" or record.get("canvas") != [1024, 1536] or (
            record.get("feet_x"), record.get("feet_y")) != (512, 1440):
        raise Blocked("pf_rescued registration uses an unexpected rig/canvas/feet basis")
    files = {}
    for skin in SKINS:
        listed = record["parts"][f"skin_{skin}"]["slots"]
        for slot, source in SLOT_FILES.items():
            files[f"{skin}_{slot}"] = parts / "skins" / skin / f"{source}.png"
            if str(files[f"{skin}_{slot}"].relative_to(parts.parents[3])) != listed[source]:
                raise Blocked(f"Registration lists a different file for {skin}/{source}")
    for name in PIECES:
        files[name] = parts / "pieces" / f"{name}.png"
    absent = [str(p) for p in files.values() if not p.is_file()]
    if absent:
        raise Blocked(f"Registered pf_rescued pieces are incomplete: {absent}")
    return record, files


def author(parts, output, layout_path=None):
    parts, output = Path(parts), Path(output)
    if (output / "pf_rescued.spine").exists():
        raise Blocked("Existing native project is authoritative; use a fresh draft directory")
    if output.exists():
        raise Blocked("Draft output already exists; preserve it and choose a new draft")
    record, files = load_delivery(parts)
    layout_path = Path(layout_path or HERE / "rescued-layout.json")
    if not layout_path.is_file():
        raise Blocked("rescued-layout.json is missing; run layout_rescued.py")
    layout = json.loads(layout_path.read_text())
    manifest_hash = hashlib.sha256((parts / "registration.json").read_bytes()).hexdigest()
    if layout["registration_sha256"] != manifest_hash:
        raise Blocked("Layout was measured against a different registered delivery")
    from PIL import Image
    sizes, boxes = {}, {}
    for name, path in files.items():
        image = Image.open(path)
        if name.split("_", 1)[0] in SKINS and image.size != CANVAS:
            raise Blocked(f"Skin slot {name} is not on the registered canvas: {image.size}")
        sizes[name] = list(image.size)
        boxes[name] = painted_box(image)
    rig = build_rig(layout, sizes, boxes)
    images = output / "images"
    images.mkdir(parents=True)
    freeze_source(parts / "registration.json", output / "registration.json")
    freeze_source(layout_path, output / "rescued-layout.json")
    for name in sorted(files):
        freeze_source(files[name], images / f"{name}.png")
    (output / "pf_rescued.json").write_text(json.dumps(rig, indent=2) + "\n")
    (output / "source-record.json").write_text(json.dumps({
        "status": "FULL_RIG_UNREVIEWED", "rig": "pf_rescued", "editor": "4.2.43",
        "registration_sha256": manifest_hash, "standing_scale": layout["spine_scale"],
        "source_files": {name: {"path": str(files[name].resolve()),
                               "sha256": hashlib.sha256((images / f"{name}.png").read_bytes()).hexdigest()}
                         for name in sorted(files)},
        "derivation": "Weighted quad meshes on per-skin pivot bones; source PNG bytes unchanged (renamed copies per skin)",
        "paid_generation": "none", "motion_review": "NOT RUN",
    }, indent=2) + "\n")
    return output / "pf_rescued.json"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parts", type=Path, default=PARTS)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--layout", type=Path)
    args = parser.parse_args()
    try:
        print(author(args.parts, args.output, args.layout))
    except Blocked as error:
        print(f"BLOCKED: {error}")
        raise SystemExit(2)
