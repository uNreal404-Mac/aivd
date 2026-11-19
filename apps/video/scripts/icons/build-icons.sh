#!/bin/sh
# Rebuilds every site icon from public/logo.svg (macOS: uses Swift/AppKit to
# draw the SVG and Python Pillow for the .ico). Run from apps/video:
#   sh scripts/icons/build-icons.sh
set -e
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
swift scripts/icons/svg2png.swift public/logo.svg "$tmp/logo-1024.png" 1024 >/dev/null
cp public/logo.svg public/favicon.svg
python3 - "$tmp/logo-1024.png" <<'PY'
import sys
from PIL import Image
logo = Image.open(sys.argv[1]).convert("RGBA")
# App icons keep the rounded square on transparency.
for size, name in [(192, "icon-192.png"), (512, "icon-512.png")]:
    logo.resize((size, size), Image.LANCZOS).save(f"public/{name}", optimize=True)
# iOS rounds the corners itself, so the touch icon is a full square of brand colour.
corner = logo.getpixel((logo.width // 2, 40))
square = Image.new("RGBA", logo.size, corner)
square.alpha_composite(logo)
square.convert("RGB").resize((180, 180), Image.LANCZOS).save("public/apple-touch-icon.png", optimize=True)
logo.resize((64, 64), Image.LANCZOS).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("icons written")
PY
rm -rf "$tmp"
