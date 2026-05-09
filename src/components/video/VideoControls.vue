<script setup lang="ts">
import { inject } from 'vue'
import type { Ref } from 'vue'

const keyboardEnabled = inject<Ref<boolean>>('keyboardEnabled')!
const mouseEnabled = inject<Ref<boolean>>('mouseEnabled')!
</script>

<template>
  <div class="flex items-center gap-1">
    <span
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
      :class="keyboardEnabled.value ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'"
      title="Keyboard Capture"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
      </svg>
      KB
    </span>
    <span
      class="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
      :class="mouseEnabled.value ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-700 text-slate-400'"
      title="Mouse Capture"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
      </svg>
      Mouse
    </span>
  </div>
</template>
