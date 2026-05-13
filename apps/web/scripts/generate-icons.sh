#!/usr/bin/env bash
# Regenerate all PNG/ICO icon variants from the SVG sources.
# Requires: rsvg-convert (librsvg) and ImageMagick (`magick`).
set -euo pipefail

cd "$(dirname "$0")/.."
PUB=public
DOCS=../../docs/assets

# Favicons
rsvg-convert -w 16  -h 16  "$PUB/favicon.svg" -o "$PUB/favicon-16x16.png"
rsvg-convert -w 32  -h 32  "$PUB/favicon.svg" -o "$PUB/favicon-32x32.png"
rsvg-convert -w 48  -h 48  "$PUB/favicon.svg" -o "$PUB/favicon-48x48.png"
rsvg-convert -w 180 -h 180 "$PUB/favicon.svg" -o "$PUB/apple-touch-icon.png"
rsvg-convert -w 192 -h 192 "$PUB/favicon.svg" -o "$PUB/android-chrome-192x192.png"
rsvg-convert -w 512 -h 512 "$PUB/favicon.svg" -o "$PUB/android-chrome-512x512.png"
magick "$PUB/favicon-16x16.png" "$PUB/favicon-32x32.png" "$PUB/favicon-48x48.png" "$PUB/favicon.ico"

# Social card
rsvg-convert -w 1200 -h 630 "$PUB/og-image.svg" -o "$PUB/og-image.png"

# README assets
rsvg-convert -w 1200 -h 320 "$DOCS/banner.svg"   -o "$DOCS/banner.png"
rsvg-convert -w 256  -h 256 "$DOCS/logo.svg"     -o "$DOCS/logo.png"
rsvg-convert -w 640  -h 160 "$DOCS/wordmark.svg" -o "$DOCS/wordmark.png"

echo "Icons regenerated."
