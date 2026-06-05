import { ref, computed, inject } from 'vue'
import { HIDTransportKey, type TransportDeviceInfo } from '@openterface/core'

export const usbMode = ref<'host' | 'target'>('target')

export function useDeviceState() {
  const transport = inject(HIDTransportKey)!

  const deviceInfo = computed(() => transport.deviceInfo.value)

  const firmwareVersion = computed(() => deviceInfo.value?.firmwareVersion ?? '')
  const targetConnected = computed(() => deviceInfo.value?.targetConnected ?? false)
  const numLock = computed(() => deviceInfo.value?.numLock ?? false)
  const capsLock = computed(() => deviceInfo.value?.capsLock ?? false)
  const scrollLock = computed(() => deviceInfo.value?.scrollLock ?? false)

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
