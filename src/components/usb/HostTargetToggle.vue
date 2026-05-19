<script setup lang="ts">
import { computed } from 'vue'
import { useSerial } from '../../composables/useSerial'
import { useDeviceState } from '../../composables/useDeviceState'

const { isConnected, setUsbMode } = useSerial()
const { usbMode } = useDeviceState()

const isHost = computed(() => usbMode.value === 'host')
const isTarget = computed(() => usbMode.value === 'target')

async function setMode(mode: 'host' | 'target'): Promise<void> {
  if (!isConnected.value) return
  await setUsbMode(mode)
}
</script>

<template>
  <div class="flex items-center rounded-lg bg-slate-800 p-0.5">
    <button
      @click="setMode('host')"
      :disabled="!isConnected"
      class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
      :class="isHost
        ? 'bg-blue-500 text-white shadow'
        : 'text-slate-500 hover:text-slate-300'"
      title="Switch USB to Host"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      Host
    </button>
    <button
      @click="setMode('target')"
      :disabled="!isConnected"
      class="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all"
      :class="isTarget
        ? 'bg-emerald-500 text-white shadow'
        : 'text-slate-500 hover:text-slate-300'"
      title="Switch USB to Target"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
      </svg>
      Target
    </button>
  </div>
</template>
