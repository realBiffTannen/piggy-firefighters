#!/bin/bash
# serial: one browser at a time from this shard. usage: run_seq.sh <capture-ms> <results-name> spec@WxH ...
D=/Users/jbull/code/piggy-firefighters/qa/smoke/review/motion_c
CAP="$1"; RN="$2"; shift 2
for item in "$@"; do
  spec="${item%@*}"; vp="${item##*@}"
  echo "START $spec $vp $(date +%T)"
  bash "$D/run_vp.sh" "$vp" "$RN" "$CAP" "$spec"
  echo "DONE $spec $vp $(date +%T)"
done
echo "ALLDONE"
