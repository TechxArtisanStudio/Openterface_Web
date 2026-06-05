export function useBrowserDetection() {
  if (typeof window === 'undefined') {
    return {
      serial: false,
      mediaDevices: false,
      pointerLock: false,
      clipboard: false,
      fullSupport: false,
      missingApis: [] as string[],
    }
  }

  const serial = 'serial' in navigator
  const mediaDevices = 'mediaDevices' in navigator
  const pointerLock = 'pointerLockElement' in document
  const clipboard = 'clipboard' in navigator
  const imageCapture = 'ImageCapture' in window

  const missingApis: string[] = []
  if (!serial) missingApis.push('WebSerial')
  if (!mediaDevices) missingApis.push('MediaDevices')
  if (!pointerLock) missingApis.push('Pointer Lock')
  if (!clipboard) missingApis.push('Clipboard API')

  // Full KVM requires at minimum WebSerial and MediaDevices
  const fullSupport = serial && mediaDevices

  return {
    serial,
    mediaDevices,
    pointerLock,
    clipboard,
    imageCapture,
    fullSupport,
    missingApis,
  }
}
