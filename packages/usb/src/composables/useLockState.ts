/**
 * Composable for lock key state with optimistic UI updates.
 *
 * Supports two toggle paths:
 *  1. Click toggle (StatusBar icons) - flips optimistic state, then sends key press
 *  2. Keyboard toggle (physical lock key press) - flips optimistic state, queries firmware
 */
import { ref, watch, computed } from 'vue'
import { useSerial } from './useSerial'
import { useSerialCommands } from './useSerialCommands'
import { useDeviceState } from './useDeviceState'
import { getKeymod, isWasmReady } from './useWasm'

// Optimistic local state - defaults are overwritten on first firmware sync
const localNumLock = ref(false)
const localCapsLock = ref(false)
const localScrollLock = ref(false)

let initialized = false
function ensureInit(): void {
  if (initialized) return
  initialized = true

  const { numLock, capsLock, scrollLock } = useDeviceState()

  // Reconcile optimistic state with firmware response
  watch([numLock, capsLock, scrollLock], ([n, c, s]) => {
    localNumLock.value = n
    localCapsLock.value = c
    localScrollLock.value = s
  }, { immediate: true })
}

/** Resolve a lock key HID code from Core WASM dom_event_map */
function getLockKeyHidCode(key: 'numLock' | 'capsLock' | 'scrollLock'): number | null {
  if (!isWasmReady()) return null
  const km = getKeymod()
  const name = key === 'numLock' ? 'NumLock' : key === 'capsLock' ? 'CapsLock' : 'ScrollLock'
  return km.hidCodeFromDomCode(name)
}

export function useLockState() {
  ensureInit()

  const { isConnected } = useSerial()
  const { toggleLockKey, queryDeviceInfo } = useSerialCommands()

  /** Click toggle (StatusBar icons) - sends key press + optimistic flip */
  async function toggleLock(key: 'numLock' | 'capsLock' | 'scrollLock'): Promise<void> {
    // Optimistic flip - UI updates instantly
    const flag = key === 'numLock' ? localNumLock : key === 'capsLock' ? localCapsLock : localScrollLock
    flag.value = !flag.value

    if (!isConnected.value) return

    const hidCode = getLockKeyHidCode(key)
    if (hidCode == null || hidCode < 0) {
      console.warn(`[LockState] Core returned invalid HID code for ${key}`)
      return
    }

    console.log(`[LockState] click toggle ${key} => ${flag.value} (0x${hidCode.toString(16)})`)

    // Send key to firmware then query updated state
    await toggleLockKey(hidCode)
    await new Promise(r => setTimeout(r, 100))
    await queryDeviceInfo()
  }

  /**
   * Keyboard toggle (physical lock key press) - called by useViewerKeyboard
   * after it already sent the key press via sendKeyPress.
   * Only handles optimistic flip + state reconciliation.
   */
  function toggleLockKeyFromKeyboard(hidCode: number): void {
    // Optimistic flip based on HID code
    let key: 'numLock' | 'capsLock' | 'scrollLock' | null = null
    if (hidCode === 0x53) key = 'numLock'
    else if (hidCode === 0x39) key = 'capsLock'
    else if (hidCode === 0x47) key = 'scrollLock'

    if (key) {
      const flag = key === 'numLock' ? localNumLock : key === 'capsLock' ? localCapsLock : localScrollLock
      flag.value = !flag.value
      console.log(`[LockState] keyboard optimistic ${key} => ${flag.value} (0x${hidCode.toString(16)})`)
    }

    // Query firmware for actual state (fire-and-forget)
    void (async () => {
      await new Promise(r => setTimeout(r, 100))
      await queryDeviceInfo()
    })()
  }

  return {
    numLock: computed(() => localNumLock.value),
    capsLock: computed(() => localCapsLock.value),
    scrollLock: computed(() => localScrollLock.value),
    toggleLock,
    toggleLockKeyFromKeyboard,
  }
}
