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

# Desktop hero: the coffee clip (EK3A2455, sent 27 Sep 2026 to replace EK3A2406
# — "don't focus on her face"). 4K 60fps portrait with a rotation flag, which
# ffmpeg applies itself, so no transpose here. A 16:9 band from the collar to
# the waist, so the print leads rather than her face; half speed, ~13 s. (The
# first cut, from y=1300, sliced through her mouth and the cup in most shots.)
enc_mp4 hero-wide EK3A2455.mp4 "crop=2160:1215:0:1500,setpts=2*PTS,scale=1920:1080:flags=lanczos:$TV,fps=30000/1001" 22 4500

# Phone hero: the same coffee clip as the desktop hero (EK3A2455, since 27 Sep
# 2026), in its full portrait frame, half speed, no transpose — it carries its
# own rotation. CRF 25 for phones: about a quarter smaller than CRF 23 for an
# SSIM 0.002 lower, invisible on a phone screen.
enc_mp4 hero-mobile EK3A2455.mp4 "setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 25 2500

# Intro hero: the fountain clip ("Introduction video.mov", sent 28 Sep 2026),
# played once and held on its last frame — the camera drifts through all 5.5 s,
# so no two frames match well enough to loop without the fountain ghosting.
# An iPhone clip: HEVC 10-bit HLG (BT.2020), so it is tone-mapped to SDR
# BT.709 first; left as HDR it plays grey and flat. 1080 wide portrait with a
# rotation flag (applied by ffmpeg). 30 fps, so half speed needs motion
# interpolation (minterpolate) to stay smooth — checked on the hands and paper.
# Desktop: a 16:9 band from y=540 keeps her head and the paper in every frame;
# kept at its own 1080 px (the browser scales it), not enlarged here.
INTRO="introduction-fountain.mov"
HLG="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv"
SLOW="minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts=2*PTS,fps=30"
enc_mp4 hero-intro-wide "$INTRO" "$HLG,crop=1080:608:0:540,$SLOW" 20 4500
enc_mp4 hero-intro-mobile "$INTRO" "$HLG,$SLOW" 23 3000
# Its poster is what a phone paints first (the LCP): at the default -q:v 2 it
# was 353 KB; -q:v 5 is 218 KB and indistinguishable on a phone (SSIM 0.990).
# Scaled to 720 wide (5 Oct 2026): Lighthouse found the full-size frame shown at
# ~720 device pixels on a phone, and its download was most of the LCP. The film
# itself keeps its size; the poster only shows until the film starts.
ffmpeg -hide_banner -loglevel error -y -i "$OUT/hero-intro-mobile.mp4" -frames:v 1 -vf "scale=720:-2:flags=lanczos" -q:v 5 "$OUT/hero-intro-mobile-poster.jpg"



# (story-walk, beside "Behind the print", and story-cafe, the Made for You
# Bridal tile, are no longer used: the painting film and a words-only Made for
# You replaced them on 27 Sep 2026. Their lines are in the history.)

# Our Story opener: the other café clip (the pillow), the one the homepage does
# not use. Portrait only: a landscape crop of it is nothing but her face, so
# desktop shows it in a portrait half-screen frame.
enc_mp4 story-pillow EK3A2414.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 22 4000
# …and its phone version: 36% smaller (3.8 MB against 5.9 MB), SSIM 0.002 lower.
enc_mp4 story-pillow-small EK3A2414.mp4 "transpose=2,setpts=2*PTS,scale=1080:1920:flags=lanczos:$TV,fps=30000/1001" 25 2500

# Our Story, "Behind the print": the whale shark hand-painted with a brush
# (illustration-paint.mov, a 15 s screen recording, 1090x1364, 60 fps, full
# range). Native size, 30 fps.
enc_mp4 story-paint illustration-paint.mov "scale=1090:1364:flags=lanczos:$TV,fps=30" 23 2500
