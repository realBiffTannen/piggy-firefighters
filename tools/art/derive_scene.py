#!/usr/bin/env python3
"""Derive the PIGGY FIREFIGHTERS scene textures from accepted gpt-image paintings (art-src/generated/**, never
modified). Subcommands (default: all):

  env        environment/<mood>_landscape.webp 2039x1000 + <mood>_portrait.webp 1242x2208, cover-crop, q88
             (moods: base = Station 13 truck bay at dusk, backdraft, rescue = the block at night, inferno = red sky;
             a mood without its own painting may be a relight of another: --relight backdraft=base:backdraft)
  ambient    ambient/plate_<mood>_landscape.webp 1536x1024 + plate_<mood>_portrait.webp 1024x1536, q80;
             the whole ambient/ dir must stay <= 1.5 MB (exit 1 over budget)
  frame      ui_scene/board_frame.webp 1497x946 (+ ui_scene/frame.meta.json): the generated truck-panel frame is
             warped (separable piecewise-linear, premultiplied cubic) so its outer edge and inner opening land exactly
             on the family's sliced geometry OPEN {x0:212, x1:1279, y0:178, y1:761}; the top rail (repeated WITHOUT
             mirroring at runtime from TOP_TILE [340,36,487,154]) is rebuilt as an exact whole-period tile
  backplate  ui_scene/cell_backplate.webp 963x645 (the dark reel field; drawn bottom-centre at 963:645)
  shutter    splash/shutter_slats_tile.webp 1024x512 (whole slats, seamless vertical repeat, autocorrelation period)
             + splash/shutter_bottom_bar.webp 1024x115 (the bay door's bottom beam, ends kept, middle repeated)

Default sources (then art-src/generated/scene.sources.json when present, then --map <json>
{"plate_base_16_9": "b3/plate_base_16_9_r2", ...}):
  scene/plate_<mood>_16_9, scene/plate_<mood>_portrait, scene/board_frame, scene/cell_backplate, scene/shutter
Missing sources are PENDING and skipped. --out <assets root> redirects every write (tests / staging).
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from art_common import (GEN, clean_specks, cover, exists_src, fit_into, load_rgb, load_rgba, out_root, period,  # noqa: E402
                        prepare_out, rel, relight, save_webp, src_path, warp_sep, write_json)

SCENE_MAP_FILE = os.path.join(GEN, "scene.sources.json")  # accepted redraws (e.g. board_frame -> scene/board_frame_r2)
FRAME_DIR = "ui_scene"  # board frame, its meta and the cell backplate live with the other scene UI sprites

LAND, PORT = (2039, 1000), (1242, 2208)
PLATE_LAND, PLATE_PORT = (1536, 1024), (1024, 1536)
AMBIENT_BUDGET = int(1.5 * 1024 * 1024)
MOODS = ("base", "backdraft", "rescue", "inferno")
# relight presets (derive_scene.relight in the family): a mood derived from another plate without a paid call
RELIGHT = {
    "backdraft": dict(mul=(1.28, 0.98, 0.70), gamma=0.95, add=(0.07, 0.025, 0.0), sat=1.12, mix=0.85),
    "night": dict(mul=(0.55, 0.66, 1.02), gamma=1.18, mix=0.9),
    "inferno": dict(mul=(1.30, 0.80, 0.62), gamma=1.05, add=(0.10, 0.02, 0.0), sat=1.15, mix=0.9),
}
# the family's board-frame geometry (art px of the 1497x946 painting; BoardFrame.svelte slices these)
FW, FH = 1497, 946
OPEN = {"x0": 212, "x1": 1279, "y0": 178, "y1": 761}
TOP_TILE = (340, 36, 487, 154)  # x, y, w, h - repeated WITHOUT mirroring
CORNER_TL_W, CORNER_TR_X = 272, 1225
BACKPLATE = (963, 645)
SLATS, BAR = (1024, 512), (1024, 115)


def default_sources():
    m = {"board_frame": "scene/board_frame", "cell_backplate": "scene/cell_backplate", "shutter": "scene/shutter"}
    for mood in MOODS:
        m[f"plate_{mood}_16_9"] = f"scene/plate_{mood}_16_9"
        m[f"plate_{mood}_portrait"] = f"scene/plate_{mood}_portrait"
    return m


def parse_relights(items):
    out = {}
    for it in items or []:
        mood, _, rest = it.partition("=")
        src, _, preset = rest.partition(":")
        if not (mood and src and preset in RELIGHT):
            raise SystemExit(f"--relight takes mood=source_mood:preset ({sorted(RELIGHT)}), got {it}")
        out[mood] = (src, preset)
    return out


def plate(srcs, relights, mood, orient):
    """The mood's own painting, or a relight of another mood's painting. Returns (PIL RGB, provenance) or None."""
    key = f"plate_{mood}_{orient}"
    if exists_src(srcs.get(key, "")):
        return load_rgb(srcs[key]), rel(src_path(srcs[key]))
    if mood in relights:
        smood, preset = relights[mood]
        skey = f"plate_{smood}_{orient}"
        if exists_src(srcs.get(skey, "")):
            return relight(load_rgb(srcs[skey]), **RELIGHT[preset]), f"relight:{preset} of {rel(src_path(srcs[skey]))}"
    return None


def cmd_env(srcs, root, relights, moods, pending, land=LAND, port=PORT):
    out = prepare_out(os.path.join(root, "environment"))
    for mood in moods:
        for orient, size, name in (("16_9", land, "landscape"), ("portrait", port, "portrait")):
            got = plate(srcs, relights, mood, orient)
            if not got:
                pending.append(f"plate_{mood}_{orient}")
                continue
            im = cover(got[0], size)
            n = save_webp(im, os.path.join(out, f"{mood}_{name}.webp"), quality=88)
            print(f"environment/{mood}_{name}.webp {im.size} {n} B <- {got[1]}")


def cmd_ambient(srcs, root, relights, moods, pending):
    out = prepare_out(os.path.join(root, "ambient"))
    for mood in moods:
        for orient, size, name in (("16_9", PLATE_LAND, "landscape"), ("portrait", PLATE_PORT, "portrait")):
            got = plate(srcs, relights, mood, orient)
            if not got:
                pending.append(f"ambient plate_{mood}_{orient}")
                continue
            im = cover(got[0], size)
            n = save_webp(im, os.path.join(out, f"plate_{mood}_{name}.webp"), quality=80)
            print(f"ambient/plate_{mood}_{name}.webp {im.size} {n} B <- {got[1]}")
    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    print(f"ambient/ total {total / 1048576:.2f} MB (budget {AMBIENT_BUDGET / 1048576:.1f} MB)")
    if total > AMBIENT_BUDGET:
        raise SystemExit("ambient/ over budget")


def frame_edges(alpha, thr=128):
    """Outer box and inner opening of a frame mask (end-exclusive), walking out from the centre."""
    m = alpha >= thr
    ys, xs = np.where(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
    row, col = m[cy], m[:, cx]
    if row[cx] or col[cy]:
        raise SystemExit("board frame: the centre is not transparent (the opening must be genuinely clear)")
    ox0 = cx - int(np.argmax(row[:cx][::-1]))
    ox1 = cx + int(np.argmax(row[cx:]))
    oy0 = cy - int(np.argmax(col[:cy][::-1]))
    oy1 = cy + int(np.argmax(col[cy:]))
    return (int(x0), ox0, ox1, int(x1)), (int(y0), oy0, oy1, int(y1))


def rebuild_rail(fr, lo=40):
    """Make the unmirrored top-rail repeat seamless: measure the rail's period, cut k whole periods starting at the
    tile's own x, resample them to exactly TOP_TILE w, and lay that tile between the corners phase-locked to x=340."""
    x0t, y0t, wt, ht = TOP_TILE
    band = fr[y0t:y0t + ht].astype(np.float32)
    lum = (band[:, :, :3].mean(axis=2) * (band[:, :, 3] / 255.0))
    prof = lum[:, CORNER_TL_W:CORNER_TR_X].mean(axis=0)
    p = period(prof, lo, min(wt, len(prof) // 2))
    k = max(1, round(wt / p))
    seg = band[:, x0t:x0t + k * p]
    tile = np.asarray(Image.fromarray(np.clip(seg, 0, 255).astype(np.uint8), "RGBA").resize((wt, ht), Image.LANCZOS))
    out = fr.copy()
    x = x0t - wt * ((x0t - CORNER_TL_W) // wt + 1)
    while x < CORNER_TR_X:
        for i in range(wt):
            X = x + i
            if CORNER_TL_W <= X < CORNER_TR_X:
                out[y0t:y0t + ht, X] = tile[:, i]
        x += wt
    return out, {"rail_period_px": int(p), "periods_per_tile": int(k), "stretch": round(wt / (k * p), 4)}


def inner_opening(arr):
    a = arr[:, :, 3]
    h, w = a.shape
    cy, cx = h // 2, w // 2
    row, col = a[cy, :], a[:, cx]
    left = np.argmax(row[:cx][::-1] > 20)
    right = np.argmax(row[cx:] > 20)
    top = np.argmax(col[:cy][::-1] > 20)
    bot = np.argmax(col[cy:] > 20)
    return {"x0": round(float(cx - left) / w, 4), "x1": round(float(cx + right) / w, 4),
            "y0": round(float(cy - top) / h, 4), "y1": round(float(cy + bot) / h, 4)}


def cmd_frame(srcs, root, rail, pending):
    if not exists_src(srcs.get("board_frame", "")):
        pending.append("board_frame")
        return
    arr = np.array(clean_specks(Image.fromarray(load_rgba(srcs["board_frame"]), "RGBA")))  # specks shift the edges
    (sx0, sox0, sox1, sx1), (sy0, soy0, soy1, sy1) = frame_edges(arr[:, :, 3])
    fr = warp_sep(arr, [sx0, sox0, sox1, sx1], [0, OPEN["x0"], OPEN["x1"], FW],
                  [sy0, soy0, soy1, sy1], [0, OPEN["y0"], OPEN["y1"], FH], (FW, FH))
    info = {}
    if rail:
        fr, info = rebuild_rail(fr)
    out = prepare_out(os.path.join(root, FRAME_DIR))
    im = Image.fromarray(fr, "RGBA")
    n = save_webp(im, os.path.join(out, "board_frame.webp"), quality=92)
    meta = inner_opening(fr)
    meta.update({"w": FW, "h": FH, "open_px": OPEN, "top_tile": list(TOP_TILE), "source": rel(src_path(srcs["board_frame"])),
                 "source_edges": {"x": [sx0, sox0, sox1, sx1], "y": [sy0, soy0, soy1, sy1]}, **info,
                 "generated_by": "tools/art/derive_scene.py frame"})
    write_json(os.path.join(out, "frame.meta.json"), meta)
    print(f"{FRAME_DIR}/board_frame.webp {im.size} {n} B opening {inner_opening(fr)} {info}")


def cmd_backplate(srcs, root, pending):
    if not exists_src(srcs.get("cell_backplate", "")):
        pending.append("cell_backplate")
        return
    im = Image.fromarray(load_rgba(srcs["cell_backplate"]), "RGBA")
    im = im.crop(im.getbbox())
    W, H = BACKPLATE
    if abs(im.width / im.height - W / H) < 0.2:  # a flat field: a mild non-uniform resize beats a letterbox
        can = im.resize(BACKPLATE, Image.LANCZOS)
    else:
        can = fit_into(im, BACKPLATE, anchor="bottom")[0]
    out = prepare_out(os.path.join(root, FRAME_DIR))
    n = save_webp(can, os.path.join(out, "cell_backplate.webp"), quality=90)
    print(f"{FRAME_DIR}/cell_backplate.webp {can.size} {n} B (source aspect {im.width / im.height:.3f})")


def dark_runs(prof, thr):
    runs, start = [], None
    for y, v in enumerate(prof):
        if v < thr and start is None:
            start = y
        elif v >= thr and start is not None:
            runs.append((start, y))
            start = None
    if start is not None:
        runs.append((start, len(prof)))
    return runs


def cmd_shutter(srcs, root, pending, slats=6):
    if not exists_src(srcs.get("shutter", "")):
        pending.append("shutter")
        return
    im = load_rgb(srcs["shutter"])
    im = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS) if im.width != 1024 else im
    a = np.asarray(im).astype(np.float32)
    prof = a[:, 200:824].mean(axis=(1, 2))
    H = len(prof)
    body = prof[: int(H * 0.8)]
    per = period(body, 40, 200)
    thr = prof.min() + 0.35 * (np.median(prof) - prof.min())
    runs = dark_runs(prof, thr)
    # the slat gaps form a chain spaced ~per apart; the first dark run that breaks the chain is the beam's top edge
    chain_end, beam_top = None, None
    for i, (s, e) in enumerate(runs):
        if i and chain_end is not None:
            prev = runs[i - 1]
            if abs(((s + e) / 2 - (prev[0] + prev[1]) / 2) - per) > per * 0.25:
                beam_top = s
                break
        chain_end = e
    if beam_top is None:
        beam_top = chain_end if chain_end is not None else int(H * 0.88)
    g0 = runs[0][0] if runs else 0
    y0 = g0 + per // 2
    if y0 + slats * per > beam_top:
        raise SystemExit(f"shutter: need {slats} whole slats above the beam (period {per}, beam at {beam_top})")
    tile = im.crop((0, y0, 1024, y0 + slats * per)).resize(SLATS, Image.LANCZOS)
    out = prepare_out(os.path.join(root, "splash"))
    n1 = save_webp(tile, os.path.join(out, "shutter_slats_tile.webp"), quality=90)
    beam = im.crop((0, beam_top, 1024, H))
    small = beam.resize((max(1, round(1024 * BAR[1] / beam.height)), BAR[1]), Image.LANCZOS)
    end = round(small.width * 0.30)
    left, right = small.crop((0, 0, end, BAR[1])), small.crop((small.width - end, 0, small.width, BAR[1]))
    mid = small.crop((end, 0, small.width - end, BAR[1]))
    bar = Image.new("RGB", BAR)
    bar.paste(left, (0, 0))
    x, flip = end, False
    while x < 1024 - end and mid.width > 0:
        m = mid.transpose(Image.FLIP_LEFT_RIGHT) if flip else mid
        bar.paste(m.crop((0, 0, min(m.width, 1024 - end - x), BAR[1])), (x, 0))
        x += m.width
        flip = not flip
    bar.paste(right, (1024 - end, 0))
    n2 = save_webp(bar, os.path.join(out, "shutter_bottom_bar.webp"), quality=90)
    print(f"splash/shutter_slats_tile.webp {tile.size} {n1} B (period {per}px, rows {y0}-{y0 + slats * per}); "
          f"splash/shutter_bottom_bar.webp {bar.size} {n2} B (beam rows {beam_top}-{H})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="*", help="all (default) | env | ambient | frame | backplate | shutter")
    ap.add_argument("--map", default="")
    ap.add_argument("--moods", default=",".join(MOODS))
    ap.add_argument("--relight", action="append", default=[], help="mood=source_mood:preset (backdraft|night|inferno)")
    ap.add_argument("--no-rail-rebuild", action="store_true")
    ap.add_argument("--land", default="%dx%d" % LAND, help="environment landscape size (frontend placeholder: 2048x1024)")
    ap.add_argument("--port", default="%dx%d" % PORT, help="environment portrait size (frontend placeholder: 1080x1920)")
    ap.add_argument("--out", default="")
    ap.add_argument("--strict", action="store_true")
    a = ap.parse_args()
    srcs = default_sources()
    if os.path.isfile(SCENE_MAP_FILE):
        srcs.update(json.load(open(SCENE_MAP_FILE)))
    if a.map:
        srcs.update(json.load(open(a.map)))
    root = out_root(a.out)
    relights = parse_relights(a.relight)
    moods = [m for m in a.moods.split(",") if m]
    every = ["env", "ambient", "frame", "backplate", "shutter"]
    bad = [c for c in a.cmd if c not in every + ["all"]]
    if bad:
        ap.error(f"unknown subcommand(s) {bad}")
    cmds = every if (not a.cmd or "all" in a.cmd) else a.cmd
    pending = []
    for c in cmds:
        if c == "env":
            wh = lambda v: tuple(int(n) for n in v.lower().split("x"))  # noqa: E731
            cmd_env(srcs, root, relights, moods, pending, wh(a.land), wh(a.port))
        elif c == "ambient":
            cmd_ambient(srcs, root, relights, moods, pending)
        elif c == "frame":
            cmd_frame(srcs, root, not a.no_rail_rebuild, pending)
        elif c == "backplate":
            cmd_backplate(srcs, root, pending)
        elif c == "shutter":
            cmd_shutter(srcs, root, pending)
    if pending:
        print("PENDING (no accepted source yet):", ", ".join(pending))
    if a.strict and pending:
        sys.exit(1)


if __name__ == "__main__":
    main()
