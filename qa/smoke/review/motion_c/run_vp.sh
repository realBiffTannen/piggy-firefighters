#!/bin/bash
# usage: run_vp.sh <WxH> <results-name> <capture-ms> fixtures...
cd /Users/jbull/code/piggy-firefighters
VP="$1"; RN="$2"; CAP="$3"; shift 3
export PLAYWRIGHT_MODULE=/Users/jbull/code/ganja_farm/node_modules/playwright
export GAME_URL=http://127.0.0.1:3003/
export RGS_HOST=127.0.0.1:3043
export CAPTURE_EVERY_MS="$CAP"
export VIEWPORT="$VP"
export RESULTS_NAME="$RN"
export STACK_LOG="${STACK_LOG:-stacks.log}"
node qa/smoke/review/motion_c/smoke.mjs "$@"
echo "EXIT $?"
