<script setup lang="ts">
import { ref, provide } from 'vue'
import { HIDTransportKey, loadWasm } from '@openterface/core'
import { Layout, BrowserWarningModal } from '@openterface/control-ui'
import { useBrowserDetection } from '@openterface/control-ui'
import { useUsbTransport } from './composables/useUsbTransport'

const transport = useUsbTransport()
provide(HIDTransportKey, transport)

const showWarning = ref(false)
const detection = useBrowserDetection()

// Load WASM on mount
loadWasm().catch(err => console.error('WASM load failed:', err))
</script>

<template>
  <Layout @show-warning="showWarning = true" />
  <BrowserWarningModal v-if="showWarning" @close="showWarning = false" />
</template>
