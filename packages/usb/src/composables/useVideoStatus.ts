/**
 * Composable for polling the target device's HDMI input resolution.
 * Uses WebHID directly — does not depend on useSerial's generation detection.
 */

import { ref } from 'vue'
import { useSerial } from './useSerial'
import { readMs21xxVideoStatus, type Ms21xxVideoStatus, type Ms21xxWebHidDevice } from '../utils/ms21xxHid'
import { SerialState } from '../types/serial'

const POLL_INTERVAL_MS = 1000

const hdmiConnected = ref(false)
const width = ref(0)
const height = ref(0)
const fpsRaw = ref(0)
const pixelClockKhzRaw = ref(0)
const available = ref(false)
let pollTimer: number | null = null

/** Get the WebHID API if available */
function getNavigatorHid(): { getDevices(): Promise<unknown[]>; requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<unknown[]> } | null {
  const nav = navigator as Navigator & {
    hid?: {
      getDevices(): Promise<unknown[]>
      requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<unknown[]>
    }
  }
  return nav.hid ?? null
}

const MS2109S_FILTER = { vendorId: 0x345f, productId: 0x2109 }

async function tryGetMs2109sHid(): Promise<Ms21xxWebHidDevice | null> {
  const hid = getNavigatorHid()
  if (!hid) return null

  try {
    // First try already-granted devices
    const grantedDevices = (await hid.getDevices()) as Ms21xxWebHidDevice[]
    for (const device of grantedDevices) {
      if (device.vendorId === MS2109S_FILTER.vendorId && device.productId === MS2109S_FILTER.productId) {
        return device
      }
    }
  } catch (err) {
    console.warn('[VideoStatus] getDevices failed:', err)
  }

  return null
}

export function useVideoStatus() {
  const serial = useSerial()

  function startPolling(): void {
    stopPolling()

    console.log('[VideoStatus] startPolling, generation:', serial.generation.value)

    available.value = true
    pollTimer = window.setInterval(async () => {
      await pollOnce()
    }, POLL_INTERVAL_MS)

    // Poll immediately on start
    void pollOnce()
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer)
      pollTimer = null
    }
    hdmiConnected.value = false
    width.value = 0
    height.value = 0
    fpsRaw.value = 0
    pixelClockKhzRaw.value = 0
    available.value = false
  }

  async function pollOnce(): Promise<void> {
    if (serial.state.value !== SerialState.Connected) {
      return
    }

    // Try useSerial's HID device first (for Gen1/Gen3/V3 where it was already granted)
    let hidDevice = serial.getUsbModeHidDevice()

    // Fallback: try to get HID device directly
    if (!hidDevice) {
      hidDevice = await tryGetMs2109sHid()
    }

    if (!hidDevice) {
      console.warn('[VideoStatus] no HID device available')
      return
    }

    try {
      const status = await readMs21xxVideoStatus(hidDevice)
      if (status) {
        hdmiConnected.value = status.hdmiConnected
        width.value = status.width
        height.value = status.height
        fpsRaw.value = status.fpsRaw
        pixelClockKhzRaw.value = status.pixelClockKhzRaw
        available.value = true
        console.log('[VideoStatus] got:', status.hdmiConnected ? `${status.width}x${status.height} @ ${status.fpsRaw / 100}fps (${status.pixelClockKhzRaw / 100}kHz)` : 'no HDMI', 'pclk raw changed')
      } else {
        console.warn('[VideoStatus] read returned null')
        hdmiConnected.value = false
        width.value = 0
        height.value = 0
      }
    } catch (err) {
      console.error('[VideoStatus] poll error:', err)
    }
  }

  return {
    hdmiConnected,
    width,
    height,
    fpsRaw,
    pixelClockKhzRaw,
    available,
    startPolling,
    stopPolling,
  }
}
