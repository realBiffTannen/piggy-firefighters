#!/usr/bin/env python3
# PIGGY FIREFIGHTERS audio lane: copied from the family tool set (LUCKY audio/tools/limit_loop.py), code unchanged below.
# usage: python3 audio/tools/limit_loop.py --raw in.wav --limit 0.89 --out out.mp3 --wav out.wav --json out.json [--rotate-auto]
"""Apply a lookahead limiter with cyclic context; preserve exact loop length/phase."""
import argparse
import json
import subprocess
import numpy as np
from loopkit import SR, decode, encode_mp3, encode_wav, ebur128, report, sha256, rotate, rotation_search

ap = argparse.ArgumentParser()
ap.add_argument('--raw', required=True)
ap.add_argument('--limit', type=float, required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--wav', required=True)
ap.add_argument('--json', required=True)
ap.add_argument('--rotate-auto', action='store_true')
a = ap.parse_args()
x = decode(a.raw)
n = len(x)
filters = f'alimiter=limit={a.limit}:level=0:attack=5:release=50:latency=1'
# The middle cycle has settled lookahead/release state on both sides of its seam.
raw = np.tile(x, (3, 1)).astype('<f4').tobytes()
p = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-f', 'f32le',
                    '-ar', str(SR), '-ac', '2', '-i', '-', '-af', filters,
                    '-f', 'f32le', '-acodec', 'pcm_f32le', '-'],
                   input=raw, capture_output=True, check=True)
decoded = np.frombuffer(p.stdout, dtype='<f4').reshape(-1, 2).astype(float)
assert len(decoded) == 3 * n
y = decoded[n:2 * n]
assert len(y) == n and np.max(np.abs(y)) <= a.limit + 0.00001
rotation = 0
if a.rotate_auto:
    rotation, _ = rotation_search(y, onset_weight=3, hf_weight=2)
    y = rotate(y, rotation)
encode_wav(y, a.wav)
encode_mp3(y, a.out, 320)
back = decode(a.out)
assert len(back) == n
record = {'source': a.raw, 'sourceSha256': sha256(a.raw), 'filter': filters,
          'cyclicContextCopies': 3, 'selectedCopy': 1, 'samples': n,
          'rotationAfterLimitingSamples': rotation,
          'inputPeak': float(np.max(np.abs(x))),
          'outputPeak': float(np.max(np.abs(y))),
          'masterSha256': sha256(a.out), 'masterBytes': len(open(a.out, 'rb').read()),
          'master': report(back, 'limited loop, decoded master:'),
          'lufs': ebur128(a.out)}
open(a.json, 'w').write(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
