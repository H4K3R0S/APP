#!/bin/bash
# Instalira Gambit.desktop u meni aplikacija i na Desktop (XFCE dvoklik: trusted metapodatak).
# Exec/Icon/Path se prepisuju iz stvarne lokacije repoa (radi i posle premeštanja/kloniranja).
set -eu
ROOT="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
SRC="$ROOT/Gambit.desktop"
chmod +x "$ROOT/gambit.sh"
for DST in "$HOME/.local/share/applications/Gambit.desktop" "$HOME/Desktop/Gambit.desktop"; do
  mkdir -p "$(dirname "$DST")"
  sed -e "s|^Exec=.*|Exec=$ROOT/gambit.sh|" \
      -e "s|^Icon=.*|Icon=$ROOT/assets/icon.png|" \
      -e "s|^Path=.*|Path=$ROOT|" "$SRC" > "$DST"
  chmod +x "$DST"
  gio set "$DST" metadata::trusted true 2>/dev/null || true
done
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
echo "✓ Gambit.desktop → ~/.local/share/applications + ~/Desktop (trusted, putanje iz $ROOT)"
