#!/usr/bin/env python3
"""Author Chief's original-parts spray pilot; no raster painting or native overwrite.

The registered delivery and this rig's reviewed layout are required inputs. Mesh UVs
select existing painted pixels. Draft images are byte-preserving frozen copies.
Every draft is imported into its own new Spine 4.2.43 project, then kept authoritative.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path


HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_chief"


class Blocked(RuntimeError):
    pass


def freeze_source(source, target):
    if target.exists():
        raise Blocked(f"Preserving existing draft texture: {target}")
    shutil.copyfile(source, target)


def canvas_point(point, scale):
    return ((point[0] - 512) * scale, (1440 - point[1]) * scale)


def standing_scale(bounds):
    height = bounds[3] - bounds[1]
    if height <= 0:
        raise Blocked("Master has no standing silhouette")
    return 420 / height


def local_point(point, transform):
    x, y, angle = transform
    dx, dy = point[0] - x, point[1] - y
    return (dx * math.cos(angle) + dy * math.sin(angle),
            -dx * math.sin(angle) + dy * math.cos(angle))


def weighted_vertex(point, influences, transforms):
    if not influences or abs(sum(weight for _, weight in influences) - 1) > 1e-6:
        raise ValueError("Vertex weights must total one")
    result = [len(influences)]
    for bone, weight in influences:
        if weight <= 0:
            raise ValueError("Vertex weights must be positive")
        x, y = local_point(point, transforms[bone])
        result.extend([bone, round(x, 6), round(y, 6), weight])
    return result


def timeline(samples, channel):
    """Ease using Spine 4.2's absolute time/value cubic handles, per channel."""
    keys = [dict(time=t, **dict(zip(channel, values))) for t, values in samples]
    for first, second in zip(keys, keys[1:]):
        dt = second["time"] - first["time"]
        first["curve"] = [number for name in channel for number in (
            round(first["time"] + dt * .35, 6), first[name],
            round(second["time"] - dt * .35, 6), second[name])]
    return keys


def spray_clips():
    # Values are in final 420px skeleton units, with root/boots entirely unkeyed.
    # Start: gaze, brace, raise, seat grips, spray, settle; each secondary lags.
    tracks = {
        ("head", "rotate"): ([(0, (0,)), (.09, (-4,)), (.25, (-2,)), (.6, (-1.5,))],
                             [(0, (-1.5,)), (.32, (-1,)), (.7, (-1.8,)), (1.2, (-1.5,))]),
        ("body", "translate"): ([(0, (0, 0)), (.12, (0, 0)), (.27, (-1, -5)), (.6, (-1, -4))],
                                [(0, (-1, -4)), (.24, (-2, -4.7)), (.58, (-.5, -3.7)), (1.2, (-1, -4))]),
        ("chest", "rotate"): ([(0, (0,)), (.1, (0,)), (.28, (2.5,)), (.6, (1.2,))],
                              [(0, (1.2,)), (.2, (2,)), (.55, (.6,)), (.9, (1.6,)), (1.2, (1.2,))]),
        ("nozzle", "rotate"): ([(0, (0,)), (.13, (0,)), (.4, (28,)), (.48, (29,)), (.6, (28,))],
                               [(0, (28,)), (.16, (28.6,)), (.41, (27.7,)), (.72, (28.3,)), (1.2, (28,))]),
        ("nozzle", "translate"): ([(0, (0, 0)), (.12, (0, -2)), (.4, (12, 38)), (.48, (11, 38)), (.6, (12, 38))],
                                  [(0, (12, 38)), (.13, (10.9, 38.3)), (.36, (12.4, 37.8)), (.7, (11.5, 38.1)), (1.2, (12, 38))]),
        ("helmet", "rotate"): ([(0, (0,)), (.11, (0,)), (.2, (2.4,)), (.36, (-1.3,)), (.6, (.4,))],
                               [(0, (.4,)), (.35, (-.2,)), (.8, (.7,)), (1.2, (.4,))]),
        ("moustache", "rotate"): ([(0, (0,)), (.17, (0,)), (.31, (2,)), (.47, (-1,)), (.6, (.3,))],
                                  [(0, (.3,)), (.26, (-.5,)), (.62, (.7,)), (1.2, (.3,))]),
        ("coat_r", "rotate"): ([(0, (0,)), (.2, (0,)), (.39, (3,)), (.52, (-1,)), (.6, (.6,))],
                               [(0, (.6,)), (.4, (1.5,)), (.82, (.1,)), (1.2, (.6,))]),
        ("coat_l", "rotate"): ([(0, (0,)), (.23, (0,)), (.43, (-2,)), (.6, (-.4,))],
                               [(0, (-.4,)), (.49, (-1.1,)), (.93, (.1,)), (1.2, (-.4,))]),
    }
    result = {name: {"bones": {}} for name in ("spray_start", "spray_loop", "spray_end")}
    for (bone, kind), (start, loop) in tracks.items():
        channels = ("value",) if kind == "rotate" else ("x", "y")
        rest, aimed = start[0][1], loop[0][1]
        lag = .09 if bone in ("helmet", "moustache", "coat_l", "coat_r") else .04
        end = [(0, aimed), (lag, aimed), (.36 if lag == .04 else .43, rest), (.5, rest)]
        for name, keys in zip(result, (start, loop, end)):
            result[name]["bones"].setdefault(bone, {})[kind] = timeline(keys, channels)
    result["spray_start"]["events"] = [{"time": .44, "name": "spray_on"}]
    result["spray_end"]["events"] = [{"time": 0, "name": "spray_off"}]
    return result


def full_clips():
    from chief_performances import make_clips
    return make_clips(spray_clips(), timeline)


def load_delivery(parts):
    manifest_path = parts / "registration.json"
    if not manifest_path.is_file():
        raise Blocked(f"Registered Chief registration.json is missing: {manifest_path}")
    record = json.loads(manifest_path.read_text())
    if record.get("rig") != "pf_chief" or record.get("canvas") != [1024, 1536] or (
            record.get("feet_x"), record.get("feet_y")) != (512, 1440):
        raise Blocked("Chief registration uses an unexpected rig/canvas/feet basis")
    files = {name: parts / f"{name}.png" for name in (
        "master_pf_chief", "body_no_head_no_arms", "head_blank", "head_no_helmet",
        "helmet_only", "arm_right", "arm_left", "leg_right", "leg_left", "coat_tails", "face_sheet")}
    for sheet in record["pieces"].values():
        if sheet["missing"]:
            raise Blocked(f"Registered sheet has missing pieces: {sheet['missing']}")
        for name in sheet["pieces"]:
            files[name] = parts / "pieces" / f"{name}.png"
    files["hose_original"] = parts.parent / "pf_rookie" / "pieces" / "hose_flexible.png"
    # Lettering is a separately approved local derivation, omitted by the r2 grid manifest.
    files["shield_13"] = parts / "pieces" / "shield_13.png"
    required = {"hand_l_grip", "hand_r_grip", "nozzle", "eyes_open", "eyes_closed",
                "brows_level", "mouth_closed", "moustache", "ear_left", "ear_right"}
    absent = sorted(required - files.keys()) + [str(p) for p in files.values() if not p.is_file()]
    if absent:
        raise Blocked(f"Registered Chief pieces are incomplete: {absent}")
    return record, files


def build_rig(layout, scale, full=False):
    bones, transforms, indices = [], [], {}
    for spec in layout["bones"]:
        name, parent = spec["name"], spec.get("parent")
        point = canvas_point(spec["point"], scale)
        angle = math.radians(spec.get("angle", 0))
        transform = (*point, angle)
        bone = {"name": name}
        if parent:
            base = transforms[indices[parent]]
            bone.update(parent=parent, x=local_point(point, base)[0], y=local_point(point, base)[1],
                        rotation=math.degrees(angle - base[2]))
        elif point != (0, 0) or angle:
            raise Blocked("Root setup must be the neutral feet origin")
        if spec.get("length"):
            bone["length"] = spec["length"] * scale
        indices[name] = len(bones)
        bones.append(bone)
        transforms.append(transform)
    slots, attachments = [], {}
    for surface in layout["surfaces"]:
        name = surface["name"]
        slot = surface.get("slot", name)
        if slot not in attachments:
            setup = surface.get("setup_attachment", name)
            slots.append({"name": slot, "bone": surface["bone"], **({"attachment": setup} if setup else {})})
            attachments[slot] = {}
        uvs, vertices = [], []
        width, height = surface["image_size"]
        for vertex in surface["vertices"]:
            uvs.extend([vertex["uv"][0] / width, vertex["uv"][1] / height])
            influences = [(indices[bone], weight) for bone, weight in vertex["weights"].items()]
            vertices.extend(weighted_vertex(canvas_point(vertex["point"], scale), influences, transforms))
        edges = set()
        for i in range(0, len(surface["triangles"]), 3):
            a, b, c = surface["triangles"][i:i + 3]
            edges.update(tuple(sorted(pair)) for pair in ((a, b), (b, c), (c, a)))
        attachments[slot][name] = {"type": "mesh", "path": surface["image"],
            "width": width, "height": height, "uvs": uvs, "vertices": vertices,
            "triangles": surface["triangles"], "hull": surface.get("hull", 0),
            "edges": [index * 2 for edge in sorted(edges) for index in edge]}
    return {"skeleton": {"spine": "4.2.43", "images": "./images/", "x": -160, "y": 0,
                         "width": 320, "height": 420},
            "bones": bones, "slots": slots, "ik": layout["ik"], "transform": layout.get("transform", []),
            "skins": [{"name": "default", "attachments": attachments}],
            "events": {"step": {}, "spray_on": {}, "spray_off": {}, "sign_hit": {}},
            "animations": full_clips() if full else spray_clips()}


def author(parts, output, layout_path=None, full=False):
    parts, output = Path(parts), Path(output)
    if (output / "pf_chief.spine").exists():
        raise Blocked("Existing native project is authoritative; use a fresh draft directory")
    record, files = load_delivery(parts)
    layout_path = Path(layout_path or HERE / "pilot-layout.json")
    if not layout_path.is_file():
        raise Blocked("Registered-pixel pilot-layout.json awaits actual assembly review")
    layout = json.loads(layout_path.read_text())
    manifest_hash = hashlib.sha256((parts / "registration.json").read_bytes()).hexdigest()
    if layout["registration_sha256"] != manifest_hash:
        raise Blocked("Pilot layout was measured against a different registered delivery")
    from PIL import Image
    master = Image.open(files["master_pf_chief"])
    bounds = master.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
    scale = standing_scale(bounds)
    rig = build_rig(layout, scale, full)
    used = {surface["image"] for surface in layout["surfaces"]}
    for surface in layout["surfaces"]:
        if surface["image"] not in files or list(Image.open(files[surface["image"]]).size) != surface["image_size"]:
            raise Blocked(f"Source size/path differs from layout: {surface['image']}")
    if output.exists():
        raise Blocked("Draft output already exists; preserve it and choose a new draft")
    images = output / "images"
    images.mkdir(parents=True)
    freeze_source(parts / "registration.json", output / "registration.json")
    freeze_source(layout_path, output / "pilot-layout.json")
    for name in sorted(used):
        freeze_source(files[name], images / f"{name}.png")
    (output / "pf_chief.json").write_text(json.dumps(rig, indent=2) + "\n")
    (output / "source-record.json").write_text(json.dumps({
        "status": "FULL_RIG_UNREVIEWED" if full else "PILOT_UNREVIEWED", "rig": "pf_chief", "editor": "4.2.43",
        "registration_sha256": manifest_hash, "standing_scale": scale,
        "source_files": {name: {"path": str(files[name].resolve()),
                               "sha256": hashlib.sha256((images / f"{name}.png").read_bytes()).hexdigest()}
                         for name in sorted(used)},
        "derivation": "Spine UV submeshes and bone weights; source PNG bytes unchanged",
        "motion_review": "NOT RUN", "remaining_clips": "Full contract authored; review pending" if full else "Deferred until spray pilot review"
    }, indent=2) + "\n")
    return output / "pf_chief.json"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parts", type=Path, default=PARTS)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--layout", type=Path)
    parser.add_argument("--full", action="store_true", help="Include all ten original Chief performances")
    args = parser.parse_args()
    try:
        print(author(args.parts, args.output, args.layout, args.full))
    except Blocked as error:
        print(f"BLOCKED: {error}")
        raise SystemExit(2)
