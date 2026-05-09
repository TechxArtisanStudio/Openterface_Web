import { ref, type Ref } from 'vue'

export function useVideoControls() {
  const brightness = ref(100) // percentage
  const contrast = ref(100) // percentage
  const supportsImageCapture = ref(false)
  const imageCapture: Ref<ImageCapture | null> = ref(null)

  /** Try to initialize ImageCapture API for hardware-level video controls */
  async function initialize(stream: MediaStream | null): Promise<void> {
    if (!stream) return

    const track = stream.getVideoTracks()[0]
    if (!track) return

    // Check if ImageCapture API is available
    if ('ImageCapture' in window) {
      try {
        const capture = new ImageCapture(track)
        const capabilities = await capture.getPhotoCapabilities()
        // If we got here, ImageCapture works
        supportsImageCapture.value = true
        imageCapture.value = capture
        return
      } catch {
        // ImageCapture not supported for this device
        supportsImageCapture.value = false
      }
    }

    // Fall back to CSS filters (always available)
    supportsImageCapture.value = false
  }

  /** Apply brightness/contrast via CSS filter on the video element */
  function applyCssFilter(videoEl: HTMLVideoElement | null): void {
    if (!videoEl) return
    videoEl.style.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%)`
  }

  /** Apply brightness via ImageCapture (if available) */
  async function setBrightness(value: number): Promise<void> {
    brightness.value = value
    if (supportsImageCapture.value && imageCapture.value) {
      try {
        await imageCapture.value.setOptions({ brightness: value / 100 })
      } catch {
        // Fall back to CSS
      }
    }
  }

  /** Apply contrast via ImageCapture (if available) */
  async function setContrast(value: number): Promise<void> {
    contrast.value = value
    if (supportsImageCapture.value && imageCapture.value) {
      try {
        await imageCapture.value.setOptions({ contrast: value / 100 })
      } catch {
        // Fall back to CSS
      }
    }
  }

  function reset(): void {
    brightness.value = 100
    contrast.value = 100
  }

  return {
    brightness,
    contrast,
    supportsImageCapture,
    initialize,
    applyCssFilter,
    setBrightness,
    setContrast,
    reset,
  }
}
