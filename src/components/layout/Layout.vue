<script setup lang="ts">
import { ref, watch, provide, watchEffect, onMounted, onUnmounted, computed } from 'vue'
import TopBar from './TopBar.vue'
import BottomBar from './BottomBar.vue'
import StatusBar from './StatusBar.vue'
import VideoStream from '../video/VideoStream.vue'
import { useSerial } from '../../composables/useSerial'
import { useViewerKeyboard } from '../../composables/useViewerKeyboard'
import { useViewerMouse } from '../../composables/useViewerMouse'
import { useViewerMedia } from '../../composables/useViewerMedia'
import { useDeviceState } from '../../composables/useDeviceState'
import { loadWasm } from '../../composables/useWasm'
import { useBrowserDetection } from '../../composables/useBrowserDetection'

const emit = defineEmits<{
  'show-warning': []
}>()

const detection = useBrowserDetection()
const { state, connect, disconnect, deviceInfo, isConnected } = useSerial()
const keyboard = useViewerKeyboard()
const mouse = useViewerMouse()
const media = useViewerMedia()

// Shared ref for the video element, populated by VideoStream on mount
const videoElRef = ref<HTMLVideoElement | null>(null)
provide('videoEl', videoElRef)

// Watch for video element to become available, then share with mouse
watchEffect(() => {
  if (videoElRef.value) {
    mouse.videoEl.value = videoElRef.value
    console.log('[Layout] mouse videoEl set')
  }
})

// Auto-enable keyboard and mouse when serial connects
watch(isConnected, (connected) => {
  if (connected) {
    keyboard.enabled.value = true
    mouse.enabled.value = true
    console.log('[Layout] serial connected — keyboard and mouse auto-enabled')
  } else {
    keyboard.enabled.value = false
    mouse.enabled.value = false
    console.log('[Layout] serial disconnected — keyboard and mouse disabled')
  }
})

// Provide keyboard/mouse state to child components for button styling

function onVideoMouseMove(e: MouseEvent): void {
  mouse.handleMouseMove(e)
}

const {
  firmwareVersion,
  targetConnected,
  numLock,
  capsLock,
  scrollLock,
  usbMode,
  usbSyncStatus,
} = useDeviceState()

const { setUsbMode } = useSerial()

function handleToggleUsbMode(): void {
  if (!isConnected.value) return
  const nextMode = usbMode.value === 'host' ? 'target' : 'host'
  console.log(`[Layout] StatusBar click toggle USB mode: ${usbMode.value} → ${nextMode}`)
  setUsbMode(nextMode)
}

const mouseX = computed(() => Math.round(mouse.mouse.x))
const mouseY = computed(() => Math.round(mouse.mouse.y))

onMounted(async () => {
  try {
    await loadWasm()
    console.log('[Layout] WASM loaded successfully')
  } catch (err) {
    console.error('[Layout] WASM failed to load:', err)
    console.error('[Layout] Keyboard and mouse input will not work without WASM')
  }

  if (detection.mediaDevices) {
    // Wait a bit for camera to stabilize before connecting
    await new Promise(r => setTimeout(r, 500))
    console.log('[Layout] auto-connect, videoEl:', !!videoElRef.value)
    await media.connect(videoElRef.value)
  }

  // Auto-connect serial on page load
  if (detection.fullSupport) {
    const ports = await navigator.serial.getPorts()
    if (ports.length > 0) {
      console.log('[Layout] auto-connecting serial, existing port found')
      connect({ allowHidPrompt: false })
    } else {
      // requestPort() requires a user gesture — defer to first interaction
      console.log('[Layout] no existing serial port, will auto-connect on first user interaction')
      const handler = () => {
        connect({ allowHidPrompt: true })
        document.removeEventListener('click', handler)
        document.removeEventListener('keydown', handler)
        document.removeEventListener('touchstart', handler)
      }
      document.addEventListener('click', handler, { once: true })
      document.addEventListener('keydown', handler, { once: true })
      document.addEventListener('touchstart', handler, { once: true })
    }
  }

  if (!detection.fullSupport) {
    emit('show-warning')
  }
})

onUnmounted(() => {
  keyboard.releaseAll()
  media.disconnect()
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
    <TopBar />
    <div class="flex flex-1 min-h-0">
      <div class="flex-1 min-h-0">
        <VideoStream
          @mousedown="mouse.handleClick"
          @mouseup="mouse.handleMouseUp"
          @mousemove="onVideoMouseMove"
          @wheel="mouse.handleWheel"
          :mouse-x="mouseX"
          :mouse-y="mouseY"
        />
      </div>
      <div class="flex flex-col w-12 shrink-0">
        <StatusBar
          :num-lock="numLock"
          :caps-lock="capsLock"
          :scroll-lock="scrollLock"
          :usb-mode="usbMode"
          :usb-sync-status="usbSyncStatus"
          @toggle-usb-mode="handleToggleUsbMode"
        />
        <div class="w-5 h-px bg-slate-700 self-center my-1" />
        <BottomBar />
      </div>
    </div>
  </div>
</template>
