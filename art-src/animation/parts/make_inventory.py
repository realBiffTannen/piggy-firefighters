#!/usr/bin/env python3
"""Write art-src/animation/parts/INVENTORY.md from the files on disk + each rig's registration.json (free, atomic)."""
import json
import os
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RIGS = ["pf_chief", "pf_rookie", "pf_dog", "pf_rescued"]
DESC = {
    "master": "full character, neutral three-quarter pose, feet on the common feet line (integer shift of the raw master; immutable input)",
    "body_no_head_no_arms": "torso + tail WITHOUT legs (r2); neck stub and shoulder caps painted; chief/rookie: ends at the belt (coat_tails is its own layer)",
    "body_no_head_no_legs": "torso + collar; neck, shoulder/hip sockets and rump painted (registered redraw r2 of the edit; see open items)",
    "head_no_helmet": "head with face, ears (moustache on the chief); crown painted where the helmet was (registered)",
    "head": "head with face and ears, neck stub (registered)",
    "head_blank": "head base without eyes/brows/mouth/ears (snout kept) for layered faces (registered)",
    "helmet_only": "complete helmet with blank brass plate; navy lining painted under the brim (registered); use when the helmet leaves the head",
    "helmet_front": "layer-ready helmet cut from the MASTER's own pixels (r2): no seam at rest, transparent where the head shows",
    "arms_down": "both arms on one layer, shoulder caps painted (registered)",
    "arm_right": "character's right arm = image-left, near side (split of arms_down)",
    "arm_left": "character's left arm = image-right, far side (split of arms_down)",
    "arms_raised": "both arms raised (cheer), each shoulder cap on the down arm's shoulder",
    "arm_right_raised": "raised right arm (split of arms_raised; chief r2: rotated about the shoulder so the fingertips stay on the canvas)",
    "arm_left_raised": "raised left arm (split of arms_raised; chief r2: rotated about the shoulder so the fingertips stay on the canvas)",
    "legs": "leg_right + leg_left on one layer (r2: cut from the registered body, soles on y 1440; dog: the four legs on one layer)",
    "leg_right": "image-left leg = character's right (near), cut from the registered body, soles on y 1440, hidden top extended under the hem",
    "leg_left": "image-right leg = character's left (far), cut from the registered body, soles on y 1440, hidden top extended under the hem",
    "leg_hind_right": "Ember's near hind leg (image-left), one layer",
    "leg_hind_left": "Ember's far hind leg, partly behind the near front leg (hidden part not painted)",
    "leg_front_right": "Ember's near front leg, owns the outline it shares with the far hind leg",
    "leg_front_left": "Ember's far front leg (image-right), one layer",
    "coat_tails": "coat below the belt (belt middle to hem) cut from the registered body at master scale (r2); cut edge hides under the belt",
    "hands_sheet": "hand variants sheet (immutable input; see pieces/)",
    "face_sheet": "eyes / brows / mouths (+ moustache, ears) sheet (immutable input; see pieces/)",
    "props": "props sheet (immutable input; see pieces/)",
    "parts_sheet": "ears, tail, jaw, jawless head, tongue sheet (immutable input; see pieces/)",
    "wave_arm": "call-for-help wave arm x3 + wave hands x3 sheet (immutable input; see pieces/)",
    "slide_poses": "full-body slide / land / cheer pose sheet (immutable input; see pieces/)",
    "skin_grandma": "skin: grandma + ginger cat on her shoulder (registered full-figure costume edit; slots in skins/grandma/)",
    "skin_twins": "skin: twins, the second rides piggyback (registered full-figure costume edit; slots in skins/twins/)",
    "skin_dad": "skin: dad in a bathrobe (registered full-figure costume edit; slots in skins/dad/)",
    "skin_baby": "skin: mum with the baby in a front sling (registered full-figure costume edit; slots in skins/baby/)",
    "skin_teen": "skin: teen with headphones (registered full-figure costume edit; slots in skins/teen/)",
    "anchors.json": "measured anchor guidance (contract bones) + spine scale",
    "registration.json": "r2: fit per part, derived layers, fixed-grid piece records (cell, rule, dropped components, per-family scale)",
    "sheets.layout.json": "r2 layout of record: each sheet's cell rectangles, labels, cut rule and per-family scale_to_canvas",
    "derive.layout.json": "r2 parameters (read by eye) for the derived layers: belt band, leg seeds, skin slot overrides, helmet cut",
    "QA_reassembly": "NOT part of this delivery: written by another process; left untouched",
}
SLOT_DESC = {"head": "head slot", "body_no_head_no_arms": "body slot (extras stay here: cat, rider twin, sling, robe skirt)",
             "arm_right": "near arm slot", "arm_left": "far arm slot", "leg_right": "near leg slot (hidden top extended)",
             "leg_left": "far leg slot (hidden top extended)"}


def row(path, key=None):
    rel = os.path.relpath(path, HERE)
    b = os.path.getsize(path)
    if path.endswith(".png"):
        with Image.open(path) as im:
            dims = f"{im.width}x{im.height} {im.mode}"
    else:
        dims = "json"
    key = key or os.path.splitext(os.path.basename(path))[0]
    if key.startswith("master_"):
        key = "master"
    d = DESC.get(key) or DESC.get(os.path.basename(path), "")
    return f"| `{rel}` | {dims} | {max(1, b // 1024)} KB | {d} |"


def main():
    out = ["# Rig parts inventory (r2, generated by make_inventory.py)", "",
           "Common canvas 1024x1536 RGBA for every registered file (feet line y 1440, feet centre x 512); see "
           "REGISTRATION.md. Pieces under `pieces/` are trimmed cut-outs from the sheets at SHEET scale, cut on the fixed "
           "grid of `<rig>/sheets.layout.json`: multiply by the piece's `scale_to_canvas` (per family since r2, below and "
           "in registration.json) to match the canvas. Labelled contact sheets: `qa/art/parts/<rig>_pieces_r2.png` "
           "(pieces at 2x) and `qa/art/parts/<rig>_layers_r2.png` (canvas layers).", ""]
    for rig in RIGS:
        d = os.path.join(HERE, rig)
        if not os.path.isdir(d):
            continue
        reg = json.load(open(os.path.join(d, "registration.json")))
        out += [f"## {rig}", "", "| File | Pixels | Bytes | What it is |", "|---|---|---|---|"]
        for f in sorted(os.listdir(d)):
            p = os.path.join(d, f)
            if os.path.isfile(p) and not f.startswith(".tmp_"):
                out.append(row(p))
        sk = os.path.join(d, "skins")
        if os.path.isdir(sk):
            out += ["", f"Skin slots ({rig}/skins/<skin>/, same canvas, cut with the template slot masks):", "",
                    "| File | Pixels | Bytes | What it is |", "|---|---|---|---|"]
            for s in sorted(os.listdir(sk)):
                for f in sorted(os.listdir(os.path.join(sk, s))):
                    p = os.path.join(sk, s, f)
                    nm = os.path.splitext(f)[0]
                    out.append(row(p).rsplit("|", 2)[0] + f"| {s}: {SLOT_DESC.get(nm, '')} |")
        pd = os.path.join(d, "pieces")
        if os.path.isdir(pd):
            out += ["", f"Pieces ({rig}/pieces/):", "",
                    "| Piece | Pixels | From sheet (row, col) | Cut rule | Family | Scale to canvas |", "|---|---|---|---|---|---|"]
            owner = {}
            for sh, v in reg.get("pieces", {}).items():
                for nm, pv in v["pieces"].items():
                    owner[nm] = (sh, pv)
            for f in sorted(os.listdir(pd)):
                if f.startswith(".tmp_"):
                    continue
                with Image.open(os.path.join(pd, f)) as im:
                    w, h = im.width, im.height
                nm = os.path.splitext(f)[0]
                if nm not in owner:
                    note = "NOT part of this delivery (another process wrote it; lettered \"13\")" if nm == "shield_13" \
                        else "not in registration.json"
                    out.append(f"| `{nm}` | {w}x{h} | {note} | | | |")
                    continue
                sh, pv = owner[nm]
                rule = pv["rule"] + (f" (dropped {len(pv['dropped'])})" if pv["dropped"] else "")
                out.append(f"| `{nm}` | {w}x{h} | {sh} (r{pv['grid'][0]}, c{pv['grid'][1]}) | {rule} | "
                           f"{pv['scale_family']} | {pv['scale_to_canvas']} |")
        out.append("")
    path = os.path.join(HERE, "INVENTORY.md")
    fd, tmp = tempfile.mkstemp(dir=HERE, prefix=".tmp_", suffix=".md")
    with os.fdopen(fd, "w") as fh:
        fh.write("\n".join(out) + "\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
