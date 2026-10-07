#!/usr/bin/env bash
# Encode audio to Ogg Opus (gapless-looping friendly), writing each <name>.ogg alongside its source.
# Usage: scripts/encode-opus.sh <file-or-folder> [bitrate, default 256k]
# Existing .ogg outputs are overwritten. Folders are processed non-recursively.

# Re-run under bash if invoked via `sh script` (e.g. dash), which ignores the shebang
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
    echo "Usage: $0 <file-or-folder> [bitrate, default 256k]" >&2
    exit 1
fi

input="$1"
bitrate="${2:-256k}"

encode() {
    local src="$1"
    local dst="${src%.*}.ogg"
    echo "Encoding $src -> $dst"
    ffmpeg -hide_banner -loglevel error -nostdin -y -i "$src" -vn -c:a libopus -b:a "$bitrate" -vbr on -application audio "$dst"
}

if [[ -d "$input" ]]; then
    shopt -s nullglob nocaseglob
    files=("$input"/*.{wav,flac,aif,aiff,mp3,m4a,aac})
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No audio files found in $input" >&2
        exit 1
    fi
    for f in "${files[@]}"; do encode "$f"; done
elif [[ -f "$input" ]]; then
    encode "$input"
else
    echo "Not a file or folder: $input" >&2
    exit 1
fi
