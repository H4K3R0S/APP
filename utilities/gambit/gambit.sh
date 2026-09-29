#!/bin/bash
# Gambit launcher (dvoklik): postavlja X okruženje, pri prvom pokretanju sam instalira Electron, pokreće app.
# Argumenti se prosleđuju Electron-u (npr. --dev, --smoke). GAMBIT_NO_SANDBOX=1 dodaje --no-sandbox
# samo za mašine bez user-namespace sandboxa (podrazumevano je Chromium sandbox UKLJUČEN).
cd "$(dirname "$(readlink -f "$0")")" || exit 1
export DISPLAY="${DISPLAY:-:0.0}"
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
export PATH="$HOME/.local/bin:$PATH"

fail() {
  command -v notify-send >/dev/null && notify-send "Gambit" "$1"
  echo "gambit: $1" >&2
  exit 1
}

ELECTRON=./node_modules/electron/dist/electron
if [ ! -x "$ELECTRON" ]; then
  LOG="$(mktemp "${XDG_RUNTIME_DIR:-/tmp}/gambit-install.XXXXXX.log")"
  if [ -f package-lock.json ]; then INSTALL="npm ci"; else INSTALL="npm install"; fi
  $INSTALL --no-audit --no-fund >"$LOG" 2>&1 || fail "Instalacija zavisnosti nije uspela (vidi $LOG)"
  [ -x "$ELECTRON" ] || fail "Electron binarni fajl nedostaje posle instalacije (vidi $LOG)"
fi

EXTRA=()
[ "${GAMBIT_NO_SANDBOX:-0}" = "1" ] && EXTRA+=(--no-sandbox)
exec ./node_modules/.bin/electron . "${EXTRA[@]}" "$@"
