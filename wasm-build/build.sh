#!/usr/bin/env bash
# Build Openterface_Core as WebAssembly for the web viewer.
# Usage: bash build.sh <path-to-Openterface_Core> <output-dir>
#
# Primary module: openterface.js (unified Core API — all packet building,
#   HID lookup, transport, profiles, video chip control, USB mode, etc.)

set -euo pipefail

CORE_DIR="${1:?Usage: build.sh <Openterface_Core-dir> <output-dir>}"
OUT_DIR="${2:?Usage: build.sh <Openterface_Core-dir> <output-dir>}"

SRC="$CORE_DIR/src"
INC="$CORE_DIR/include"

mkdir -p "$OUT_DIR"

# ── openterface.js: unified Core API for Web ─────────────────────────────
# Compiles all platform-independent Core sources. Platform backends are
# limited to the stub (pure C); Linux/Windows are excluded. The Web project
# provides its own transport providers (WebSerial/WebHID) that satisfy the
# op_transport_vtable_t interface at runtime.

echo "[wasm] Compiling Openterface_Core unified API to WebAssembly..."

PLATFORM="$CORE_DIR/src/platform"
NATIVE_DIR="$CORE_DIR/src"

emcc \
  "$SRC/core/version.c" \
  "$SRC/capability/capability.c" \
  "$SRC/device/device_info.c" \
  "$SRC/profile/profile.c" \
  "$SRC/transport/transport.c" \
  "$SRC/input/input_hid.c" \
  "$SRC/input/input_packet.c" \
  "$SRC/input/input_parser.c" \
  "$SRC/input/input_event.c" \
  "$SRC/protocol/ch9329/protocol_ch9329.c" \
  "$NATIVE_DIR/core_native.c" \
  "$SRC/chip/chip_detector.c" \
  "$SRC/chip/video_chip_controller.c" \
  "$SRC/video_status/video_status_poller.c" \
  "$SRC/usb_mode/usb_mode_controller.c" \
  "$SRC/usb_mode/usb_mode_ms21xx.c" \
  "$SRC/usb_mode/usb_mode_serial.c" \
  "$SRC/hid/hid_device_session.c" \
  "$SRC/hid/hid_transaction_guard.c" \
  "$SRC/watchdog/connection_watchdog.c" \
  "$PLATFORM/platform_backend.c" \
  "$PLATFORM/platform_stub.c" \
  -I"$INC" \
  -I"$PLATFORM" \
  -I"$SRC/chip" \
  -o "$OUT_DIR/openterface.js" \
  -O3 \
  -s WASM=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME="createOpenterfaceModule" \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","stringToNewUTF8","HEAPU8","HEAP32","HEAP16","getValue","setValue"]' \
  -s EXPORTED_FUNCTIONS='["_op_transport_init","_op_transport_open","_op_transport_close","_op_transport_read","_op_transport_write","_op_transport_control","_op_transport_kind_label","_op_profile_registry","_op_profile_registry_count","_op_profile_find_by_id","_op_profile_match","_op_profile_apply_to_device","_op_profile_has_capability","_op_device_family_label","_op_ch9329_checksum","_op_ch9329_hex_dump","_op_ch9329_build_keyboard_packet","_op_ch9329_build_mouse_rel_packet","_op_ch9329_build_mouse_abs_packet","_op_ch9329_build_press_release_packets","_op_ch9329_build_usb_switch_packet","_op_ch9329_parse_usb_switch_response","_op_input_hid_code_from_name","_op_input_hid_code_from_char","_op_input_hid_code_label","_op_input_parse_token","_op_input_macro_parse","_op_input_script_tokenize","_op_input_hid_code_from_dom_code","_op_input_build_keyboard","_op_input_build_mouse_rel","_op_input_build_mouse_abs","_op_input_build_press_release","_op_input_checksum","_op_input_hex_dump","_op_capabilities_has","_op_capability_label","_op_capability_state_label","_op_device_info_init","_op_device_info_has_interface","_op_device_info_has_capability","_op_video_chip_detect_from_device","_op_video_chip_kind_label","_op_video_chip_get_register_set","_op_video_chip_controller_create","_op_video_chip_controller_destroy","_op_video_chip_controller_set_transport","_op_video_chip_controller_detect","_op_video_chip_controller_get_register_set","_op_video_chip_controller_read_register","_op_video_chip_controller_write_register","_op_video_chip_controller_get_usb_mode","_op_video_chip_controller_set_usb_mode","_op_video_chip_controller_get_cached_input_status","_op_video_chip_controller_set_cached_input_status","_op_video_status_poller_create","_op_video_status_poller_destroy","_op_video_status_poller_poll","_op_video_input_status_clear","_op_video_input_status_normalize","_op_usb_mode_endpoint_init","_op_usb_mode_endpoint_bind_device","_op_usb_mode_endpoint_bind_hid_session","_op_usb_mode_endpoint_bind_transport","_op_usb_mode_endpoint_bind_chip_controller","_op_usb_mode_get","_op_usb_mode_set","_op_hid_device_session_create","_op_hid_device_session_destroy","_op_hid_device_session_open","_op_hid_device_session_close","_op_hid_device_session_is_open","_op_hid_device_session_device","_op_hid_device_session_send_feature_report","_op_hid_device_session_get_feature_report","_op_hid_transaction_guard_create","_op_hid_transaction_guard_destroy","_op_hid_transaction_guard_enter","_op_hid_transaction_guard_leave","_op_native_transport_init_serial","_op_native_transport_release","_op_core_native_version","_op_core_native_hid_backend_name","_op_core_native_serial_backend_name","_op_core_version","_op_core_version_string","_op_watchdog_create","_op_watchdog_destroy","_op_watchdog_tick","_op_watchdog_report_error","_op_watchdog_report_ok","_op_watchdog_get_state","_op_watchdog_consecutive_errors","_op_watchdog_total_errors","_op_watchdog_recovery_attempts","_op_watchdog_force_reconnect","_op_connection_state_label","_malloc","_free"]' \
  --no-entry \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORT_KEEPALIVE=1

echo "[wasm] Output: $OUT_DIR/openterface.js"

echo "[wasm] Output: $OUT_DIR/openterface.wasm"
ls -lh "$OUT_DIR/openterface.wasm"

# Copy to canonical location for npm workspace consumption
CORE_WASM="packages/core/wasm"
mkdir -p "$CORE_WASM"
cp "$OUT_DIR/openterface.js" "$CORE_WASM/openterface.js" 2>/dev/null || { echo "[wasm] Error: Could not copy JS to $CORE_WASM"; exit 1; }
cp "$OUT_DIR/openterface.wasm" "$CORE_WASM/openterface.wasm" 2>/dev/null || { echo "[wasm] Error: Could not copy WASM to $CORE_WASM"; exit 1; }
echo "[wasm] Copied to $CORE_WASM/"
