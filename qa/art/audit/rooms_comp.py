import json
from PIL import Image
D='/home/user/piggy-firefighters/apps/piggy_firefighters/static/assets/features/rescue/'
OUT='/tmp/claude-0/-home-user/cded9580-0537-5335-9bd1-733f7d545b8e/scratchpad/audit2/'
M=json.load(open(D+'rooms.meta.json'))
rows=[]
for fac,pre in (('block_facade.webp',''),('block_facade_inferno.webp','inferno_')):
    for st in ('roaring','smouldering','safe'):
        f=Image.open(D+fac).convert('RGBA')
        pad=60
        c=Image.new('RGBA',(f.width,f.height+pad),(30,42,74,255)); c.alpha_composite(f,(0,pad))
        for r in M['rooms']:
            x0,y0,x1,y1=r['box_in_facade']
            im=Image.open(D+f"room_{r['reel']}_{pre}{st}.webp").convert('RGBA')
            c.alpha_composite(im,(x0,y0+pad))
        rows.append(c)
W=rows[0].width; H=sum(r.height for r in rows)
o=Image.new('RGB',(W,H)); y=0
for r in rows: o.paste(r.convert('RGB'),(0,y)); y+=r.height
o.save(OUT+'rooms_on_facade.png'); print(o.size)
# zoom crop of one roaring room to check seams
rows[0].crop((0,0,460,rows[0].height)).resize((920,(rows[0].height)*2)).convert('RGB').save(OUT+'rooms_zoom_roaring.png')
rows[3].crop((0,0,460,rows[3].height)).resize((920,(rows[3].height)*2)).convert('RGB').save(OUT+'rooms_zoom_inferno_roaring.png')
