import { ref, reactive } from 'vue'
import { useSerial } from './useSerial'
import { useSerialCommands } from './useSerialCommands'

export function useViewerMouse() {
  const videoEl = ref<HTMLVideoElement | null>(null)
  const enabled = ref(false)
  const mouse = reactive({ x: 0, y: 0 })
  let isPressed = false
  let currentButton = 0
  let lastX = 0
  let lastY = 0

  const { isConnected } = useSerial()
  const { sendMouseAbsolute: serialSendMouseAbs } = useSerialCommands()

  function handleClick(e: MouseEvent): void {
    console.log('[Mouse] click, button:', e.button, 'enabled:', enabled.value)
    if (!enabled.value || !isConnected.value) return
    isPressed = true
    currentButton = mapButton(e.button)
    updatePosition(e)
    const { absX, absY } = getAbsoluteCoords()
    serialSendMouseAbs(currentButton, absX, absY, 0)
  }

  function handleMouseUp(e: MouseEvent): void {
    isPressed = false
    const btn = currentButton
    currentButton = 0
    console.log('[Mouse] up, button:', btn, 'enabled:', enabled.value)
    if (!enabled.value || !isConnected.value) return
    updatePosition(e)
    const { absX, absY } = getAbsoluteCoords()
    serialSendMouseAbs(0, absX, absY, 0)
  }

  function handleMouseMove(e: MouseEvent): void {
    updatePosition(e)
    if (!enabled.value || !isConnected.value) {
      return
    }

    const { absX, absY } = getAbsoluteCoords()
    serialSendMouseAbs(isPressed ? currentButton : 0, absX, absY, 0)
  }

  function handleWheel(e: MouseEvent): void {
    if (!enabled.value || !isConnected.value) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? 0xff : 0x01
    console.log('[Mouse] wheel, delta:', delta)
    serialSendMouseAbs(0, 0, 0, delta)
  }

  function updatePosition(e: MouseEvent): void {
    lastX = e.clientX
    lastY = e.clientY
  }

  function getAbsoluteCoords(): { absX: number; absY: number } {
    if (!videoEl.value) return { absX: 0, absY: 0 }
    const rect = videoEl.value.getBoundingClientRect()
    const nativeW = videoEl.value.videoWidth
    const nativeH = videoEl.value.videoHeight

    if (!nativeW || !nativeH) return { absX: 0, absY: 0 }

    // Compute the actual displayed video size (object-contain preserves aspect ratio)
    const nativeAspect = nativeW / nativeH
    const containerAspect = rect.width / rect.height

    let renderW: number
    let renderH: number

    if (containerAspect > nativeAspect) {
      // Letterboxed: height fills, width is limited
      renderH = rect.height
      renderW = renderH * nativeAspect
    } else {
      // Pillarboxed: width fills, height is limited
      renderW = rect.width
      renderH = renderW / nativeAspect
    }

    // Compute the offset where the video frame starts within the container
    const offsetX = (rect.width - renderW) / 2
    const offsetY = (rect.height - renderH) / 2

    // Mouse position relative to the rendered video frame
    const relX = Math.max(0, Math.min(1, (lastX - rect.left - offsetX) / renderW))
    const relY = Math.max(0, Math.min(1, (lastY - rect.top - offsetY) / renderH))

    return {
      absX: Math.round(relX * 4095),
      absY: Math.round(relY * 4095),
    }
  }

  function requestPointerLock(): void {
    const target = videoEl.value
    if (target) {
      console.log('[Mouse] requesting pointer lock')
      target.requestPointerLock()
    }
  }

  function exitPointerLock(): void {
    document.exitPointerLock()
  }

  return {
    enabled,
    mouse,
    videoEl,
    handleClick,
    handleMouseUp,
    handleMouseMove,
    handleWheel,
    requestPointerLock,
    exitPointerLock,
  }
}

function mapButton(browserButton: number): number {
  // Browser: 0=left, 1=middle, 2=right
  // CH9329: 1=left, 2=middle, 4=right
  const map: Record<number, number> = { 0: 1, 1: 4, 2: 2 }
  return map[browserButton] ?? 0
}
