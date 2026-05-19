<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useSerial } from '../../composables/useSerial'
import { useViewerMedia } from '../../composables/useViewerMedia'
import { useBrowserDetection } from '../../composables/useBrowserDetection'
import CameraSelector from '../video/CameraSelector.vue'
import type { Ref } from 'vue'

const { state, connect, disconnect, isConnected, generation, usbProductId, usbModeBackend, requestUsbModeHidPermission } = useSerial()
const media = useViewerMedia()
const detection = useBrowserDetection()
const videoElRef = inject<Ref<HTMLVideoElement | null>>('videoEl')

async function toggleMonitor() {
  console.log('[TopBar] toggleMonitor, enabled:', media.enabled.value, 'videoEl:', !!videoElRef?.value)
  if (media.enabled.value) {
    media.disconnect()
    console.log('[TopBar] monitor disconnected')
  } else {
    const result = await media.connect(videoElRef?.value)
    console.log('[TopBar] monitor connect result:', result)
  }
}

async function toggleSerial() {
  if (isConnected.value) {
    await disconnect()
  } else {
    await connect({ allowHidPrompt: true })
  }
}

const stateLabel = computed(() => {
  switch (state.value) {
    case 'opening':
      return 'Connecting...'
    case 'connected':
      return 'Serial Connected'
    default:
      return 'Serial Disconnected'
  }
})

const showHidUsbModePrompt = computed(() => {
  return isConnected.value && (generation.value === 'gen1' || generation.value === 'gen3') && usbModeBackend.value !== 'hid'
})
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800 h-10 shrink-0">
    <!-- Logo -->
    <div class="flex items-center gap-2 shrink-0">
      <span class="text-sm font-semibold text-orange-400">Openterface</span>
      <span class="text-xs text-slate-500">Web Viewer</span>
    </div>

    <div class="h-5 w-px bg-slate-700 mx-1 shrink-0" />

    <!-- Camera Selector -->
    <CameraSelector />

    <div class="h-5 w-px bg-slate-700 mx-1 shrink-0" />

    <!-- Monitor Toggle -->
    <button
      @click="toggleMonitor"
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
      :class="media.enabled.value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      {{ media.enabled.value ? 'Monitor ON' : 'Monitor OFF' }}
    </button>

    <!-- Serial Toggle (only if full support) -->
    <button
      v-if="detection.fullSupport"
      @click="toggleSerial"
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
      :class="isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      {{ stateLabel }}
    </button>

    <button
      v-if="showHidUsbModePrompt"
      @click="requestUsbModeHidPermission"
      :disabled="!detection.hid"
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      :class="detection.hid ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'"
      :title="detection.hid ? 'Grant WebHID access for USB mode sync' : 'Current browser does not support WebHID'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6m9 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      {{ detection.hid ? 'Grant HID Access' : 'WebHID Unavailable' }}
    </button>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Browser warning -->
    <button
      v-if="!detection.fullSupport"
      @click="$emit('showWarning')"
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 animate-pulse"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
      Limited Support
    </button>
  </div>
</template>
