#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu
prefix="${AIPLC_INSTALL_DIR:-$HOME/.local/closelly-aiplc}"
case "${1:-}" in
  --prefix) [ "$#" -eq 2 ] || exit 64; prefix=$2;;
  --help|-h) echo 'Uso: sh uninstall.sh [--prefix /ruta/de/instalación]'; exit 0;;
  '') ;;
  *) echo 'Usa --help.' >&2; exit 64;;
esac
prefix=${prefix%/}
case "$prefix" in /*) ;; *) echo 'Usa una ruta absoluta.' >&2; exit 1;; esac
[ -n "$prefix" ] && [ "$prefix" != "$HOME" ] && [ ! -L "$prefix" ] &&
  [ "$(cat "$prefix/.installed-by-closelly-aiplc" 2>/dev/null)" = v1 ] ||
  { echo 'La ruta no corresponde a una instalación administrada.' >&2; exit 1; }
[ ! -d "$prefix/.install-lock" ] || { echo 'Hay una instalación en curso.' >&2; exit 1; }
if [ -f "$prefix/.skills-dir" ]; then
  skills=$(cat "$prefix/.skills-dir")
  for item in "$skills"/*; do
    [ -L "$item" ] || continue
    case "$(readlink "$item")" in "$prefix/current/assets/skills/"*) rm -- "$item";; esac
  done
fi
rm -rf -- "$prefix"
echo 'Closelly AI-PLC desinstalado. Tus productos y documentos se conservan.'
echo 'La línea de configuración de la terminal queda inactiva; puedes retirarla si lo deseas.'
