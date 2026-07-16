@echo off
REM Build Openterface_Core as WebAssembly for the web viewer.
REM Usage: build.bat [Openterface_Core-dir] [output-dir]
REM
REM Default: build.bat -> compiles Openterface_Core into public\

setlocal EnableDelayedExpansion

REM Default paths
if "%~1"=="" (set "CORE_DIR=Openterface_Core") else (set "CORE_DIR=%~1")
if "%~2"=="" (set "OUT_DIR=public") else (set "OUT_DIR=%~2")

set "SRC=%CORE_DIR%\src"
set "INC=%CORE_DIR%\include"
set "PLATFORM=%SRC%\platform"

echo [wasm] CoreDir: %CORE_DIR%
echo [wasm] OutDir : %OUT_DIR%
echo [wasm] Compiling Openterface_Core unified API to WebAssembly...

REM Create output directory
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM Check emcc
where emcc >nul 2>&1
if errorlevel 1 (
    echo ERROR: emcc not found on PATH. Install Emscripten SDK first.
    exit /b 1
)

REM Check core directory
if not exist "%SRC%" (
    echo ERROR: Source directory not found: %SRC%
    exit /b 1
)

echo [wasm] Output: %OUT_DIR%\openterface.js

REM Build the argument list in a temp file to avoid CMD escaping issues
set "RESPONSE_FILE=%TEMP%\emcc_args_%RANDOM%.rsp"

(
echo "%SRC%\core\version.c"
echo "%SRC%\capability\capability.c"
echo "%SRC%\device\device_info.c"
echo "%SRC%\profile\profile.c"
echo "%SRC%\transport\transport.c"
echo "%SRC%\input\input_hid.c"
echo "%SRC%\input\input_packet.c"
echo "%SRC%\input\input_parser.c"
echo "%SRC%\input\input_event.c"
echo "%SRC%\protocol\ch9329\protocol_ch9329.c"
echo "%SRC%\core_native.c"
echo "%SRC%\chip\chip_detector.c"
echo "%SRC%\chip\video_chip_controller.c"
echo "%SRC%\video_status\video_status_poller.c"
echo "%SRC%\usb_mode\usb_mode_controller.c"
echo "%SRC%\usb_mode\usb_mode_ms21xx.c"
echo "%SRC%\usb_mode\usb_mode_serial.c"
echo "%SRC%\hid\hid_device_session.c"
echo "%SRC%\hid\hid_transaction_guard.c"
echo "%SRC%\watchdog\connection_watchdog.c"
echo "%PLATFORM%\platform_backend.c"
echo "%PLATFORM%\platform_stub.c"
echo -I"%INC%"
echo -I"%PLATFORM%"
echo -I"%SRC%\chip"
echo -o "%OUT_DIR%\openterface.js"
echo -O3
echo -s WASM=1
echo -s MODULARIZE=1
echo -s EXPORT_NAME=createOpenterfaceModule
echo -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','stringToNewUTF8','HEAPU8','HEAP32','HEAP16','getValue','setValue']
echo -s EXPORTED_FUNCTIONS=['_op_transport_init','_op_transport_open','_op_transport_close','_op_transport_read','_op_transport_write','_op_transport_control','_op_transport_kind_label','_op_profile_registry','_op_profile_registry_count','_op_profile_find_by_id','_op_profile_match','_op_profile_apply_to_device','_op_profile_has_capability','_op_device_family_label','_op_ch9329_checksum','_op_ch9329_hex_dump','_op_ch9329_build_keyboard_packet','_op_ch9329_build_mouse_rel_packet','_op_ch9329_build_mouse_abs_packet','_op_ch9329_build_press_release_packets','_op_ch9329_build_usb_switch_packet','_op_ch9329_parse_usb_switch_response','_op_input_hid_code_from_name','_op_input_hid_code_from_char','_op_input_hid_code_label','_op_input_parse_token','_op_input_macro_parse','_op_input_script_tokenize','_op_input_hid_code_from_dom_code','_op_input_build_keyboard','_op_input_build_mouse_rel','_op_input_build_mouse_abs','_op_input_build_press_release','_op_input_checksum','_op_input_hex_dump','_op_capabilities_has','_op_capability_label','_op_capability_state_label','_op_device_info_init','_op_device_info_has_interface','_op_device_info_has_capability','_op_video_chip_detect_from_device','_op_video_chip_kind_label','_op_video_chip_get_register_set','_op_video_chip_controller_create','_op_video_chip_controller_destroy','_op_video_chip_controller_set_transport','_op_video_chip_controller_detect','_op_video_chip_controller_get_register_set','_op_video_chip_controller_read_register','_op_video_chip_controller_write_register','_op_video_chip_controller_get_usb_mode','_op_video_chip_controller_set_usb_mode','_op_video_chip_controller_get_cached_input_status','_op_video_chip_controller_set_cached_input_status','_op_video_status_poller_create','_op_video_status_poller_destroy','_op_video_status_poller_poll','_op_video_input_status_clear','_op_video_input_status_normalize','_op_usb_mode_endpoint_init','_op_usb_mode_endpoint_bind_device','_op_usb_mode_endpoint_bind_hid_session','_op_usb_mode_endpoint_bind_transport','_op_usb_mode_endpoint_bind_chip_controller','_op_usb_mode_get','_op_usb_mode_set','_op_hid_device_session_create','_op_hid_device_session_destroy','_op_hid_device_session_open','_op_hid_device_session_close','_op_hid_device_session_is_open','_op_hid_device_session_device','_op_hid_device_session_send_feature_report','_op_hid_device_session_get_feature_report','_op_hid_transaction_guard_create','_op_hid_transaction_guard_destroy','_op_hid_transaction_guard_enter','_op_hid_transaction_guard_leave','_op_native_transport_init_serial','_op_native_transport_release','_op_core_native_version','_op_core_native_hid_backend_name','_op_core_native_serial_backend_name','_op_core_version','_op_core_version_string','_op_watchdog_create','_op_watchdog_destroy','_op_watchdog_tick','_op_watchdog_report_error','_op_watchdog_report_ok','_op_watchdog_get_state','_op_watchdog_consecutive_errors','_op_watchdog_total_errors','_op_watchdog_recovery_attempts','_op_watchdog_force_reconnect','_op_connection_state_label','_malloc','_free']
echo --no-entry
echo -s ALLOW_MEMORY_GROWTH=1
echo -s EXPORT_KEEPALIVE=1
) > "%RESPONSE_FILE%"

emcc @%RESPONSE_FILE%

if errorlevel 1 (
    del /f /q "%RESPONSE_FILE%"
    echo ERROR: emcc build failed.
    exit /b 1
)

del /f /q "%RESPONSE_FILE%"

echo [wasm] Output: %OUT_DIR%\openterface.wasm
dir "%OUT_DIR%\openterface.wasm" 2>nul

REM Copy to canonical location for npm workspace
set "CORE_WASM=packages\core\wasm"
if not exist "%CORE_WASM%" mkdir "%CORE_WASM%"
copy /Y "%OUT_DIR%\openterface.js" "%CORE_WASM%\openterface.js" >nul
copy /Y "%OUT_DIR%\openterface.wasm" "%CORE_WASM%\openterface.wasm" >nul
echo [wasm] Copied to %CORE_WASM%\

endlocal
