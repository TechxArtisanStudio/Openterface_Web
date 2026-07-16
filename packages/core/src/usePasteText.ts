/**
 * Paste text composable — transport-agnostic.
 * Uses HIDTransportKey and useHidCommands from @openterface/core.
 */
import { ref, inject } from 'vue'
import { HIDTransportKey, useHidCommands } from './index'

export function usePasteText() {
  const transport = inject(HIDTransportKey)
  if (!transport) {
    throw new Error('[usePasteText] HIDTransportKey not provided.')
  }

  const { sendKeyDown, sendKeyUp } = useHidCommands()

  const isPasting = ref(false)
  const progress = ref(0)
  const totalChars = ref(0)
  const delay = ref(30)
  const text = ref('')
  const error = ref<string | null>(null)

  let cancelled = false

  async function paste(pasteText: string, customDelay?: number): Promise<void> {
    if (!pasteText.trim()) return
    if (!transport.isConnected?.value) {
      error.value = 'Not connected to device'
      return
    }

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
        await sendKeyDown(0, 0x28) // Enter
        await new Promise((r) => setTimeout(r, customDelay ?? delay.value))
        await sendKeyUp()
      } else if (char === '\t') {
        await sendKeyDown(0, 0x2b) // Tab
        await new Promise((r) => setTimeout(r, customDelay ?? delay.value))
        await sendKeyUp()
      } else {
        const km = getKeymod()
        if (!km) continue
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

function getKeymod(): CoreWASM | null {
  if (typeof window === 'undefined') return null
  return (window as any)._wasmModule as CoreWASM | undefined
}

interface CoreWASM {
  hidCodeForChar(c: string): { code: number; needsShift: boolean } | null
}
