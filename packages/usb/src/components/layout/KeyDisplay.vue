<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

const MOD_CODES: Record<string, string> = {
  ControlLeft: 'LCtrl',
  ControlRight: 'RCtrl',
  ShiftLeft: 'LShift',
  ShiftRight: 'RShift',
  AltLeft: 'LAlt',
  AltRight: 'RAlt',
  MetaLeft: 'LWin',
  MetaRight: 'RWin',
}

const activeMods = ref<string[]>([])
const currentKey = ref<string>('')
const modifiers = computed(() => activeMods.value)

function onKeyDown(e: KeyboardEvent): void {
  const modLabel = MOD_CODES[e.code]
  if (modLabel) {
    if (!activeMods.value.includes(modLabel)) {
      activeMods.value = [...activeMods.value, modLabel]
    }
  } else {
    currentKey.value = e.code
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const modLabel = MOD_CODES[e.code]
  if (modLabel) {
    activeMods.value = activeMods.value.filter(m => m !== modLabel)
  } else if (currentKey.value === e.code) {
    currentKey.value = ''
  }
}

function onBlur(): void {
  activeMods.value = []
  currentKey.value = ''
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 text-xs font-mono select-none">
    <!-- Modifiers -->
    <div class="flex gap-1">
      <span
        v-for="mod in modifiers"
        :key="mod"
        class="px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-300 border border-orange-500/40"
      >
        {{ mod }}
      </span>
      <span
        v-if="modifiers.length === 0"
        class="px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-500 border border-slate-700/40"
      >
        Mod
      </span>
    </div>

    <!-- Separator -->
    <div class="h-4 w-px bg-slate-700 mx-0.5" />

    <!-- Current key -->
    <span
      :class="currentKey ? 'text-emerald-300' : 'text-slate-600'"
      class="min-w-[3rem] text-center"
    >
      {{ currentKey || '—' }}
    </span>
  </div>
</template>
