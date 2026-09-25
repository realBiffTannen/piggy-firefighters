"""Ember's five contract performances, authored in 220px skeleton units.

Root never moves. Positive leg rotation swings a paw forward (screen right);
positive head rotation lifts the nose; positive body rotation rears the chest up
about the hips; negative ear rotation trails the ears back; the tail wags about
its root. Eyes blink by squashing their own sub-mesh onto the lower lid over a
white-fur cover; brows raise over their cover. Muzzle overlays swap the mouth.
"""
import math


def make_clips(timeline):
    clips = {}

    def clip(name, duration):
        value = {"bones": {}, "slots": {}}
        clips[name] = value

        def track(bone, kind, samples):
            channels = ("value",) if kind == "rotate" else ("x", "y")
            rest = (1, 1) if kind == "scale" else tuple(0 for _ in channels)
            frames = [(t, v if isinstance(v, tuple) else (v,)) for t, v in samples]
            if frames[0][0] != 0:
                frames.insert(0, (0, rest))
            if frames[-1][0] != duration:
                frames.append((duration, rest))
            value["bones"].setdefault(bone, {})[kind] = timeline(frames, channels)

        def rot(bone, samples):
            track(bone, "rotate", samples)

        def move(bone, samples):
            track(bone, "translate", samples)

        def scale(bone, samples):
            track(bone, "scale", samples)

        def attach(slot, samples, rest=None):
            frames = [{"time": t, "name": n} for t, n in samples]
            if frames[0]["time"] != 0:
                frames.insert(0, {"time": 0, "name": rest})
            if frames[-1]["time"] != duration:
                frames.append({"time": duration, "name": rest})
            value["slots"][slot] = {"attachment": frames}

        def blink(at, both=True, depth=0.08, close=0.06, hold=0.04, open_=0.09):
            for eye in ("eye_right", "eye_left") if both else ("eye_right",):
                scale(eye, [(at, (1, 1)), (at + close, (1, depth)), (at + close + hold, (1, depth)),
                            (at + close + hold + open_, (1, 1))])

        def sine(bone, kind, duration_, mid, amp, phase, samples=8):
            frames = []
            for i in range(samples + 1):
                t = duration_ * i / samples
                frames.append((round(t, 4), round(mid + amp * math.sin(2 * math.pi * (i / samples + phase)), 3)))
            frames[-1] = (duration_, frames[0][1])  # exact loop seam
            track(bone, kind, frames)

        return value, rot, move, scale, attach, blink, sine

    # Standing alert idle (Ember has no seated pose in the delivery): two uneven
    # breaths, head drift with ear/tail follow-through, one blink, one brow flicker.
    c, r, m, s, a, blink, sine = clip("sit_idle", 4.4)
    m("chest", [(0, (0, 0)), (1.1, (0.4, 0.9)), (2.2, (0, 0)), (3.3, (0.3, 0.8)), (4.4, (0, 0))])
    r("body", [(0, 0), (1.1, 0.5), (2.2, 0), (3.3, 0.4), (4.4, 0)])
    r("head", [(0, 0), (1.3, 1.2), (2.6, -0.8), (3.6, 0.6), (4.4, 0)])
    m("neck", [(0, (0, 0)), (1.2, (0, 0.5)), (2.3, (0, 0)), (3.4, (0, 0.4)), (4.4, (0, 0))])
    r("ear_right", [(0, 0), (1.5, -1.6), (2.8, 1.1), (3.8, -0.8), (4.4, 0)])
    r("ear_left", [(0, 0), (1.6, -1.2), (2.9, 1.4), (3.9, -0.6), (4.4, 0)])
    r("tail", [(0, 0), (0.6, 6), (1.3, -5), (2.0, 4), (2.6, 0), (3.4, 0), (3.8, 5), (4.4, 0)])
    r("helmet", [(0, 0), (1.4, 0.4), (2.7, -0.3), (4.4, 0)])
    blink(2.3)
    m("brow_right", [(0, (0, 0)), (3.0, (0, 0)), (3.15, (0, 1.2)), (3.5, (0, 0))])
    m("brow_left", [(0, (0, 0)), (3.0, (0, 0)), (3.15, (0, 1.0)), (3.5, (0, 0))])
    a("muzzle", [(0, None)])

    # Intake (head back, chest up, brows alert), snap forward with the bark jaw,
    # ears flick back, then recover. Event on the vocal action.
    c, r, m, s, a, blink, sine = clip("bark", 0.6)
    r("head", [(0, 0), (0.14, 7), (0.26, -9), (0.4, -7), (0.6, 0)])
    m("neck", [(0, (0, 0)), (0.14, (-1.5, 1.5)), (0.26, (2.5, -1.5)), (0.4, (1.5, -1)), (0.6, (0, 0))])
    m("chest", [(0, (0, 0)), (0.14, (0, 1.2)), (0.28, (1, -0.8)), (0.55, (0, 0))])
    r("body", [(0, 0), (0.14, 1.5), (0.28, -1.5), (0.55, 0)])
    r("ear_right", [(0, 0), (0.16, 4), (0.3, -12), (0.44, -6), (0.6, 0)])
    r("ear_left", [(0, 0), (0.17, 3), (0.31, -10), (0.45, -5), (0.6, 0)])
    m("brow_right", [(0, (0, 0)), (0.12, (0, 1.6)), (0.4, (0, 1.6)), (0.58, (0, 0))])
    m("brow_left", [(0, (0, 0)), (0.12, (0, 1.4)), (0.4, (0, 1.4)), (0.58, (0, 0))])
    r("tail", [(0, 0), (0.2, -5), (0.4, 3), (0.6, 0)])
    r("helmet", [(0, 0), (0.18, -2), (0.32, 2.5), (0.46, -0.8), (0.6, 0)])
    a("muzzle", [(0, None), (0.24, "muzzle_bark"), (0.46, None)])
    c["events"] = [{"time": 0.25, "name": "bark"}]

    # Gallop: front pair leads, hind pair follows; body bobs and pitches, head
    # counters, ears and tail trail. Root neutral; the runtime owns travel.
    T = 0.5
    c, r, m, s, a, blink, sine = clip("run_loop", T)
    sine("leg_front_right", "rotate", T, 2, 24, 0.0)
    sine("leg_front_left", "rotate", T, 0, 20, 0.3)
    sine("leg_hind_right", "rotate", T, 0, 22, 0.55)
    sine("leg_hind_left", "rotate", T, 0, 20, 0.85)
    frames = [(round(T * i / 8, 4), (0, round(2.5 * math.sin(2 * math.pi * (i / 8 + 0.1)), 3))) for i in range(9)]
    frames[-1] = (T, frames[0][1])
    m("pelvis", frames)
    sine("body", "rotate", T, 0, 3, 0.35)
    sine("head", "rotate", T, -3, 2.5, 0.6)
    frames = [(round(T * i / 8, 4), (1, round(0.8 * math.sin(2 * math.pi * (i / 8 + 0.6)), 3))) for i in range(9)]
    frames[-1] = (T, frames[0][1])
    m("neck", frames)
    sine("ear_right", "rotate", T, -14, 5, 0.8)
    sine("ear_left", "rotate", T, -12, 5, 0.7)
    sine("tail", "rotate", T, -12, 6, 0.5)
    sine("helmet", "rotate", T, 0, 2, 0.7)
    a("muzzle", [(0, "muzzle_pant")], rest="muzzle_pant")

    # Crouch, rear up on the hind legs with paddling forepaws, panting grin and
    # a fast wag, drop back with a landing squash, settle.
    c, r, m, s, a, blink, sine = clip("celebrate", 1.5)
    r("body", [(0, 0), (0.18, -3), (0.42, 24), (0.6, 21), (0.78, 25), (0.95, 22), (1.15, 0), (1.25, -2), (1.5, 0)])
    m("pelvis", [(0, (0, 0)), (0.18, (0, -1.2)), (0.42, (0, 0)), (1.15, (0, 0)), (1.24, (0, -1.5)), (1.45, (0, 0))])
    r("leg_front_right", [(0, 0), (0.18, -5), (0.45, 34), (0.65, 27), (0.85, 36), (1.0, 29), (1.18, 0), (1.5, 0)])
    r("leg_front_left", [(0, 0), (0.18, -4), (0.48, 18), (0.68, 24), (0.88, 17), (1.02, 23), (1.2, 0), (1.5, 0)])
    r("leg_hind_right", [(0, 0), (0.42, 3), (1.0, 3), (1.2, 0)])
    r("leg_hind_left", [(0, 0), (0.42, 2.5), (1.0, 2.5), (1.2, 0)])
    r("head", [(0, 0), (0.18, -4), (0.45, -10), (0.7, -8), (0.9, -11), (1.1, -6), (1.3, -2), (1.5, 0)])
    m("neck", [(0, (0, 0)), (0.18, (0, -0.8)), (0.45, (0.5, 0.8)), (1.15, (0.5, 0.8)), (1.3, (0, 0))])
    r("ear_right", [(0, 0), (0.2, 6), (0.5, -14), (0.7, -6), (0.9, -12), (1.1, -4), (1.3, 5), (1.5, 0)])
    r("ear_left", [(0, 0), (0.22, 5), (0.52, -12), (0.72, -5), (0.92, -10), (1.12, -3), (1.32, 4), (1.5, 0)])
    r("tail", [(0, 0), (0.15, 12), (0.35, -12), (0.55, 12), (0.75, -12), (0.95, 12), (1.15, -10), (1.35, 6), (1.5, 0)])
    r("helmet", [(0, 0), (0.2, 2), (0.48, -5), (0.7, 3), (0.95, -2), (1.22, 4), (1.5, 0)])
    m("brow_right", [(0, (0, 0)), (0.35, (0, 1.5)), (1.1, (0, 1.5)), (1.35, (0, 0))])
    m("brow_left", [(0, (0, 0)), (0.35, (0, 1.3)), (1.1, (0, 1.3)), (1.35, (0, 0))])
    s("eye_right", [(0, (1, 1)), (0.3, (1, 1)), (0.45, (1, 0.35)), (1.1, (1, 0.35)), (1.3, (1, 1))])
    s("eye_left", [(0, (1, 1)), (0.3, (1, 1)), (0.45, (1, 0.35)), (1.1, (1, 0.35)), (1.3, (1, 1))])
    a("muzzle", [(0, None), (0.3, "muzzle_pant"), (1.35, None)])

    # Braced hold on the sheet corner: head lowered on the corner, slow tugs
    # through neck and jaw, steady wag, one blink. Anchors ride the jaw bone.
    c, r, m, s, a, blink, sine = clip("hold_sheet", 2.4)
    r("head", [(0, -7), (0.6, -9), (1.2, -6), (1.8, -9.5), (2.4, -7)])
    m("neck", [(0, (0.5, -0.5)), (0.6, (1.2, -1)), (1.2, (0.3, -0.3)), (1.8, (1.3, -1.1)), (2.4, (0.5, -0.5))])
    r("body", [(0, -2), (0.6, -2.6), (1.2, -1.6), (1.8, -2.7), (2.4, -2)])
    m("pelvis", [(0, (0, 0)), (0.6, (0, -0.4)), (1.2, (0, 0)), (1.8, (0, -0.4)), (2.4, (0, 0))])
    r("ear_right", [(0, 2), (0.7, 3.5), (1.4, 1), (2.4, 2)])
    r("ear_left", [(0, 1.5), (0.8, 3), (1.5, 0.5), (2.4, 1.5)])
    r("tail", [(0, 0), (0.5, 5), (1.1, -4), (1.7, 4), (2.4, 0)])
    r("jaw", [(0, 0), (0.6, -1), (1.2, 0), (1.8, -1.2), (2.4, 0)])
    r("helmet", [(0, 0), (0.7, -0.6), (1.5, 0.4), (2.4, 0)])
    blink(1.5)
    a("muzzle", [(0, None)])
    return clips
