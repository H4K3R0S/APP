#!/usr/bin/env bash
# Verifikuje da Gambit ima frameless seamless window chrome.
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"
fail(){ echo "FAIL: $1"; exit 1; }

# Frameless prozor.
grep -q 'frame: false' "$R/main.js" || fail "main.js nema frame: false"

# IPC handleri (main) + most (preload).
grep -q "win:minimize" "$R/main/ipc.js" || fail "ipc.js nema win:minimize"
grep -q "win:maxToggle" "$R/main/ipc.js" || fail "ipc.js nema win:maxToggle"
grep -q "win:close" "$R/main/ipc.js" || fail "ipc.js nema win:close"
grep -q "winMinimize" "$R/preload.cjs" || fail "preload.cjs nema winMinimize u gambitAPI"
grep -q "winMaxToggle" "$R/preload.cjs" || fail "preload.cjs nema winMaxToggle"
grep -q "winClose" "$R/preload.cjs" || fail "preload.cjs nema winClose"

# Vendored css + link + mount + accent.
[ -f "$R/src/vendor/window-chrome/window-chrome.css" ] || fail "vendored css missing (src/vendor)"
grep -q 'window-chrome.css' "$R/src/index.html" || fail "index.html ne linkuje window-chrome.css"
grep -q 'id="wc-root"' "$R/src/index.html" || fail "index.html nema #wc-root"
grep -q 'mountTitleBar' "$R/src/js/renderer.js" || fail "renderer.js ne poziva mountTitleBar"
grep -Eq -- '--wc-accent-rgb:[[:space:]]*251,[[:space:]]*191,[[:space:]]*36' "$R/src/css/global.css" || fail "global.css nema gold --wc-accent-rgb"

echo "OK"
