#!/bin/bash
# OKO nezavisnost: proveri sistemske + venv zavisnosti; ako fale, ponudi instalaciju
# (GTK prozorčić sa copy-paste uputstvom + INSTALL dugmetom; fallback zenity/terminal).
set -u
HERE="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
cd "$HERE" || exit 1

APT=()
command -v xdotool >/dev/null 2>&1 || APT+=(xdotool)
python3 -c 'import gi; gi.require_version("Gtk","3.0"); from gi.repository import Gtk' 2>/dev/null \
  || APT+=(python3-gi gir1.2-gtk-3.0)

if [ ${#APT[@]} -gt 0 ]; then
  if python3 -c 'import gi; gi.require_version("Gtk","3.0"); from gi.repository import Gtk' 2>/dev/null; then
    python3 "$HERE/scripts/deps_dialog.py" --apt "${APT[*]}" || exit 1
  elif command -v zenity >/dev/null 2>&1; then
    zenity --question --title="OKO — zavisnosti" \
      --text="Nedostaje: ${APT[*]}

Instaliraj:
sudo apt-get install -y ${APT[*]}" \
      --ok-label="INSTALL" --cancel-label="Zatvori" \
      && pkexec apt-get install -y "${APT[@]}" || exit 1
  else
    echo "OKO: nedostaje: ${APT[*]}" >&2
    echo "Instaliraj: sudo apt-get install -y ${APT[*]}" >&2
    command -v notify-send >/dev/null 2>&1 && \
      notify-send "OKO — zavisnosti" "sudo apt-get install -y ${APT[*]}"
    exit 1
  fi
fi

# venv (--system-site-packages: gi/GTK iz sistema) + pip python-xlib
if [ ! -x ./.venv/bin/python ]; then
  python3 -m venv --system-site-packages .venv || { echo "venv fail" >&2; exit 1; }
fi
if ! ./.venv/bin/python -c 'import Xlib' 2>/dev/null; then
  ./.venv/bin/pip install -q -r requirements.txt || { echo "pip fail (offline?)" >&2; exit 1; }
fi
exit 0
