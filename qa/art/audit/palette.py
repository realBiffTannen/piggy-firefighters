import os, glob, json
import numpy as np, cv2
from PIL import Image
S='/home/user/piggy-firefighters/apps/piggy_firefighters/static/assets'
PAL={'engine_red':'#D7262B','brass_gold':'#E9B23B','hydrant_yellow':'#F5D23C','hose_cream':'#F4E9D2','smoke_grey':'#7C8AA0','dusk_navy':'#1E2A4A','flame_orange':'#FF7A1A'}
def hx(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],np.uint8)
def lab(rgb): return cv2.cvtColor(rgb.reshape(-1,1,3).astype(np.uint8),cv2.COLOR_RGB2LAB).reshape(-1,3).astype(float)*np.array([100/255,1,1])-np.array([0,128,128])
PL={k:lab(hx(v)[None])[0] for k,v in PAL.items()}
INK=lab(np.array([[42,26,16]],np.uint8))[0]
groups={
 'symbols':'sprites/symbolsCartoon/sym_*.webp','symbols_tall':'sprites/symbolsCartoonTall/symT_*.webp',
 'environment':'environment/*.webp','buycards':'buycards/*.webp','splash':'splash/*.webp','maxwin':'maxwin/*.webp',
 'signs':'winrungs/signs/*.webp','pieces':'winrungs/pieces/*.webp','coins':'winrungs/coins/*.webp',
 'ui_scene':'ui_scene/*.webp','rescue':'features/rescue/*.webp','branding':'branding/*'}
FIRE=('W_blaze','backdraft','inferno','roaring','smouldering','ember','card_maxwin','max_win','spark','card_backdraft','card_rescue','rescue.webp','card_chief')
out={}
for g,pat in groups.items():
    for p in sorted(glob.glob(os.path.join(S,pat))):
        a=np.asarray(Image.open(p).convert('RGBA'))
        m=a[...,3]>=250
        px=a[...,:3][m]
        if len(px)>400000: px=px[np.random.default_rng(0).choice(len(px),400000,replace=False)]
        L=lab(px)
        hsv=cv2.cvtColor(px.reshape(-1,1,3),cv2.COLOR_RGB2HSV).reshape(-1,3).astype(float)
        H=hsv[:,0]*2; Sa=hsv[:,1]/255; V=hsv[:,2]/255
        dark=L[:,0]<22
        ink=px[dark]
        inkmed=np.median(ink,0) if len(ink) else None
        red=((H<12)|(H>348))&(Sa>0.65)&(V>0.55)
        yel=(H>=40)&(H<=58)&(Sa>0.55)&(V>0.75)
        de=lambda sel,k: float(np.linalg.norm(np.median(L[sel],0)-PL[k])) if sel.sum()>50 else None
        near_orange=np.linalg.norm(L-PL['flame_orange'],axis=1)<12
        # nearest-palette share: pixels within dE<20 of any palette colour or ink
        allp=np.stack(list(PL.values())+[INK])
        dmin=np.min(np.linalg.norm(L[:,None,:]-allp[None],axis=2),axis=1)
        out[os.path.relpath(p,S)]=dict(group=g,
            ink_median=[int(x) for x in inkmed] if inkmed is not None else None,
            ink_share=round(float(dark.mean()),3),
            ink_brown=bool(inkmed is not None and inkmed[0]>inkmed[2]+4),
            red_median='#%02X%02X%02X'%tuple(int(x) for x in np.median(px[red],0)) if red.sum()>50 else None,
            dE_red=de(red,'engine_red'),
            yellow_median='#%02X%02X%02X'%tuple(int(x) for x in np.median(px[yel],0)) if yel.sum()>50 else None,
            dE_yellow=de(yel,'hydrant_yellow'), dE_gold=de(yel,'brass_gold'),
            orange_share=round(float(near_orange.mean()),4),
            fire_asset=any(k in p for k in FIRE),
            palette_within20=round(float((dmin<20).mean()),3))
json.dump(out,open('/tmp/claude-0/-home-user/cded9580-0537-5335-9bd1-733f7d545b8e/scratchpad/audit2/palette.json','w'),indent=1)
# summary per group
import collections
G=collections.defaultdict(list)
for k,v in out.items(): G[v['group']].append((k,v))
for g,l in G.items():
    inks=[v['ink_median'] for k,v in l if v['ink_median']]
    brown=sum(v['ink_brown'] for k,v in l)
    dr=[v['dE_red'] for k,v in l if v['dE_red'] is not None]
    dy=[v['dE_yellow'] for k,v in l if v['dE_yellow'] is not None]
    reds=[v['red_median'] for k,v in l if v['red_median']]
    print(f"{g:13s} n={len(l):2d} ink_median≈{np.median(np.array(inks),0).astype(int).tolist() if inks else None} brown_ink={brown}/{len(l)} red_med={collections.Counter(reds).most_common(2)} dE_red med={(np.median(dr) if dr else -1):.1f} max={max(dr) if dr else 0:.1f} dE_yel med={np.median(dy) if dy else 0:.1f} palette<20 med={np.median([v['palette_within20'] for k,v in l]):.2f}")
print('\nOrange (#FF7A1A dE<12) share > 1% in NON-fire assets:')
for k,v in out.items():
    if not v['fire_asset'] and v['orange_share']>0.01: print('  ',k,v['orange_share'])
print('\nInk not brown (pure-black/grey ink):')
for k,v in out.items():
    if v['ink_median'] and not v['ink_brown'] and v['ink_share']>0.02: print('  ',k,v['ink_median'],v['ink_share'])
print('\nRed dE>15 from engine red:')
for k,v in out.items():
    if v['dE_red'] and v['dE_red']>15: print('  ',k,v['red_median'],round(v['dE_red'],1))
