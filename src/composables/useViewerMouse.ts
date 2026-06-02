import { ref, reactive } from 'vue'
import { useSerial } from './useSerial'
import { useInputSettings } from './useInputSettings'
import { useSerialCommands } from './useSerialCommands'

type ContainerRect = { left: number; top: number; width: number; height: number }

type ViewportMetrics = {
  rect: ContainerRect
  nativeW: number
  nativeH: number
  renderW: number
  renderH: number
  offsetX: number
  offsetY: number
}

type PointerPosition = {
  pixelX: number
  pixelY: number
  absX: number
  absY: number
  insideContent: boolean
}

type TargetPosition = {
  x: number
  y: number
  absX: number
  absY: number
  hasPosition: boolean
}

export function useViewerMouse() {
  const videoEl = ref<HTMLVideoElement | null>(null)
  const enabled = ref(false)
  const mouse = reactive({ x: 0, y: 0 })
  const target = reactive<TargetPosition>({ x: 0, y: 0, absX: 0, absY: 0, hasPosition: false })
  let isPressed = false
  let currentButton = 0
  let lastX = 0
  let lastY = 0
  let lastContainerRect: ContainerRect | null = null
  let wasInsideContent = false
  let lastContentPixelX = 0
  let lastContentPixelY = 0

  const { isConnected } = useSerial()
  const { mouseSensitivity, mouseMode } = useInputSettings()
  const {
    sendMouseAbsolute: serialSendMouseAbs,
    sendMouseRelative: serialSendMouseRel,
  } = useSerialCommands()

  function handleClick(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    console.log('[Mouse] mousedown button=', e.button, 'enabled=', enabled.value, 'isConnected=', isConnected.value, 'mode=', mouseMode.value)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    isPressed = true
    currentButton = mapButton(e.button)
    updatePosition(e)
    const position = getAbsoluteCoords()
    if (!position.insideContent) {
      console.log('[Mouse] mousedown ignored outside video content')
      isPressed = false
      currentButton = 0
      return
    }
    mouse.x = position.pixelX
    mouse.y = position.pixelY
    syncTargetToPointer(position, target)
    lastContentPixelX = position.pixelX
    lastContentPixelY = position.pixelY
    wasInsideContent = true
    logMouseCoordinates('mousedown', position, target)

    if (mouseMode.value === 'absolute') {
      console.log('[Mouse] send press abs: btn=', currentButton, 'abs=(', position.absX, ',', position.absY, ')')
      serialSendMouseAbs(currentButton, position.absX, position.absY, 0)
    } else {
      console.log('[Mouse] send press rel: btn=', currentButton, 'pixel=(', position.pixelX, ',', position.pixelY, ') rel=(0,0)')
      serialSendMouseRel(currentButton, 0, 0, 0)
    }
  }

  function handleMouseUp(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const btn = currentButton
    isPressed = false
    currentButton = 0
    console.log('[Mouse] mouseup released_btn=', btn, 'enabled=', enabled.value, 'isConnected=', isConnected.value, 'mode=', mouseMode.value)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] mouseup BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    updatePosition(e)
    const position = getAbsoluteCoords()
    if (position.insideContent) {
      mouse.x = position.pixelX
      mouse.y = position.pixelY
      syncTargetToPointer(position, target)
      lastContentPixelX = position.pixelX
      lastContentPixelY = position.pixelY
      wasInsideContent = true
    } else {
      console.log('[Mouse] release outside video content, sending button release only')
      wasInsideContent = false
    }
    logMouseCoordinates('mouseup', position, target)

    if (mouseMode.value === 'absolute') {
      console.log('[Mouse] send release abs: btn=0 abs=(', position.absX, ',', position.absY, ')')
      serialSendMouseAbs(0, position.absX, position.absY, 0)
    } else {
      console.log('[Mouse] send release rel: btn=0 pixel=(', position.pixelX, ',', position.pixelY, ') rel=(0,0)')
      serialSendMouseRel(0, 0, 0, 0)
    }
  }

  function handleMouseMove(e: MouseEvent): void {
    updatePosition(e)
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] move BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    e.preventDefault()
    e.stopPropagation()

    const metrics = getViewportMetrics()
    if (!metrics) {
      wasInsideContent = false
      return
    }

    const currentCoords = getCoordsForClientPoint(lastX, lastY, metrics)
    logViewportMetrics('mousemove', metrics, currentCoords, lastX, lastY)

    if (!currentCoords.insideContent) {
      wasInsideContent = false
      console.log('[Mouse] move ignored outside video content')
      return
    }

    mouse.x = currentCoords.pixelX
    mouse.y = currentCoords.pixelY

    if (mouseMode.value === 'absolute') {
      lastContentPixelX = currentCoords.pixelX
      lastContentPixelY = currentCoords.pixelY
      syncTargetToPointer(currentCoords, target)
      logMouseCoordinates('move-abs', currentCoords, target)

      const btn = isPressed ? currentButton : 0
      console.log('[Mouse] move abs: btn=', btn, 'pixel=(', currentCoords.pixelX, ',', currentCoords.pixelY, ') abs=(', currentCoords.absX, ',', currentCoords.absY, ')')
      serialSendMouseAbs(btn, currentCoords.absX, currentCoords.absY, 0)
      return
    }

    /* ---- relative mode ---- */
    if (!wasInsideContent) {
      wasInsideContent = true
      lastContentPixelX = currentCoords.pixelX
      lastContentPixelY = currentCoords.pixelY
      syncTargetToPointer(currentCoords, target)
      logMouseCoordinates('move-resync', currentCoords, target)
      console.log('[Mouse] move re-synced on content re-entry: pixel=(', currentCoords.pixelX, ',', currentCoords.pixelY, ')')
      return
    }

    const btn = isPressed ? currentButton : 0
    const rawDx = currentCoords.pixelX - lastContentPixelX
    const rawDy = currentCoords.pixelY - lastContentPixelY
    const dx = clampRelativeDelta(Math.round(rawDx * mouseSensitivity.value))
    const dy = clampRelativeDelta(Math.round(rawDy * mouseSensitivity.value))

    lastContentPixelX = currentCoords.pixelX
    lastContentPixelY = currentCoords.pixelY
    syncTargetWithRelativeDelta(dx, dy, metrics, target)
    logMouseCoordinates('move', currentCoords, target, dx, dy)

    console.log('[Mouse] move: btn=', btn, 'pixel=(', currentCoords.pixelX, ',', currentCoords.pixelY, ') rawRel=(', rawDx, ',', rawDy, ') rel=(', dx, ',', dy, ')')
    if (dx !== 0 || dy !== 0 || btn !== 0) {
      serialSendMouseRel(btn, dx, dy, 0)
    }
  }

  function handleWheel(e: WheelEvent): void {
    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] wheel BLOCKED: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -1 : 1
    const position = getAbsoluteCoords()
    logMouseCoordinates('wheel', position, target, 0, 0, delta)

    if (mouseMode.value === 'absolute' && position.insideContent) {
      console.log('[Mouse] wheel abs: abs=(', position.absX, ',', position.absY, ') wheel=', delta)
      serialSendMouseAbs(0, position.absX, position.absY, delta)
    } else {
      console.log('[Mouse] wheel rel: wheel=', delta)
      serialSendMouseRel(0, 0, 0, delta)
    }
  }

  function updatePosition(e: MouseEvent): void {
    lastX = e.clientX
    lastY = e.clientY
    const container = e.currentTarget instanceof HTMLElement
      ? e.currentTarget
      : videoEl.value?.parentElement
    if (container) {
      const r = container.getBoundingClientRect()
      lastContainerRect = { left: r.left, top: r.top, width: r.width, height: r.height }
    }
  }

  function getAbsoluteCoords(): PointerPosition {
    const metrics = getViewportMetrics()
    if (!metrics) {
      return { pixelX: 0, pixelY: 0, absX: 0, absY: 0, insideContent: false }
    }

    const coords = getCoordsForClientPoint(lastX, lastY, metrics)
    logViewportMetrics('absolute-coords', metrics, coords, lastX, lastY)
    return coords
  }

  function getViewportMetrics(): ViewportMetrics | null {
    if (!videoEl.value) {
      console.warn('[Mouse] getViewportMetrics: videoEl is null')
      return null
    }

    const rect = lastContainerRect ?? toContainerRect(videoEl.value.getBoundingClientRect())
    const nativeW = videoEl.value.videoWidth
    const nativeH = videoEl.value.videoHeight

    if (!nativeW || !nativeH || !rect.width || !rect.height) {
      console.warn('[Mouse] getViewportMetrics: invalid dimensions, nativeW=', nativeW, 'nativeH=', nativeH, 'rect=', rect)
      return null
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

    return {
      rect,
      nativeW,
      nativeH,
      renderW,
      renderH,
      offsetX: (rect.width - renderW) / 2,
      offsetY: (rect.height - renderH) / 2,
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

  async function centerCursor(): Promise<void> {
    const metrics = getViewportMetrics()
    if (!metrics) {
      console.warn('[Mouse] centerCursor aborted: viewport metrics unavailable')
      return
    }

    const centerPosition = getCenterPointerPosition(metrics)

    mouse.x = centerPosition.pixelX
    mouse.y = centerPosition.pixelY
    syncTargetToPointer(centerPosition, target)

    lastContentPixelX = centerPosition.pixelX
    lastContentPixelY = centerPosition.pixelY
    lastX = metrics.rect.left + metrics.offsetX + metrics.renderW / 2
    lastY = metrics.rect.top + metrics.offsetY + metrics.renderH / 2
    wasInsideContent = true

    logMouseCoordinates('center', centerPosition, target)
    logViewportMetrics('center', metrics, centerPosition, lastX, lastY)

    if (!enabled.value || !isConnected.value) {
      console.warn('[Mouse] centerCursor visual state only: enabled=', enabled.value, 'isConnected=', isConnected.value)
      return
    }

    console.log('[Mouse] centerCursor send abs: pixel=(', centerPosition.pixelX, ',', centerPosition.pixelY, ') abs=(', centerPosition.absX, ',', centerPosition.absY, ')')
    await serialSendMouseAbs(0, centerPosition.absX, centerPosition.absY, 0)
  }

  return {
    enabled,
    mouse,
    target,
    videoEl,
    handleClick,
    handleMouseUp,
    handleMouseMove,
    handleWheel,
    centerCursor,
    requestPointerLock,
    exitPointerLock,
  }
}

function logMouseCoordinates(
  action: string,
  position: PointerPosition,
  target: TargetPosition,
  dx = 0,
  dy = 0,
  wheel = 0,
): void {
  console.log(
    `[MouseCoords] ${action}`,
    'pointerPixel=(', position.pixelX, ',', position.pixelY, ')',
    'pointerAbs=(', position.absX, ',', position.absY, ')',
    'insideContent=', position.insideContent,
    'targetPixel=(', target.x, ',', target.y, ')',
    'targetAbs=(', target.absX, ',', target.absY, ')',
    'delta=(', dx, ',', dy, ')',
    'wheel=', wheel,
  )
}

function logViewportMetrics(
  action: string,
  metrics: ViewportMetrics,
  position: PointerPosition,
  clientX: number,
  clientY: number,
): void {
  const contentLeft = metrics.rect.left + metrics.offsetX
  const contentTop = metrics.rect.top + metrics.offsetY
  const rawX = clientX - contentLeft
  const rawY = clientY - contentTop

  console.log(
    `[MouseMap] ${action}`,
    'client=(', clientX, ',', clientY, ')',
    'containerRect=(', metrics.rect.left, ',', metrics.rect.top, ',', metrics.rect.width, ',', metrics.rect.height, ')',
    'renderSize=(', metrics.renderW, ',', metrics.renderH, ')',
    'contentOrigin=(', contentLeft, ',', contentTop, ')',
    'rawContent=(', rawX, ',', rawY, ')',
    'nativeSize=(', metrics.nativeW, ',', metrics.nativeH, ')',
    'mappedPixel=(', position.pixelX, ',', position.pixelY, ')',
    'mappedAbs=(', position.absX, ',', position.absY, ')',
    'insideContent=', position.insideContent,
  )
}

function syncTargetToPointer(position: PointerPosition, target: TargetPosition): void {
  target.x = position.pixelX
  target.y = position.pixelY
  target.absX = position.absX
  target.absY = position.absY
  target.hasPosition = true
}

function syncTargetWithRelativeDelta(
  dx: number,
  dy: number,
  metrics: ViewportMetrics,
  target: TargetPosition,
): void {
  const maxX = Math.max(metrics.nativeW - 1, 0)
  const maxY = Math.max(metrics.nativeH - 1, 0)

  target.x = clamp(target.x + dx, 0, maxX)
  target.y = clamp(target.y + dy, 0, maxY)
  target.absX = Math.round(clamp(target.x / Math.max(maxX, 1), 0, 1) * 4095)
  target.absY = Math.round(clamp(target.y / Math.max(maxY, 1), 0, 1) * 4095)
  target.hasPosition = true
}

function getCoordsForClientPoint(
  clientX: number,
  clientY: number,
  metrics: ViewportMetrics,
): PointerPosition {
  const rawX = clientX - metrics.rect.left - metrics.offsetX
  const rawY = clientY - metrics.rect.top - metrics.offsetY
  const insideContent = rawX >= 0 && rawX <= metrics.renderW && rawY >= 0 && rawY <= metrics.renderH
  const pixelX = Math.round(clamp(rawX / metrics.renderW, 0, 1) * (metrics.nativeW - 1))
  const pixelY = Math.round(clamp(rawY / metrics.renderH, 0, 1) * (metrics.nativeH - 1))

  return {
    pixelX,
    pixelY,
    absX: Math.round(clamp(pixelX / Math.max(metrics.nativeW - 1, 1), 0, 1) * 4095),
    absY: Math.round(clamp(pixelY / Math.max(metrics.nativeH - 1, 1), 0, 1) * 4095),
    insideContent,
  }
}

function getCenterPointerPosition(metrics: ViewportMetrics): PointerPosition {
  return {
    pixelX: Math.round((metrics.nativeW - 1) / 2),
    pixelY: Math.round((metrics.nativeH - 1) / 2),
    absX: Math.round(4095 / 2),
    absY: Math.round(4095 / 2),
    insideContent: true,
  }
}

function toContainerRect(rect: DOMRect): ContainerRect {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function mapButton(browserButton: number): number {
  const map: Record<number, number> = { 0: 1, 1: 4, 2: 2 }
  return map[browserButton] ?? 0
}

function clampRelativeDelta(value: number): number {
  return Math.max(-127, Math.min(127, value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
