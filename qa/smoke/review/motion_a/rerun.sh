#!/bin/bash
# usage: rerun.sh <viewport> <spec...>   (CAPTURE_EVERY_MS=0, results to results_nocap_<viewport>.json)
cd /Users/jbull/code/piggy-firefighters
VP="$1"; shift
export PLAYWRIGHT_MODULE=/Users/jbull/code/ganja_farm/node_modules/playwright GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:3041 CAPTURE_EVERY_MS=0 VIEWPORT="$VP" RESULTS_NAME="results_nocap_$VP.json"
node qa/smoke/review/motion_a/smoke.mjs "$@"
echo EXIT $?
