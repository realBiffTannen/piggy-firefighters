import hashlib, os, json, sys, collections
def h(p):
    m=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(1<<20), b''): m.update(c)
    return m.hexdigest()
donors={}; nd=collections.Counter()
for repo in ['/home/user/lucky','/home/user/piggy-builders-3','/home/user/piggy-police']:
    for dp,dns,fs in os.walk(repo):
        dns[:]=[d for d in dns if d not in ('node_modules','.git')]
        for f in fs:
            p=os.path.join(dp,f)
            try:
                if os.path.islink(p) or os.path.getsize(p)<64: continue
                donors.setdefault(h(p), p); nd[repo]+=1
            except Exception: pass
print('donor files hashed', dict(nd), 'unique', len(donors), flush=True)
PF='/home/user/piggy-firefighters'; S=PF+'/apps/piggy_firefighters/static/assets'
fams=['sprites','environment','features','ui_scene','buycards','splash','winrungs','maxwin','branding','ambient']
targets=[(f, os.path.join(S,f)) for f in fams]+[('art-src/animation/parts',PF+'/art-src/animation/parts'),('thumbnail',PF+'/thumbnail'),('art-src/generated',PF+'/art-src/generated')]
res={'matches':[], 'counts':{}}
for fam,root in targets:
    n=0
    for dp,_,fs in os.walk(root):
        for f in fs:
            p=os.path.join(dp,f); n+=1
            if os.path.getsize(p)<64: continue
            d=donors.get(h(p))
            if d: res['matches'].append([os.path.relpath(p,PF), d])
    res['counts'][fam]=n
res['donor_counts']=dict(nd); res['donor_unique']=len(donors)
json.dump(res, open(sys.argv[1],'w'), indent=1)
print(json.dumps(res, indent=1))
