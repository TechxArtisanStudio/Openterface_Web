<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from 'vue'
import { HIDTransportKey, loadWasm } from '@openterface/core'
import { useWebRtcTransport } from './composables/useWebRtcTransport'

const transport = useWebRtcTransport()
provide(HIDTransportKey, transport)

const isConnecting = ref(false)
const error = ref<string | null>(null)

async function connect() {
  isConnecting.value = true
  error.value = null
  try {
    const success = await transport.connect()
    if (!success) {
      error.value = 'Failed to connect'
    }
  } catch (err) {
    error.value = String(err)
  } finally {
    isConnecting.value = false
  }
}

function disconnect() {
  transport.disconnect()
}

onMounted(async () => {
  try {
    await loadWasm()
    console.log('[App] WASM loaded')
  } catch (err) {
    console.error('[App] WASM load failed:', err)
  }
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-white">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
      <h1 class="text-lg font-bold">Openterface WebRTC Client</h1>
      <div class="flex items-center gap-3">
        <span class="text-sm" :class="transport.isConnected.value ? 'text-green-400' : 'text-slate-400'">
          {{ transport.state.value }}
        </span>
        <button
          v-if="!transport.isConnected.value"
          @click="connect"
          :disabled="isConnecting"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded text-sm font-medium transition-colors"
        >
          {{ isConnecting ? 'Connecting...' : 'Connect' }}
        </button>
        <button
          v-else
          @click="disconnect"
          class="px-4 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm font-medium transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-4 py-2 bg-red-900/50 text-red-200 text-sm">
      {{ error }}
    </div>

    <!-- Video -->
    <div class="flex-1 flex items-center justify-center p-4">
      <video
        class="max-w-full max-h-full bg-black"
        autoplay
        playsinline
        muted
      />
    </div>

    <!-- Instructions -->
    <div class="px-4 py-3 bg-slate-900 border-t border-slate-800 text-sm text-slate-400">
      <p>Connect to start viewing. Keyboard and mouse input will be sent via the WebRTC data channel.</p>
    </div>
  </div>
</template>
