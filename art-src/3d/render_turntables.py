"""Blender (5.2, headless) toon turntables for the seven win-rung solids (lane E).

    /Applications/Blender.app/Contents/MacOS/Blender -b --python art-src/3d/render_turntables.py -- \
        [--jobs coin,helmet,coins] [--res 256] [--out art-src/3d/renders/frames] [--only-frame 0] [--calibrate]

Per job: import `art-src/meshy/<piece>.glb` (Meshy image-to-3D, embedded albedo texture), bake the importer's
transforms, centre the mesh on its bounding sphere and lock an orthographic camera so the sphere's diameter is 86 % of
the cell (scale-locked across every frame of the spin). Every material is replaced by a toon shader: the Meshy albedo
is the base colour; a white Diffuse BSDF lit by ONE warm key (sun from the camera's upper-left, no shadows, no world
light) goes through Shader-to-RGB into constant ColorRamps (3 steps on n.l: hard shadow / base / small highlight) that
drive a hue-preserving V and S step on the albedo; the result is emitted (no PBR, no speculars, no ambient). Eevee,
Standard view transform (sRGB, no tone curve so the 2D palette survives), transparent film, no motion blur.

Two images per frame at `--res` px (2x the 128 px cell): `<job>/NN.png` (RGBA colour) and `<job>/depth/NN.png`
(16-bit view-depth, normalised to the sphere: `depth_units = v * 4R`). `compose_sheets.py` draws the ink outline
(#3B2313, 2 px at 128) from the alpha and the depth discontinuities, downsamples and packs the sheets.

Jobs: `<piece>` = 24 frames, 360 deg about the vertical axis tilted 20 deg about the camera X (tumble);
`coins` = the fountain coin, 32 frames Y-spin only (edge-on at 8 and 24).
"""
import hashlib
import json
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MESHY = os.path.join(ROOT, "art-src", "meshy")

PIECES = ["coin", "silver_coin", "helmet", "nozzle", "badge", "boot", "hydrant_cap"]
FILL = 0.86            # bounding-sphere diameter / cell
TILT_DEG = 20.0        # spin-axis tilt about the camera's X for the tumbling pieces
CAM_DIST = 50.0

# Per-piece rest pose (degrees, applied before the spin so frame 0 is the hero view of the 2D sheet).
# yaw = about the vertical axis, pitch = about the camera X, roll = about the view axis.
POSE = {
    "coin": dict(yaw=0, pitch=0, roll=0),
    "silver_coin": dict(yaw=0, pitch=0, roll=0),
    "helmet": dict(yaw=0, pitch=0, roll=0),
    "nozzle": dict(yaw=180, pitch=0, roll=0),  # tip to the right, bail upper-left like the 2D piece
    "badge": dict(yaw=0, pitch=0, roll=0),
    "boot": dict(yaw=0, pitch=0, roll=0),
    "hydrant_cap": dict(yaw=0, pitch=0, roll=0),
}
JOBS = {p: dict(glb=p, frames=24, tilt=TILT_DEG) for p in PIECES}
JOBS["coins"] = dict(glb="coin", frames=32, tilt=0.0)

# Toon ramp on n.l. Calibrated (--calibrate): a sun of strength pi makes a facing white diffuse surface read 1.0,
# so the ramp positions are n.l directly.
SUN_STRENGTH = math.pi
SHADOW_END = 0.36      # n.l below this -> shadow tone
HIGH_START = 0.86      # n.l above this -> highlight
SHADOW_V, SHADOW_S = 0.66, 1.22
HIGH_VADD, HIGH_S = 0.10, 0.82
LIGHT_FROM = Vector((-0.55, -0.80, 0.75))  # warm key from the camera's upper-left, in front


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default=",".join(list(JOBS)))
    ap.add_argument("--res", type=int, default=256)
    ap.add_argument("--samples", type=int, default=32)
    ap.add_argument("--out", default=os.path.join(HERE, "renders", "frames"))
    ap.add_argument("--only-frame", type=int, default=-1, help="render one frame index (preview)")
    ap.add_argument("--no-depth", action="store_true", help="skip the depth pass (preview)")
    ap.add_argument("--calibrate", action="store_true")
    ap.add_argument("--sun", type=float, default=None, help="override SUN_STRENGTH (calibration)")
    return ap.parse_args(argv)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ------------------------------------------------------------------------------------------------ scene
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = True
    sc.render.use_motion_blur = False
    sc.render.use_freestyle = False
    sc.render.dither_intensity = 0.0
    set_output_colour(sc)
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.display_settings.display_device = "sRGB"
    ev = sc.eevee
    for attr in ("use_shadows", "use_gtao", "use_bloom", "use_raytracing"):
        if hasattr(ev, attr):
            setattr(ev, attr, False)
    # world: black, no ambient (the ramp sees the key light only)
    world = bpy.data.worlds.new("toon_world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0, 0, 0, 1)
        bg.inputs[1].default_value = 0.0
    sc.world = world
    return sc


def set_output_colour(sc):
    sc.view_settings.view_transform = "Standard"
    s = sc.render.image_settings
    s.file_format = "PNG"
    s.color_mode = "RGBA"
    s.color_depth = "8"
    s.compression = 30


def set_output_depth(sc):
    sc.view_settings.view_transform = "Raw"
    s = sc.render.image_settings
    s.file_format = "PNG"
    s.color_mode = "BW"
    s.color_depth = "16"
    s.compression = 30


def add_camera(sc, ortho_scale, res):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam_data.clip_start = 0.01
    cam_data.clip_end = 1000.0
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0.0, -CAM_DIST, 0.0)
    cam.rotation_euler = (math.radians(90.0), 0.0, 0.0)  # looks along +Y, Z up
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    return cam


def add_sun(sc):
    ld = bpy.data.lights.new("key", type="SUN")
    ld.energy = SUN_STRENGTH
    ld.color = (1.0, 1.0, 1.0)
    ld.use_shadow = False
    ld.angle = 0.0
    sun = bpy.data.objects.new("key", ld)
    d = -LIGHT_FROM.normalized()  # travel direction
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(sun)
    return sun


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def bounding_sphere(meshes):
    pts = []
    for o in meshes:
        M = o.matrix_world
        pts.extend(M @ v.co for v in o.data.vertices)
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) * 0.5
    r = max((p - c).length for p in pts)
    return c, r, lo, hi


def find_base_image(mat):
    if not mat or not mat.use_nodes:
        return None, None
    nt = mat.node_tree
    principled = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if principled:
        link = next((l for l in nt.links if l.to_node == principled and l.to_socket.name == "Base Color"), None)
        if link and link.from_node.type == "TEX_IMAGE":
            return link.from_node.image, None
    img = next((n.image for n in nt.nodes if n.type == "TEX_IMAGE" and n.image), None)
    flat = tuple(principled.inputs["Base Color"].default_value)[:3] if principled else (0.8, 0.8, 0.8)
    return img, flat


def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emis = nt.nodes.new("ShaderNodeEmission")
    emis.inputs["Strength"].default_value = 1.0
    nt.links.new(emis.outputs[0], out.inputs["Surface"])
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    mat.use_backface_culling = False
    return mat, nt, emis


def make_toon_material(name, image, flat_rgb):
    mat, nt, emis = new_material(f"toon_{name}")
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.interpolation = "Linear"
        tex.extension = "REPEAT"
        base_out = tex.outputs["Color"]
    else:
        rgb = nt.nodes.new("ShaderNodeRGB")
        rgb.outputs[0].default_value = (*flat_rgb, 1.0)
        base_out = rgb.outputs[0]

    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.mode = "HSV"
    nt.links.new(base_out, sep.inputs["Color"])

    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    diff.inputs["Roughness"].default_value = 0.0
    s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    nt.links.new(diff.outputs[0], s2rgb.inputs[0])
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    nt.links.new(s2rgb.outputs["Color"], bw.inputs["Color"])

    def ramp(values):
        r = nt.nodes.new("ShaderNodeValToRGB")
        cr = r.color_ramp
        cr.interpolation = "CONSTANT"
        while len(cr.elements) > 1:
            cr.elements.remove(cr.elements[-1])
        cr.elements[0].position = 0.0
        cr.elements[0].color = (values[0],) * 3 + (1.0,)
        e = cr.elements.new(SHADOW_END)
        e.color = (values[1],) * 3 + (1.0,)
        e = cr.elements.new(HIGH_START)
        e.color = (values[2],) * 3 + (1.0,)
        nt.links.new(bw.outputs["Val"], r.inputs["Fac"])
        r2bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(r.outputs["Color"], r2bw.inputs["Color"])
        return r2bw.outputs["Val"]

    v_mul = ramp((SHADOW_V, 1.0, 1.0))
    v_add = ramp((0.0, 0.0, HIGH_VADD))
    s_mul = ramp((SHADOW_S, 1.0, HIGH_S))

    def math_node(op, a, b, clamp=False):
        m = nt.nodes.new("ShaderNodeMath")
        m.operation = op
        m.use_clamp = clamp
        for i, x in enumerate((a, b)):
            if isinstance(x, (int, float)):
                m.inputs[i].default_value = x
            else:
                nt.links.new(x, m.inputs[i])
        return m.outputs[0]

    v1 = math_node("MULTIPLY", sep.outputs["Blue"], v_mul)               # V
    v2 = math_node("ADD", v1, v_add, clamp=True)
    s1 = math_node("MULTIPLY", sep.outputs["Green"], s_mul, clamp=True)  # S
    comb = nt.nodes.new("ShaderNodeCombineColor")
    comb.mode = "HSV"
    nt.links.new(sep.outputs["Red"], comb.inputs["Red"])
    nt.links.new(s1, comb.inputs["Green"])
    nt.links.new(v2, comb.inputs["Blue"])
    nt.links.new(comb.outputs["Color"], emis.inputs["Color"])
    return mat


def make_depth_material(radius):
    """Emits the view depth normalised to [0,1] over [CAM_DIST-2R, CAM_DIST+2R] (the sphere sits in the middle)."""
    mat, nt, emis = new_material("depth_override")
    cam = nt.nodes.new("ShaderNodeCameraData")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.data_type = "FLOAT"
    mr.clamp = True
    mr.inputs["From Min"].default_value = CAM_DIST - 2.0 * radius
    mr.inputs["From Max"].default_value = CAM_DIST + 2.0 * radius
    mr.inputs["To Min"].default_value = 0.0
    mr.inputs["To Max"].default_value = 1.0
    nt.links.new(cam.outputs["View Z Depth"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], emis.inputs["Color"])
    return mat


def pose_matrix(pose):
    yaw = Matrix.Rotation(math.radians(pose.get("yaw", 0)), 4, "Z")
    pitch = Matrix.Rotation(math.radians(pose.get("pitch", 0)), 4, "X")
    roll = Matrix.Rotation(math.radians(pose.get("roll", 0)), 4, "Y")
    return pitch @ roll @ yaw


def build_piece(sc, glb_path, pose, tilt_deg):
    objs = import_glb(glb_path)
    meshes = [o for o in objs if o.type == "MESH"]
    if not meshes:
        raise SystemExit(f"no mesh in {glb_path}")
    for o in meshes:  # bake world transforms, drop the importer hierarchy
        M = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = M
    for o in objs:
        if o.type != "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    c, r, lo, hi = bounding_sphere(meshes)
    P = pose_matrix(pose)
    tilt = bpy.data.objects.new("tilt", None)
    spin = bpy.data.objects.new("spin", None)
    sc.collection.objects.link(tilt)
    sc.collection.objects.link(spin)
    spin.parent = tilt
    tilt.rotation_euler = (math.radians(tilt_deg), 0.0, 0.0)
    ntri = 0
    for o in meshes:
        o.matrix_world = P @ Matrix.Translation(-c) @ o.matrix_world
        o.parent = spin
        o.matrix_parent_inverse = Matrix.Identity(4)
        ntri += sum(len(p.vertices) - 2 for p in o.data.polygons)
        for slot in o.material_slots:
            img, flat = find_base_image(slot.material)
            slot.material = make_toon_material(o.name + "_" + (slot.material.name if slot.material else "none"),
                                               img, flat or (0.8, 0.8, 0.8))
        for p in o.data.polygons:
            p.use_smooth = True
    return spin, c, r, (lo, hi), ntri, len(meshes)


def render_job(args, name, job):
    sc = reset_scene()
    glb = os.path.join(MESHY, job["glb"] + ".glb")
    spin, c, r, (lo, hi), ntri, nmesh = build_piece(sc, glb, POSE.get(job["glb"], {}), job["tilt"])
    ortho = 2.0 * r / FILL
    add_camera(sc, ortho, args.res)
    add_sun(sc)
    sc.eevee.taa_render_samples = args.samples
    depth_mat = make_depth_material(r)
    vl = sc.view_layers[0]
    out_dir = os.path.join(args.out, name)
    os.makedirs(os.path.join(out_dir, "depth"), exist_ok=True)
    n = job["frames"]
    idx = range(n) if args.only_frame < 0 else [args.only_frame]
    for i in idx:
        spin.rotation_euler = (0.0, 0.0, -2.0 * math.pi * i / n)
        vl.material_override = None
        set_output_colour(sc)
        sc.render.filepath = os.path.join(out_dir, f"{i:02d}.png")
        bpy.ops.render.render(write_still=True)
        if not args.no_depth:
            vl.material_override = depth_mat
            set_output_depth(sc)
            sc.render.filepath = os.path.join(out_dir, "depth", f"{i:02d}.png")
            bpy.ops.render.render(write_still=True)
    rec = {
        "job": name, "glb": os.path.relpath(glb, ROOT), "glb_sha256": sha256(glb), "meshes": nmesh, "triangles": ntri,
        "bbox_min": [round(v, 5) for v in lo], "bbox_max": [round(v, 5) for v in hi],
        "sphere_centre": [round(v, 5) for v in c], "sphere_radius": round(r, 5), "ortho_scale": round(ortho, 5),
        "fill": FILL, "frames": n, "tilt_deg": job["tilt"], "pose": POSE.get(job["glb"], {}), "render_px": args.res,
        "samples": args.samples, "depth_range": [CAM_DIST - 2 * r, CAM_DIST + 2 * r],
        "blender": bpy.app.version_string, "engine": sc.render.engine,
        "shading": {"sun_strength": SUN_STRENGTH, "light_from": [round(v, 3) for v in LIGHT_FROM.normalized()],
                    "ramp": {"shadow_end": SHADOW_END, "high_start": HIGH_START, "shadow_v": SHADOW_V,
                             "shadow_s": SHADOW_S, "high_v_add": HIGH_VADD, "high_s": HIGH_S},
                    "view_transform": "Standard", "world": "black, no ambient", "shadows": False, "motion_blur": False},
    }
    with open(os.path.join(out_dir, "render.json"), "w") as f:
        json.dump(rec, f, indent=1)
    print("RENDERED", json.dumps(rec))


def calibrate(args):
    """White diffuse plane facing the key: the rendered value of a fully lit surface (target 1.0)."""
    sc = reset_scene()
    add_camera(sc, 2.0, 32)
    add_sun(sc)
    bpy.ops.mesh.primitive_plane_add(size=4)
    plane = bpy.context.active_object
    n = LIGHT_FROM.normalized()
    plane.rotation_euler = n.to_track_quat("Z", "Y").to_euler()
    mat, nt, emis = new_material("cal")
    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2 = nt.nodes.new("ShaderNodeShaderToRGB")
    nt.links.new(diff.outputs[0], s2.inputs[0])
    nt.links.new(s2.outputs["Color"], emis.inputs["Color"])
    plane.data.materials.append(mat)
    sc.eevee.taa_render_samples = 4
    path = os.path.join(args.out, "_calibrate.png")
    os.makedirs(args.out, exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    px = list(img.pixels)
    w = img.size[0]
    i = (16 * w + 16) * 4
    print("CALIBRATE centre pixel (sRGB-encoded PNG):", px[i:i + 4])


def main():
    global SUN_STRENGTH
    args = parse_args()
    if args.sun is not None:
        SUN_STRENGTH = args.sun
    print("Blender", bpy.app.version_string)
    if args.calibrate:
        calibrate(args)
        return
    for name in [j for j in args.jobs.split(",") if j]:
        if name not in JOBS:
            raise SystemExit(f"unknown job {name}; jobs: {list(JOBS)}")
        render_job(args, name, JOBS[name])


if __name__ == "__main__":
    main()
