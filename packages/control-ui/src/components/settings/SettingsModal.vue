<script setup lang="ts">
import { ref, inject } from 'vue'
import { HIDTransportKey } from '@openterface/core'

const emit = defineEmits<{ close: [] }>()

const transport = inject(HIDTransportKey)!
const mouseMode = ref<'absolute' | 'relative'>('absolute')
const pasteDelay = ref(30)
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">Settings</h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-800 text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-5">
        <!-- Connection Status -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Connection Status</label>
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-1 rounded text-xs font-medium"
              :class="transport.isConnected.value ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'"
            >
              {{ transport.state.value }}
            </span>
          </div>
        </div>

        <!-- Mouse Mode -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Mouse Mode</label>
          <div class="flex gap-2">
            <button
              @click="mouseMode = 'absolute'"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="mouseMode === 'absolute' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'"
            >
              Absolute
            </button>
            <button
              @click="mouseMode = 'relative'"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="mouseMode === 'relative' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'"
            >
              Relative (Pointer Lock)
            </button>
          </div>
        </div>

        <!-- Paste Delay -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Paste Delay</label>
          <div class="flex items-center gap-3">
            <input
              v-model.number="pasteDelay"
              type="range"
              min="10"
              max="200"
              class="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <span class="text-xs font-mono text-slate-300 w-12 text-right">{{ pasteDelay }}ms</span>
          </div>
        </div>

        <!-- Device Info -->
        <div v-if="transport.deviceInfo.value">
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Device Info</label>
          <div class="text-xs text-slate-400 space-y-1">
            <p>Firmware: {{ transport.deviceInfo.value.firmwareVersion }}</p>
            <p>Target: {{ transport.deviceInfo.value.targetConnected ? 'Connected' : 'Disconnected' }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
