import { ref, computed } from 'vue'

export const CAMERA_RESOLUTIONS = [
  { width: 1920, height: 1080, label: '1920×1080' },
  { width: 1280, height: 720, label: '1280×720' },
  { width: 640, height: 480, label: '640×480' },
  { width: 320, height: 240, label: '320×240' },
] as const

export function useViewerMedia() {
  const enabled = ref(false)
  const selectedDevice = ref('')
  const devices = ref<MediaDeviceInfo[]>([])
  const showAllDevices = ref(false)
  const currentSettings = ref<MediaTrackSettings | null>(null)
  const error = ref<string | null>(null)

  const filteredDevices = computed(() =>
    devices.value.filter((d) =>
      showAllDevices.value ? true : d.label.toLowerCase().includes('openterface'),
    ),
  )

  async function refreshDevices(): Promise<MediaDeviceInfo[]> {
    if (!('mediaDevices' in navigator)) return []
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      devices.value = all.filter((d) => d.kind === 'videoinput')
      return devices.value
    } catch (err) {
      error.value = `Failed to enumerate devices: ${err}`
      return []
    }
  }

  async function connect(deviceId?: string): Promise<boolean> {
    if (!('mediaDevices' in navigator)) return false
    await refreshDevices()

    const targetId = deviceId || filteredDevices.value[0]?.deviceId
    if (!targetId) {
      error.value = 'No camera device found'
      return false
    }

    selectedDevice.value = targetId

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: targetId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      const video = document.querySelector('video') as HTMLVideoElement
      if (video) {
        video.srcObject = stream
        video.play().catch(() => {
          /* autoplay blocked */
        })
      }

      const track = stream.getVideoTracks()[0]
      if (track) {
        currentSettings.value = track.getSettings()
      }

      enabled.value = true
      error.value = null
      return true
    } catch (err) {
      error.value = `Camera error: ${err}`
      enabled.value = false
      return false
    }
  }

  function disconnect(): void {
    const video = document.querySelector('video') as HTMLVideoElement
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      video.srcObject = null
    }
    enabled.value = false
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
    disconnect()
    return connect(deviceId)
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
