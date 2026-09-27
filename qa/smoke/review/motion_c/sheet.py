#!/usr/bin/env python3
"""Contact sheets: sheet.py <prefix> [cols] [per_sheet] [thumb_w] [start] [end]
Frames <prefix>.<n>.png sorted numerically; sheets written as sheet_<tag>_<k>.png in this dir."""
import sys, re, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
prefix = sys.argv[1]
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
per = int(sys.argv[3]) if len(sys.argv) > 3 else 20
tw = int(sys.argv[4]) if len(sys.argv) > 4 else 360
start = int(sys.argv[5]) if len(sys.argv) > 5 else 0
end = int(sys.argv[6]) if len(sys.argv) > 6 else 10**9
rx = re.compile(re.escape(prefix) + r'\.(\d+)\.png$')
frames = sorted(((int(m.group(1)), f) for f in os.listdir(HERE) if (m := rx.match(f))), key=lambda t: t[0])
frames = [t for t in frames if start <= t[0] <= end]
tag = re.sub(r'[^A-Za-z0-9]+', '_', prefix)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except Exception:
    font = ImageFont.load_default()
out = []
for k in range(0, len(frames), per):
    chunk = frames[k:k + per]
    im0 = Image.open(os.path.join(HERE, chunk[0][1]))
    th = round(im0.height * tw / im0.width)
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (20, 20, 20))
    d = ImageDraw.Draw(sheet)
    for i, (n, f) in enumerate(chunk):
        try:
            im = Image.open(os.path.join(HERE, f)).convert('RGB').resize((tw, th), Image.LANCZOS)
        except Exception as e:
            continue
        x, y = (i % cols) * tw, (i // cols) * (th + 22)
        sheet.paste(im, (x, y + 22))
        d.text((x + 4, y + 2), str(n), fill=(255, 255, 0), font=font)
    p = os.path.join(HERE, f'sheet_{tag}_{start}_{k // per:02d}.png')
    sheet.save(p)
    out.append((p, chunk[0][0], chunk[-1][0]))
for p, a, b in out:
    print(p, a, b)
print('frames', len(frames))
