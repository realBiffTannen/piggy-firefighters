"""Chief's distinct full performances, authored in 420px skeleton units.

No root movement. Hands release/reseat explicitly; the other hand retains the
nozzle. These curves require actual original attachment variants from the layout.
"""
import math


def make_clips(spray, timeline):
    clips = dict(spray)

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

        def wrist(samples, side="r"):
            # World-axis offsets converted into the neutral nozzle parent's -28° axes.
            a = math.radians(-28)
            move(f"wrist_target_{side}", [(t, (math.cos(a)*x + math.sin(a)*y,
                                               -math.sin(a)*x + math.cos(a)*y)) for t, x, y, _ in samples])
            rot(f"wrist_target_{side}", [(t, angle) for t, _, _, angle in samples])

        def attach(slot, samples, rest=None):
            frames = [{"time": t, "name": name} for t, name in samples]
            if frames[0]["time"] != 0:
                frames.insert(0, {"time": 0, "name": rest or slot})
            if frames[-1]["time"] != duration:
                frames.append({"time": duration, "name": rest or slot})
            value["slots"][slot] = {"attachment": frames}

        return value, rot, move, wrist, attach

    # Five seconds: chest-led breath, irregular brief blink, gaze recovery.
    c, r, m, w, a = clip("idle", 5)
    m("body", [(0, (0, 0)), (1.8, (.3, 1.4)), (3.6, (-.25, -.6))])
    r("chest", [(0, 0), (1.7, -.65), (3.5, .35)])
    r("head", [(0, 0), (1.9, .4), (3.9, -.2)])
    r("helmet", [(0, 0), (2.05, .45), (3.95, -.25)])
    r("moustache", [(0, 0), (2.2, -.4), (4.15, .25)])
    a("eyes", [(2.71, "eyes_closed"), (2.84, "eyes")])

    # Brief business with the original bugle: retrieve, inspect, return to belt.
    c, r, m, w, a = clip("idle_alt", 4)
    r("head", [(.22, 6), (.65, 10), (1.4, -4), (2, -6), (2.6, 6), (3.5, 0)])
    r("chest", [(.25, -1.8), (.75, -2), (1.5, 2), (2.3, 1), (3.35, 0)])
    w([(.12, 0, 0, 0), (.55, -40, -32, -10), (.72, -40, -32, -10),
       (1.3, -34, 43, 28), (1.75, -30, 48, 37), (2.15, -34, 43, 28),
       (2.9, -40, -32, -10), (3.12, -40, -32, -10), (3.72, 0, 0, 0)])
    r("helmet", [(.36, -1), (.9, 1.8), (1.7, -.6), (2.65, 1.2), (3.7, 0)])
    r("moustache", [(.5, 1.1), (1.55, -.7), (2.4, 1), (3.7, 0)])
    a("hand_r", [(.16, "hand_r_open"), (.61, "hand_r"), (3.04, "hand_r_open"), (3.73, "hand_r")])
    a("bugle_belt", [(0, "bugle_belt"), (.61, None), (3.04, "bugle_belt")])
    a("bugle_hand", [(0, None), (.61, "bugle_hand"), (3.04, None), (4, None)])
    a("eyes", [(1.05, "eyes_closed"), (1.17, "eyes")])
    a("brows", [(1.2, "brows_raised"), (2.42, "brows")])

    # One compact fist pump: anticipate, punch, settle, visibly regain the nozzle.
    c, r, m, w, a = clip("win", 1.2)
    m("body", [(.13, (-1, -4)), (.36, (1, 1.7)), (.7, (0, -.4)), (1.08, (0, 0))])
    r("chest", [(.12, -2), (.33, 4.5), (.65, 1.8), (1.08, 0)])
    r("head", [(.08, -2), (.31, -5), (.62, -2), (1.05, 0)])
    w([(.08, 0, 0, 0), (.19, -11, -4, 15), (.38, -68, 87, 122),
       (.54, -68, 88, 122), (.74, -54, 64, 110), (1.12, 0, 0, 0)])
    r("helmet", [(.21, 2), (.46, -1.4), (.79, .7), (1.15, 0)])
    r("coat_r", [(.22, -2), (.48, 3), (.83, -.7), (1.15, 0)])
    a("hand_r", [(.1, "hand_r_thumb"), (.94, "hand_r_open"), (1.12, "hand_r")])
    a("mouth", [(.2, "mouth_smile"), (.88, "mouth")])

    # Stronger anticipation, a clear held upper silhouette and a single weight-set.
    c, r, m, w, a = clip("big_win", 2.4)
    m("body", [(.22, (-3, -7)), (.49, (1, 2)), (.79, (0, -1)), (1.2, (1, 1)), (1.9, (0, -.4)), (2.3, (0, 0))])
    r("chest", [(.2, -4), (.48, 7), (.82, 3), (1.18, 5), (1.72, 2), (2.2, 0)])
    r("head", [(.1, 3), (.43, -6), (.85, -3), (1.3, -4.5), (2.1, 0)])
    w([(.1, 0, 0, 0), (.24, -10, -12, 15), (.48, -75, 105, 128),
       (.7, -75, 103, 128), (.95, -59, 75, 112), (1.19, -74, 103, 128),
       (1.45, -74, 103, 128), (1.9, -45, 40, 75), (2.24, 0, 0, 0)])
    m("boot_r", [(.25, (0, 2.7)), (.48, (0, 0))])
    r("boot_r", [(.25, 2.3), (.48, 0)])
    r("helmet", [(.29, 3), (.6, -2), (1.3, 1.4), (1.7, -.6), (2.3, 0)])
    r("moustache", [(.32, 2), (.65, -2.2), (1.32, 1), (2.3, 0)])
    r("coat_r", [(.3, -2), (.6, 4), (1.37, 2), (2.3, 0)])
    r("coat_l", [(.32, 2), (.66, -3), (1.4, -1.5), (2.3, 0)])
    a("hand_r", [(.12, "hand_r_thumb"), (2.05, "hand_r_open"), (2.24, "hand_r")])
    a("mouth", [(.3, "mouth_smile"), (1.8, "mouth")])
    a("eyes", [(.4, "eyes_happy"), (.87, "eyes"), (1.17, "eyes_happy"), (1.59, "eyes")])
    c["events"] = [{"time": .48, "name": "step"}, {"time": .48, "name": "sign_hit"}]

    # Head leads a short index-point hold toward the reels; presentation is evented.
    c, r, m, w, a = clip("point_reels", .8)
    r("head", [(.08, -5), (.3, -3), (.55, -3), (.75, 0)])
    r("chest", [(.1, 0), (.28, -3), (.51, -2.5), (.77, 0)])
    w([(.1, 0, 0, 0), (.3, 26, 39, 71), (.48, 26, 39, 71), (.73, 0, 0, 0)])
    r("helmet", [(.17, 1.5), (.35, -.5), (.77, 0)])
    r("moustache", [(.23, .8), (.48, -.3), (.77, 0)])
    a("hand_r", [(.13, "hand_r_point"), (.65, "hand_r_open"), (.73, "hand_r")])
    c["events"] = [{"time": .3, "name": "sign_hit"}]

    # Open salute/wave, then settle; distinct from the clenched win accents.
    c, r, m, w, a = clip("celebrate", 2)
    m("body", [(.16, (-1, -3)), (.46, (1, 1)), (1.12, (-.5, .3)), (1.8, (0, 0))])
    r("chest", [(.15, -2), (.46, 4), (1.1, 2), (1.8, 0)])
    r("head", [(.09, -3), (.5, -5), (1.2, -2), (1.8, 0)])
    w([(.1, 0, 0, 0), (.46, -72, 83, 126), (.69, -76, 87, 112),
       (.93, -68, 86, 140), (1.17, -77, 86, 110), (1.4, -69, 81, 132), (1.84, 0, 0, 0)])
    r("helmet", [(.25, 2), (.59, -1.5), (1.22, .9), (1.9, 0)])
    r("moustache", [(.33, 1), (.65, -1), (1.31, .7), (1.9, 0)])
    r("coat_r", [(.3, -2), (.6, 2.7), (1.34, 1.1), (1.9, 0)])
    a("hand_r", [(.12, "hand_r_open"), (1.84, "hand_r")])
    a("mouth", [(.22, "mouth_smile"), (1.67, "mouth")])
    a("eyes", [(.85, "eyes_happy"), (1.2, "eyes")])

    # Recognition, exhale and sympathetic recovery; no celebratory lift or stamp.
    c, r, m, w, a = clip("sad", 1.5)
    r("head", [(.12, 2.5), (.48, 8), (.83, 7), (1.39, 0)])
    m("body", [(.21, (0, -1)), (.54, (-.5, -4)), (.87, (-.5, -4)), (1.4, (0, 0))])
    r("chest", [(.27, -1), (.59, -3), (.92, -3), (1.4, 0)])
    r("helmet", [(.3, -1), (.65, 1.5), (1.44, 0)])
    r("moustache", [(.37, -.8), (.73, 1.3), (1.44, 0)])
    a("brows", [(.16, "brows_worried"), (1.3, "brows")])
    a("eyes", [(.59, "eyes_closed"), (.83, "eyes")])
    return clips
