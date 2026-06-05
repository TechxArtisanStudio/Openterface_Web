<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { HIDTransportKey, useHidCommands } from '@openterface/core'

const transport = inject(HIDTransportKey)!
const { sendKeyDown, sendKeyUp, toggleLockKey } = useHidCommands()

const shiftLock = ref(false)
const ctrlLock = ref(false)
const altLock = ref(false)
const winLock = ref(false)

const activeModifiers = computed(() => {
  let mod = 0
  if (ctrlLock.value) mod |= 0x01
  if (shiftLock.value) mod |= 0x02
  if (altLock.value) mod |= 0x04
  if (winLock.value) mod |= 0x08
  return mod
})

async function sendWithLock(key: string, hidCode: number): Promise<void> {
  if (!transport.isConnected.value) return
  const mod = activeModifiers.value
  await sendKeyDown(mod, [hidCode])
  setTimeout(async () => await sendKeyUp(), 100)
}

// Function keys F1-F12
const functionKeys = [
  { label: 'F1', code: 0x3a },
  { label: 'F2', code: 0x3b },
  { label: 'F3', code: 0x3c },
  { label: 'F4', code: 0x3d },
  { label: 'F5', code: 0x3e },
  { label: 'F6', code: 0x3f },
  { label: 'F7', code: 0x40 },
  { label: 'F8', code: 0x41 },
  { label: 'F9', code: 0x42 },
  { label: 'F10', code: 0x43 },
  { label: 'F11', code: 0x44 },
  { label: 'F12', code: 0x45 },
]
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <!-- Modifier Locks -->
    <button
      v-for="m in [
        { key: 'shiftLock', label: 'SHIFT', active: shiftLock, lock: () => shiftLock = !shiftLock },
        { key: 'ctrlLock', label: 'CTRL', active: ctrlLock, lock: () => ctrlLock = !ctrlLock },
        { key: 'altLock', label: 'ALT', active: altLock, lock: () => altLock = !altLock },
        { key: 'winLock', label: 'WIN', active: winLock, lock: () => winLock = !winLock },
      ]"
      :key="m.key"
      @click="m.lock()"
      class="px-1.5 py-0.5 rounded text-xs font-bold transition-colors"
      :class="m.active ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300'"
    >
      {{ m.label }}
    </button>

    <div class="w-5 h-px bg-slate-700" />

    <!-- Function Keys -->
    <button
      v-for="fk in functionKeys"
      :key="fk.label"
      @click="sendWithLock(fk.label, fk.code)"
      :disabled="!transport.isConnected.value"
      class="px-1 py-0.5 rounded text-xs font-mono bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {{ fk.label }}
    </button>
  </div>
</template>
