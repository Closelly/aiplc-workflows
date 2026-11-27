#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu
root="$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)"
command -v bun >/dev/null 2>&1 || { echo 'Instala Bun 1.4.5 para compilar desde el código.' >&2; exit 1; }
(cd "$root" && bun install --frozen-lockfile && bun run build)
exec sh "$root/install.sh" --dist "$root/dist" "$@"
