#!/usr/bin/env python3
"""crop.py <file-prefix-with-dir> <ext> <x0,y0,x1,y1 in source px> <out_w per tile> <cols> <out.png> <frames: 1,2,5-9>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
pre, ext, box, tw, cols, out, fr = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), sys.argv[6], sys.argv[7]
x0, y0, x1, y1 = map(int, box.split(','))
nums = []
for part in fr.split(','):
    if '-' in part:
        step = 1
        if ':' in part:
            part, step = part.split(':'); step = int(step)
        a, b = map(int, part.split('-')); nums += list(range(a, b + 1, step))
    else:
        nums.append(int(part))
pad = 3 if ext == 'jpg' else 2
tiles = []
for n in nums:
    p = f'{pre}.{str(n).zfill(pad)}.{ext}'
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGB').crop((x0, y0, x1, y1))
    th = round(im.height * tw / im.width)
    tiles.append((n, im.resize((tw, th), Image.LANCZOS)))
th = tiles[0][1].height
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (40, 40, 40))
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
for i, (n, im) in enumerate(tiles):
    x, y = (i % cols) * tw, (i // cols) * (th + 22)
    sheet.paste(im, (x, y + 22)); d.text((x + 4, y + 2), str(n), fill=(255, 255, 0), font=font)
sheet.save(out); print(out, len(tiles))
