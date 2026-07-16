<script setup lang="ts">
import { ref } from 'vue'
import Layout from './components/layout/Layout.vue'
import BrowserWarningModal from './components/settings/BrowserWarningModal.vue'
import { useBrowserDetection } from './composables/useBrowserDetection'

const showWarning = ref(false)
const detection = useBrowserDetection()
</script>

<template>
  <Layout @show-warning="showWarning = true" />

  <BrowserWarningModal v-if="showWarning" @close="showWarning = false" />
</template>
