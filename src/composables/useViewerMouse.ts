import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useSerial } from './useSerial'
import { useSerialCommands } from './useSerialCommands'

export function useViewerMouse(videoEl: HTMLVideoElement | null) {
  const enabled = ref(false)
  const mouseMode = ref<'absolute' | 'relative'>('absolute')
  const mouse = reactive({ x: 0, y: 0 })
  let isPressed = false
  let currentButton = 0
  let wheelState = 0

  const { isConnected } = useSerial()
  const { sendMouseAbsolute, sendMouseRelative } = useSerialCommands()

  function handleClick(e: MouseEvent): void {
    if (!enabled.value || !isConnected.value) return
    isPressed = true
    currentButton = mapButton(e.button)
    sendMouseEvent(currentButton)
  }

  function handleMouseUp(): void {
    isPressed = false
    currentButton = 0
    sendMouseEvent(0)
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!enabled.value || !isConnected.value || !videoEl) return

    const rect = videoEl.getBoundingClientRect()
    mouse.x = e.clientX - rect.left
    mouse.y = e.clientY - rect.top

    if (mouseMode.value === 'absolute') {
      sendMouseEvent(isPressed ? currentButton : 0)
    } else {
      // Relative mode uses movementX/Y
      handleRelativeMove(e.movementX, e.movementY, isPressed ? currentButton : 0)
    }
  }

  function handleRelativeMove(dx: number, dy: number, buttons: number): void {
    if (!isConnected.value) return
    // Clamp to int8 range
    dx = Math.max(-127, Math.min(127, dx))
    dy = Math.max(-127, Math.min(127, dy))
    sendMouseRelative(buttons, dx, dy, 0)
  }

  function handleWheel(e: WheelEvent): void {
    if (!enabled.value || !isConnected.value) return
    const delta = e.deltaY > 0 ? 0xff : 0x01
    if (mouseMode.value === 'absolute') {
      sendMouseEvent(0, delta)
    } else {
      sendMouseRelative(0, 0, 0, delta)
    }
  }

  function sendMouseEvent(buttons: number, wheel: number = 0): void {
    if (!isConnected.value || !videoEl) return

    const rect = videoEl.getBoundingClientRect()
    const relX = (mouse.x / rect.width) * 4096
    const relY = (mouse.y / rect.height) * 4096

    sendMouseAbsolute(buttons, Math.round(relX), Math.round(relY), wheel)
  }

  function requestPointerLock(): void {
    if (videoEl) {
      videoEl.requestPointerLock()
    }
  }

  function exitPointerLock(): void {
    document.exitPointerLock()
  }

  return {
    enabled,
    mouseMode,
    mouse,
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
