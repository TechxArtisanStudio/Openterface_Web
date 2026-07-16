/**
 * High-level HID command builders.
 * Wraps the transport `write` function with typed helpers for each device operation.
 *
 * Uses the active HIDTransport (via Vue DI) to send CH9329 frames,
 * and the WASM core module to build packets.
 *
 * Transport-agnostic — works with USB serial, WebRTC, or any HIDTransport.
 */
import { inject } from 'vue'
import { HIDTransportKey } from './index'

const FRAME_HEAD = new Uint8Array([0x57, 0xab, 0x00])

/** Return the WASM core module, or null if not loaded. */
function getKeymod(): CoreWASM | null {
  if (typeof window === 'undefined') return null
  const wm = (window as any)._wasmModule as CoreWASM | undefined
  return wm ?? null
}

/** Write a CH9329 frame to the active transport */
async function writeFrame(transport: HIDTransport, cmd: number, data: Uint8Array): Promise<void> {
  const frame = new Uint8Array(5 + data.length + 1)
  frame[0] = 0x57
  frame[1] = 0xab
  frame[2] = 0x00
  frame[3] = cmd
  frame[4] = data.length
  frame.set(data, 5)
  frame[frame.length - 1] = computeChecksum(frame.subarray(0, frame.length - 1))
  await transport.write(frame)
}

/** Compute CH9329 checksum */
function computeChecksum(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum & 0xff
}

export function useHidCommands() {
  const transport = inject(HIDTransportKey)
  if (!transport) {
    throw new Error(
      '[HidCommands] HIDTransportKey not provided. ' +
      'Call provide(HIDTransportKey, transport) before using HID commands.'
    )
  }

  const km = (): CoreWASM | null => {
    const m = getKeymod()
    if (!m) {
      console.warn('[HidCommands] Core WASM not ready, skipping command')
    }
    return m
  }

  /** Send a keyboard press+release (single key) */
  async function sendKeyPress(modifiers: number, hidCode: number): Promise<void> {
    await sendKeyDown(modifiers, hidCode)
    await sendKeyUp()
  }

  /** Send a keyboard press (keys held down) */
  async function sendKeyDown(modifiers: number, keys: number | number[]): Promise<void> {
    const k = km()
    if (!k) return
    const normalizedKeys = Array.isArray(keys) ? keys : [keys]
    const packet = k.buildKeyboard(modifiers, normalizedKeys)
    await transport.write(packet)
  }

  /** Send a keyboard release (all keys up) */
  async function sendKeyUp(): Promise<void> {
    const k = km()
    if (!k) return
    const packet = k.buildKeyboard(0, [])
    await transport.write(packet)
  }

  /** Send a keyboard press + release in one go */
  async function sendKeyTap(modifiers: number, hidCode: number): Promise<void> {
    await sendKeyDown(modifiers, [hidCode])
    await sendKeyUp()
  }

  /** Send an absolute mouse report */
  async function sendMouseAbsolute(
    buttons: number,
    x: number,
    y: number,
    wheel: number,
  ): Promise<void> {
    const k = km()
    if (!k) return
    const clampedX = Math.max(0, Math.min(4095, x))
    const clampedY = Math.max(0, Math.min(4095, y))
    const packet = k.buildMouseAbs(buttons, clampedX, clampedY, wheel)
    await transport.write(packet)
  }

  /** Send a relative mouse report */
  async function sendMouseRelative(
    buttons: number,
    dx: number,
    dy: number,
    wheel: number,
  ): Promise<void> {
    const k = km()
    if (!k) return
    const clampedDx = Math.max(-127, Math.min(127, Math.trunc(dx)))
    const clampedDy = Math.max(-127, Math.min(127, Math.trunc(dy)))
    const clampedWheel = Math.max(-127, Math.min(127, Math.trunc(wheel)))
    const packet = k.buildMouseRel(buttons, clampedDx, clampedDy, clampedWheel)
    await transport.write(packet)
  }

  /** Send a media/consumer control report */
  async function sendMediaKey(data: Uint8Array): Promise<void> {
    await writeFrame(transport, 0x03, data)
  }

  /** Switch USB to host mode */
  async function switchUsbToHost(): Promise<void> {
    const k = km()
    if (!k) return
    const frame = k.buildUsbSwitch(0x00)
    await transport.write(frame)
  }

  /** Switch USB to target mode */
  async function switchUsbToTarget(): Promise<void> {
    const k = km()
    if (!k) return
    const frame = k.buildUsbSwitch(0x01)
    await transport.write(frame)
  }

  /** Query device info */
  async function queryDeviceInfo(): Promise<void> {
    const frame = new Uint8Array(6)
    frame[0] = 0x57
    frame[1] = 0xab
    frame[2] = 0x00
    frame[3] = 0x01
    frame[4] = 0x00
    frame[5] = computeChecksum(frame.subarray(0, 5))
    await transport.write(frame)
  }

  /** Toggle a lock key (send press+release) */
  async function toggleLockKey(hidCode: number): Promise<void> {
    await sendKeyPress(0, hidCode)
  }

  return {
    sendKeyPress,
    sendKeyDown,
    sendKeyUp,
    sendKeyTap,
    sendMouseAbsolute,
    sendMouseRelative,
    sendMediaKey,
    switchUsbToHost,
    switchUsbToTarget,
    queryDeviceInfo,
    toggleLockKey,
  }
}

/** WASM core module interface (matches the CoreWASM type from useWasm) */
interface CoreWASM {
  buildKeyboard(modifiers: number, keys: number[]): Uint8Array
  buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array
  buildMouseAbs(buttons: number, x: number, y: number, wheel: number): Uint8Array
  buildUsbSwitch(requestType: number): Uint8Array
}

/** HID transport interface (matches the one from index.ts) */
interface HIDTransport {
  write(data: Uint8Array): Promise<void>
}
