# Chief spray pilot

Work in progress, using original Piggy Firefighters art only. No accepted rig exists yet.
The pilot deliberately contains only `spray_start`, `spray_loop`, and `spray_end`;
the complete contract gate must continue to fail until the remaining clips are authored.

`author_pilot.py` requires Claude's complete `parts/pf_chief/registration.json`
and a `pilot-layout.json` measured against that exact manifest hash. It preserves
source image bytes in each draft's copied textures, registration and layout. Spine
mesh UVs separate painted regions, weighted sleeves bind to two-bone IK chains with
half-angle elbow helpers, and separate gripping hands share the nozzle's transform.
Anatomical RIGHT is image LEFT in the supplied registration records.

The root is neutral at canvas `(512,1440)`. The actual master's standing silhouette
is scaled to 420px. Boots remain fixed; upper legs, chest, sleeve meshes, independent
face/helmet/coat parts provide the articulation. Source PNGs are never repainted by
this script. New hidden paint, if required after the pilot review, returns to the art lane.
The attached hose selects the flexible fabric pixels from this title's original
`pf_rookie/pieces/hose_flexible.png`; it introduces no generated or repainted pixels.

Generate each draft in a fresh directory:

```sh
python3 -B art-src/animation/rigs/pf_chief/test_author_pilot.py
python3 -B art-src/animation/rigs/pf_chief/author_pilot.py \
  --output art-src/animation/rigs/pf_chief/drafts/pilot-v009
```

Import the resulting `pf_chief.json` into a NEW `pf_chief.spine` using the pinned
4.2.43 CLI commands in `qa/codex/animation/AUTHORING.md`; never overwrite a native
project. That imported project is authoritative. Preserve each draft rather than
re-importing over any editor changes. Export to a fresh directory with
`pilot.export.json`: straight alpha, 1×, at most 2048px atlas pages.

The CLI omits its cached setup AABB after JSON import. `finish_export.mjs` preserves
the native export and makes a separate runtime copy, deriving ONLY the four
`skeleton.x/y/width/height` fields with installed spine-core4.2.74 setup pose + IK
and `Skeleton.getBounds`. The derivation and hashes appear in its source record.
It does not change geometry, clips, weights, events or textures.

Native drafts are retained. v001 exposed opposite UV-hull winding and missing
editor edge metadata; v002 corrected both. v003 improved arm layering and volume;
v004 is an unpromoted duplicate after an incoming unused source was empty. v005
tucked the far elbow. v006 connected the original hose. v007 seated the sleeve tip
in the independent wrist; v008 also made the penultimate forearm section transverse
and tapered, removing the red lip exposed during the slow raise.
Original62725b3 registration is preserved under `registered-source/` and v001–v005;
v006 records r2 metadata after verifying all previously used pixel hashes unchanged.

Review the actual export in the development pilot viewer before further clips:
both grip/cuff contacts throughout motion, sleeve bends, fixed boot soles, face and
helmet assembly, nozzle-axis anchor, and exact start/loop/end joins at normal and
quarter speed, desktop and phone size. `spray_on` is at .44s after aim/contact;
`spray_off` is at time zero of the .5s end. Static checks never certify motion craft.

Current evidence: six focused authoring safeguards PASS; native4.2.43 import/export
of v002 onward PASS without warnings; limited static export preflight PASS.
Actual v002 onward browser images exist under their draft review folders. Older arm
poses were rejected. v008 has desktop and phone videos of the actual development
spray sequence at normal and quarter speed (0.6s start, 0.8s loop hold, 0.5s end;
mixes 0/0.15s), with no page errors and the real spray events recorded in capture.json.
The coordinator's separate sequence-control probe does not certify motion craft.
v008's visual acceptance is pending; full ten-clip contract, mounted-gameplay,
device and interruption motion review remain incomplete. Current static runtime files are a LOCAL
AUTHORING PILOT, not an accepted production rig.
