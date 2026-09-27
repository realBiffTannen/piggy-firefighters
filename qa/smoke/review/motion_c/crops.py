#!/usr/bin/env python3
"""crops.py <prefix> <x0,y0,x1,y1 in CSS px> <scale> <cols> <out-tag> n1 n2 ... (or a-b ranges)
Crops frames (device pixels = CSS px * dsf, dsf inferred from width vs viewport tag) and tiles them."""
import sys, os, re
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
prefix, box, scale, cols, tag = sys.argv[1], sys.argv[2], float(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
x0, y0, x1, y1 = map(int, box.split(','))
vw = int(re.search(r'@(\d+)x\d+$', prefix).group(1))
ns = []
for a in sys.argv[6:]:
    if '-' in a:
        lo, hi = map(int, a.split('-')); ns += list(range(lo, hi + 1))
    else:
        ns.append(int(a))
avail = {}
for f in os.listdir(HERE):
    m = re.match(re.escape(prefix) + r'\.(\d+)\.png$', f)
    if m: avail[int(m.group(1))] = f
ns = [n for n in ns if n in avail]
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 20)
except Exception: font = ImageFont.load_default()
tiles = []
for n in ns:
    im = Image.open(os.path.join(HERE, avail[n])).convert('RGB')
    dsf = im.width / vw
    c = im.crop((int(x0 * dsf), int(y0 * dsf), int(x1 * dsf), int(y1 * dsf)))
    c = c.resize((int((x1 - x0) * scale), int((y1 - y0) * scale)), Image.LANCZOS)
    tiles.append((n, c))
if not tiles: print('no frames'); sys.exit(0)
tw, th = tiles[0][1].size
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 24)), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, (n, c) in enumerate(tiles):
    x, y = (i % cols) * tw, (i // cols) * (th + 24)
    sheet.paste(c, (x, y + 24)); d.text((x + 4, y + 2), str(n), fill=(255, 255, 0), font=font)
p = os.path.join(HERE, f'crop_{tag}.png'); sheet.save(p); print(p, [n for n, _ in tiles])
