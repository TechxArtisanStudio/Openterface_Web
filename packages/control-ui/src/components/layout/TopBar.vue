<script setup lang="ts">
import { computed, inject } from 'vue'
import { HIDTransportKey, TransportState } from '@openterface/core'
import { useBrowserDetection } from '../../composables/useBrowserDetection'
import CameraSelector from '../video/CameraSelector.vue'
import type { Ref } from 'vue'

const transport = inject(HIDTransportKey)!
const videoElRef = inject<Ref<HTMLVideoElement | null>>('videoEl')
const detection = useBrowserDetection()

// These are USB-specific - exposed via transport state
// WebRTC uses remote video, USB uses getUserMedia
// The transport's deviceInfo and state provide the connection info
const stateLabel = computed(() => {
  switch (transport.state.value) {
    case TransportState.Connecting:
      return 'Connecting...'
    case TransportState.Connected:
      return 'Connected'
    default:
      return 'Disconnected'
  }
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

    <!-- Connection Status -->
    <div
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      :class="transport.isConnected.value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
      {{ stateLabel }}
    </div>

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
