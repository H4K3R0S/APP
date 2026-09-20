#!/bin/bash
# OKO launcher — dvoklik pokreće daemon u pozadini (single-instance lock štiti od duplog).
cd "$(dirname "$(readlink -f "$0")")" || exit 1
export DISPLAY="${DISPLAY:-:0.0}"
# X autorizacija (nužna kad se pokreće otkačeno od sesije; dvoklik u sesiji je već ima).
export XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"
# Nezavisnost: proveri zavisnosti; ako fale, ponudi instalaciju (prozorčić/INSTALL).
if ! ./scripts/check_deps.sh; then
  exit 1
fi
exec ./.venv/bin/python -m daemon
