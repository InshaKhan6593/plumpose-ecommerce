#!/bin/sh
# Rebuilds the site's web video from the client's camera originals.
#
#   sh scripts/encode-videos.sh
#
# The encoded files (public/video/) are NOT committed: the repository is
# public and the footage is the client's unreleased model film, the same reason
# seed-assets/ and brand-assets/ stay out. Run this after cloning, with the
# client's originals in ../brand-assets/video/ (see brand-assets/README.md).
# Needs ffmpeg with libx264 and libvpx-vp9.
set -e

SRC="$(dirname "$0")/../../brand-assets/video"
OUT="$(dirname "$0")/../public/video"
mkdir -p "$OUT"

# name  source  filter  max bitrate (kbit/s)
enc() {
  name=$1; src=$2; vf=$3; rate=$4
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$src" -an -vf "$vf" \
    -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -crf 27 -maxrate "${rate}k" -bufsize "$((rate * 2))k" -movflags +faststart \
    "$OUT/$name.mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$src" -an -vf "$vf" \
    -c:v libvpx-vp9 -row-mt 1 -deadline good -cpu-used 2 -crf 36 -b:v 0 -maxrate "${rate}k" -bufsize "$((rate * 2))k" -pix_fmt yuv420p \
    "$OUT/$name.webm"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/$name.mp4" -frames:v 1 -q:v 3 "$OUT/$name-poster.jpg"
  echo "  $name"
}

# Desktop hero: the café table clip, filmed sideways at 4K 60fps. Rotated upright,
# a 16:9 band cut from hair to mid-chest so the shirt shows, half speed.
enc hero-wide   EK3A2406.mp4 "transpose=2,crop=2160:1215:0:250,setpts=2*PTS,scale=1920:1080,fps=30000/1001" 2300

# Phone hero: already vertical, 24fps. Re-encode only.
enc hero-mobile IMG_5839.mp4 "scale=1080:1920" 1600

# Our Story (planned): the same café clip, full portrait frame, half speed.
enc story-cafe  EK3A2406.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920,fps=30000/1001" 1600
