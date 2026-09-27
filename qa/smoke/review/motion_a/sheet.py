import sys, re, glob, os
from PIL import Image, ImageDraw, ImageFont
# usage: sheet.py <name-prefix e.g. base_win@off@1440x900> <thumb_w> <cols> [start] [end] [crop x0,y0,x1,y1] [out]
d = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]; tw = int(sys.argv[2]); cols = int(sys.argv[3])
start = int(sys.argv[4]) if len(sys.argv) > 4 else 1
end = int(sys.argv[5]) if len(sys.argv) > 5 else 10**6
crop = tuple(map(int, sys.argv[6].split(','))) if len(sys.argv) > 6 and sys.argv[6] != '-' else None
out = sys.argv[7] if len(sys.argv) > 7 else None
files = []
for f in glob.glob(os.path.join(d, glob.escape(name) + '.*.png')):
    m = re.match(re.escape(name) + r'\.(\d+)\.png$', os.path.basename(f))
    if m: files.append((int(m.group(1)), f))
files.sort()
files = [x for x in files if start <= x[0] <= end]
if not files: print('none'); sys.exit()
ims = []
for n, f in files:
    im = Image.open(f).convert('RGB')
    if crop: im = im.crop(crop)
    th = int(im.height * tw / im.width)
    ims.append((n, im.resize((tw, th))))
th = max(i.height for _, i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 16)), 'white')
dr = ImageDraw.Draw(sheet)
for k, (n, im) in enumerate(ims):
    x = (k % cols) * tw; y = (k // cols) * (th + 16)
    sheet.paste(im, (x, y + 16)); dr.text((x + 3, y + 2), f'#{n}', fill='black')
out = out or os.path.join(d, 'sheets', f'{name}_{start}-{end}.png')
sheet.save(out); print(out, len(ims), sheet.size)
