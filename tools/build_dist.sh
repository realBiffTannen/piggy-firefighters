#!/usr/bin/env bash
# Production build -> game/dist. The /rigs route is a dev-only rig viewer: it is moved out of the
# route tree for the build so none of its code reaches the shipped bundle, then restored.
set -u
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# One build at a time: the log, pid, staging dir and the held /rigs route are fixed paths, so a second concurrent
# build (another lane, a reviewer) would overwrite them. Wait up to 15 minutes for the lock.
mkdir -p "$REPO/qa/build"
if command -v flock >/dev/null 2>&1 && [ -z "${PFF_BUILD_LOCKED:-}" ]; then
  exec env PFF_BUILD_LOCKED=1 flock -w 900 "$REPO/qa/build/.lock" "$0" "$@"
fi
APP=$REPO/apps/piggy_firefighters
LOG=$REPO/qa/build/build.log
HOLD=$REPO/.rigs_route_hold
cd $APP
[ -d src/routes/rigs ] && mv src/routes/rigs $HOLD
restore() { [ -d $HOLD ] && mv $HOLD $APP/src/routes/rigs; }
trap restore EXIT
rm -rf build
( node $APP/node_modules/vite/bin/vite.js build > $LOG 2>&1 & echo $! > $REPO/qa/build/build.pid )
for i in $(seq 1 240); do
  if grep -q "Wrote site to" $LOG 2>/dev/null; then break; fi
  if ! kill -0 $(cat $REPO/qa/build/build.pid) 2>/dev/null; then break; fi
  sleep 2
done
sleep 2
# Terminate ONLY this build's own process tree (never an unscoped `pkill -f "vite build"`: the Mac is shared
# between lanes and another lane's vite may be running). Children first, then the pid.
BPID=$(cat $REPO/qa/build/build.pid 2>/dev/null)
if [ -n "$BPID" ]; then pkill -TERM -P "$BPID" 2>/dev/null; kill -TERM "$BPID" 2>/dev/null; sleep 1; pkill -KILL -P "$BPID" 2>/dev/null; kill -KILL "$BPID" 2>/dev/null; fi
if ! grep -q "Wrote site to" $LOG; then echo "BUILD FAILED"; tail -30 $LOG; exit 1; fi
# bundleStrategy 'inline' puts the CSS inside index.html, so a url(./file) that Vite wrote relative to
# the emitted stylesheet resolves against the PAGE and 404s. Point those at the real emitted files.
python3 - "$APP/build" <<'PY'
import re,sys,os
root=sys.argv[1]; p=os.path.join(root,'index.html'); s=open(p,encoding='utf-8').read()
assets=set(os.listdir(os.path.join(root,'_app','immutable','assets')))
def fix(m):
    name=m.group(2)
    return 'url(./_app/immutable/assets/%s)'%name if name in assets else m.group(0)
n=re.sub(r'url\((\./)?([A-Za-z0-9_.-]+\.(?:ttf|otf|woff2?|png|webp|svg|jpg))\)',fix,s)
open(p,'w',encoding='utf-8').write(n)
print('css asset urls rewritten:', len(re.findall(r'url\(\./_app/immutable/assets/',n)))
PY
rm -f $APP/build/rigs.html
# bundleStrategy 'inline' also leaves the emitted stylesheets (two near-identical ~84 KB style.*.css, one with a
# root-relative font url) in _app/immutable/assets although nothing links them: the page carries its CSS inline.
# Drop every emitted .css that no shipped .html / .js / .css names (gate loop r1, seats A and C).
python3 - "$APP/build" <<'PY'
import os,sys
root=sys.argv[1]; d=os.path.join(root,'_app','immutable','assets')
css=[f for f in os.listdir(d) if f.endswith('.css')]
texts=[]
for dp,_,fs in os.walk(root):
    for f in fs:
        if f.endswith(('.html','.js','.css','.json')):
            texts.append((os.path.join(dp,f),open(os.path.join(dp,f),encoding='utf-8',errors='ignore').read()))
for c in css:
    if not any(c in t for p,t in texts if not p.endswith(c)):
        os.remove(os.path.join(d,c)); print('unlinked stylesheet dropped:',c)
PY
if [ "${1:-}" = "--no-sync" ]; then echo "BUILD OK (staged in apps/piggy_firefighters/build, game/dist untouched)"; du -sh $APP/build; exit 0; fi
rsync -a --delete $APP/build/ $REPO/game/dist/
echo "BUILD OK"; du -sh $REPO/game/dist; find $REPO/game/dist -type f | wc -l
