<script setup lang="ts">
import { useBrowserDetection } from '../../composables/useBrowserDetection'

const emit = defineEmits<{ close: [] }>()
const detection = useBrowserDetection()
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-slate-900 border border-red-500/30 rounded-xl shadow-2xl w-full max-w-md p-6">
      <div class="flex items-center gap-2 mb-4">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>
        <h2 class="text-lg font-semibold text-red-400">Limited Support</h2>
      </div>

      <p class="text-sm text-slate-300 mb-4">
        Your browser does not support all required features. You can still view the video feed, but keyboard and mouse injection will not work.
      </p>

      <div class="space-y-2 mb-4">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">Web Serial API</span>
          <span class="px-2 py-0.5 rounded font-bold" :class="detection.serial ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
            {{ detection.serial ? 'Supported' : 'Missing' }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">MediaDevices API</span>
          <span class="px-2 py-0.5 rounded font-bold" :class="detection.mediaDevices ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
            {{ detection.mediaDevices ? 'Supported' : 'Missing' }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">Pointer Lock API</span>
          <span class="px-2 py-0.5 rounded font-bold" :class="detection.pointerLock ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
            {{ detection.pointerLock ? 'Supported' : 'Missing' }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-400">Clipboard API</span>
          <span class="px-2 py-0.5 rounded font-bold" :class="detection.clipboard ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'">
            {{ detection.clipboard ? 'Supported' : 'Missing' }}
          </span>
        </div>
      </div>

      <p class="text-xs text-slate-500 mb-4">
        For full functionality, use a Chromium-based browser (Chrome, Edge, Arc) with HTTPS or localhost.
      </p>

      <div class="flex gap-3">
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/SerialPort#browser_compatibility"
          target="_blank"
          rel="noopener"
          class="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
        >
          Browser Compatibility
        </a>
        <button
          @click="emit('close')"
          class="flex-1 px-4 py-2 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  </div>
</template>
