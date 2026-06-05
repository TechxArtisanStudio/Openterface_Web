/**
 * High-level HID command builders.
 * Uses the injected HIDTransport for sending CH9329 frames.
 */
import { inject } from 'vue'
import { HIDTransportKey } from '../transport/hid-transport'
import { getKeymod, isWasmReady } from '../wasm/useWasm'
import { Command, buildFrame, checksum } from '../protocol/serial'

export function useHidCommands() {
  const transport = inject(HIDTransportKey)!

  const km = () => {
    if (!isWasmReady()) {
      console.warn('[HidCommands] WASM not ready, skipping command')
      return null
    }
    return getKeymod()
  }

  /** Send a keyboard press+release (single key) */
  async function sendKeyPress(modifiers: number, hidCode: number): Promise<void> {
    const k = km()
    if (!k) return
    const packet = k.buildPressRelease(modifiers, hidCode)
    await transport.write(packet)
  }

  /** Send a keyboard press (keys held down) */
  async function sendKeyDown(modifiers: number, keys: number[]): Promise<void> {
    const k = km()
    if (!k) return
    const packet = k.buildKeyboard(modifiers, keys)
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

  /** Send an absolute mouse report (uses WASM) */
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

  /** Send a relative mouse report (uses WASM) */
  async function sendMouseRelative(
    buttons: number,
    dx: number,
    dy: number,
    wheel: number,
  ): Promise<void> {
    const k = km()
    if (!k) return
    const packet = k.buildMouseRel(buttons, dx, dy, wheel)
    await transport.write(packet)
  }

  /** Send a media/consumer control report */
  async function sendMediaKey(data: Uint8Array): Promise<void> {
    const frame = buildFrame(Command.CMD_SEND_KB_MEDIA_DATA, data)
    await transport.write(frame)
  }

  /** Switch USB to host mode */
  async function switchUsbToHost(): Promise<void> {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(Command.CMD_SWITCH_USB, data)
    await transport.write(frame)
  }

  /** Switch USB to target mode */
  async function switchUsbToTarget(): Promise<void> {
    const data = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(Command.CMD_SWITCH_USB, data)
    await transport.write(frame)
  }

  /** Check current USB switch status */
  async function checkUsbStatus(): Promise<void> {
    const data = new Uint8Array([0x03, 0x00, 0x00, 0x00, 0x00])
    const frame = buildFrame(Command.CMD_SWITCH_USB, data)
    await transport.write(frame)
  }

  /** Query device info */
  async function queryDeviceInfo(): Promise<void> {
    await transport.queryDeviceInfo()
  }

  /** Factory reset the HID chip */
  async function factoryReset(): Promise<void> {
    const resetFrame = new Uint8Array(6)
    resetFrame[0] = 0x57
    resetFrame[1] = 0xab
    resetFrame[2] = 0x00
    resetFrame[3] = Command.CMD_RESET
    resetFrame[4] = 0x00
    resetFrame[5] = checksum(resetFrame.subarray(0, 5))
    await transport.write(resetFrame)
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
