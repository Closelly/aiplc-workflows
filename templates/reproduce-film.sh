#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo "Uso: sh reproduce.sh /ruta/pelicula.mp4" >&2
  exit 64
fi
case "$1" in /*) output="$1";; *) output="$PWD/$1";; esac
source_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT HUP INT TERM
node_bin="${AIPLC_NODE:-node}"
case "$node_bin" in /*) PATH="$(dirname -- "$node_bin"):$PATH"; export PATH;; esac
skills="${AIPLC_HYPERFRAMES_SKILLS:-$HOME/.agents/skills}"
export HYPERFRAMES_NO_TELEMETRY=1
hf() {
  if [ -n "${AIPLC_HYPERFRAMES_BIN:-}" ]; then
    "$AIPLC_HYPERFRAMES_BIN" "$@"
  else
    "$node_bin" "$skills/hyperframes/scripts/plugin-cli.mjs" --cli-version 0.9.104 "$@"
  fi
}
hf --version | grep -Eq '(^|[[:space:]])0\.9\.104([[:space:]]|$)'
while IFS= read -r chapter; do
  case "$chapter" in ""|*[!a-z0-9-]*) echo "Capítulo inválido" >&2; exit 65;; esac
  cp -R -- "$source_dir/hyperframes/$chapter" "$tmp/composition-$chapter"
  (cd "$tmp/composition-$chapter"; hf check --json .
    hf render . -o "$tmp/$chapter.mp4" --fps=30 --workers=1 --quality=looks --experimental-fast-capture=false --no-browser-gpu)
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$tmp/$chapter.mp4")"
  printf "file '%s.mp4'\nduration %s\n" "$chapter" "$duration" >> "$tmp/concat.txt"
done < "$source_dir/chapter-order.txt"
ffmpeg -v error -nostdin -n -f concat -safe 1 -i "$tmp/concat.txt" -i "$source_dir/captions.srt" \
  -f ffmetadata -i "$source_dir/chapters.ffmeta" -map 0:v:0 -map 0:a:0 -map 1:s:0 -map_chapters 2 \
  -c:v copy -c:a copy -c:s mov_text -movflags +faststart "$output"
