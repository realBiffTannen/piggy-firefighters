import hashlib, os, glob, collections, json, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
def h(p):
    m=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20), b''): m.update(c)
    return m.hexdigest()
IMG=('.png','.webp','.jpg','.jpeg','.avif','.gif')
def dhash(p):
    try:
        im=Image.open(p)
        if getattr(im,'n_frames',1)>1: im.seek(0)
        im=im.convert('RGBA')
        a=np.asarray(im).astype(np.float32)
        rgb=a[...,:3]*(a[...,3:4]/255.0)+ (255-a[...,3:4])*0.5  # composite on mid grey
        g=Image.fromarray(rgb.mean(axis=2).astype(np.uint8)).resize((17,16),Image.BILINEAR)
        g=np.asarray(g).astype(np.int16)
        return (g[:,1:]>g[:,:-1]).flatten(), im.size
    except Exception as e:
        return None, None
donors={}; donor_imgs=[]
roots=[]
for repo in ['/home/user/lucky','/home/user/piggy-builders-3','/home/user/piggy-police']:
    # whole repo files (exclude node_modules/.git/build outputs) for sha; images for dhash
    for dp,dns,fs in os.walk(repo):
        dns[:]=[d for d in dns if d not in ('node_modules','.git','.svelte-kit','.turbo')]
        for f in fs:
            p=os.path.join(dp,f)
            try:
                if os.path.getsize(p)<64: continue
                donors.setdefault(h(p), p)
            except Exception: pass
            if f.lower().endswith(IMG) and ('/static/assets/' in p or '/thumbnail/' in p or '/art-src/' in p):
                donor_imgs.append(p)
print('donor files hashed', len(donors), 'donor images for dHash', len(donor_imgs), flush=True)
dh=[]
for p in donor_imgs:
    d,sz=dhash(p)
    if d is not None: dh.append((p,d,sz))
D=np.array([x[1] for x in dh])
PF='/home/user/piggy-firefighters'
S=PF+'/apps/piggy_firefighters/static/assets'
fams=['sprites','environment','features','ui_scene','buycards','splash','winrungs','maxwin','branding','ambient']
targets=[(f, os.path.join(S,f)) for f in fams]+[('parts',PF+'/art-src/animation/parts'),('thumbnail',PF+'/thumbnail')]
out={'sha_matches':[], 'near':[], 'per_family':{}}
for fam,root in targets:
    n=0; b=0
    for dp,_,fs in os.walk(root):
        for f in sorted(fs):
            p=os.path.join(dp,f); n+=1; b+=os.path.getsize(p)
            if os.path.getsize(p)>=64:
                d=donors.get(h(p))
                if d: out['sha_matches'].append((os.path.relpath(p,PF), d))
            if f.lower().endswith(IMG) and len(D):
                q,sz=dhash(p)
                if q is None: continue
                dist=(D!=q).sum(axis=1)
                i=int(dist.argmin())
                if dist[i]<=10:
                    # exclude trivially flat images (blank) — record anyway with flag
                    out['near'].append((os.path.relpath(p,PF), dh[i][0], int(dist[i]), sz, dh[i][2]))
    out['per_family'][fam]={'files':n,'bytes':b}
json.dump(out, open(sys.argv[1],'w'), indent=1)
print('SHA MATCHES', len(out['sha_matches']))
for m in out['sha_matches']: print('  ', m)
print('NEAR (dHash<=10/256)', len(out['near']))
for m in out['near']: print('  ', m)
print(json.dumps(out['per_family'], indent=0))
