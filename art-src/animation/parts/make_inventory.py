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
}
# r2.1: per-rig descriptions where a layer was made differently
RIG_DESC = {
    ("pf_rookie", "coat_tails"): "coat below the belt (the master's belt middle line to the hem) cut from the MASTER's own pixels (r2.1): at rest it is the master; the curly tail stays on the body",
    ("pf_rookie", "leg_right"): "image-left leg = character's right (near), the MASTER's own leg pixels below the hem (r2.1), soles on y 1440, hidden top extended under the coat",
    ("pf_rookie", "leg_left"): "image-right leg = character's left (far), the MASTER's own leg pixels below the hem (r2.1), soles on y 1440, hidden top extended under the coat",
    ("pf_rookie", "legs"): "leg_right + leg_left on one layer (r2.1: the master's own leg pixels)",
    ("pf_rookie", "body_no_head_no_arms"): "torso + tail WITHOUT legs, ends at the belt; r2.1: the master's tail replaces the redraw's, and what showed at rest outside the master silhouette (collar, shoulders) is trimmed and closed with the master's outline",
    ("pf_chief", "body_no_head_no_arms"): "torso + tail WITHOUT legs (r2), ends at the belt; r2.1: the far shoulder that showed outside the master silhouette is trimmed and closed with the master's outline",
    ("pf_chief", "arm_left"): "character's left arm = image-right, far side (split of arms_down); r2.1: the shoulder cap / outer sleeve that bulged out of the master silhouette is trimmed and closed with the master's outline",
    ("pf_rookie", "arm_left"): "character's left arm = image-right, far side (split of arms_down); r2.1: the outer sleeve that stood 12-16 px outside the master silhouette is trimmed and closed with the master's outline",
    ("pf_chief", "head_blank"): "head base without eyes/brows/mouth/ears (snout kept) for layered faces; r2.1: re-seated on head_no_helmet (nostrils and chin, chin y 581 vs 582)",
    ("pf_rescued", "head_blank"): "head base without eyes/brows/mouth/ears (snout kept) for layered faces; r2.1: moved up 5 px onto head.png's chin (573)",
    ("pf_dog", "helmet_front"): "layer-ready helmet cut from the MASTER's own pixels; r2.1: the whole outer ink ring, the brim tips and the grey shadow under the brim, antialias alpha copied from the master",
    ("pf_dog", "leg_front_left"): "Ember's far front leg (image-right), one layer; r2.1: its hidden top no longer shows beside the chest (clipped above y 1120 to what the body covers or the master shows)",
    ("pf_dog", "legs"): "the four legs on one layer (registered); r2.1: the far front leg's top clipped as in leg_front_left",
}
PIECE_NOTE = {
    ("pf_dog", "head_open_smile"): "the sheet cell as drawn: a WHOLE head with an open smiling mouth (tongue, lower lip, chin); a whole-head swap, never stacked with jaw; drawn apart from the master (spots, tuft)",
    ("pf_dog", "head_no_jaw"): "r2.1 DERIVED from head_open_smile (no paid call): lower lip, chin and tongue masked away, dark mouth interior kept, cut closed with outline ink; use with pieces/jaw; drawn apart from the master (spots, tuft)",
    ("pf_chief", "shield_13"): "r2.1 DERIVED: shield_plate lettered '13' by tools/art/letter_shield.py (ART_HERO.md); contract v1.3: not for the rig (runtime letters the blank plate)",
}
PIECE_NOTE_PREFIX = {
    ("pf_dog", "muzzle_"): "opaque muzzle overlay WITH its own nose (r2: mouth_*): register nose-on-nose with head_no_helmet (anchors.json guidance.muzzle_nose)",
    (None, "ear_"): "r2.1: named by the character's side (the image-left ear is ear_right); r2 had the two labels swapped",
}
SKIN_NOTE = {
    ("twins", "body_no_head_no_arms"): "twins: body slot; CARRIES THE RIDER TWIN (head, collar, hugging arms and fists, legs) and the tail; the space behind the lower twin's head is unpainted, so the head slot must stay at or near rest (anchors.json guidance.skin_joints)",
    ("twins", "head"): "twins: head slot = the lower twin's head; its neck sits ~75 px below the template's, see anchors.json guidance.skin_joints",
    ("twins", "arm_right"): "twins: near arm slot, r2.1 with the striped sleeve from the shoulder cap; the shoulder sits ~160 px below the template's",
    ("twins", "arm_left"): "twins: far arm slot (sleeve to fingertips); the shoulder sits ~150 px below the template's",
    ("dad", "head"): "dad: head slot; r2.1: the bare chest inside the robe's V (below y 586) moved to the body slot",
    ("dad", "body_no_head_no_arms"): "dad: body slot (robe skirt, shawl collar and, r2.1, the bare chest in the robe's V stay here); r2.1: the whole skin moved up 3 px so the soles sit on y 1440",
    ("grandma", "body_no_head_no_arms"): "grandma: body slot (the ginger cat, the dress skirt and the cardigan hem stay here)",
    ("baby", "body_no_head_no_arms"): "baby: body slot (the baby in the front sling and the sling stay here); r2.1: the skin moved down 1 px onto the feet line",
    ("teen", "body_no_head_no_arms"): "teen: body slot (the rolled hood stays here); r2.1: the skin moved down 1 px onto the feet line",
}
SLOT_DESC = {"head": "head slot", "body_no_head_no_arms": "body slot",
             "arm_right": "near arm slot", "arm_left": "far arm slot", "leg_right": "near leg slot (hidden top extended)",
             "leg_left": "far leg slot (hidden top extended)"}


def row(path, key=None, rig=None):
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
    d = RIG_DESC.get((rig, key)) or DESC.get(key) or DESC.get(os.path.basename(path), "")
    return f"| `{rel}` | {dims} | {max(1, b // 1024)} KB | {d} |"


def main():
    out = ["# Rig parts inventory (r2.1, generated by make_inventory.py)", "",
           "Common canvas 1024x1536 RGBA for every registered file (feet line y 1440, feet centre x 512); see "
           "REGISTRATION.md. Pieces under `pieces/` are trimmed cut-outs from the sheets at SHEET scale, cut on the fixed "
           "grid of `<rig>/sheets.layout.json`: multiply by the piece's `scale_to_canvas` (per family since r2, below and "
           "in registration.json) to match the canvas. r2.1 (verifier fixes, no paid call) is described in REGISTRATION.md.", "",
           "**Authoritative review sheets** (regenerated by build_parts.py with every r2.1 file): `qa/art/parts/<rig>_pieces_r2.png` "
           "(every piece at 2x with its caption), `qa/art/parts/<rig>_layers_r2.png` (every canvas layer), "
           "`qa/art/parts/<rig>_reassembly.png` (master vs the stacked layers) and `qa/art/parts/pf_rescued_skin_slots_r2.png` "
           "(tinted skin slots). The r1 sheets are renamed `qa/art/parts/<rig>_contact_r1_superseded.png` and the r1 chief "
           "QA image is `qa/art/parts/pf_chief_reassembly_r1.png`: history only, they show defects r2/r2.1 fixed. "
           "`qa/**/*.png` is git-ignored, so these reach the repository only by an explicit `git add -f` (REGISTRATION.md).", ""]
    for rig in RIGS:
        d = os.path.join(HERE, rig)
        if not os.path.isdir(d):
            continue
        reg = json.load(open(os.path.join(d, "registration.json")))
        out += [f"## {rig}", "", "| File | Pixels | Bytes | What it is |", "|---|---|---|---|"]
        for f in sorted(os.listdir(d)):
            p = os.path.join(d, f)
            if os.path.isfile(p) and not f.startswith(".tmp_"):
                out.append(row(p, rig=rig))
        sk = os.path.join(d, "skins")
        if os.path.isdir(sk):
            out += ["", f"Skin slots ({rig}/skins/<skin>/, same canvas, cut with the template slot masks):", "",
                    "| File | Pixels | Bytes | What it is |", "|---|---|---|---|"]
            for s in sorted(os.listdir(sk)):
                for f in sorted(os.listdir(os.path.join(sk, s))):
                    p = os.path.join(sk, s, f)
                    nm = os.path.splitext(f)[0]
                    out.append(row(p).rsplit("|", 2)[0] + f"| {SKIN_NOTE.get((s, nm)) or s + ': ' + SLOT_DESC.get(nm, '')} |")
        pd = os.path.join(d, "pieces")
        if os.path.isdir(pd):
            out += ["", f"Pieces ({rig}/pieces/):", "",
                    "| Piece | Pixels | From sheet (row, col) | Cut rule | Family | Scale to canvas | Note |",
                    "|---|---|---|---|---|---|---|"]
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
                    out.append(f"| `{nm}` | {w}x{h} | NOT IN registration.json | | | | |")
                    continue
                sh, pv = owner[nm]
                rule = pv["rule"] + (f" (dropped {len(pv['dropped'])})" if pv["dropped"] else "")
                note = PIECE_NOTE.get((rig, nm)) or next((v for (r_, pre), v in PIECE_NOTE_PREFIX.items()
                                                          if r_ in (None, rig) and nm.startswith(pre)), "")
                out.append(f"| `{nm}` | {w}x{h} | {sh} (r{pv['grid'][0]}, c{pv['grid'][1]}) | {rule} | "
                           f"{pv['scale_family']} | {pv['scale_to_canvas']} | {note} |")
        out.append("")
    path = os.path.join(HERE, "INVENTORY.md")
    fd, tmp = tempfile.mkstemp(dir=HERE, prefix=".tmp_", suffix=".md")
    with os.fdopen(fd, "w") as fh:
        fh.write("\n".join(out) + "\n")
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)


if __name__ == "__main__":
    main()
