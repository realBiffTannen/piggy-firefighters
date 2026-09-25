import os, glob
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS=None
PF='/home/user/piggy-firefighters'; S=PF+'/apps/piggy_firefighters/static/assets'
OUT='/tmp/claude-0/-home-user/cded9580-0537-5335-9bd1-733f7d545b8e/scratchpad/audit2'
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
def checker(w,h,s=12):
    im=Image.new('RGB',(w,h),(200,200,200)); d=ImageDraw.Draw(im)
    for y in range(0,h,s):
        for x in range(0,w,s):
            if (x//s+y//s)%2: d.rectangle([x,y,x+s-1,y+s-1],fill=(150,150,150))
    return im
def sheet(paths, name, cellh=260, cols=4, bg=(40,44,56), maxw=None):
    tiles=[]
    for p in paths:
        im=Image.open(p).convert('RGBA')
        k=cellh/im.height
        if maxw and im.width*k>maxw: k=maxw/im.width
        sm=im.resize((max(1,round(im.width*k)),max(1,round(im.height*k))),Image.LANCZOS)
        t=checker(sm.width,sm.height).convert('RGBA'); t.alpha_composite(sm)
        lab=Image.new('RGB',(max(sm.width,160),sm.height+16),bg); lab.paste(t.convert('RGB'),(0,16))
        ImageDraw.Draw(lab).text((2,1),os.path.relpath(p,S)+f' {im.width}x{im.height}',fill=(220,220,220),font=F)
        tiles.append(lab)
    rows=[tiles[i:i+cols] for i in range(0,len(tiles),cols)]
    W=max(sum(t.width+6 for t in r) for r in rows); H=sum(max(t.height for t in r)+6 for r in rows)
    o=Image.new('RGB',(W,H),bg); y=0
    for r in rows:
        x=0
        for t in r: o.paste(t,(x,y)); x+=t.width+6
        y+=max(t.height for t in r)+6
    o.save(f'{OUT}/fam_{name}.png'); print(name, o.size)
g=lambda pat: sorted(glob.glob(S+'/'+pat))
sheet(g('environment/*_landscape.webp'),'env_land',cellh=300,cols=2)
sheet(g('environment/*_portrait.webp'),'env_port',cellh=420,cols=4)
sheet(g('buycards/*.webp'),'buycards',cellh=256,cols=3)
sheet(g('splash/card_*.webp'),'splash_cards',cellh=256,cols=3)
sheet(g('splash/shutter*.webp'),'splash_shutter',cellh=200,cols=1)
sheet(g('maxwin/*.webp'),'maxwin',cellh=420,cols=2)
sheet(g('winrungs/signs/*.webp'),'signs',cellh=240,cols=3)
sheet(g('winrungs/pieces/*_sheet.webp'),'pieces',cellh=150,cols=2)
sheet(g('winrungs/coins/*.webp')+g('winrungs/fx/*.webp'),'coins_fx',cellh=200,cols=3,maxw=700)
sheet(g('ui_scene/*.webp'),'ui_scene',cellh=260,cols=4,maxw=560)
sheet(g('features/rescue/room_*.webp'),'rooms',cellh=180,cols=10)
sheet([p for p in g('features/rescue/*.webp') if '/room_' not in p],'rescue_props',cellh=200,cols=4,maxw=600)
sheet(g('branding/*'),'branding',cellh=300,cols=2)
