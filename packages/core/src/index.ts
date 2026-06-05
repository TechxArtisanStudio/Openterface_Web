// Core exports for @openterface/core

// Transport
export { HIDTransportKey, TransportState } from './transport/hid-transport'
export type { HIDTransport, TransportDeviceInfo } from './transport/hid-transport'

// Protocol
export {
  FRAME_HEAD,
  FRAME_HEAD_0,
  FRAME_HEAD_1,
  DEFAULT_ADDR,
  Command,
  ResponseCommand,
  USB,
  checksum,
  hexDump,
  buildFrame,
  buildQuery,
} from './protocol/serial'
export { FrameParser } from './protocol/serial'

// Types
export { SerialState, SerialCommand } from './types/serial'
export type { DeviceInfo } from './types/serial'

// WASM
export { loadWasm, getKeymod, isWasmReady, type KeymodWASM } from './wasm/useWasm'

// Composables
export { useHidCommands } from './composables/useHidCommands'
export { useViewerKeyboard } from './composables/useViewerKeyboard'
export { usePasteText } from './composables/usePasteText'
