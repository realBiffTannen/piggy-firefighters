"""Sprocket's seven contract performances, authored in 380 px skeleton units.

Root is never keyed. Sign conventions (Spine, y up, CCW positive; he faces image-right):
head + looks up / - nods; chest - leans forward; arm_r (near, image-left) - raises, + swings
inward; arm_l (far) + raises, - inward; fore_r + curls forward-up, fore_l - curls; ear_r + droops,
ear_l - droops; leg_r + splays the knee outward, leg_l - splays; card is a world-upright child of
hand_r so it is counter-rotated while the arm presents it.
"""


def make_clips(timeline):
    clips = {}

    def clip(name, duration):
        value = {"bones": {}, "slots": {}}
        clips[name] = value

        def track(bone, kind, samples, close=True):
            channels = ("value",) if kind == "rotate" else ("x", "y")
            rest = (1, 1) if kind == "scale" else tuple(0 for _ in channels)
            frames = [(t, v if isinstance(v, tuple) else (v,)) for t, v in samples]
            if frames[0][0] != 0:
                frames.insert(0, (0, rest))
            if close and frames[-1][0] != duration:
                frames.append((duration, rest))
            elif frames[-1][0] != duration:
                frames.append((duration, frames[-1][1]))
            value["bones"].setdefault(bone, {})[kind] = timeline(frames, channels)

        def rot(bone, samples, close=True):
            track(bone, "rotate", samples, close)

        def move(bone, samples, close=True):
            track(bone, "translate", samples, close)

        def scale(bone, samples):
            track(bone, "scale", samples)

        def attach(slot, samples, rest):
            frames = [{"time": round(t, 4), "name": name} for t, name in samples]
            if frames[0]["time"] != 0:
                frames.insert(0, {"time": 0, "name": rest})
            value["slots"][slot] = {"attachment": frames}

        def events(*samples):
            value["events"] = [{"time": t, "name": name} for t, name in samples]

        def mirror(pairs, samples_r, close=True):
            """Same acting on both sides: (bone_r, bone_l) with the left sign flipped."""
            for bone_r, bone_l in pairs:
                rot(bone_r, samples_r, close)
                rot(bone_l, [(t, -v) for t, v in samples_r], close)

        return rot, move, scale, attach, events, mirror

    ARMS = (("arm_r", "arm_l"),)
    FORES = (("fore_r", "fore_l"),)
    EARS = (("ear_r", "ear_l"),)
    LEGS = (("leg_r", "leg_l"),)

    # ---- idle · 4 s loop: chest-led breath, delayed helmet/ears, two unequal blinks.
    r, m, s, a, e, mir = clip("idle", 4)
    m("body", [(0, (0, 0)), (1.1, (.3, 1.5)), (2.0, (0, .2)), (3.0, (-.4, 1.3)), (4, (0, 0))])
    r("chest", [(0, 0), (1.15, -.9), (2.05, .1), (3.05, -.8), (4, 0)])
    r("head", [(0, 0), (1.3, .7), (2.2, -.2), (3.2, .6), (4, 0)])
    r("helmet", [(0, 0), (1.45, -.6), (2.35, .2), (3.35, -.5), (4, 0)])
    r("ear_r", [(0, 0), (1.4, 1.2), (2.3, -.3), (2.55, -2.6), (2.72, 1.1), (3.4, .8), (4, 0)])
    r("ear_l", [(0, 0), (1.5, -.9), (2.4, .2), (3.45, -.7), (4, 0)])
    r("arm_r", [(0, 0), (1.2, .9), (2.1, 0), (3.1, .8), (4, 0)])
    r("arm_l", [(0, 0), (1.25, -.8), (2.15, 0), (3.15, -.7), (4, 0)])
    r("fore_r", [(0, 0), (1.35, 1.0), (2.25, .1), (3.25, .9), (4, 0)])
    r("fore_l", [(0, 0), (1.4, -.9), (2.3, 0), (3.3, -.8), (4, 0)])
    r("coat", [(0, 0), (1.35, .5), (2.3, -.1), (3.3, .45), (4, 0)])
    a("eyes", [(1.62, "eyes_closed"), (1.74, "eyes_open"), (3.31, "eyes_closed"), (3.42, "eyes_open")], "eyes_open")

    # ---- fumble · 2.5 s: anticipation (0-.55), mistake (.55-.9), recognition (.9-1.5), recovery (1.5-2.5).
    r, m, s, a, e, mir = clip("fumble", 2.5)
    a("hose", [(0, "hose_coil")], "hose_coil")
    a("hose_tail", [(0, "hose_flexible")], "hose_flexible")
    a("hand_r", [(0, "hand_r_grip"), (.6, "hand_r_open"), (1.72, "hand_r_grip")], "hand_r_grip")
    a("hand_l", [(0, "hand_l_grip"), (.62, "hand_l_open"), (1.74, "hand_l_grip")], "hand_l_grip")
    m("hose", [(0, (0, 0)), (.3, (0, 4)), (.55, (0, 4)), (.75, (4, -26)), (.9, (2, -30)),
               (1.2, (1, -33)), (1.5, (2, -32)), (1.85, (0, -2)), (2.05, (0, 3)), (2.5, (0, 0))])
    r("hose", [(0, 0), (.3, 3), (.55, 3), (.9, -22), (1.25, -26), (1.5, -24), (1.9, 4), (2.5, 0)])
    r("hose_tail", [(0, 0), (.6, 0), (.9, 9), (1.2, -6), (1.5, 4), (1.9, -3), (2.5, 0)])
    mir(ARMS, [(0, 10), (.55, 10), (.8, 16), (1.5, 16), (1.75, 20), (2.5, 10)], close=False)
    mir(FORES, [(0, 15), (.55, 15), (.7, 2), (1.05, 8), (1.2, 3), (1.35, 9), (1.5, 9), (1.8, 22), (2.5, 15)], close=False)
    r("hand_r", [(0, 0), (.6, 0), (.75, -10), (1.05, 6), (1.2, -7), (1.35, 5), (1.7, 0)])
    r("hand_l", [(0, 0), (.6, 0), (.75, 10), (1.05, -6), (1.2, 7), (1.35, -5), (1.7, 0)])
    r("head", [(0, -4), (.4, -6), (.85, -12), (1.1, -9), (1.4, -11), (1.9, -3), (2.5, -2)], close=False)
    r("chest", [(0, -1.5), (.55, -1.5), (.85, -4), (1.15, 2), (1.5, 1), (2.0, -.5), (2.5, 0)])
    m("body", [(0, (0, 0)), (.85, (0, -3)), (1.15, (0, -1)), (1.9, (0, 1)), (2.5, (0, 0))])
    r("helmet", [(0, 0), (.9, 0), (1.05, -4), (1.3, -2), (1.75, 3), (2.2, -1), (2.5, 0)])
    mir(EARS, [(0, 0), (.9, 0), (1.1, 6), (1.5, 6), (1.9, -3), (2.5, 0)])
    r("coat", [(0, 0), (.85, 0), (1.0, -2), (1.3, 1.5), (1.9, -1), (2.5, 0)])
    a("eyes", [(.1, "eyes_dart"), (1.0, "eyes_open"), (1.25, "eyes_dart"), (1.7, "eyes_open"),
               (2.0, "eyes_happy"), (2.4, "eyes_open")], "eyes_open")
    a("brows", [(0, "brows_raised"), (.7, "brows_worried"), (1.05, "brows_embarrassed"), (1.95, "brows_neutral")], "brows_neutral")
    a("mouth", [(.62, "mouth_open"), (.95, "mouth_oops"), (2.0, "mouth_smile"), (2.45, "mouth_closed")], "mouth_closed")

    # ---- card_flip · 1 s: hand lead (0-.35), edge-on turn (.35-.57, flip at .45), reveal, grip recovery.
    r, m, s, a, e, mir = clip("card_flip", 1)
    a("card", [(0, "card_back"), (.45, "card_blank")], "card_back")
    a("hand_r", [(0, "hand_r_pinch")], "hand_r_pinch")
    r("arm_r", [(0, 0), (.35, 14), (.85, 14), (1, 13)], close=False)
    r("fore_r", [(0, 0), (.35, 100), (.85, 100), (1, 96)], close=False)
    r("hand_r", [(0, 0), (.2, -10), (.35, 5), (.45, 18), (.57, 8), (.85, 8), (1, 4)], close=False)
    r("card", [(0, 0), (.35, -114), (.45, -128), (.57, -110), (.7, -116), (.85, -114), (1, -112)], close=False)
    s("card", [(0, (1, 1)), (.33, (1, 1)), (.45, (.04, 1)), (.57, (1, 1)), (1, (1, 1))])
    r("arm_l", [(0, 0), (.4, -3), (1, -2)], close=False)
    r("head", [(0, 0), (.3, -5), (.7, -3), (1, -3)], close=False)
    r("chest", [(0, 0), (.3, -1), (.8, -1), (1, 0)])
    r("helmet", [(0, 0), (.3, 2), (.55, -1.5), (.9, .5), (1, 0)])
    a("eyes", [(.05, "eyes_dart"), (.6, "eyes_open"), (.75, "eyes_happy")], "eyes_open")
    a("brows", [(.1, "brows_raised"), (.8, "brows_neutral")], "brows_neutral")
    a("mouth", [(.6, "mouth_smile")], "mouth_closed")
    e((.45, "flip"))

    # ---- hold_sheet · 3 s loop: braced jump-sheet pose, looking up, breathing through the arms.
    HOLD = {"arm_r": -45, "arm_l": 45, "fore_r": 35, "fore_l": -35, "head": 8, "helmet": -2,
            "chest": -2, "leg_r": 4, "leg_l": -4}
    r, m, s, a, e, mir = clip("hold_sheet", 3)
    a("hand_r", [(0, "hand_r_catch")], "hand_r_catch")
    a("hand_l", [(0, "hand_l_catch")], "hand_l_catch")
    a("brows", [(0, "brows_raised")], "brows_raised")
    a("eyes", [(1.9, "eyes_closed"), (2.02, "eyes_open")], "eyes_open")
    r("arm_r", [(0, HOLD["arm_r"]), (1.5, HOLD["arm_r"] - 1.5), (3, HOLD["arm_r"])], close=False)
    r("arm_l", [(0, HOLD["arm_l"]), (1.6, HOLD["arm_l"] + 1.3), (3, HOLD["arm_l"])], close=False)
    r("fore_r", [(0, HOLD["fore_r"]), (1.4, HOLD["fore_r"] - 1.5), (3, HOLD["fore_r"])], close=False)
    r("fore_l", [(0, HOLD["fore_l"]), (1.45, HOLD["fore_l"] + 1.2), (3, HOLD["fore_l"])], close=False)
    r("chest", [(0, HOLD["chest"]), (1.5, HOLD["chest"] - 1.2), (3, HOLD["chest"])], close=False)
    m("body", [(0, (0, -3)), (1.4, (0, -1.6)), (3, (0, -3))], close=False)
    r("head", [(0, HOLD["head"]), (1.5, HOLD["head"] + 1.5), (3, HOLD["head"])], close=False)
    r("helmet", [(0, HOLD["helmet"]), (1.6, HOLD["helmet"] - .8), (3, HOLD["helmet"])], close=False)
    r("leg_r", [(0, HOLD["leg_r"]), (1.5, HOLD["leg_r"] + .6), (3, HOLD["leg_r"])], close=False)
    r("leg_l", [(0, HOLD["leg_l"]), (1.5, HOLD["leg_l"] - .5), (3, HOLD["leg_l"])], close=False)
    r("ear_r", [(0, -2), (1.3, -3), (3, -2)], close=False)
    r("ear_l", [(0, 2), (1.35, 2.8), (3, 2)], close=False)
    r("coat", [(0, 0), (1.5, .4), (3, 0)])

    # ---- catch · .7 s: impact on arrival (event .05), absorb, rebound, settle back into HOLD.
    r, m, s, a, e, mir = clip("catch", .7)
    a("hand_r", [(0, "hand_r_catch")], "hand_r_catch")
    a("hand_l", [(0, "hand_l_catch")], "hand_l_catch")
    a("brows", [(0, "brows_raised")], "brows_raised")
    a("eyes", [(.02, "eyes_closed"), (.2, "eyes_open"), (.35, "eyes_happy"), (.66, "eyes_open")], "eyes_open")
    a("mouth", [(.02, "mouth_shout"), (.3, "mouth_smile"), (.68, "mouth_closed")], "mouth_closed")
    e((.05, "catch"))
    m("body", [(0, (0, -3)), (.16, (0, -16)), (.42, (0, 1)), (.7, (0, -3))], close=False)
    r("chest", [(0, HOLD["chest"]), (.16, -6), (.42, -1), (.7, HOLD["chest"])], close=False)
    r("arm_r", [(0, HOLD["arm_r"]), (.16, -36), (.42, -49), (.7, HOLD["arm_r"])], close=False)
    r("arm_l", [(0, HOLD["arm_l"]), (.16, 36), (.42, 49), (.7, HOLD["arm_l"])], close=False)
    r("fore_r", [(0, HOLD["fore_r"]), (.16, 20), (.42, 39), (.7, HOLD["fore_r"])], close=False)
    r("fore_l", [(0, HOLD["fore_l"]), (.16, -20), (.42, -39), (.7, HOLD["fore_l"])], close=False)
    r("head", [(0, HOLD["head"]), (.16, -4), (.42, 11), (.7, HOLD["head"])], close=False)
    r("helmet", [(0, HOLD["helmet"]), (.2, 5), (.45, -5), (.7, HOLD["helmet"])], close=False)
    r("leg_r", [(0, HOLD["leg_r"]), (.16, 8), (.42, 3), (.7, HOLD["leg_r"])], close=False)
    r("leg_l", [(0, HOLD["leg_l"]), (.16, -8), (.42, -3), (.7, HOLD["leg_l"])], close=False)
    r("ear_r", [(0, -2), (.18, 6), (.45, -5), (.7, -2)], close=False)
    r("ear_l", [(0, 2), (.18, -6), (.45, 5), (.7, 2)], close=False)
    r("coat", [(0, 0), (.18, 3), (.45, -2), (.7, 0)])

    # ---- celebrate · 1.5 s: crouch, both arms up, two pumps, settle to rest.
    r, m, s, a, e, mir = clip("celebrate", 1.5)
    mir(ARMS, [(0, 0), (.12, 8), (.38, -138), (.62, -128), (.85, -140), (1.05, -128), (1.4, 0), (1.5, 0)])
    mir(FORES, [(0, 0), (.12, 4), (.38, 22), (.62, 16), (.85, 24), (1.05, 16), (1.4, 0), (1.5, 0)])
    m("body", [(0, (0, 0)), (.15, (0, -5)), (.4, (0, 9)), (.62, (0, 4)), (.85, (0, 10)), (1.05, (0, 4)), (1.4, (0, 0))])
    r("chest", [(0, 0), (.15, -3), (.4, 5), (.62, 4), (.85, 6), (1.4, 0)])
    r("head", [(0, 0), (.15, -4), (.4, 10), (.62, 7), (.85, 11), (1.2, 4), (1.5, 0)])
    r("helmet", [(0, 0), (.22, 3), (.48, -5), (.7, 3), (.95, -4), (1.3, 1), (1.5, 0)])
    m("helmet", [(0, (0, 0)), (.3, (0, 0)), (.45, (0, 4)), (.6, (0, 0)), (.9, (0, 3)), (1.05, (0, 0))])
    mir(EARS, [(0, 0), (.4, -8), (.62, -4), (.85, -9), (1.4, 0)])
    r("coat", [(0, 0), (.3, 3), (.55, -3), (.8, 2.5), (1.1, -1.5), (1.5, 0)])
    mir(LEGS, [(0, 0), (.4, 2), (1.4, 0)])
    a("eyes", [(.3, "eyes_happy"), (1.35, "eyes_open")], "eyes_open")
    a("brows", [(.25, "brows_raised"), (1.3, "brows_neutral")], "brows_neutral")
    a("mouth", [(.2, "mouth_smile"), (.35, "mouth_shout"), (.75, "mouth_smile"), (1.42, "mouth_closed")], "mouth_closed")

    # ---- sad · 1.5 s: false alarm; droop, one slow blink, restrained recovery, no frozen extreme.
    r, m, s, a, e, mir = clip("sad", 1.5)
    r("head", [(0, 0), (.45, -10), (.85, -9), (1.5, -1)], close=False)
    r("chest", [(0, 0), (.5, -3.5), (.9, -3.5), (1.5, -.5)], close=False)
    m("body", [(0, (0, 0)), (.55, (0, -5)), (.95, (0, -5)), (1.5, (0, -.5))], close=False)
    mir(ARMS, [(0, 0), (.5, 4), (1.0, 4), (1.5, .5)], close=False)
    mir(FORES, [(0, 0), (.5, -3), (1.0, -3), (1.5, 0)])
    mir(EARS, [(0, 0), (.5, 9), (1.0, 9), (1.5, 2)], close=False)
    r("helmet", [(0, 0), (.55, -3), (1.0, -2.5), (1.5, -.5)], close=False)
    r("coat", [(0, 0), (.6, -1), (1.5, 0)])
    a("brows", [(.08, "brows_worried"), (1.35, "brows_neutral")], "brows_neutral")
    a("mouth", [(.12, "mouth_sad"), (1.4, "mouth_closed")], "mouth_closed")
    a("eyes", [(.55, "eyes_closed"), (.75, "eyes_open")], "eyes_open")
    return clips
