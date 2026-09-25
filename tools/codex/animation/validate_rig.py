#!/usr/bin/env python3
"""Read-only Spine 4.2 export preflight. A static pass is never motion acceptance."""
import argparse
import json
import math
import re
import struct
from pathlib import Path

BONE_FIELDS = {
    "rotate": {"value": 0}, "translate": {"x": 0, "y": 0}, "translatex": {"value": 0},
    "translatey": {"value": 0}, "scale": {"x": 1, "y": 1}, "scalex": {"value": 1},
    "scaley": {"value": 1}, "shear": {"x": 0, "y": 0}, "shearx": {"value": 0}, "sheary": {"value": 0},
}
SLOT_TIMELINES = {"attachment", "rgba", "rgb", "alpha", "rgba2", "rgb2"}


class InvalidExport(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidExport(message)


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def read_json(path):
    value = json.loads(path.read_text(), parse_constant=lambda token: (_ for _ in ()).throw(InvalidExport(f"Non-finite JSON value {token}")))
    require(isinstance(value, dict), f"{path.name}: expected a JSON object")
    return value


def atlas_records(path):
    pages, regions = {}, {}
    new_page, current, page = True, None, None
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line:
            new_page = True
            continue
        if ":" in line:
            require(current is not None, "Atlas property has no page or region")
            key, value = line.split(":", 1)
            current[key.strip()] = value.strip()
        elif new_page:
            require(line not in pages, f"Duplicate atlas page {line}")
            page = line
            current = pages[line] = {}
            new_page = False
        else:
            require(line not in regions, f"Duplicate atlas region {line}")
            current = regions[line] = {"page": page}
    require(pages and regions, "Atlas must contain pages and regions")
    return pages, regions


def integers(text, length, label):
    values = [int(value.strip()) for value in text.split(",")]
    require(len(values) == length, f"{label}: expected {length} integers")
    return values


def check_atlas(path, issues, missing):
    pages, regions = atlas_records(path)
    sizes = {}
    for name, page in pages.items():
        texture = path.parent / name
        require(not Path(name).is_absolute() and ".." not in Path(name).parts, f"Unsafe atlas page path {name}")
        require(texture.suffix.lower() == ".png", f"Atlas page must be PNG: {name}")
        if page.get("pma", "false").lower() != "false":
            issues.append(f"{name}: premultiplied alpha must be OFF")
        declared = integers(page["size"], 2, name) if "size" in page else None
        if declared and any(size <= 0 or size > 2048 for size in declared):
            issues.append(f"{name}: atlas page dimensions must be within 1..2048")
        if not texture.is_file():
            missing.append(f"Missing PNG: {texture}")
            if declared:
                sizes[name] = declared
            continue
        with texture.open("rb") as stream:
            header = stream.read(33)
        require(len(header) == 33 and header[:8] == b"\x89PNG\r\n\x1a\n" and header[12:16] == b"IHDR",
                f"{name}: invalid PNG header")
        size = list(struct.unpack(">II", header[16:24]))
        sizes[name] = size
        if any(d <= 0 or d > 2048 for d in size):
            issues.append(f"{name}: PNG page dimensions must be within 1..2048")
        if declared and declared != size:
            issues.append(f"{name}: atlas size {declared} differs from PNG {size}")
    for name, region in regions.items():
        if "bounds" in region:
            x, y, width, height = integers(region["bounds"], 4, name)
        else:
            require("xy" in region and "size" in region, f"{name}: missing atlas region bounds")
            x, y = integers(region["xy"], 2, name)
            width, height = integers(region["size"], 2, name)
        if region.get("rotate", "false") in ("true", "90", "270"):
            width, height = height, width
        if min(x, y) < 0 or min(width, height) <= 0:
            issues.append(f"{name}: invalid region bounds")
        size = sizes.get(region["page"])
        if size and (x + width > size[0] or y + height > size[1]):
            issues.append(f"{name}: region extends outside page {region['page']}")
    return regions


def check_skins(skeleton, regions, issues):
    skins = skeleton.get("skins")
    require(isinstance(skins, list) and skins, "Expected nonempty Spine 4.2 skins array")
    by_name = {}
    slots = {slot["name"] for slot in skeleton.get("slots", [])}
    for skin in skins:
        require(isinstance(skin, dict) and isinstance(skin.get("name"), str), "Malformed skin")
        require(skin["name"] not in by_name, f"Duplicate skin {skin['name']}")
        by_name[skin["name"]] = skin

    def texture_paths(skin_name, slot_name, attachment_name, seen):
        identity = (skin_name, slot_name, attachment_name)
        require(identity not in seen, f"Linked mesh cycle: {identity}")
        attachment = by_name[skin_name]["attachments"][slot_name][attachment_name]
        require(isinstance(attachment, dict), f"Malformed attachment {identity}")
        kind = attachment.get("type", "region")
        if kind in ("boundingbox", "path", "point", "clipping"):
            return []
        require(kind in ("region", "mesh", "linkedmesh"), f"Unsupported attachment type {kind}")
        if kind == "linkedmesh":
            parent_skin = attachment.get("skin", skin_name)
            # Resolve parent even when the linked mesh overrides its texture path.
            inherited = texture_paths(parent_skin, slot_name, attachment["parent"], seen | {identity})
            if "path" not in attachment:
                return inherited
        base = attachment.get("path", attachment_name)
        require(isinstance(base, str) and base, f"Invalid attachment path {identity}")
        sequence = attachment.get("sequence")
        if sequence:
            count, start, digits = sequence["count"], sequence.get("start", 1), sequence.get("digits", 0)
            require(all(isinstance(v, int) and not isinstance(v, bool) for v in (count, start, digits))
                    and 0 < count <= 10000 and start >= 0 and 0 <= digits <= 16, f"Invalid sequence {identity}")
            return [base + str(index).zfill(digits) for index in range(start, start + count)]
        return [base]

    for skin_name, skin in by_name.items():
        attachments = skin.get("attachments", {})
        require(isinstance(attachments, dict), f"Malformed attachments for {skin_name}")
        for slot_name, entries in attachments.items():
            require(slot_name in slots, f"{skin_name}: unknown slot {slot_name}")
            require(isinstance(entries, dict), f"Malformed slot attachments {skin_name}/{slot_name}")
            for name in entries:
                for region in texture_paths(skin_name, slot_name, name, set()):
                    if region not in regions:
                        issues.append(f"{skin_name}/{slot_name}/{name}: atlas lacks region {region}")
    return set(by_name)


def check_animations(skeleton, issues):
    animations = skeleton.get("animations")
    require(isinstance(animations, dict) and animations, "Expected nonempty animations")
    bones = skeleton.get("bones", [])
    require(isinstance(bones, list) and bones and bones[0].get("name") == "root", "First bone must be root")
    bone_names = {bone["name"] for bone in bones}
    slot_names = {slot["name"] for slot in skeleton.get("slots", [])}
    root = bones[0]
    require("parent" not in root, "root must have no parent")
    for field in ("x", "y", "rotation", "scaleX", "scaleY", "shearX", "shearY"):
        neutral = 1 if field.startswith("scale") else 0
        if root.get(field, neutral) != neutral:
            issues.append(f"root setup {field} is not neutral")
    declared_events = skeleton.get("events", {})
    require(isinstance(declared_events, dict), "Malformed event definitions")
    used_events, motion_by_clip = set(), {}
    for name, animation in animations.items():
        require(isinstance(animation, dict), f"{name}: animation must be an object")
        duration, posed = 0.0, False
        moving_bones = set()

        def timelines(node, location):
            nonlocal duration, posed
            if isinstance(node, dict):
                for key, child in node.items():
                    timelines(child, location + (key,))
                return
            require(isinstance(node, list) and node, f"{name}/{'.'.join(location)}: empty or malformed timeline")
            if location[0] == "bones":
                require(len(location) == 3 and location[1] in bone_names, f"{name}: unknown animated bone {location[1]}")
                require(location[2] in BONE_FIELDS, f"{name}: unsupported bone timeline {location[2]}")
            elif location[0] == "slots":
                require(len(location) == 3 and location[1] in slot_names, f"{name}: unknown animated slot {location[1]}")
                require(location[2] in SLOT_TIMELINES, f"{name}: unsupported slot timeline {location[2]}")
            previous = -1
            for frame in node:
                require(isinstance(frame, dict), f"{name}: timeline frame must be an object")
                time = frame.get("time", 0)
                require(number(time) and time >= 0 and time >= previous, f"{name}: invalid or unordered frame time")
                previous = time
                duration = max(duration, time)
                if location[0] == "bones":
                    fields = BONE_FIELDS[location[2]]
                    require(not set(frame) - set(fields) - {"time", "curve"}, f"{name}: unsupported bone keyframe properties")
                    require(all(number(frame.get(field, neutral)) for field, neutral in fields.items()),
                            f"{name}: bone keyframe values must be numeric")
                for key, value in frame.items():
                    if isinstance(value, (float, int)):
                        require(number(value), f"{name}: invalid numeric keyframe {key}")
                if location[0] != "events" and set(frame) - {"time", "curve"}:
                    posed = True
            if location[0] == "events":
                for frame in node:
                    require(frame.get("name") in declared_events, f"{name}: undefined event {frame.get('name')}")
                    used_events.add(frame["name"])
            elif location[0] == "bones" and location[1] != "root":
                fields = BONE_FIELDS[location[2]]
                # Count numeric changes over positive time, not a static keyed pose or inherited motion.
                if any(right.get("time", 0) > left.get("time", 0)
                       and any(abs(right.get(field, neutral) - left.get(field, neutral)) > 1e-6
                               for field, neutral in fields.items())
                       for left, right in zip(node, node[1:])):
                    moving_bones.add(location[1])

        timelines(animation, ())
        if duration <= 0 or not posed:
            issues.append(f"{name}: needs a positive-duration, nonempty pose timeline; empty blocking clips are not accepted")
        root_tracks = animation.get("bones", {}).get("root", {})
        for kind, frames in root_tracks.items():
            normalized = kind
            require(normalized in BONE_FIELDS, f"{name}: unsupported root timeline {kind}; neutrality unproven")
            if any(frame.get(field, neutral) != neutral for frame in frames for field, neutral in BONE_FIELDS[normalized].items()):
                issues.append(f"{name}: root {kind} moves; runtime owns all travel")
            if any("curve" in frame and frame["curve"] != "stepped" for frame in frames):
                issues.append(f"{name}: root curves are disallowed; neutral endpoint keys do not prove neutral interpolation")
        motion_by_clip[name] = sorted(moving_bones)
    return set(animations), set(declared_events), used_events, motion_by_clip


def validate(rig, skeleton_path, atlas_path, requirements_path=None, *, requirements=None):
    issues, missing = [], []
    motion_by_clip = {}
    requirement_source = str(requirements_path) if requirements_path else "INLINE" if requirements is not None else "NOT SUPPLIED"
    for path in (skeleton_path, atlas_path, requirements_path):
        if path is not None and not path.is_file():
            missing.append(f"Missing input: {path}")
    if not missing:
        try:
            skeleton = read_json(skeleton_path)
            version = skeleton.get("skeleton", {}).get("spine", "")
            require(isinstance(version, str) and re.fullmatch(r"4\.2\.\d+(?:[-+].*)?", version), f"Spine version {version!r}: expected 4.2.x")
            regions = check_atlas(atlas_path, issues, missing)
            skins = check_skins(skeleton, regions, issues)
            clips, events, used_events, motion_by_clip = check_animations(skeleton, issues)
            if requirements_path:
                requirements = read_json(requirements_path)
            requirements = {} if requirements is None else requirements
            require(isinstance(requirements, dict), "Requirements must be an object")
            require(not set(requirements) - {"clips", "skins", "events", "anchors", "min_moving_bones"},
                    "Requirements support only clips, skins, events, anchors, min_moving_bones")
            minimum = requirements.get("min_moving_bones", 1)
            require(isinstance(minimum, int) and not isinstance(minimum, bool) and minimum >= 1,
                    "min_moving_bones must be a positive integer")
            for name, moving in motion_by_clip.items():
                if len(moving) < minimum:
                    issues.append(f"{name}: {len(moving)} moving bones; requires at least {minimum} numeric bone timelines with motion")
            if requirements:
                for key, actual in (("clips", clips), ("skins", skins), ("events", events)):
                    if key not in requirements:
                        continue
                    names = requirements[key]
                    require(isinstance(names, list) and all(isinstance(n, str) and n for n in names), f"Requirements {key} must be a list of names")
                    expected = set(names)
                    if expected - actual:
                        issues.append(f"Missing required {key}: {', '.join(sorted(expected - actual))}")
                    if actual - expected:
                        issues.append(f"Unexpected {key}: {', '.join(sorted(actual - expected))}")
                    if key == "events" and expected - used_events:
                        issues.append(f"Required events never keyed: {', '.join(sorted(expected - used_events))}")
                anchors = requirements.get("anchors", [])
                require(isinstance(anchors, list) and all(isinstance(n, str) and n for n in anchors),
                        "Requirements anchors must be a list of bone names")
                absent = set(anchors) - {bone["name"] for bone in skeleton["bones"]}
                if absent:
                    issues.append(f"Missing required anchors: {', '.join(sorted(absent))}")
        except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError) as error:
            issues.append(f"Invalid export: {error}")
    status = "FAIL" if issues else "BLOCKED" if missing else "PASS"
    return {"rig": rig, "status": status, "scope": "STATIC EXPORT PREFLIGHT ONLY", "motion_craft": "NOT RUN",
            "runtime_render": "NOT RUN", "requirements": requirement_source,
            "moving_bones_by_clip": motion_by_clip,
            "issues": issues + missing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rig", required=True, help="Rig identity for the report")
    parser.add_argument("--json", required=True, type=Path, dest="skeleton")
    parser.add_argument("--atlas", required=True, type=Path)
    parser.add_argument("--requirements", type=Path, help="Optional agreed clips, skins, events, anchors and min_moving_bones")
    args = parser.parse_args()
    report = validate(args.rig, args.skeleton, args.atlas, args.requirements)
    print(json.dumps(report, indent=2))
    return {"PASS": 0, "FAIL": 1, "BLOCKED": 2}[report["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
