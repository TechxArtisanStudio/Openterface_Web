/**
 * High-level serial command builders.
 * Wraps the serial `write` function with typed helpers for each device operation.
 */
import { useSerial } from './useSerial'
import { getKeymod } from './useWasm'

const FRAME_HEAD = new Uint8Array([0x57, 0xab, 0x00])

export function useSerialCommands() {
  const { write } = useSerial()
  const km = getKeymod()

  /** Send a keyboard press+release (single key) */
  async function sendKeyPress(modifiers: number, hidCode: number): Promise<void> {
    const packet = km.buildPressRelease(modifiers, hidCode)
    await write(packet)
  }

  /** Send a keyboard press (key held down) */
  async function sendKeyDown(modifiers: number, hidCode: number): Promise<void> {
    const packet = km.buildKeyboard(modifiers, [hidCode])
    await write(packet)
  }

  /** Send a keyboard release (all keys up) */
  async function sendKeyUp(): Promise<void> {
    const packet = km.buildKeyboard(0, [])
    await write(packet)
  }

  /** Send a keyboard press + release in one go (non-WASM fallback) */
  async function sendKeyTap(modifiers: number, hidCode: number): Promise<void> {
    await sendKeyDown(modifiers, hidCode)
    await sendKeyUp()
  }

  /** Send an absolute mouse report */
  async function sendMouseAbsolute(
    buttons: number,
    x: number,
    y: number,
    wheel: number,
  ): Promise<void> {
    // Frame: 57 AB 00 04 07 [btn x_lo x_hi y_lo y_hi wheel] checksum
    const clampedX = Math.max(0, Math.min(4095, x))
    const clampedY = Math.max(0, Math.min(4095, y))
    const data = new Uint8Array([
      buttons,
      clampedX & 0xff,
      (clampedX >> 8) & 0xff,
      clampedY & 0xff,
      (clampedY >> 8) & 0xff,
      wheel & 0xff,
    ])
    const frame = buildFrame(0x04, data)
    await write(frame)
  }

  /** Send a relative mouse report (uses WASM) */
  async function sendMouseRelative(
    buttons: number,
    dx: number,
    dy: number,
    wheel: number,
  ): Promise<void> {
    const packet = km.buildMouseRel(buttons, dx, dy, wheel)
    await write(packet)
  }

  /** Send a media/consumer control report */
  async function sendMediaKey(data: Uint8Array): Promise<void> {
    const frame = buildFrame(0x03, data)
    await write(frame)
  }

  /** Switch USB to host mode */
  async function switchUsbToHost(): Promise<void> {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(0x17, data)
    await write(frame)
  }

  /** Switch USB to target mode */
  async function switchUsbToTarget(): Promise<void> {
    const data = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(0x17, data)
    await write(frame)
  }

  /** Check current USB switch status */
  async function checkUsbStatus(): Promise<void> {
    const data = new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(0x17, data)
    await write(frame)
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
    await write(frame)
  }

  /** Factory reset the HID chip */
  async function factoryReset(): Promise<void> {
    // Send CMD_SET_DEFAULT_CFG then CMD_RESET
    const resetFrame = new Uint8Array(6)
    resetFrame[0] = 0x57
    resetFrame[1] = 0xab
    resetFrame[2] = 0x00
    resetFrame[3] = 0x0c
    resetFrame[4] = 0x00
    resetFrame[5] = computeChecksum(resetFrame.subarray(0, 5))
    await write(resetFrame)
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
    checkUsbStatus,
    queryDeviceInfo,
    factoryReset,
    toggleLockKey,
  }
}

function buildFrame(cmd: number, data: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + data.length)
  frame[0] = 0x57
  frame[1] = 0xab
  frame[2] = 0x00
  frame[3] = cmd
  frame[4] = data.length
  frame.set(data, 5)
  frame[frame.length - 1] = computeChecksum(frame.subarray(0, frame.length - 1))
  return frame
}

function computeChecksum(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum & 0xff
}
