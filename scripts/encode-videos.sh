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
    -c:v libvpx-vp9 -row-mt 1 -deadline good -cpu-used 2 -crf 36 -b:v "${rate}k" -maxrate "${rate}k" -bufsize "$((rate * 2))k" -pix_fmt yuv420p \
    "$OUT/$name.webm"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/$name.mp4" -frames:v 1 -q:v 3 "$OUT/$name-poster.jpg"
  echo "  $name"
}

# The café films (EK3A…) are full-range colour straight from the camera, and
# VP9 from this libvpx tops out at SSIM ≈0.94 against the original whatever the
# bitrate — and Chrome picks the WebM first. So they ship as H.264 only,
# converted to standard (limited) range with BT.709 tags, at a quality that is
# indistinguishable from the source (SSIM 0.975). Measured 24 Sep 2026: the
# old 1.6 Mbps hero scored 0.964 (MP4) / 0.937 (WebM) and visibly lost skin
# texture, fine hair and the print on the collar.
#   name  source  filter  crf  max bitrate (kbit/s)
enc_mp4() {
  name=$1; src=$2; vf=$3; crf=$4; rate=$5
  ffmpeg -hide_banner -loglevel error -y -i "$SRC/$src" -an     -vf "$vf,format=yuv420p"     -c:v libx264 -preset slow -tune film -profile:v high -crf "$crf" -maxrate "${rate}k" -bufsize "$((rate * 2))k"     -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart     "$OUT/$name.mp4"
  rm -f "$OUT/$name.webm"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/$name.mp4" -frames:v 1 -q:v 2 "$OUT/$name-poster.jpg"
  echo "  $name"
}
TV="in_range=pc:out_range=tv"

# Desktop hero: the café table clip, filmed sideways at 4K 60fps. Rotated upright,
# a 16:9 band cut from hair to mid-chest so the shirt shows, half speed. ~7 MB.
enc_mp4 hero-wide EK3A2406.mp4 "transpose=2,crop=2160:1215:0:250,setpts=2*PTS,scale=1920:1080:flags=lanczos:$TV,fps=30000/1001" 22 4500

# Phone hero: the same café table clip as the desktop hero, in its full
# portrait frame, half speed — 16.7 s. (It used to be IMG_5839, which is only
# 5 s at 24 fps, so on a phone the same few seconds looped over and over, and
# half speed would drop it to a choppy 12 fps.) CRF 25 for phones: 26% smaller
# than the CRF 23 desktop portrait (story-cafe) for an SSIM 0.002 lower —
# invisible on a phone screen. Also the phone version of story-cafe, so the two
# pages share one download.
enc_mp4 hero-mobile EK3A2406.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 25 2500

# The walking clip (IMG_5839): already vertical, 24fps, standard range. The
# in-view film beside "Behind the print" on Our Story.
enc story-walk IMG_5839.mp4 "scale=1080:1920" 1600

# Made for You, the Bridal tile: the café breakfast clip, full portrait frame, half speed.
enc_mp4 story-cafe EK3A2406.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 23 3500

# Our Story opener: the other café clip (the pillow), the one the homepage does
# not use. Portrait only: a landscape crop of it is nothing but her face, so
# desktop shows it in a portrait half-screen frame.
enc_mp4 story-pillow EK3A2414.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 22 4000
# …and its phone version: 36% smaller (3.8 MB against 5.9 MB), SSIM 0.002 lower.
enc_mp4 story-pillow-small EK3A2414.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 25 2500
