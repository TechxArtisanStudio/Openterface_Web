<script setup lang="ts">

interface Props {
  numLock: boolean
  capsLock: boolean
  scrollLock: boolean
  usbMode: 'host' | 'target'
  mouseX: number
  mouseY: number
}

defineProps<Props>()
</script>

<template>
  <div class="flex items-center justify-between px-3 py-1 bg-slate-900 border-y border-slate-800 h-7 shrink-0 text-xs">
    <!-- Left: Lock indicators + USB mode -->
    <div class="flex items-center gap-2">
      <span class="flex items-center gap-1.5">
        <span class="font-mono font-bold px-1.5 rounded" :class="numLock ? 'bg-orange-500/30 text-orange-400' : 'bg-slate-800 text-slate-600'" title="Num Lock">NL</span>
        <span class="font-mono font-bold px-1.5 rounded" :class="capsLock ? 'bg-orange-500/30 text-orange-400' : 'bg-slate-800 text-slate-600'" title="Caps Lock">CL</span>
        <span class="font-mono font-bold px-1.5 rounded" :class="scrollLock ? 'bg-orange-500/30 text-orange-400' : 'bg-slate-800 text-slate-600'" title="Scroll Lock">SL</span>
      </span>
      <div class="h-4 w-px bg-slate-700" />
      <span class="flex items-center gap-1">
        <span class="font-semibold px-1.5 rounded" :class="usbMode === 'target' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'" :title="usbMode === 'target' ? 'USB → Target' : 'USB → Host'">
          {{ usbMode === 'target' ? 'T' : 'H' }}
        </span>
      </span>
    </div>

    <!-- Right: Mouse coords -->
    <span class="font-mono text-slate-500">
      X: {{ mouseX }}, Y: {{ mouseY }}
    </span>
  </div>
</template>
