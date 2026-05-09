import { ref, computed } from 'vue'

export const usbMode = ref<'host' | 'target'>('target')

export function useDeviceState() {
  const firmwareVersion = ref('')
  const targetConnected = ref(false)
  const numLock = ref(false)
  const capsLock = ref(false)
  const scrollLock = ref(false)

  const deviceSummary = computed(() => {
    const parts: string[] = []
    if (firmwareVersion.value) parts.push(`FW: v${firmwareVersion.value}`)
    parts.push(`USB: ${targetConnected.value ? 'target' : 'host'}`)
    return parts.join(' | ')
  })

  const lockIndicators = computed(() => ({
    num: numLock.value,
    caps: capsLock.value,
    scroll: scrollLock.value,
  }))

  return {
    firmwareVersion,
    targetConnected,
    numLock,
    capsLock,
    scrollLock,
    usbMode,
    deviceSummary,
    lockIndicators,
  }
}
