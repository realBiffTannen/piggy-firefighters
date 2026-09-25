#!/usr/bin/env python3
"""Author Ember's (pf_dog) Spine 4.2.43 draft from the registered r2 parts.

Reads dog-layout.json (measured against the exact registration.json hash), freezes
byte-identical copies of the source PNGs into <draft>/images/, and writes
pf_dog.json: root at the feet centre, standing height 220px, polygon sub-meshes
(UV selections of registered layers), region attachments for the layers and the
muzzle overlays, contract anchors (sheet_l, sheet_r), the `bark` event and all
five contract clips. Import into a NEW .spine with the pinned CLI; see README.md.
"""
import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
PARTS = HERE.parents[1] / "parts" / "pf_dog"
SPINE_VERSION = "4.2.43"


class Blocked(RuntimeError):
    pass


def canvas_point(point, scale):
    return ((point[0] - 512) * scale, (1440 - point[1]) * scale)


def timeline(samples, channel):
    """Ease using Spine 4.2's absolute time/value cubic handles, per channel."""
    keys = [dict(time=t, **dict(zip(channel, values))) for t, values in samples]
    for first, second in zip(keys, keys[1:]):
        dt = second["time"] - first["time"]
        first["curve"] = [number for name in channel for number in (
            round(first["time"] + dt * .35, 6), first[name],
            round(second["time"] - dt * .35, 6), second[name])]
    return keys


def signed_area(points):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1])) / 2


def triangulate(points):
    """Ear clipping for a simple polygon given counter-clockwise; returns index triples."""
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        return cross(a, b, p) >= 0 and cross(b, c, p) >= 0 and cross(c, a, p) >= 0

    remaining = list(range(len(points)))
    triangles = []
    guard = 0
    while len(remaining) > 3:
        guard += 1
        if guard > 10000:
            raise Blocked("Polygon could not be triangulated (self-intersecting?)")
        for i in range(len(remaining)):
            a, b, c = remaining[i - 1], remaining[i], remaining[(i + 1) % len(remaining)]
            pa, pb, pc = points[a], points[b], points[c]
            if cross(pa, pb, pc) <= 0:
                continue
            if any(inside(points[k], pa, pb, pc) for k in remaining if k not in (a, b, c)):
                continue
            triangles.append((a, b, c))
            remaining.pop(i)
            break
        else:
            raise Blocked("No ear found; polygon is degenerate")
    triangles.append(tuple(remaining))
    return triangles


def build_rig(layout, scale, clips):
    world, indices, bones = {}, {}, []
    for spec in layout["bones"]:
        name, parent = spec["name"], spec.get("parent")
        point = canvas_point(spec["point"], scale)
        bone = {"name": name}
        if parent:
            px, py = world[parent]
            bone.update(parent=parent, x=round(point[0] - px, 4), y=round(point[1] - py, 4))
        elif point != (0, 0):
            raise Blocked("Root setup must be the neutral feet origin")
        world[name] = point
        indices[name] = len(bones)
        bones.append(bone)

    slots, attachments = [], {}
    for surface in layout["surfaces"]:
        slot, bone = surface["slot"], surface["bone"]
        if slot not in attachments:
            setup = surface["name"] if surface.get("setup", True) else None
            slots.append({"name": slot, "bone": bone, **({"attachment": setup} if setup else {})})
            attachments[slot] = {}
        width, height = surface["image_size"]
        bx, by = world[bone]
        if surface["kind"] == "region":
            s = surface["scale"]
            ox, oy = surface["origin"]
            cx, cy = canvas_point((ox + width * s / 2, oy + height * s / 2), scale)
            attachments[slot][surface["name"]] = {
                "path": surface["image"], "x": round(cx - bx, 4), "y": round(cy - by, 4),
                "scaleX": round(s * scale, 6), "scaleY": round(s * scale, 6), "width": width, "height": height}
            continue
        points = [tuple(p) for p in surface["points"]]
        if signed_area(points) > 0:  # canvas y is down: keep every hull wound the same way
            points.reverse()
        if "uv_patch" in surface:
            cx = sum(p[0] for p in points) / len(points)
            cy = sum(p[1] for p in points) / len(points)
            half = max(max(abs(p[0] - cx) for p in points), max(abs(p[1] - cy) for p in points))
            k = min(1.0, surface["uv_patch"]["half"] / half)
            ux, uy = surface["uv_patch"]["centre"]
            uv_points = [(ux + (p[0] - cx) * k, uy + (p[1] - cy) * k) for p in points]
        else:
            uv_points = points
        skeleton_points = [canvas_point(p, scale) for p in points]
        triangles = triangulate(skeleton_points)  # counter-clockwise once y is flipped
        uvs, vertices = [], []
        for uv, sp in zip(uv_points, skeleton_points):
            uvs.extend([round(uv[0] / width, 6), round(uv[1] / height, 6)])
            vertices.extend([1, indices[bone], round(sp[0] - bx, 4), round(sp[1] - by, 4), 1])
        edges = set()
        for a, b, c in triangles:
            edges.update(tuple(sorted(pair)) for pair in ((a, b), (b, c), (c, a)))
        attachments[slot][surface["name"]] = {
            "type": "mesh", "path": surface["image"], "width": width, "height": height,
            "uvs": uvs, "vertices": vertices, "triangles": [i for tri in triangles for i in tri],
            "hull": len(points), "edges": [index * 2 for edge in sorted(edges) for index in edge]}
    return {"skeleton": {"spine": SPINE_VERSION, "images": "./images/", "x": -110, "y": 0, "width": 220, "height": 220},
            "bones": bones, "slots": slots,
            "skins": [{"name": "default", "attachments": attachments}],
            "events": {"bark": {}}, "animations": clips}


def author(parts, output, layout_path=None):
    parts, output = Path(parts), Path(output)
    if output.exists():
        raise Blocked("Draft output already exists; preserve it and choose a new draft")
    manifest = parts / "registration.json"
    if not manifest.is_file():
        raise Blocked(f"Registered pf_dog registration.json is missing: {manifest}")
    record = json.loads(manifest.read_text())
    if record.get("rig") != "pf_dog" or record.get("canvas") != [1024, 1536] or (
            record.get("feet_x"), record.get("feet_y")) != (512, 1440):
        raise Blocked("pf_dog registration uses an unexpected rig/canvas/feet basis")
    layout_path = Path(layout_path or HERE / "dog-layout.json")
    layout = json.loads(layout_path.read_text())
    manifest_hash = hashlib.sha256(manifest.read_bytes()).hexdigest()
    if layout["registration_sha256"] != manifest_hash:
        raise Blocked("dog-layout.json was measured against a different registered delivery")
    from PIL import Image
    files = {}
    for surface in layout["surfaces"]:
        image = surface["image"]
        candidate = parts / f"{image}.png"
        if not candidate.is_file():
            candidate = parts / "pieces" / f"{image}.png"
        if not candidate.is_file():
            raise Blocked(f"Registered source is missing: {image}")
        if list(Image.open(candidate).size) != surface["image_size"]:
            raise Blocked(f"Source size differs from layout: {image}")
        files[image] = candidate
    master = Image.open(files["master_pf_dog"])
    bounds = master.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
    scale = layout["standing_height_px"] / (bounds[3] - bounds[1])
    from dog_performances import make_clips
    rig = build_rig(layout, scale, make_clips(timeline))
    images = output / "images"
    images.mkdir(parents=True)
    shutil.copyfile(manifest, output / "registration.json")
    shutil.copyfile(layout_path, output / "dog-layout.json")
    for name, source in sorted(files.items()):
        shutil.copyfile(source, images / f"{name}.png")
    (output / "pf_dog.json").write_text(json.dumps(rig, indent=1) + "\n")
    (output / "source-record.json").write_text(json.dumps({
        "status": "FULL_RIG_UNREVIEWED", "rig": "pf_dog", "editor": SPINE_VERSION,
        "registration_sha256": manifest_hash, "standing_scale": scale, "master_bbox": list(bounds),
        "source_files": {name: {"path": str(source.resolve()),
                               "sha256": hashlib.sha256((images / f"{name}.png").read_bytes()).hexdigest()}
                         for name, source in sorted(files.items())},
        "derivation": "Region attachments of registered layers plus UV polygon sub-meshes; source PNG bytes unchanged",
        "paid_generation": "none", "motion_review": "NOT RUN",
    }, indent=2) + "\n")
    return output / "pf_dog.json"


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
