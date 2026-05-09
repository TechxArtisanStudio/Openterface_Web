#!/usr/bin/env bash
# Build Openterface_Core as WebAssembly for the web viewer.
# Usage: bash build.sh <path-to-Openterface_Core> <output-dir>

set -euo pipefail

CORE_DIR="${1:?Usage: build.sh <Openterface_Core-dir> <output-dir>}"
OUT_DIR="${2:?Usage: build.sh <Openterface_Core-dir> <output-dir>}"

SRC="$CORE_DIR/src"
INC="$CORE_DIR/include"

mkdir -p "$OUT_DIR"

echo "[wasm] Compiling Openterface_Core to WebAssembly..."

emcc \
  "$SRC/keymod_hid.c" \
  "$SRC/keymod_packets.c" \
  "$SRC/keymod_parser.c" \
  -I"$INC" \
  -o "$OUT_DIR/keymod.wasm" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createKeymodModule" \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s EXPORTED_FUNCTIONS='[ \
    "_km_hid_code", \
    "_km_hid_code_for_char", \
    "_km_hid_code_label", \
    "_km_build_keyboard", \
    "_km_build_mouse_rel", \
    "_km_build_press_release", \
    "_km_parse_token", \
    "_km_parse_macro", \
    "_km_tokenize_script", \
    "_km_checksum" \
  ]' \
  -s ENVIRONMENT=web \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=65536

echo "[wasm] Output: $OUT_DIR/keymod.wasm"
ls -lh "$OUT_DIR/keymod.wasm"
