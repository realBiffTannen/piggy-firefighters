#!/bin/bash
# usage: lane.sh <script> <port> <viewport> <capture_ms> <results_name> <log> <spec...>   (WAIT_MS from env, default 45 min)
cd /Users/jbull/code/piggy-firefighters
S="$1"; P="$2"; VP="$3"; CAP="$4"; RN="$5"; LOG="$6"; shift 6
export PLAYWRIGHT_MODULE=/Users/jbull/code/ganja_farm/node_modules/playwright GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:$P CAPTURE_EVERY_MS="$CAP" VIEWPORT="$VP" RESULTS_NAME="$RN" WAIT_MS="${WAIT_MS:-2700000}"
node "qa/smoke/review/motion_a/$S" "$@" > "qa/smoke/review/motion_a/$LOG" 2>&1
echo "EXIT $?" >> "qa/smoke/review/motion_a/$LOG"
