#!/usr/bin/env bash
# Headless smoke test for one page: loads it in Edge (server on :5179 must be running),
# prints the number of sections rendered in #dh-main and any console errors.
# Usage: bash tools/check-page.sh options.html [width]
page="${1:?page}"; width="${2:-1440}"
edge="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
prof="$(cygpath -w "${TMP:-/tmp}")\dh-check-$(echo "$page" | tr -c 'a-zA-Z0-9' '_')-$width"
out=$("$edge" --headless=new --disable-gpu --no-first-run --disable-extensions --user-data-dir="$prof" --window-size="$width,900" \
  --enable-logging=stderr --v=0 --virtual-time-budget=6000 --dump-dom "http://localhost:5179/$page" 2>"$prof.err")
sections=$(printf '%s' "$out" | grep -o 'id="dh-main"' | wc -l)
cards=$(printf '%s' "$out" | grep -o 'class="dh-card' | wc -l)
canv=$(printf '%s' "$out" | grep -o '<canvas' | wc -l)
errs=$(grep -E 'CONSOLE' "$prof.err" | grep -E 'localhost:5179|Uncaught' | sed 's/^.*CONSOLE/CONSOLE/' | head -10)
echo "page=$page width=$width main=$sections cards=$cards canvases=$canv"
if [ -n "$errs" ]; then echo "ERRORS:"; echo "$errs"; else echo "no console errors"; fi
