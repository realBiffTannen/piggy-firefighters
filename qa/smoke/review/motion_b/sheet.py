#!/usr/bin/env python3
"""contact sheets: sheet.py <prefix> <cols> <thumb_w> [start end] -> sheets/<prefix>.sheetK.png"""
import sys, os, re, glob
from PIL import Image, ImageDraw, ImageFont
HERE = os.environ.get('DIR') or os.path.dirname(os.path.abspath(__file__))
prefix, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
start = int(sys.argv[4]) if len(sys.argv) > 4 else 1
end = int(sys.argv[5]) if len(sys.argv) > 5 else 10**9
per = int(sys.argv[6]) if len(sys.argv) > 6 else cols * 4
files = []
for f in glob.glob(os.path.join(HERE, glob.escape(prefix) + '.*.' + os.environ.get('EXT','png'))):
    m = re.search(r'\.(\d+)\.(png|jpg)$', f)
    if m and start <= int(m.group(1)) <= end:
        files.append((int(m.group(1)), f))
files.sort()
os.makedirs(os.path.join(HERE, 'sheets'), exist_ok=True)
try:
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
except Exception:
    font = ImageFont.load_default()
out = []
for k in range(0, len(files), per):
    chunk = files[k:k + per]
    im0 = Image.open(chunk[0][1])
    th = round(im0.height * tw / im0.width)
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (n, f) in enumerate(chunk):
        try:
            im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
        except Exception as e:
            continue
        x, y = (i % cols) * tw, (i // cols) * (th + 22)
        sheet.paste(im, (x, y + 22))
        d.text((x + 4, y + 2), str(n), fill=(255, 255, 0), font=font)
    p = os.path.join(HERE, 'sheets', f'{prefix}.{chunk[0][0]:03d}-{chunk[-1][0]:03d}.png')
    sheet.save(p)
    out.append(p)
print('\n'.join(out))
print(len(files), 'frames')
