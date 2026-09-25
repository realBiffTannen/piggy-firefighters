"""Compose the 3D win-rung sheets from the Blender turntable frames (lane E).

    python3 art-src/3d/compose_sheets.py [--frames art-src/3d/renders/frames] [--jobs coin,coins] [--no-static]

Reads `<frames>/<job>/NN.png` (RGBA colour at 2x) + `<frames>/<job>/depth/NN.png` (16-bit view depth) written by
`render_turntables.py`, draws the ink outline (`#3B2313`: the outer contour is the alpha dilated by 2 px at 128, the
interior lines come from view-depth discontinuities deeper than DEPTH_JUMP * R), downsamples 2x with premultiplied
LANCZOS, packs 8 columns of 128 px cells and writes:

  static/assets/3d/winrungs/pieces/<piece>_sheet.webp + <piece>.json   (24 frames, 1024x384; the 2D pieces' schema)
  static/assets/3d/winrungs/coins/coin_sheet.webp + coin_sheet.json     (32 frames, 1024x512; pixi spritesheet, "coin")
  art-src/3d/renders/contact.png            blind test: 160 px + 96 / 48 px reductions of frame 0, light + dark ground
  art-src/3d/renders/compare_2d_vs_3d.png   frame 0 of the 2D flip sheet next to frame 0 of the 3D turntable
  art-src/3d/renders/source-record.json     Blender version, render + outline settings, GLB sha256 + Meshy task per piece
"""
import argparse
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "tools", "art"))
from art_common import contact_sheet, save_webp  # noqa: E402

STATIC = os.path.join(ROOT, "apps", "piggy_firefighters", "static", "assets")
OUT_3D = os.path.join(STATIC, "3d", "winrungs")
OUT_2D = os.path.join(STATIC, "winrungs")
MESHY = os.path.join(ROOT, "art-src", "meshy")
RENDERS = os.path.join(HERE, "renders")

PIECES = ["coin", "silver_coin", "helmet", "nozzle", "badge", "boot", "hydrant_cap"]
CELL, COLS, FPS = 128, 8, 24
INK = (0x3B, 0x23, 0x13)
OUTER_PX = 2.0        # outer contour width at 128 px
INNER_PX = 1.4        # interior line width at 128 px
DEPTH_JUMP = 0.06     # interior line where the view depth jumps by more than this * R between neighbours
MAX_BYTES = 130_000


def disc(r):
    n = int(math.ceil(r))
    y, x = np.mgrid[-n:n + 1, -n:n + 1]
    return (x * x + y * y) <= r * r + 1e-6


def load_frame(frames_dir, job, i):
    col = np.asarray(Image.open(os.path.join(frames_dir, job, f"{i:02d}.png")).convert("RGBA")).astype(np.float32)
    dp = os.path.join(frames_dir, job, "depth", f"{i:02d}.png")
    depth = np.asarray(Image.open(dp)).astype(np.float32) / 65535.0 if os.path.exists(dp) else None
    return col, depth


def ink_outline(col, depth, scale):
    """col: HxWx4 float 0..255 straight alpha; depth: HxW in [0,1] (4R range) or None. Returns HxWx4 uint8."""
    h, w, _ = col.shape
    rgb = col[..., :3] / 255.0
    a = col[..., 3] / 255.0
    ink = np.array(INK, np.float32) / 255.0

    # outer contour: the alpha dilated by OUTER_PX (grey dilation keeps the AA of the outer edge); colour goes OVER it
    outer = ndi.grey_dilation(a, footprint=disc(OUTER_PX * scale))
    out_rgb = rgb * a[..., None] + ink * (outer * (1.0 - a))[..., None]
    out_a = a + outer * (1.0 - a)

    # interior lines: view-depth discontinuities between pixels that are both solid
    if depth is not None:
        solid = a > 0.5
        tau = DEPTH_JUMP / 4.0  # depth is normalised to 4R
        jump = np.zeros_like(depth, dtype=bool)
        for dy, dx in ((0, 1), (1, 0), (1, 1), (1, -1)):
            d2 = np.roll(np.roll(depth, -dy, 0), -dx, 1)
            s2 = np.roll(np.roll(solid, -dy, 0), -dx, 1)
            both = solid & s2
            e = both & (np.abs(depth - d2) > tau)
            jump |= e
            jump |= np.roll(np.roll(e, dy, 0), dx, 1)
        line = ndi.grey_dilation(jump.astype(np.float32), footprint=disc(max(0.0, INNER_PX * scale / 2.0 - 0.5)))
        line = ndi.gaussian_filter(line, 0.35 * scale)
        line = np.clip(line, 0, 1) * (out_a > 0.05)
        out_rgb = out_rgb * (1.0 - line[..., None]) + ink * line[..., None]
        out_a = np.maximum(out_a, line)

    # un-premultiply for the straight-alpha PNG/webp pipeline
    safe = np.where(out_a > 1e-4, out_a, 1.0)[..., None]
    straight = np.clip(out_rgb / safe, 0, 1)
    arr = np.concatenate([straight, out_a[..., None]], axis=2)
    return (np.clip(arr, 0, 1) * 255.0 + 0.5).astype(np.uint8)


def downsample(arr, cell):
    im = Image.fromarray(arr, "RGBA")
    if im.width == cell:
        return im
    return im.convert("RGBa").resize((cell, cell), Image.LANCZOS).convert("RGBA")


def compose_job(frames_dir, job, n):
    frames = []
    for i in range(n):
        col, depth = load_frame(frames_dir, job, i)
        scale = col.shape[0] / CELL
        frames.append(downsample(ink_outline(col, depth, scale), CELL))
    return frames


def pack(frames, cols=COLS, cell=CELL):
    rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (cols * cell, rows * cell))
    for i, fr in enumerate(frames):
        sheet.alpha_composite(fr, ((i % cols) * cell, (i // cols) * cell))
    return sheet


def save_within_budget(sheet, path):
    """Lossy webp at q90; when that misses MAX_BYTES, step the quality down (85, 80, 75) until it fits."""
    for q in (90, 85, 80, 75):
        n = save_webp(sheet, path, quality=q)
        if n <= MAX_BYTES:
            return n, q
    return n, q


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def meshy_task(piece):
    p = os.path.join(MESHY, f"{piece}.json")
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f).get("id")
    return None


def render_record(frames_dir, job):
    p = os.path.join(frames_dir, job, "render.json")
    with open(p) as f:
        return json.load(f)


def frame0_2d(piece):
    p = os.path.join(OUT_2D, "pieces", f"{piece}_sheet.webp")
    if not os.path.exists(p):
        return None
    return Image.open(p).convert("RGBA").crop((0, 0, CELL, CELL))


def compare_sheet(pairs, out):
    """2D frame 0 next to 3D frame 0 per piece, on a light and a dark ground."""
    n = len(pairs)
    tile = CELL + 8
    im = Image.new("RGBA", (n * tile, 4 * tile), (0, 0, 0, 0))
    for i, (name, im2d, im3d) in enumerate(pairs):
        rows = [((244, 240, 232), im2d), ((244, 240, 232), im3d), ((24, 28, 40), im2d), ((24, 28, 40), im3d)]
        for r, (bg, src) in enumerate(rows):
            cellim = Image.new("RGBA", (tile, tile), bg + (255,))
            if src is not None:
                cellim.alpha_composite(src, (4, 4))
            im.paste(cellim, (i * tile, r * tile))
    im.convert("RGB").save(out)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--frames", default=os.path.join(RENDERS, "frames"))
    ap.add_argument("--jobs", default=",".join(PIECES + ["coins"]))
    ap.add_argument("--out", default=OUT_3D, help="static output root (…/static/assets/3d/winrungs)")
    ap.add_argument("--renders", default=RENDERS, help="where contact.png / compare / source-record.json go")
    args = ap.parse_args()
    jobs = [j for j in args.jobs.split(",") if j]
    record = {"blender": None, "engine": None, "render": None, "outline": {
        "ink": "#%02X%02X%02X" % INK, "outer_px_at_128": OUTER_PX, "inner_px_at_128": INNER_PX,
        "interior": f"view-depth jump > {DEPTH_JUMP} * R between solid neighbours (4-neighbourhood + diagonals)",
        "method": "screen-space: alpha grey-dilation (outer) + depth-discontinuity lines, colour composited over ink"},
        "downsample": "2x premultiplied LANCZOS",
        "webp": f"lossy method 6, q90 stepped down to 85/80/75 only when a sheet exceeds {MAX_BYTES} B", "pieces": []}
    tiles, pairs = [], []
    for job in jobs:
        rec = render_record(args.frames, job)
        record["blender"] = rec["blender"]
        record["engine"] = rec["engine"]
        record["render"] = {"px": rec["render_px"], "samples": rec["samples"], "camera": "orthographic, sphere = "
                            f"{rec['fill']} of the cell", "shading": rec["shading"]}
        n = rec["frames"]
        frames = compose_job(args.frames, job, n)
        sheet = pack(frames)
        piece = rec["glb"].split("/")[-1][:-4]
        task = meshy_task(piece)
        if job == "coins":
            out_dir = os.path.join(args.out, "coins")
            os.makedirs(out_dir, exist_ok=True)
            nbytes, q = save_within_budget(sheet, os.path.join(out_dir, "coin_sheet.webp"))
            names = [f"pff_coin_{i:02d}.png" for i in range(n)]
            meta = {"frames": {nm: {"frame": {"x": (i % COLS) * CELL, "y": (i // COLS) * CELL, "w": CELL, "h": CELL},
                                    "rotated": False, "trimmed": False,
                                    "spriteSourceSize": {"x": 0, "y": 0, "w": CELL, "h": CELL},
                                    "sourceSize": {"w": CELL, "h": CELL}} for i, nm in enumerate(names)},
                    "animations": {"coin": names},
                    "meta": {"app": "art-src/3d/compose_sheets.py coins", "version": "1.0", "image": "coin_sheet.webp",
                             "format": "RGBA8888", "size": {"w": sheet.width, "h": sheet.height}, "scale": "1"}}
            write_json(os.path.join(out_dir, "coin_sheet.json"), meta)
            rel_out = "static/assets/3d/winrungs/coins/coin_sheet.webp"
        else:
            out_dir = os.path.join(args.out, "pieces")
            os.makedirs(out_dir, exist_ok=True)
            nbytes, q = save_within_budget(sheet, os.path.join(out_dir, f"{piece}_sheet.webp"))
            meta = {"sheet": f"{piece}_sheet.webp", "w": sheet.width, "h": sheet.height, "bytes": nbytes, "frames": n,
                    "fps": FPS, "cell": CELL, "cols": COLS, "rows": sheet.height // CELL, "pivot": [0.5, 0.5],
                    "loop": True, "route": f"3D turntable: Meshy image-to-3D {task} + Blender toon"}
            write_json(os.path.join(out_dir, f"{piece}.json"), meta)
            rel_out = f"static/assets/3d/winrungs/pieces/{piece}_sheet.webp"
            tiles.append((piece, frames[0]))
            pairs.append((piece, frame0_2d(piece), frames[0]))
        flag = "" if nbytes <= MAX_BYTES else "  ** OVER 130 KB **"
        print(f"{rel_out} {sheet.size} {n} frames {nbytes} B q{q}{flag}")
        record["pieces"].append({"job": job, "piece": piece, "glb": rec["glb"], "glb_sha256": rec["glb_sha256"],
                                 "meshy_task": task, "triangles": rec["triangles"], "frames": n,
                                 "tilt_deg": rec["tilt_deg"], "pose": rec["pose"],
                                 "sphere_radius": rec["sphere_radius"], "ortho_scale": rec["ortho_scale"],
                                 "sheet": rel_out, "sheet_size": [sheet.width, sheet.height], "bytes": nbytes,
                                 "webp_quality": q, "within_budget": nbytes <= MAX_BYTES})
    os.makedirs(args.renders, exist_ok=True)
    if tiles:
        print("blind-test sheet ->", contact_sheet(tiles, os.path.join(args.renders, "contact.png"), cell=160,
                                                   small=(96, 48)))
        print("compare ->", compare_sheet(pairs, os.path.join(args.renders, "compare_2d_vs_3d.png")))
    write_json(os.path.join(args.renders, "source-record.json"), record)


if __name__ == "__main__":
    main()
