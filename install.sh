#!/bin/sh
# SPDX-License-Identifier: MIT
# Release packaging replaces these markers. Installation requires no Bun or Node.
set -eu
release_repo='Closelly/aiplc-workflows'
release_version='__RELEASE_VERSION__'
prefix="${AIPLC_INSTALL_DIR:-$HOME/.local/closelly-aiplc}"
skills="${AIPLC_SKILLS_DIR:-$HOME/.agents/skills}"
from=''; dist=''; modify_path=1; with_skills=1; temp=''; lock=''; pending=''
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Closelly AI-PLC · instalación para macOS, Linux y WSL (sin sudo)
Uso: sh install.sh [opciones]
  --prefix RUTA        Destino (por defecto ~/.local/closelly-aiplc)
  --skills-dir RUTA    Skills (por defecto ~/.agents/skills)
  --no-skills          Instalar solo la CLI
  --no-modify-path     No editar la configuración de la terminal
  --repo OWNER/REPO    Repositorio GitHub de las releases
  --version X.Y.Z      Versión exacta, con o sin prefijo v
  --from RUTA          Release local: VERSION, checksums.txt y .tar.gz
  --dist RUTA          Distribución ya compilada (desarrollo)
  --help               Mostrar esta ayuda
HELP
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix|--skills-dir|--repo|--version|--from|--dist)
      [ "$#" -ge 2 ] || fail "Falta el argumento de $1."
      [ -n "$2" ] || fail "El argumento de $1 está vacío."
      case "$1" in
        --prefix) prefix=$2;; --skills-dir) skills=$2;; --repo) release_repo=$2;;
        --version) release_version=${2#v};; --from) from=$2;; --dist) dist=$2;;
      esac
      shift 2;;
    --no-skills) with_skills=0; shift;;
    --no-modify-path) modify_path=0; shift;;
    --help|-h) usage; exit 0;;
    *) fail "Opción desconocida: $1. Usa --help.";;
  esac
done
[ "$(id -u)" -ne 0 ] || fail 'Ejecuta el instalador con tu usuario, sin sudo.'
[ -z "$from" ] || [ -z "$dist" ] || fail 'Usa --from o --dist, no ambos.'
for path in "$prefix" "$skills"; do
  case "$path" in /*) ;; *) fail "Usa rutas absolutas: $path";; esac
  case "$path" in *'
'*|*'/../'*|*'/./'*|*/..|*/.) fail 'Ruta no admitida.';; esac
done
prefix=${prefix%/}; skills=${skills%/}
[ -n "$skills" ] || fail 'Elige una subcarpeta para las skills.'
case "$skills/" in "$prefix/"*) fail 'Las skills deben instalarse fuera del prefijo de la herramienta.';; esac
[ -n "$prefix" ] && [ "$prefix" != "$HOME" ] || fail 'Elige una subcarpeta para instalar.'
case "$(uname -s)" in Darwin) os=darwin;; Linux) os=linux;; *) fail 'Usa macOS, Linux o WSL. Windows nativo todavía no está soportado.';; esac
case "$(uname -m)" in arm64|aarch64) arch=arm64;; x86_64|amd64) arch=x64;; *) fail 'Se requiere ARM64 o x64.';; esac
if [ "$os" = linux ]; then
  for loader in /lib/ld-musl-*.so.1; do
    [ ! -e "$loader" ] || fail 'Esta release requiere Linux con glibc; musl/Alpine no está soportado.'
  done
fi
for program in git tar awk diff; do
  command -v "$program" >/dev/null 2>&1 || fail "Falta $program. Instala esta herramienta con el gestor de tu sistema y vuelve a intentarlo."
done
sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else fail 'Se necesita sha256sum o shasum para verificar la descarga.'; fi
}
download() {
  command -v curl >/dev/null 2>&1 || fail 'Se necesita curl para descargar la release.'
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
    --retry 2 --connect-timeout 20 --max-time 600 "$1" --output "$2" ||
    fail 'No se pudo descargar. Comprueba la conexión, el repositorio y que la versión esté publicada.'
}
cleanup() {
  [ -z "$pending" ] || rm -rf -- "$pending"
  [ -z "$temp" ] || rm -rf -- "$temp"
  [ -z "$lock" ] || rmdir "$lock" 2>/dev/null || :
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP
umask 077
temp=$(mktemp -d "${TMPDIR:-/tmp}/closelly-install.XXXXXXXX")
if [ -n "$dist" ]; then
  [ -x "$dist/closelly-aiplc" ] || fail 'Falta el ejecutable en --dist. Ejecuta bun run build primero.'
  dist=$(CDPATH='' cd -- "$dist" && pwd -P)
  release_version=$("$dist/closelly-aiplc" version)
else
  case "$release_repo" in __GITHUB_REPOSITORY__) release_repo='';; esac
  case "$release_version" in __RELEASE_VERSION__) release_version='';; esac
  if [ -n "$from" ]; then
    [ -d "$from" ] || fail 'No existe el directorio indicado en --from.'
    from=$(CDPATH='' cd -- "$from" && pwd -P)
    [ -n "$release_version" ] || release_version=$(cat "$from/VERSION")
  else
    printf '%s\n' "$release_repo" | awk '/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/ {ok=1} END {exit !ok}' ||
      fail 'Falta el repositorio de publicación. Usa --repo OWNER/REPO o el install.sh de una release.'
    if [ -z "$release_version" ]; then
      download "https://github.com/$release_repo/releases/latest/download/VERSION" "$temp/VERSION"
      release_version=$(cat "$temp/VERSION")
    fi
  fi
  printf '%s\n' "$release_version" | awk '/^[0-9]+\.[0-9]+\.[0-9]+$/ {ok=1} END {exit !ok}' || fail 'Versión inválida. Usa X.Y.Z.'
  archive="closelly-aiplc-v$release_version-$os-$arch.tar.gz"
  if [ -n "$from" ]; then
    cp "$from/checksums.txt" "$temp/checksums.txt"
    cp "$from/$archive" "$temp/$archive"
  else
    base="https://github.com/$release_repo/releases/download/v$release_version"
    printf 'Descargando Closelly AI-PLC %s para %s-%s…\n' "$release_version" "$os" "$arch"
    download "$base/checksums.txt" "$temp/checksums.txt"
    download "$base/$archive" "$temp/$archive"
  fi
  expected=$(awk -v name="$archive" '$2 == name {sum=$1; count++} END {if(count != 1) exit 1; print sum}' "$temp/checksums.txt") || fail 'Checksum ausente o duplicado.'
  [ "${#expected}" -eq 64 ] || fail 'Checksum inválido.'
  [ "$(sha256 "$temp/$archive")" = "$expected" ] || fail 'La descarga no coincide con su SHA-256. No se instaló nada.'
  tar -tzf "$temp/$archive" > "$temp/entries"
  awk '!/^closelly-aiplc\// || /(^|\/)\.\.?(\/|$)/ || /\\/ {bad=1} END {exit bad}' "$temp/entries" || fail 'El paquete contiene rutas no admitidas.'
  tar -tvzf "$temp/$archive" > "$temp/types"
  awk 'substr($0,1,1) != "d" && substr($0,1,1) != "-" {bad=1} END {exit bad}' "$temp/types" || fail 'El paquete contiene enlaces o archivos especiales.'
  tar -xzf "$temp/$archive" -C "$temp"
  dist="$temp/closelly-aiplc"
fi
printf '%s\n' "$release_version" | awk '/^[0-9]+\.[0-9]+\.[0-9]+$/ {ok=1} END {exit !ok}' || fail 'La distribución tiene una versión inválida.'
for required in closelly-aiplc assets/workflows/po.yaml assets/workflows/dev.yaml assets/skills/closelly-aiplc-po/SKILL.md vendor/gsap.min.js LICENSE THIRD_PARTY_NOTICES.md uninstall.sh; do
  [ -f "$dist/$required" ] || fail "Distribución incompleta: falta $required."
done
[ "$("$dist/closelly-aiplc" version)" = "$release_version" ] || fail 'El ejecutable no corresponde a la versión solicitada.'
"$dist/closelly-aiplc" doctor --core || fail 'El diagnóstico básico falló; no se activó la instalación.'

# Refuse to replace user-owned destinations and unrelated skills.
if [ -e "$prefix" ] || [ -L "$prefix" ]; then
  [ ! -L "$prefix" ] || fail 'El destino no puede ser un enlace.'
  [ "$(cat "$prefix/.installed-by-closelly-aiplc" 2>/dev/null)" = v1 ] || fail 'El destino ya existe y no pertenece a este instalador. Elige una carpeta nueva con --prefix.'
fi
if [ "$with_skills" -eq 1 ]; then
  for item in "$dist"/assets/skills/*; do
    name=$(basename "$item"); existing="$skills/$name"
    if [ -e "$existing" ] || [ -L "$existing" ]; then
      [ -L "$existing" ] && [ "$(readlink "$existing")" = "$prefix/current/assets/skills/$name" ] ||
        fail "Ya existe una skill ajena: $existing. Usa otro --skills-dir o --no-skills."
    fi
  done
  if [ -f "$prefix/.skills-dir" ]; then
    [ "$(cat "$prefix/.skills-dir")" = "$skills" ] || fail 'Esta instalación usa otro directorio de skills. Conserva --skills-dir o usa otro --prefix.'
  fi
fi
mkdir -p "$prefix"
lock="$prefix/.install-lock"
mkdir "$lock" 2>/dev/null || { lock=''; fail 'Hay otra instalación en curso. Si terminó abruptamente, revisa .install-lock antes de retirarlo.'; }
printf 'v1\n' > "$prefix/.installed-by-closelly-aiplc"
mkdir -p "$prefix/versions" "$prefix/bin"
target="$prefix/versions/$release_version-$os-$arch"
if [ -e "$target" ]; then
  diff -qr "$dist" "$target" >/dev/null || fail 'Ya existe esta versión con contenido diferente. Publica otra versión o usa otro prefijo.'
else
  pending=$(mktemp -d "$prefix/versions/.pending.XXXXXXXX")
  cp -R "$dist/." "$pending/"
  mv "$pending" "$target"
  pending=''
fi
if [ -e "$prefix/bin/closelly-aiplc" ] || [ -L "$prefix/bin/closelly-aiplc" ]; then
  [ -L "$prefix/bin/closelly-aiplc" ] && [ "$(readlink "$prefix/bin/closelly-aiplc")" = ../current/closelly-aiplc ] || fail 'El comando existente no pertenece al instalador.'
else
  ln -s ../current/closelly-aiplc "$prefix/bin/closelly-aiplc"
fi
if [ -e "$prefix/current" ] || [ -L "$prefix/current" ]; then
  [ -L "$prefix/current" ] || fail 'El destino current no pertenece al instalador.'
fi
ln -s "versions/$release_version-$os-$arch" "$prefix/.current-next"
if [ "$os" = darwin ]; then mv -fh "$prefix/.current-next" "$prefix/current"
else mv -fT "$prefix/.current-next" "$prefix/current"; fi
if [ "$with_skills" -eq 1 ]; then
  mkdir -p "$skills"
  for item in "$dist"/assets/skills/*; do
    name=$(basename "$item")
    if [ -e "$skills/$name" ] || [ -L "$skills/$name" ]; then
      [ -L "$skills/$name" ] && [ "$(readlink "$skills/$name")" = "$prefix/current/assets/skills/$name" ] || fail "La skill cambió durante la instalación: $name."
    else
      ln -s "$prefix/current/assets/skills/$name" "$skills/$name"
    fi
  done
  printf '%s\n' "$skills" > "$prefix/.skills-dir"
fi
cp "$dist/uninstall.sh" "$prefix/uninstall.sh"

quote() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"; }
printf 'export PATH=%s:"$PATH"\n' "$(quote "$prefix/bin")" > "$prefix/env"
line="[ ! -f $(quote "$prefix/env") ] || . $(quote "$prefix/env") # closelly-aiplc"
if [ "$modify_path" -eq 1 ]; then
  case "${SHELL:-}" in
    */zsh) profiles="${ZDOTDIR:-$HOME}/.zshrc";;
    */bash) profiles="$HOME/.bashrc
$HOME/.bash_profile";;
    *) profiles="$HOME/.profile";;
  esac
  set -f
  old_ifs=$IFS; IFS='
'
  for profile in $profiles; do
    if ! grep -Fqx "$line" "$profile" 2>/dev/null; then
      if ! printf '\n%s\n' "$line" >> "$profile"; then
        printf 'No se pudo actualizar %s. Añade el PATH manualmente.\n' "$profile" >&2
      fi
    fi
  done
  IFS=$old_ifs
  set +f
fi
printf '\nInstalado: %s\n' "$prefix/bin/closelly-aiplc"
printf 'Abre una terminal nueva o ejecuta: . %s\n' "$(quote "$prefix/env")"
printf 'Después: closelly-aiplc doctor --core\n'
printf 'En Codex, abre la carpeta de tu producto y pide: Usa $closelly-aiplc-po para guiarme.\n'
printf 'Para empezar un producto, solo necesitas tu nombre y una idea.\n'
