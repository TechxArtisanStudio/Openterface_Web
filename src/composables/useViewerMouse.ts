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
  let lastContainerRect: { left: number; top: number; width: number; height: number } | null = null

  const { isConnected } = useSerial()
  const { sendMouseAbsolute: serialSendMouseAbs } = useSerialCommands()

  function handleClick(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    console.log('[Mouse] mousedown button=', e.button, 'enabled=', enabled.value, 'isConnected=', isConnected.value)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    isPressed = true
    currentButton = mapButton(e.button)
    updatePosition(e)
    const { pixelX, pixelY, absX, absY } = getAbsoluteCoords()
    mouse.x = pixelX
    mouse.y = pixelY
    console.log('[Mouse] send press: btn=', currentButton, 'pixel=(', pixelX, ',', pixelY, ') abs=(', absX, ',', absY, ')')
    serialSendMouseAbs(currentButton, absX, absY, 0)
  }

  function handleMouseUp(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const btn = currentButton
    isPressed = false
    currentButton = 0
    console.log('[Mouse] mouseup released_btn=', btn, 'enabled=', enabled.value, 'isConnected=', isConnected.value)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] mouseup BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    updatePosition(e)
    const { pixelX, pixelY, absX, absY } = getAbsoluteCoords()
    mouse.x = pixelX
    mouse.y = pixelY
    console.log('[Mouse] send release: btn=0 pixel=(', pixelX, ',', pixelY, ') abs=(', absX, ',', absY, ')')
    serialSendMouseAbs(0, absX, absY, 0)
  }

  function handleMouseMove(e: MouseEvent): void {
    updatePosition(e)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] move BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    e.preventDefault()
    e.stopPropagation()

    const { pixelX, pixelY, absX, absY } = getAbsoluteCoords()
    mouse.x = pixelX
    mouse.y = pixelY
    const btn = isPressed ? currentButton : 0
    console.log('[Mouse] move: btn=', btn, 'pixel=(', pixelX, ',', pixelY, ') abs=(', absX, ',', absY, ')')
    serialSendMouseAbs(btn, absX, absY, 0)
  }

  function handleWheel(e: WheelEvent): void {
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] wheel BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? 0xff : 0x01
    serialSendMouseAbs(0, 0, 0, delta)
  }

  function updatePosition(e: MouseEvent): void {
    lastX = e.clientX
    lastY = e.clientY
    const container = videoEl.value?.parentElement
    if (container) {
      const r = container.getBoundingClientRect()
      lastContainerRect = { left: r.left, top: r.top, width: r.width, height: r.height }
    }
  }

  function getAbsoluteCoords(): { pixelX: number; pixelY: number; absX: number; absY: number } {
    if (!videoEl.value) {
      console.warn('[Mouse] getAbsoluteCoords: videoEl is null')
      return { pixelX: 0, pixelY: 0, absX: 0, absY: 0 }
    }
    const rect = lastContainerRect ?? videoEl.value.getBoundingClientRect()
    const nativeW = videoEl.value.videoWidth
    const nativeH = videoEl.value.videoHeight

    if (!nativeW || !nativeH) {
      console.warn('[Mouse] getAbsoluteCoords: video dimensions is 0, nativeW=', nativeW, 'nativeH=', nativeH)
      return { pixelX: 0, pixelY: 0, absX: 0, absY: 0 }
    }

    const nativeAspect = nativeW / nativeH
    const containerAspect = rect.width / rect.height

    let renderW: number
    let renderH: number

    if (containerAspect > nativeAspect) {
      renderH = rect.height
      renderW = renderH * nativeAspect
    } else {
      renderW = rect.width
      renderH = renderW / nativeAspect
    }

    const offsetX = (rect.width - renderW) / 2
    const offsetY = (rect.height - renderH) / 2

    const rawX = lastX - rect.left - offsetX
    const rawY = lastY - rect.top - offsetY

    const pixelX = Math.round(Math.max(0, Math.min(nativeW, rawX / renderW * nativeW)))
    const pixelY = Math.round(Math.max(0, Math.min(nativeH, rawY / renderH * nativeH)))

    return {
      pixelX,
      pixelY,
      absX: Math.round(pixelX / nativeW * 4095),
      absY: Math.round(pixelY / nativeH * 4095),
    }
  }

  function requestPointerLock(): void {
    const target = videoEl.value
    if (target) {
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
  const map: Record<number, number> = { 0: 1, 1: 4, 2: 2 }
  return map[browserButton] ?? 0
}
