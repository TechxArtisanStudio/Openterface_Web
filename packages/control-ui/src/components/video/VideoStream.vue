<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, Ref } from 'vue'
import { HIDTransportKey } from '@openterface/core'

const videoRef = ref<HTMLVideoElement | null>(null)
const isFullscreen = ref(false)

const transport = inject(HIDTransportKey)!
const isConnected = transport.isConnected

const videoElRef = inject<Ref<HTMLVideoElement | null>>('videoEl')

const emit = defineEmits<{
  'mousedown': [e: MouseEvent]
  'mouseup': [e: MouseEvent]
  'mousemove': [e: MouseEvent]
  'wheel': [e: WheelEvent]
}>()

const props = defineProps<{
  mouseX?: number
  mouseY?: number
}>()

defineExpose({ videoRef })

onMounted(() => {
  if (videoElRef) {
    videoElRef.value = videoRef.value
  }
})

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
    @contextmenu.prevent
    @mousedown="$emit('mousedown', $event)"
    @mouseup="$emit('mouseup', $event)"
    @mousemove="$emit('mousemove', $event)"
    @wheel="$emit('wheel', $event)"
  >
    <!-- Video Element -->
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      autoplay
      muted
      playsinline
    />

    <!-- Welcome Poster (shown when not connected) -->
    <div v-if="!isConnected.value" class="absolute inset-0 flex items-center justify-center bg-slate-950 pointer-events-none">
      <div class="text-center">
        <svg class="w-20 h-20 mx-auto text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p class="text-slate-500 text-sm">No video signal</p>
        <p class="text-slate-600 text-xs mt-1">Connect to begin</p>
      </div>
    </div>

    <!-- Resolution Badge -->
    <div class="absolute top-2 right-2 flex flex-col items-end gap-1">
      <!-- Mouse Coordinates -->
      <span
        v-if="mouseX !== undefined && mouseY !== undefined"
        class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800/80 text-slate-300 pointer-events-none"
      >
        X: {{ mouseX }}, Y: {{ mouseY }}
      </span>
    </div>

    <!-- Fullscreen Button -->
    <div class="absolute bottom-2 right-2">
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
