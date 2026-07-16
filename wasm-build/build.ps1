<#
.SYNOPSIS
  Build Openterface_Core to WebAssembly for Openterface_Web.

.DESCRIPTION
  PowerShell equivalent of wasm-build/build.sh.
  Produces:
    - openterface.js
    - openterface.wasm

  Default output directory is the web app's public/ folder so Vite can serve it
  and include it in the production build.

.PREREQUISITES
  - Emscripten SDK installed and activated in the current shell (emcc on PATH)

.EXAMPLE
  # From repo root:
  pwsh -File .\wasm-build\build.ps1

.EXAMPLE
  pwsh -File .\wasm-build\build.ps1 -CoreDir .\Openterface_Core -OutDir .\public
#>

[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$CoreDir,

  [Parameter(Position = 1)]
  [string]$OutDir
)

$ErrorActionPreference = 'Stop'

function Resolve-Dir([string]$PathValue, [string]$BaseDir) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $null
  }
  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return (Resolve-Path -LiteralPath $PathValue).Path
  }
  return (Resolve-Path -LiteralPath (Join-Path $BaseDir $PathValue)).Path
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $scriptDir '..')).Path

if ([string]::IsNullOrWhiteSpace($CoreDir)) {
  $CoreDir = Join-Path $repoRoot 'Openterface_Core'
}
if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path $repoRoot 'public'
}

$coreDirFull = Resolve-Dir -PathValue $CoreDir -BaseDir $repoRoot
$outDirFull = if ([System.IO.Path]::IsPathRooted($OutDir)) {
  [System.IO.Path]::GetFullPath($OutDir)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutDir))
}

if (-not (Test-Path -LiteralPath $coreDirFull -PathType Container)) {
  throw "CoreDir not found: $coreDirFull"
}

$src = Join-Path $coreDirFull 'src'
$inc = Join-Path $coreDirFull 'include'
$platform = Join-Path $src 'platform'
$nativeDir = $src

New-Item -ItemType Directory -Force -Path $outDirFull | Out-Null

if (-not (Get-Command emcc -ErrorAction SilentlyContinue)) {
  throw "'emcc' not found on PATH. Please install/activate Emscripten SDK (emsdk) in this shell, then re-run."
}

Write-Host "[wasm] CoreDir: $coreDirFull" -ForegroundColor DarkGray
Write-Host "[wasm] OutDir : $outDirFull" -ForegroundColor DarkGray
Write-Host "[wasm] Compiling Openterface_Core unified API to WebAssembly..." -ForegroundColor Cyan

# Keep the source list in sync with wasm-build/build.sh
$sources = @(
  (Join-Path $src 'core/version.c'),
  (Join-Path $src 'capability/capability.c'),
  (Join-Path $src 'device/device_info.c'),
  (Join-Path $src 'profile/profile.c'),
  (Join-Path $src 'transport/transport.c'),
  (Join-Path $src 'input/input_hid.c'),
  (Join-Path $src 'input/input_packet.c'),
  (Join-Path $src 'input/input_parser.c'),
  (Join-Path $src 'input/input_event.c'),
  (Join-Path $src 'protocol/ch9329/protocol_ch9329.c'),
  (Join-Path $nativeDir 'core_native.c'),
  (Join-Path $src 'chip/chip_detector.c'),
  (Join-Path $src 'chip/video_chip_controller.c'),
  (Join-Path $src 'video_status/video_status_poller.c'),
  (Join-Path $src 'usb_mode/usb_mode_controller.c'),
  (Join-Path $src 'usb_mode/usb_mode_ms21xx.c'),
  (Join-Path $src 'usb_mode/usb_mode_serial.c'),
  (Join-Path $src 'hid/hid_device_session.c'),
  (Join-Path $src 'hid/hid_transaction_guard.c'),
  (Join-Path $src 'watchdog/connection_watchdog.c'),
  (Join-Path $platform 'platform_backend.c'),
  (Join-Path $platform 'platform_stub.c')
)

foreach ($file in $sources) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Missing source file: $file"
  }
}

$outJs = Join-Path $outDirFull 'openterface.js'

$exportedRuntimeMethods = '["ccall","cwrap","stringToNewUTF8","HEAPU8","HEAP32","HEAP16","getValue","setValue"]'
$exportedFunctions = '["_op_transport_init","_op_transport_open","_op_transport_close","_op_transport_read","_op_transport_write","_op_transport_control","_op_transport_kind_label","_op_profile_registry","_op_profile_registry_count","_op_profile_find_by_id","_op_profile_match","_op_profile_apply_to_device","_op_profile_has_capability","_op_device_family_label","_op_ch9329_checksum","_op_ch9329_hex_dump","_op_ch9329_build_keyboard_packet","_op_ch9329_build_mouse_rel_packet","_op_ch9329_build_mouse_abs_packet","_op_ch9329_build_press_release_packets","_op_ch9329_build_usb_switch_packet","_op_ch9329_parse_usb_switch_response","_op_input_hid_code_from_name","_op_input_hid_code_from_char","_op_input_hid_code_label","_op_input_parse_token","_op_input_macro_parse","_op_input_script_tokenize","_op_input_hid_code_from_dom_code","_op_input_build_keyboard","_op_input_build_mouse_rel","_op_input_build_mouse_abs","_op_input_build_press_release","_op_input_checksum","_op_input_hex_dump","_op_capabilities_has","_op_capability_label","_op_capability_state_label","_op_device_info_init","_op_device_info_has_interface","_op_device_info_has_capability","_op_video_chip_detect_from_device","_op_video_chip_kind_label","_op_video_chip_get_register_set","_op_video_chip_controller_create","_op_video_chip_controller_destroy","_op_video_chip_controller_set_transport","_op_video_chip_controller_detect","_op_video_chip_controller_get_register_set","_op_video_chip_controller_read_register","_op_video_chip_controller_write_register","_op_video_chip_controller_get_usb_mode","_op_video_chip_controller_set_usb_mode","_op_video_chip_controller_get_cached_input_status","_op_video_chip_controller_set_cached_input_status","_op_video_status_poller_create","_op_video_status_poller_destroy","_op_video_status_poller_poll","_op_video_input_status_clear","_op_video_input_status_normalize","_op_usb_mode_endpoint_init","_op_usb_mode_endpoint_bind_device","_op_usb_mode_endpoint_bind_hid_session","_op_usb_mode_endpoint_bind_transport","_op_usb_mode_endpoint_bind_chip_controller","_op_usb_mode_get","_op_usb_mode_set","_op_hid_device_session_create","_op_hid_device_session_destroy","_op_hid_device_session_open","_op_hid_device_session_close","_op_hid_device_session_is_open","_op_hid_device_session_device","_op_hid_device_session_send_feature_report","_op_hid_device_session_get_feature_report","_op_hid_transaction_guard_create","_op_hid_transaction_guard_destroy","_op_hid_transaction_guard_enter","_op_hid_transaction_guard_leave","_op_native_transport_init_serial","_op_native_transport_release","_op_core_native_version","_op_core_native_hid_backend_name","_op_core_native_serial_backend_name","_op_core_version","_op_core_version_string","_op_watchdog_create","_op_watchdog_destroy","_op_watchdog_tick","_op_watchdog_report_error","_op_watchdog_report_ok","_op_watchdog_get_state","_op_watchdog_consecutive_errors","_op_watchdog_total_errors","_op_watchdog_recovery_attempts","_op_watchdog_force_reconnect","_op_connection_state_label","_malloc","_free"]'

$args = @()
$args += $sources
$args += "-I$inc"
$args += "-I$platform"
$args += "-I" + (Join-Path $src 'chip')
$args += @(
  '-o', $outJs,
  '-O3',
  '-sWASM=1',
  '-sMODULARIZE=1',
  '-sEXPORT_NAME=createOpenterfaceModule',
  "-sEXPORTED_RUNTIME_METHODS=$exportedRuntimeMethods",
  "-sEXPORTED_FUNCTIONS=$exportedFunctions",
  '--no-entry',
  '-sALLOW_MEMORY_GROWTH=1',
  '-sEXPORT_KEEPALIVE=1'
)

& emcc @args

$outWasm = Join-Path $outDirFull 'openterface.wasm'
$outJs2 = Join-Path $outDirFull 'openterface.js'
if (-not (Test-Path -LiteralPath $outJs2 -PathType Leaf)) {
  throw "Build finished but JS file not found: $outJs2"
}
if (-not (Test-Path -LiteralPath $outWasm -PathType Leaf)) {
  throw "Build finished but wasm file not found: $outWasm"
}

$jsInfo = Get-Item -LiteralPath $outJs2
$wasmInfo = Get-Item -LiteralPath $outWasm
Write-Host "[wasm] Output JS  : $outJs2 ($([Math]::Round($jsInfo.Length / 1KB, 1)) KiB) @ $($jsInfo.LastWriteTime)" -ForegroundColor Green
Write-Host "[wasm] Output WASM: $outWasm ($([Math]::Round($wasmInfo.Length / 1KB, 1)) KiB) @ $($wasmInfo.LastWriteTime)" -ForegroundColor Green
