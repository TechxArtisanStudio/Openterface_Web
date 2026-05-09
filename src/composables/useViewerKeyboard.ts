import { ref, onMounted, onUnmounted, watch, reactive } from 'vue'
import { useSerial } from './useSerial'
import { getKeymod } from './useWasm'
import { useSerialCommands } from './useSerialCommands'

export function useViewerKeyboard() {
  const enabled = ref(false)
  const km = getKeymod()
  const { isConnected } = useSerial()
  const { sendKeyDown, sendKeyUp } = useSerialCommands()

  // Currently pressed keys (by event.code)
  const pressedKeys = new Map<string, number>() // code → hidCode
  let currentModifiers = 0

  function handleEvent(event: KeyboardEvent, pressed: boolean): void {
    if (!enabled.value || !isConnected.value) return

    // Don't capture system shortcuts we can't prevent
    if (event.altKey && event.ctrlKey) return

    event.preventDefault()
    event.stopPropagation()

    const code = event.code
    const hidCode = mapCodeToHid(code, km)
    if (hidCode < 0) return

    // Compute modifier state from the event
    const modifiers = computeModifiers(event)

    if (pressed) {
      pressedKeys.set(code, hidCode)
      currentModifiers = modifiers
      sendKeyDown(modifiers, hidCode)
    } else {
      pressedKeys.delete(code)

      if (pressedKeys.size === 0) {
        // All keys released, send release report
        sendKeyUp()
        currentModifiers = 0
      } else {
        // Other keys still held, send updated report
        sendKeyDown(modifiers, hidCode)
      }
    }
  }

  function releaseAll(): void {
    if (!isConnected.value) return
    sendKeyUp()
    pressedKeys.clear()
    currentModifiers = 0
  }

  onUnmounted(() => {
    releaseAll()
  })

  return { enabled, handleEvent, releaseAll }
}

function mapCodeToHid(code: string, km: ReturnType<typeof getKeymod>): number {
  // Direct HID mapping from common codes
  const direct: Record<string, number> = {
    KeyA: 0x04,
    KeyB: 0x05,
    KeyC: 0x06,
    KeyD: 0x07,
    KeyE: 0x08,
    KeyF: 0x09,
    KeyG: 0x0a,
    KeyH: 0x0b,
    KeyI: 0x0c,
    KeyJ: 0x0d,
    KeyK: 0x0e,
    KeyL: 0x0f,
    KeyM: 0x10,
    KeyN: 0x11,
    KeyO: 0x12,
    KeyP: 0x13,
    KeyQ: 0x14,
    KeyR: 0x15,
    KeyS: 0x16,
    KeyT: 0x17,
    KeyU: 0x18,
    KeyV: 0x19,
    KeyW: 0x1a,
    KeyX: 0x1b,
    KeyY: 0x1c,
    KeyZ: 0x1d,
    Digit0: 0x27,
    Digit1: 0x1e,
    Digit2: 0x1f,
    Digit3: 0x20,
    Digit4: 0x21,
    Digit5: 0x22,
    Digit6: 0x23,
    Digit7: 0x24,
    Digit8: 0x25,
    Digit9: 0x26,
    Enter: 0x28,
    Escape: 0x29,
    Backspace: 0x2a,
    Tab: 0x2b,
    Space: 0x2c,
    Minus: 0x2d,
    Equal: 0x2e,
    BracketLeft: 0x2f,
    BracketRight: 0x30,
    Backslash: 0x31,
    IntlBackslash: 0x64,
    Semicolon: 0x33,
    Quote: 0x34,
    Backquote: 0x35,
    Comma: 0x36,
    Period: 0x37,
    Slash: 0x38,
    CapsLock: 0x39,
    F1: 0x3a,
    F2: 0x3b,
    F3: 0x3c,
    F4: 0x3d,
    F5: 0x3e,
    F6: 0x3f,
    F7: 0x40,
    F8: 0x41,
    F9: 0x42,
    F10: 0x43,
    F11: 0x44,
    F12: 0x45,
    PrintScreen: 0x46,
    ScrollLock: 0x47,
    Pause: 0x48,
    Insert: 0x49,
    Home: 0x4a,
    PageUp: 0x4b,
    Delete: 0x4c,
    End: 0x4d,
    PageDown: 0x4e,
    ArrowRight: 0x4f,
    ArrowLeft: 0x50,
    ArrowDown: 0x51,
    ArrowUp: 0x52,
    NumLock: 0x53,
    NumpadDivide: 0x54,
    NumpadMultiply: 0x55,
    NumpadAdd: 0x57,
    NumpadSubtract: 0x56,
    NumpadEnter: 0x58,
    NumpadDecimal: 0x63,
    Numpad0: 0x62,
    Numpad1: 0x59,
    Numpad2: 0x5a,
    Numpad3: 0x5b,
    Numpad4: 0x5c,
    Numpad5: 0x5d,
    Numpad6: 0x5e,
    Numpad7: 0x5f,
    Numpad8: 0x60,
    Numpad9: 0x61,
    NumpadEqual: 0x67,
    ControlLeft: 0xe0,
    ControlRight: 0xe4,
    ShiftLeft: 0xe1,
    ShiftRight: 0xe5,
    AltLeft: 0xe2,
    AltRight: 0xe6,
    MetaLeft: 0xe3,
    MetaRight: 0xe7,
  }

  return direct[code] ?? -1
}

function computeModifiers(event: KeyboardEvent): number {
  let mod = 0
  if (event.ctrlKey || event.code === 'ControlLeft' || event.code === 'ControlRight') mod |= 0x01
  if (event.shiftKey || event.code === 'ShiftLeft' || event.code === 'ShiftRight') mod |= 0x02
  if (event.altKey || event.code === 'AltLeft' || event.code === 'AltRight') mod |= 0x04
  if (event.metaKey || event.code === 'MetaLeft' || event.code === 'MetaRight') mod |= 0x08
  return mod
}
