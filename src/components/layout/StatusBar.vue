<script setup lang="ts">

interface Props {
  numLock: boolean
  capsLock: boolean
  scrollLock: boolean
  usbMode: 'host' | 'target' | 'unknown'
  usbSyncStatus?: 'synced' | 'out-of-sync'
}

const props = withDefaults(defineProps<Props>(), {
  usbSyncStatus: 'synced'
})

const emit = defineEmits<{
  'toggle-usb-mode': []
  'toggle-lock': [key: 'numLock' | 'capsLock' | 'scrollLock']
}>()
</script>

<template>
  <div class="flex flex-col items-center py-3 px-1 bg-slate-900 border-l border-slate-800 shrink-0 text-xs">
    <!-- Lock indicators + USB mode (vertical) -->
    <div class="flex flex-col items-center gap-2">
      <span class="flex flex-col items-center gap-1.5 cursor-pointer">
        <span class="font-mono font-bold px-1.5 rounded transition-colors" :class="numLock ? 'bg-orange-500/30 text-orange-400 hover:bg-orange-500/50' : 'bg-slate-800 text-slate-600 hover:bg-slate-700 hover:text-slate-400'" title="点击切换 Num Lock" @click="emit('toggle-lock', 'numLock')">NL</span>
        <span class="font-mono font-bold px-1.5 rounded transition-colors" :class="capsLock ? 'bg-orange-500/30 text-orange-400 hover:bg-orange-500/50' : 'bg-slate-800 text-slate-600 hover:bg-slate-700 hover:text-slate-400'" title="点击切换 Caps Lock" @click="emit('toggle-lock', 'capsLock')">CL</span>
        <span class="font-mono font-bold px-1.5 rounded transition-colors" :class="scrollLock ? 'bg-orange-500/30 text-orange-400 hover:bg-orange-500/50' : 'bg-slate-800 text-slate-600 hover:bg-slate-700 hover:text-slate-400'" title="点击切换 Scroll Lock" @click="emit('toggle-lock', 'scrollLock')">SL</span>
      </span>
      <div class="w-4 h-px bg-slate-700" />
      <span class="flex items-center gap-1">
        <span
          class="font-semibold px-1.5 rounded cursor-pointer hover:brightness-150 transition"
          :class="[
            usbMode === 'target'
              ? (props.usbSyncStatus === 'out-of-sync' ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/20 text-emerald-400')
              : usbMode === 'host'
                ? (props.usbSyncStatus === 'out-of-sync' ? 'bg-amber-500/30 text-amber-400' : 'bg-blue-500/20 text-blue-400')
                : 'bg-slate-800 text-slate-500'
          ]"
          :title="usbMode === 'target'
            ? (props.usbSyncStatus === 'out-of-sync' ? 'Target (software override, click to switch)' : 'USB → Target (click to switch)')
            : usbMode === 'host'
              ? (props.usbSyncStatus === 'out-of-sync' ? 'Host (software override, click to switch)' : 'USB → Host (click to switch)')
              : 'USB mode unknown'"
          @click="emit('toggle-usb-mode')"
        >
          {{ usbMode === 'target' ? 'T' : usbMode === 'host' ? 'H' : '?' }}
        </span>
      </span>
    </div>
  </div>
</template>
