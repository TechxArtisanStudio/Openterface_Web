import { computed } from 'vue'
import { useSerial } from './useSerial'

export function useDeviceState() {
  const { deviceInfo, usbMode } = useSerial()

  const firmwareVersion = computed(() => deviceInfo.value?.firmwareVersion ?? '')
  const targetConnected = computed(() => deviceInfo.value?.targetConnected ?? false)
  const numLock = computed(() => deviceInfo.value?.numLock ?? false)
  const capsLock = computed(() => deviceInfo.value?.capsLock ?? false)
  const scrollLock = computed(() => deviceInfo.value?.scrollLock ?? false)

  const deviceSummary = computed(() => {
    const parts: string[] = []
    if (firmwareVersion.value) parts.push(`FW: v${firmwareVersion.value}`)
    parts.push(`USB: ${usbMode.value}`)
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
