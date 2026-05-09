<script setup lang="ts">
import { ref, watch, provide, watchEffect, onMounted, onUnmounted } from 'vue'
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
const { deviceInfo, isConnected } = useSerial()
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
provide('keyboardEnabled', keyboard.enabled)
provide('mouseEnabled', mouse.enabled)

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
} = useDeviceState()

const mouseX = 0
const mouseY = 0

onMounted(async () => {
  try {
    await loadWasm()
    console.log('[Layout] WASM loaded successfully')
  } catch (err) {
    console.error('[Layout] WASM failed to load:', err)
    console.error('[Layout] Keyboard and mouse input will not work without WASM')
  }

  if (detection.mediaDevices) {
    // Wait a tick for VideoStream to mount and set the video element
    await new Promise(r => setTimeout(r, 100))
    console.log('[Layout] auto-connect, videoEl:', !!videoElRef.value)
    await media.connect(videoElRef.value)
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
    <div class="flex-1 relative min-h-0">
      <VideoStream
        @mousedown="mouse.handleClick"
        @mouseup="mouse.handleMouseUp"
        @mousemove="onVideoMouseMove"
        @wheel="mouse.handleWheel"
      />
    </div>
    <StatusBar
      :num-lock="numLock"
      :caps-lock="capsLock"
      :scroll-lock="scrollLock"
      :usb-mode="usbMode"
      :mouse-x="mouseX"
      :mouse-y="mouseY"
    />
    <BottomBar />
  </div>
</template>
