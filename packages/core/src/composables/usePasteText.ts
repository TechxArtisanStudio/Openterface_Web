import { ref, inject } from 'vue'
import { HIDTransportKey } from '../transport/hid-transport'
import { getKeymod } from '../wasm/useWasm'
import { useHidCommands } from './useHidCommands'

export function usePasteText() {
  const isPasting = ref(false)
  const progress = ref(0)
  const totalChars = ref(0)
  const delay = ref(30) // ms between characters
  const text = ref('')
  const error = ref<string | null>(null)

  const transport = inject(HIDTransportKey)!
  const { sendKeyDown, sendKeyUp } = useHidCommands()

  let cancelled = false

  async function paste(pasteText: string, customDelay?: number): Promise<void> {
    if (!pasteText.trim()) return

    if (!transport.isConnected.value) {
      error.value = 'Not connected to device'
      return
    }

    const km = getKeymod()

    isPasting.value = true
    cancelled = false
    text.value = pasteText
    totalChars.value = pasteText.length
    progress.value = 0
    error.value = null

    for (let i = 0; i < pasteText.length; i++) {
      if (cancelled) break

      const char = pasteText[i]

      if (char === '\n' || char === '\r') {
        // Send Enter
        await sendKeyDown(0, 0x28)
        await new Promise((r) => setTimeout(r, customDelay ?? delay.value))
        await sendKeyUp()
      } else if (char === '\t') {
        // Send Tab
        await sendKeyDown(0, 0x2b)
        await new Promise((r) => setTimeout(r, customDelay ?? delay.value))
        await sendKeyUp()
      } else {
        const result = km.hidCodeForChar(char)
        if (!result) {
          console.warn(`[Paste] No HID mapping for character: ${char}`)
          continue
        }

        const modifiers = result.needsShift ? 0x02 : 0
        await sendKeyDown(modifiers, result.code)
        await new Promise((r) => setTimeout(r, customDelay ?? delay.value))
        await sendKeyUp()
      }

      progress.value = i + 1
    }

    isPasting.value = false
  }

  function cancel(): void {
    cancelled = true
  }

  async function pasteFromClipboard(customDelay?: number): Promise<void> {
    try {
      const text = await navigator.clipboard.readText()
      await paste(text, customDelay)
    } catch {
      error.value = 'Clipboard access denied. Use the text field instead.'
    }
  }

  return {
    isPasting,
    progress,
    totalChars,
    delay,
    text,
    error,
    paste,
    cancel,
    pasteFromClipboard,
  }
}
