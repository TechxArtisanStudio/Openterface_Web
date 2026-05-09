<script setup lang="ts">
import { computed } from 'vue'
import { useViewerMedia } from '../../composables/useViewerMedia'

const media = useViewerMedia()

const options = computed(() =>
  media.devices.value.map((d) => ({
    value: d.deviceId,
    label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
  }))
)

async function onSelect(deviceId: string): Promise<void> {
  await media.changeDevice(deviceId)
}
</script>

<template>
  <select
    v-if="options.length"
    v-model="media.selectedDevice.value"
    @change="onSelect(media.selectedDevice.value)"
    class="bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
  >
    <option v-for="opt in options" :key="opt.value" :value="opt.value">
      {{ opt.label }}
    </option>
  </select>
  <span v-else class="text-xs text-slate-600 italic">No camera</span>
</template>
