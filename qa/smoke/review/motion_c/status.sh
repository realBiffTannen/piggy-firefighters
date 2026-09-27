#!/bin/bash
cd /Users/jbull/code/piggy-firefighters/qa/smoke/review/motion_c
echo "--- desktop"; cat run_desktop.log
echo "--- phone"; cat run_phone.log
shopt -s nullglob
for f in *.png; do echo "${f%.*.png}"; done | sed 's/\.[0-9]*$//' | sort | uniq -c
