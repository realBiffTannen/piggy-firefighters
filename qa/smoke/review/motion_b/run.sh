#!/bin/bash
# usage: run.sh <viewport> <capture_ms> <results_name> <spec...>
cd /Users/jbull/code/piggy-firefighters
VP="$1"; CAP="$2"; RN="$3"; shift 3
export PLAYWRIGHT_MODULE=/Users/jbull/code/ganja_farm/node_modules/playwright GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:${RGS_PORT:-3042} CAPTURE_EVERY_MS="$CAP" VIEWPORT="$VP" RESULTS_NAME="$RN"
node qa/smoke/review/motion_b/smoke.mjs "$@"
