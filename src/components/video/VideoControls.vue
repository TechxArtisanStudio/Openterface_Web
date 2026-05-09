<script setup lang="ts">
import { ref } from 'vue'
import { useVideoControls } from '../../composables/useVideoControls'

const showPanel = ref(false)
const { brightness, contrast, setBrightness, setContrast, reset } = useVideoControls()

function onBrightnessChange(): void {
  const video = document.querySelector('video') as HTMLVideoElement | null
  if (video) {
    video.style.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%)`
  }
}

function onContrastChange(): void {
  const video = document.querySelector('video') as HTMLVideoElement | null
  if (video) {
    video.style.filter = `brightness(${brightness.value}%) contrast(${contrast.value}%)`
  }
}
</script>

<template>
  <div class="relative">
    <button
      @click="showPanel = !showPanel"
      class="p-1 rounded bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
      title="Video Controls"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
      </svg>
    </button>

    <div v-if="showPanel" class="absolute right-0 top-8 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
      <div class="space-y-3">
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="text-slate-400">Brightness</span>
            <span class="text-slate-300 font-mono">{{ brightness }}%</span>
          </div>
          <input
            type="range" min="20" max="200"
            v-model="brightness"
            @input="onBrightnessChange"
            class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
        <div>
          <div class="flex justify-between text-xs mb-1">
            <span class="text-slate-400">Contrast</span>
            <span class="text-slate-300 font-mono">{{ contrast }}%</span>
          </div>
          <input
            type="range" min="20" max="200"
            v-model="contrast"
            @input="onContrastChange"
            class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
          />
        </div>
        <button
          @click="reset(); onBrightnessChange()"
          class="w-full text-xs text-slate-400 hover:text-slate-200 py-1 rounded hover:bg-slate-800 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>
