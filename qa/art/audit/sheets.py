import os, glob, json, sys
from PIL import Image, ImageDraw, ImageFont
Image.MAX_IMAGE_PIXELS=None
PF='/home/user/piggy-firefighters'; S=PF+'/apps/piggy_firefighters/static/assets'
OUT='/tmp/claude-0/-home-user/cded9580-0537-5335-9bd1-733f7d545b8e/scratchpad/audit2'
LIGHT=(244,240,232); DARK=(24,28,40); MID=(30,42,74)
def font(n):
    for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if os.path.exists(f): return ImageFont.truetype(f,n)
    return ImageFont.load_default()
F=font(11)
ORDER=['H1','H2','H3','H4','L1','L2','L3','L4','W','W_blaze','ALARM','GALARM','H1_b','H2_b','H3_b','H4_b','W_b']
def symrow(paths, size, bg, gap=6, labels=True):
    ims=[Image.open(p).convert('RGBA') for p in paths]
    hs=[round(size*im.height/im.width) for im in ims]
    H=max(hs)+(14 if labels else 0)+gap*2
    W=sum(size+gap for _ in ims)+gap
    row=Image.new('RGBA',(W,H),bg+(255,))
    x=gap
    for p,im,h in zip(paths,ims,hs):
        sm=im.resize((size,h),Image.LANCZOS)
        row.alpha_composite(sm,(x,gap+(14 if labels else 0)))
        if labels: ImageDraw.Draw(row).text((x,gap-2),os.path.basename(p).split('.')[0].replace('symT_','').replace('sym_',''),fill=(140,140,140),font=F)
        x+=size+gap
    return row
def stack(rows,bg=(128,128,128)):
    W=max(r.width for r in rows); H=sum(r.height for r in rows)
    o=Image.new('RGBA',(W,H),bg+(255,)); y=0
    for r in rows: o.alpha_composite(r,(0,y)); y+=r.height
    return o.convert('RGB')
sq=[f'{S}/sprites/symbolsCartoon/sym_{k}.webp' for k in ORDER if os.path.exists(f'{S}/sprites/symbolsCartoon/sym_{k}.webp')]
tl=[f'{S}/sprites/symbolsCartoonTall/symT_{k}.webp' for k in ORDER if os.path.exists(f'{S}/sprites/symbolsCartoonTall/symT_{k}.webp')]
# 85 px sheets
stack([symrow(sq,85,LIGHT),symrow(sq,85,DARK),symrow(sq,85,MID)]).save(OUT+'/sym_sq_85.png')
stack([symrow(sq,40,LIGHT),symrow(sq,40,DARK),symrow(sq,40,MID)]).save(OUT+'/sym_sq_40.png')
stack([symrow(tl,85,LIGHT),symrow(tl,85,DARK)]).save(OUT+'/sym_tall_85.png')
stack([symrow(tl,40,LIGHT),symrow(tl,40,DARK)]).save(OUT+'/sym_tall_40.png')
# 40 px enlarged 2x nearest (to judge what the phone shows)
im=Image.open(OUT+'/sym_sq_40.png'); im.resize((im.width*2,im.height*2),Image.NEAREST).save(OUT+'/sym_sq_40_x2.png')
im=Image.open(OUT+'/sym_tall_40.png'); im.resize((im.width*2,im.height*2),Image.NEAREST).save(OUT+'/sym_tall_40_x2.png')
# large review of square symbols at 192
stack([symrow(sq[:9],192,LIGHT),symrow(sq[9:],192,LIGHT)]).save(OUT+'/sym_sq_192.png')
stack([symrow(tl[:9],160,DARK),symrow(tl[9:],160,DARK)]).save(OUT+'/sym_tall_160.png')
print('ok')
