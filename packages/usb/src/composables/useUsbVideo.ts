import { ref, computed } from 'vue'

export const CAMERA_RESOLUTIONS = [
  { width: 1920, height: 1080, label: '1920×1080' },
  { width: 1280, height: 720, label: '1280×720' },
  { width: 640, height: 480, label: '640×480' },
  { width: 320, height: 240, label: '320×240' },
] as const

// Module-level shared state so all callers see the same values
const enabled = ref(false)
const selectedDevice = ref('')
const devices = ref<MediaDeviceInfo[]>([])
const showAllDevices = ref(false)
const currentSettings = ref<MediaTrackSettings | null>(null)
const error = ref<string | null>(null)

const filteredDevices = computed(() =>
  devices.value.filter((d) => d.kind === 'videoinput'),
)

export function useViewerMedia() {
  async function refreshDevices(): Promise<MediaDeviceInfo[]> {
    if (!('mediaDevices' in navigator)) return []
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      console.log('[ViewerMedia] enumerateDevices:', all.map(d => ({ kind: d.kind, deviceId: d.deviceId.slice(0,8), label: d.label })))
      devices.value = all.filter((d) => d.kind === 'videoinput')
      console.log('[ViewerMedia] filtered video inputs:', devices.value.map(d => ({ deviceId: d.deviceId.slice(0,8), label: d.label })))
      return devices.value
    } catch (err) {
      error.value = `Failed to enumerate devices: ${err}`
      console.error('[ViewerMedia]', error.value)
      return []
    }
  }

  async function connect(videoEl?: HTMLVideoElement | null, deviceId?: string): Promise<boolean> {
    if (enabled.value) {
      console.log('[ViewerMedia] already connected, skipping')
      return true
    }
    if (!('mediaDevices' in navigator)) {
      console.error('[ViewerMedia] mediaDevices not available')
      return false
    }
    console.log('[ViewerMedia] connect called, videoEl:', !!videoEl, 'requestedDeviceId:', deviceId)
    await refreshDevices()
    console.log('[ViewerMedia] devices:', devices.value.map(d => ({ label: d.label, id: d.deviceId.slice(0, Math.min(8, d.deviceId.length)) })))
    console.log('[ViewerMedia] filtered devices:', filteredDevices.value.map(d => ({ label: d.label, id: d.deviceId.slice(0, Math.min(8, d.deviceId.length)) })))

    let hasValidDevices = devices.value.some(d => d.deviceId && d.deviceId.length > 0)
    let targetId = deviceId
    if (!targetId && hasValidDevices) {
      targetId = filteredDevices.value[0]?.deviceId || devices.value[0]?.deviceId
    }
    selectedDevice.value = targetId
    console.log('[ViewerMedia] hasValidDevices:', hasValidDevices, 'targetId:', targetId?.slice(0, 8))
    if (!targetId && !hasValidDevices) {
      console.log('[ViewerMedia] no valid deviceId — will request any available camera (pre-permission)')
    }

    try {
      console.log('[ViewerMedia] requesting getUserMedia...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: targetId
          ? { deviceId: { exact: targetId }, width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 } }
          : { width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 } },
      })
      console.log('[ViewerMedia] got stream, tracks:', stream.getTracks().map(t => t.label))

      const video = videoEl || document.querySelector('video') as HTMLVideoElement
      console.log('[ViewerMedia] using video element:', !!video)
      if (video) {
        video.srcObject = stream
        console.log('[ViewerMedia] srcObject set, video.paused:', video.paused, 'video.readyState:', video.readyState)
        try {
          await video.play()
        } catch (e) {
          console.error('[ViewerMedia] video play error:', e)
          enabled.value = false
          error.value = `Failed to play video: ${e}`
          return false
        }
        console.log('[ViewerMedia] after play, video.paused:', video.paused, 'video.readyState:', video.readyState, 'video.videoWidth:', video.videoWidth)
      }

      const track = stream.getVideoTracks()[0]
      if (track) {
        currentSettings.value = track.getSettings()
        // If the camera started at a lower resolution, try to upgrade
        const w = currentSettings.value.width ?? 0
        const h = currentSettings.value.height ?? 0
        if (w > 0 && w < 1920) {
          console.log('[ViewerMedia] started at low res', w, 'x', h, '— requesting 1920x1080')
          try {
            await track.applyConstraints({ width: { ideal: 1920 }, height: { ideal: 1080 } })
            currentSettings.value = track.getSettings()
            console.log('[ViewerMedia] upgraded to', currentSettings.value.width, 'x', currentSettings.value.height)
          } catch (e) {
            console.warn('[ViewerMedia] could not upgrade resolution:', e)
          }
        }
      }

      // Refresh device list now that permission is granted — labels were empty before
      await refreshDevices()
      console.log('[ViewerMedia] post-connect selectedDevice:', selectedDevice.value, 'filteredDevices:', filteredDevices.value.map(d => d.deviceId.slice(0,8)))
      if (!selectedDevice.value && filteredDevices.value.length > 0) {
        selectedDevice.value = filteredDevices.value[0].deviceId
        console.log('[ViewerMedia] set selectedDevice to first device:', selectedDevice.value.slice(0,8))
      }

      enabled.value = true
      console.log('[ViewerMedia] enabled set to true')
      error.value = null
      return true
    } catch (err) {
      error.value = `Camera error: ${err}`
      enabled.value = false
      console.warn('[ViewerMedia] camera not available:', err)
      return false
    }
  }

  function disconnect(): void {
    console.log('[ViewerMedia] disconnect called, selectedDevice:', selectedDevice.value)
    const video = document.querySelector('video') as HTMLVideoElement
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
    enabled.value = false
    console.log('[ViewerMedia] disconnect: enabled set to false')
    selectedDevice.value = ''
    currentSettings.value = null
  }

  async function applySettings(settings: MediaTrackConstraints): Promise<void> {
    const video = document.querySelector('video') as HTMLVideoElement
    if (!video?.srcObject) return

    const stream = video.srcObject as MediaStream
    const track = stream.getVideoTracks()[0]
    if (!track) return

    try {
      await track.applyConstraints(settings)
      currentSettings.value = track.getSettings()
    } catch (err) {
      error.value = `Failed to apply settings: ${err}`
    }
  }

  async function changeDevice(deviceId: string): Promise<boolean> {
    console.log('[ViewerMedia] changeDevice:', deviceId.slice(0,8))
    disconnect()
    return connect(undefined, deviceId)
  }

  return {
    enabled,
    selectedDevice,
    devices: filteredDevices,
    showAllDevices,
    currentSettings,
    error,
    refreshDevices,
    connect,
    disconnect,
    applySettings,
    changeDevice,
  }
}

// Log initial state
console.log('[ViewerMedia] module initialized')
