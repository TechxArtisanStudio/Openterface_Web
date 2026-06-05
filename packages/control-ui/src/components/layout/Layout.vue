<script setup lang="ts">
import { ref, watch, provide, watchEffect, onMounted, onUnmounted, computed, inject } from 'vue'
import { HIDTransportKey, loadWasm } from '@openterface/core'
import { useViewerKeyboard } from '@openterface/core'
import { useViewerMouse } from '../composables/useViewerMouse'
import { useDeviceState } from '../composables/useDeviceState'
import { useBrowserDetection } from '../composables/useBrowserDetection'
import TopBar from './TopBar.vue'
import BottomBar from './BottomBar.vue'
import StatusBar from './StatusBar.vue'
import VideoStream from '../video/VideoStream.vue'

const emit = defineEmits<{
  'show-warning': []
}>()

const transport = inject(HIDTransportKey)!
const detection = useBrowserDetection()
const keyboard = useViewerKeyboard()
const mouse = useViewerMouse()

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

// Auto-enable keyboard and mouse when transport connects
watch(transport.isConnected, (connected) => {
  if (connected) {
    keyboard.enabled.value = true
    mouse.enabled.value = true
    console.log('[Layout] transport connected — keyboard and mouse auto-enabled')
  } else {
    keyboard.enabled.value = false
    mouse.enabled.value = false
    console.log('[Layout] transport disconnected — keyboard and mouse disabled')
  }
})

function onVideoMouseMove(e: MouseEvent): void {
  mouse.handleMouseMove(e)
}

const {
  numLock,
  capsLock,
  scrollLock,
  usbMode,
} = useDeviceState()

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

  if (!detection.fullSupport) {
    emit('show-warning')
  }
})

onUnmounted(() => {
  keyboard.releaseAll()
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
        />
        <div class="w-5 h-px bg-slate-700 self-center my-1" />
        <BottomBar />
      </div>
    </div>
  </div>
</template>
