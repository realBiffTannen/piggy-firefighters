"""The Trotter family's four contract performances, authored in 260px skeleton units.

One skeleton, five skins. Every skin owns its own neck, shoulder and hand pivots
(bones head_<skin>, arm_r_<skin>, hand_r_<skin>, arm_l_<skin>, hand_l_<skin>), so
each clip keys the same acting on every skin's bones; the root is never keyed.

Semantics (converted to Spine rotations here): `raise` lifts an arm outward and up
from hanging (image-left arm = negative Spine rotation); `splay` swings a leg
outward from the hip; `toward` tilts head/chest toward the skin's waving arm.
Grandma waves with her image-right arm (the cat rides her other shoulder), and the
capped arm never swings through the cat.
"""

RAISE_SIGN = {"r": -1, "l": +1}      # arm_r is the image-left arm; CW (negative) lifts it outward
SPLAY_SIGN = {"r": -1, "l": +1}      # leg_r is the image-left leg
TOWARD_SIGN = {"r": +1, "l": -1}     # CCW (+) tilts the head toward image-left


def make_clips(timeline, skins):
    """skins: {name: {"wave_side": "r"|"l", "raise_cap": {"r": deg?, "l": deg?}}}."""
    clips = {}

    def clip(name, duration):
        value = {"bones": {}, "slots": {}}
        clips[name] = value

        def track(bone, kind, samples):
            channels = ("value",) if kind == "rotate" else ("x", "y")
            rest = tuple(0 for _ in channels)
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

        def heads(samples, toward=None):
            for skin, info in skins.items():
                sign = TOWARD_SIGN[info["wave_side"]] if toward else 1
                rot(f"head_{skin}", [(t, v * sign) for t, v in samples])

        def arm(skin, side, samples):
            cap = skins[skin]["raise_cap"].get(side)
            rot(f"arm_{side}_{skin}", [(t, RAISE_SIGN[side] * (min(v, cap) if cap is not None else v)) for t, v in samples])

        def arms(side, samples):
            for skin in skins:
                arm(skin, side, samples)

        def wave_arm(samples):
            for skin, info in skins.items():
                arm(skin, info["wave_side"], samples)

        def other_arm(samples):
            for skin, info in skins.items():
                arm(skin, "l" if info["wave_side"] == "r" else "r", samples)

        def wave_hand(samples):
            for skin, info in skins.items():
                side = info["wave_side"]
                rot(f"hand_{side}_{skin}", [(t, RAISE_SIGN[side] * v) for t, v in samples])

        def legs(samples):
            for side in ("r", "l"):
                rot(f"leg_{side}", [(t, SPLAY_SIGN[side] * v) for t, v in samples])

        def attach(slot, samples):
            value["slots"][slot] = {"attachment": [{"time": t, "name": name} for t, name in samples]}

        return dict(rot=rot, move=move, heads=heads, arms=arms, wave_arm=wave_arm, other_arm=other_arm,
                    wave_hand=wave_hand, legs=legs, attach=attach, value=value)

    # Call for help above the window edge (0-1.45 s), then a brief held silhouette
    # with breathing (1.45-2.6 s); the seam returns to the raised call pose.
    c = clip("wave_window", 2.6)
    c["wave_arm"]([(0, 150), (.35, 140), (.7, 158), (1.05, 140), (1.4, 152), (1.9, 150), (2.6, 150)])
    c["wave_hand"]([(0, 0), (.18, 28), (.53, -28), (.88, 26), (1.23, -20), (1.5, 0), (2.6, 0)])
    c["other_arm"]([(0, 0), (.7, 7), (1.4, 0), (2.0, -2), (2.6, 0)])
    c["heads"]([(0, 0), (.3, 6), (1.0, 4), (1.4, 6), (1.9, 0), (2.6, 0)], toward=True)
    c["rot"]("chest", [(0, 0), (.35, 2.5), (1.4, 2.5), (1.9, 0), (2.6, 0)])
    c["move"]("hips", [(0, (0, 0)), (.35, (0, 3)), (.7, (0, -1)), (1.05, (0, 3)), (1.4, (0, 0)), (2.0, (0, 1.5)), (2.6, (0, 0))])
    c["attach"]("mouth", [(0, "mouth_call"), (1.45, None)])
    c["attach"]("wave_hand", [(0, "wave_hand_front")])

    # Pose only: the runtime carries the actor down the ladder. Arms up and legs
    # kicked out on the way; body bumps; near the end the arms come down to brace
    # and the legs gather under for contact.
    c = clip("slide", 1.2)
    c["arms"]("r", [(0, 40), (.15, 150), (.5, 140), (.8, 150), (1.05, 50), (1.2, 45)])
    c["arms"]("l", [(0, 40), (.15, 150), (.5, 140), (.8, 150), (1.05, 50), (1.2, 45)])
    c["legs"]([(0, 0), (.15, 22), (.6, 16), (.85, 22), (1.1, 4), (1.2, 4)])
    c["move"]("hips", [(0, (0, 0)), (.15, (0, -10)), (.5, (0, -7)), (.8, (0, -10)), (1.1, (0, -3)), (1.2, (0, -2))])
    c["rot"]("hips", [(0, 0), (.3, 4), (.6, -4), (.9, 3), (1.2, 0)])
    c["heads"]([(0, 0), (.25, -6), (.55, 6), (.85, -4), (1.2, 0)])
    c["rot"]("chest", [(0, 0), (.2, 5), (1.0, -3), (1.2, 0)])
    c["attach"]("mouth", [(0, "mouth_cheer"), (.9, None)])
    c["attach"]("wave_hand", [(0, None)])

    # Feet contact at .04 s: compress, rebound past neutral, find balance.
    c = clip("land", .6)
    c["move"]("hips", [(0, (0, -2)), (.04, (0, -4)), (.14, (0, -14)), (.32, (0, 3)), (.46, (0, -1)), (.6, (0, 0))])
    c["rot"]("chest", [(0, 0), (.14, 6), (.34, -2), (.6, 0)])
    c["legs"]([(0, 4), (.14, 14), (.34, 8), (.6, 0)])
    c["arms"]("r", [(0, 45), (.14, 75), (.34, 60), (.6, 0)])
    c["arms"]("l", [(0, 45), (.14, 75), (.34, 60), (.6, 0)])
    c["heads"]([(0, 0), (.14, -5), (.34, 4), (.6, 0)])
    c["attach"]("mouth", [(0, "mouth_o"), (.3, None)])
    c["attach"]("wave_hand", [(0, None)])
    c["value"]["events"] = [{"time": .04, "name": "land"}]

    # Both arms pumping out of phase over four torso hops; head rocks; open cheer.
    c = clip("cheer", 1.2)
    c["arms"]("r", [(0, 150), (.3, 135), (.6, 155), (.9, 135), (1.2, 150)])
    c["arms"]("l", [(0, 140), (.3, 158), (.6, 135), (.9, 158), (1.2, 140)])
    c["move"]("hips", [(0, (0, 0)), (.15, (0, 6)), (.3, (0, 0)), (.45, (0, 6)), (.6, (0, 0)), (.75, (0, 6)), (.9, (0, 0)), (1.05, (0, 6)), (1.2, (0, 0))])
    c["legs"]([(0, 0), (.3, 4), (.6, 0), (.9, 4), (1.2, 0)])
    c["heads"]([(0, 5), (.3, -5), (.6, 5), (.9, -5), (1.2, 5)])
    c["rot"]("chest", [(0, -2), (.6, 2), (1.2, -2)])
    c["attach"]("mouth", [(0, "mouth_cheer")])
    c["attach"]("wave_hand", [(0, None)])
    return clips
