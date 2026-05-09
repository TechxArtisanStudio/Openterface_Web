<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TopBar from './TopBar.vue'
import BottomBar from './BottomBar.vue'
import StatusBar from './StatusBar.vue'
import VideoStream from '../video/VideoStream.vue'
import { useSerial } from '../../composables/useSerial'
import { useViewerKeyboard } from '../../composables/useViewerKeyboard'
import { useViewerMedia } from '../../composables/useViewerMedia'
import { useDeviceState } from '../../composables/useDeviceState'
import { loadWasm } from '../../composables/useWasm'
import { useBrowserDetection } from '../../composables/useBrowserDetection'

const emit = defineEmits<{
  'show-warning': []
}>()

const detection = useBrowserDetection()
const { deviceInfo } = useSerial()
const keyboard = useViewerKeyboard()
const media = useViewerMedia()
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
  } catch (err) {
    console.error('[WASM] Failed to load:', err)
  }

  if (detection.mediaDevices) {
    await media.connect()
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
      <VideoStream />
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
