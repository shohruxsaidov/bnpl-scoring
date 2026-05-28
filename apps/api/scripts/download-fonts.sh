#!/bin/sh
# Downloads NotoSans fonts required for PDF generation (pdfkit Cyrillic support).
# Run once: sh apps/api/scripts/download-fonts.sh

FONTS_DIR="$(dirname "$0")/../src/assets/fonts"
mkdir -p "$FONTS_DIR"

curl -fL -o "$FONTS_DIR/NotoSans-Regular.ttf" \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf"

curl -fL -o "$FONTS_DIR/NotoSans-Bold.ttf" \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf"

echo "Fonts downloaded to $FONTS_DIR"
