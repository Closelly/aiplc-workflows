#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
prefix=""
skills=""
dist="$root/dist"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix|--skills-dir|--dist)
      [ "$#" -ge 2 ] || { echo "Falta el argumento de $1" >&2; exit 64; }
      case "$1" in --prefix) prefix="$2";; --skills-dir) skills="$2";; --dist) dist="$2";; esac
      shift 2;;
    --help|-h)
      echo "Uso: ./install.sh --prefix /ruta [--skills-dir /ruta] [--dist /distribucion/compilada]"
      exit 0;;
    *) echo "Opción no reconocida: $1" >&2; exit 64;;
  esac
done
[ -n "$prefix" ] || { echo "Selecciona un destino con --prefix." >&2; exit 64; }

if [ ! -x "$dist/closelly-aiplc" ] || [ ! -f "$dist/assets/workflows/po.yaml" ]; then
  [ "$dist" = "$root/dist" ] && command -v bun >/dev/null ||
    { echo "Usa Bun 1.3+ para compilar o provee una distribución válida con --dist." >&2; exit 1; }
  (cd "$root" && bun install --frozen-lockfile && bun run build)
fi
"$dist/closelly-aiplc" version >/dev/null
mkdir -p -- "$prefix/bin" "$prefix/lib"
target="$prefix/lib/closelly-aiplc"
[ ! -e "$target" ] && [ ! -e "$prefix/bin/closelly-aiplc" ] ||
  { echo "Ya hay una instalación en $prefix. Usa un prefijo nuevo." >&2; exit 1; }
if [ -n "$skills" ]; then
  for f in "$dist"/assets/skills/*; do
    [ ! -e "$skills/$(basename -- "$f")" ] ||
      { echo "La Skill ya existe: $f" >&2; exit 1; }
  done
fi
pending="$(mktemp -d "$prefix/lib/.closelly-install.XXXXXXXX")"
trap 'rm -rf -- "$pending"' EXIT HUP INT TERM
cp -R -- "$dist/." "$pending/"
mv -- "$pending" "$target"
cat > "$prefix/bin/closelly-aiplc" <<'LAUNCHER'
#!/bin/sh
set -eu
base="$(CDPATH= cd -- "$(dirname -- "$0")"/.. && pwd)"
exec "$base/lib/closelly-aiplc/closelly-aiplc" "$@"
LAUNCHER
chmod +x "$prefix/bin/closelly-aiplc"
if [ -n "$skills" ]; then
  mkdir -p -- "$skills"
  for f in "$target"/assets/skills/*; do cp -R -- "$f" "$skills/"; done
fi
echo "Instalado en $prefix/bin/closelly-aiplc"
