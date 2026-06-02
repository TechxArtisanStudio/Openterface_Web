<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, Ref } from 'vue'
import { useViewerMedia } from '../../composables/useViewerMedia'
import { useSerial } from '../../composables/useSerial'

const videoRef = ref<HTMLVideoElement | null>(null)
const isFullscreen = ref(false)

const media = useViewerMedia()
const serial = useSerial()

const showBaudPopup = ref(false)

function selectBaud(baud: number) {
  showBaudPopup.value = false
  serial.setBaudrate(baud)
}

// Share video element with parent
const videoElRef = inject<Ref<HTMLVideoElement | null>>('videoEl')

const emit = defineEmits<{
  'mousedown': [e: MouseEvent]
  'mouseup': [e: MouseEvent]
  'mousemove': [e: MouseEvent]
  'wheel': [e: WheelEvent]
  'center-mouse': []
}>()

const props = defineProps<{
  mouseX?: number
  mouseY?: number
  mouseEnabled?: boolean
  targetMouseX?: number
  targetMouseY?: number
  targetMouseReady?: boolean
}>()

defineExpose({ videoRef })

onMounted(() => {
  if (videoElRef) {
    videoElRef.value = videoRef.value
  }
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (showBaudPopup.value && !(e.target as HTMLElement).closest('[data-baud-dropdown]')) {
    showBaudPopup.value = false
  }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}
</script>

<template>
  <div
    class="relative w-full h-full bg-black flex items-center justify-center"
  >
    <!-- Video Element -->
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      autoplay
      muted
      playsinline
      @contextmenu.prevent
      @mousedown="$emit('mousedown', $event)"
      @mouseup="$emit('mouseup', $event)"
      @mousemove="$emit('mousemove', $event)"
      @wheel="$emit('wheel', $event)"
      @play="console.log('[VideoStream] video playing, videoWidth:', videoRef?.videoWidth, 'videoHeight:', videoRef?.videoHeight, 'enabled:', media.enabled.value)"
      @error="console.log('[VideoStream] video error:', $event)"
    />

    <!-- Welcome Poster (shown when no stream) -->
    <div v-if="!media.enabled.value" class="absolute inset-0 flex items-center justify-center bg-slate-950 pointer-events-none">
      <div class="text-center">
        <svg class="w-20 h-20 mx-auto text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p class="text-slate-500 text-sm">No video signal</p>
        <p class="text-slate-600 text-xs mt-1">Connect an Openterface camera to begin</p>
      </div>
    </div>

    <!-- Resolution Badge -->
    <div
      class="absolute top-2 right-2 flex flex-col items-end gap-1"
    >
      <!-- Mouse Status Indicator -->
      <span
        class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium pointer-events-none"
        :class="mouseEnabled ? 'bg-green-800/80 text-green-300' : 'bg-red-800/80 text-red-300'"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
        </svg>
        Mouse {{ mouseEnabled ? 'ON' : 'OFF' }}
      </span>
      <span
        class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-300 pointer-events-none"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <span v-if="media.currentSettings.value?.width && media.currentSettings.value?.height">
          {{ media.currentSettings.value.width }}×{{ media.currentSettings.value.height }}
        </span>
        <span v-else>—</span>
      </span>
      <div
        v-if="serial.baudrate.value > 0"
        class="relative"
      >
        <button
          @click.stop="showBaudPopup = !showBaudPopup"
          @mousedown.stop
          @mouseup.stop
          class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          {{ serial.baudrate.value }} baud
        </button>
        <div
          v-if="showBaudPopup"
          class="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
          data-baud-dropdown
        >
          <button
            v-for="baud in [9600, 115200]"
            :key="baud"
            @click="selectBaud(baud)"
            class="w-full px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap"
            :class="serial.baudrate.value === baud ? 'text-orange-400 bg-slate-700/50' : ''"
          >
            {{ baud }} baud
          </button>
        </div>
      </div>
      <span
        v-if="media.currentSettings.value?.width && media.currentSettings.value?.height"
        class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-300 pointer-events-none"
      >
        Target X: {{ props.targetMouseReady ? props.targetMouseX : '—' }}, Y: {{ props.targetMouseReady ? props.targetMouseY : '—' }}
      </span>
      <span
        v-if="media.currentSettings.value?.width && media.currentSettings.value?.height"
        class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-400 pointer-events-none"
      >
        Pointer X: {{ props.mouseX }}, Y: {{ props.mouseY }}
      </span>
      <button
        v-if="media.currentSettings.value?.width && media.currentSettings.value?.height"
        @click.stop="emit('center-mouse')"
        @mousedown.stop
        @mouseup.stop
        class="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-slate-800/80 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
        title="Center target mouse and reset page tracking"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v3m0 12v3m9-9h-3M6 12H3m12.364 6.364l-2.121-2.121M8.757 8.757L6.636 6.636m9.728 0l-2.121 2.121M8.757 15.243l-2.121 2.121M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        Center
      </button>
    </div>

    <!-- Fullscreen Button -->
    <div
      class="absolute bottom-2 right-2"
    >
      <button
        @click="toggleFullscreen"
        class="p-1.5 rounded bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
        :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
      >
        <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
        </svg>
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"/>
        </svg>
      </button>
    </div>
  </div>
</template>
