/**
 * High-level serial command builders.
 * Wraps the serial `write` function with typed helpers for each device operation.
 */
import { useSerial } from './useSerial'
import { getKeymod, isWasmReady } from './useWasm'
import { hexDump } from '../utils/serial'

const FRAME_HEAD = new Uint8Array([0x57, 0xab, 0x00])

export function useSerialCommands() {
  const { write } = useSerial()
  const km = () => {
    if (!isWasmReady()) {
      console.warn('[SerialCommands] Core WASM not ready, skipping command')
      return null
    }
    return getKeymod()
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
    await write(packet)
  }

  /** Send a keyboard release (all keys up) */
  async function sendKeyUp(): Promise<void> {
    const k = km()
    if (!k) return
    const packet = k.buildKeyboard(0, [])
    await write(packet)
  }

  /** Send a keyboard press + release in one go */
  async function sendKeyTap(modifiers: number, hidCode: number): Promise<void> {
    await sendKeyDown(modifiers, [hidCode])
    await sendKeyUp()
  }

  /** Send an absolute mouse report (uses WASM) */
  async function sendMouseAbsolute(
    buttons: number,
    x: number,
    y: number,
    wheel: number,
  ): Promise<void> {
    const k = km()
    if (!k) {
      console.warn('[SerialCommands] sendMouseAbsolute aborted: keymod unavailable')
      return
    }
    const clampedX = Math.max(0, Math.min(4095, x))
    const clampedY = Math.max(0, Math.min(4095, y))
    console.log('[SerialCommands] sendMouseAbsolute: btn=' + buttons, 'x=' + clampedX, 'y=' + clampedY, 'wheel=' + wheel)
    const packet = k.buildMouseAbs(buttons, clampedX, clampedY, wheel)
    console.log('[SerialCommands] sendMouseAbsolute packet=' + hexDump(packet))
    try {
      await write(packet)
      console.log('[SerialCommands] sendMouseAbsolute write OK, len=' + packet.length)
    } catch (error) {
      console.error('[SerialCommands] sendMouseAbsolute write FAIL', error)
      throw error
    }
  }

  /** Send a relative mouse report (uses WASM) */
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
    console.log('[SerialCommands] sendMouseRelative: btn=' + buttons, 'dx=' + clampedDx, 'dy=' + clampedDy, 'wheel=' + clampedWheel)
    const packet = k.buildMouseRel(buttons, clampedDx, clampedDy, clampedWheel)
    await write(packet)
  }

  /** Send a media/consumer control report */
  async function sendMediaKey(data: Uint8Array): Promise<void> {
    const frame = buildFrame(0x03, data)
    await write(frame)
  }

  /** Switch USB to host mode */
  async function switchUsbToHost(): Promise<void> {
    const k = km()
    if (!k) return
    const frame = k.buildUsbSwitch(0x00)
    console.log(`[SerialCommands] switch USB to host: ${hexDump(frame)}`)
    await write(frame)
  }

  /** Switch USB to target mode */
  async function switchUsbToTarget(): Promise<void> {
    const k = km()
    if (!k) return
    const frame = k.buildUsbSwitch(0x01)
    console.log(`[SerialCommands] switch USB to target: ${hexDump(frame)}`)
    await write(frame)
  }

  /** Check current USB switch status */
  async function checkUsbStatus(): Promise<void> {
    // USB status query uses a different frame (CMD_SWITCH_USB with param 0x03)
    // No dedicated Core builder for the query, so use plain frame
    const frame = buildFrame(0x17, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x03]))
    console.log(`[SerialCommands] query USB status: ${hexDump(frame)}`)
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
  const frame = new Uint8Array(5 + data.length + 1) // +1 for checksum
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
