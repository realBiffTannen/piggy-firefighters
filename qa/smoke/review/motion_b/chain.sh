#!/bin/bash
# usage: chain.sh <viewport> <port> <tag>
cd /Users/jbull/code/piggy-firefighters
VP="$1"; PORT="$2"; TAG="$3"
export PLAYWRIGHT_MODULE=/Users/jbull/code/ganja_farm/node_modules/playwright GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:$PORT CAPTURE_EVERY_MS=0 VIEWPORT="$VP"
RESULTS_NAME=results_nocap_$TAG.json node qa/smoke/review/motion_b/smoke.mjs base_backdraft_win@off alarm_call_false@off
RESULTS_NAME=results_nocap_rescue_$TAG.json node qa/smoke/review/motion_b/smoke_cast.mjs base_trigger_rescue@off
echo CHAIN-DONE
