<script setup lang="ts">
import { ref, inject } from 'vue'
import { HIDTransportKey, useHidCommands } from '@openterface/core'
import ModifierLocks from '../input/ModifierLocks.vue'
import PasteTextDialog from '../paste/PasteTextDialog.vue'
import SettingsModal from '../settings/SettingsModal.vue'

const transport = inject(HIDTransportKey)!
const { sendMediaKey, sendKeyDown, sendKeyUp } = useHidCommands()

const showPaste = ref(false)
const showSettings = ref(false)
const darkMode = ref(true)

// Media key data bytes for power/sleep/wake
const MEDIA_POWER = new Uint8Array([0x02, 0x01, 0x01])
const MEDIA_SLEEP = new Uint8Array([0x02, 0x01, 0x02])
const MEDIA_WAKE = new Uint8Array([0x02, 0x01, 0x04])

// Transport controls
const MEDIA_PREV = new Uint8Array([0x04, 0x02, 0x20, 0x00, 0x00])
const MEDIA_PLAY = new Uint8Array([0x04, 0x02, 0x08, 0x00, 0x00])
const MEDIA_NEXT = new Uint8Array([0x04, 0x02, 0x10, 0x00, 0x00])

// Volume
const MEDIA_VOL_DOWN = new Uint8Array([0x04, 0x02, 0x02, 0x00, 0x00])
const MEDIA_VOL_UP = new Uint8Array([0x04, 0x02, 0x01, 0x00, 0x00])
const MEDIA_MUTE = new Uint8Array([0x04, 0x02, 0x04, 0x00, 0x00])

async function sendMedia(data: Uint8Array) {
  if (!transport.isConnected.value) return
  await sendMediaKey(data)
  // Release after brief moment
  setTimeout(async () => {
    const release = new Uint8Array([0x02, 0x00, 0x00])
    await sendMediaKey(release)
  }, 100)
}

function toggleTheme() {
  darkMode.value = !darkMode.value
  document.documentElement.classList.toggle('dark', darkMode.value)
}

async function sendCtrlAltDel() {
  if (!transport.isConnected.value) return
  await sendKeyDown(0x01 | 0x04, [0x4c]) // Ctrl+Alt + Delete
  setTimeout(async () => await sendKeyUp(), 100)
}
</script>

<template>
  <div class="flex flex-col items-center gap-1 px-1.5 py-2 bg-slate-900 border-l border-slate-800 w-auto flex-1 min-h-0 overflow-y-auto">

    <!-- Power / Sleep / Wake -->
    <div class="flex flex-col items-center gap-0.5 shrink-0">
      <button @click="sendMedia(MEDIA_POWER)" :disabled="!transport.isConnected.value" class="p-1.5 rounded hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-red-400" title="Power">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_WAKE)" :disabled="!transport.isConnected.value" class="p-1.5 rounded hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-amber-400" title="Wake">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_SLEEP)" :disabled="!transport.isConnected.value" class="p-1.5 rounded hover:bg-indigo-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-indigo-400" title="Sleep">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      </button>
    </div>

    <div class="w-5 h-px bg-slate-700 shrink-0" />

    <!-- Ctrl+Alt+Del -->
    <button @click="sendCtrlAltDel" :disabled="!transport.isConnected.value" class="px-2 py-0.5 rounded text-xs font-mono font-bold hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed text-red-400" title="Ctrl+Alt+Del">
      CAD
    </button>

    <div class="w-5 h-px bg-slate-700 shrink-0" />

    <!-- Transport Controls -->
    <div class="flex flex-col items-center gap-0.5 shrink-0">
      <button @click="sendMedia(MEDIA_PREV)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Previous Track">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_PLAY)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Play/Pause">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_NEXT)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Next Track">
        <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
    </div>

    <div class="w-5 h-px bg-slate-700 shrink-0" />

    <!-- Volume Controls -->
    <div class="flex flex-col items-center gap-0.5 shrink-0">
      <button @click="sendMedia(MEDIA_VOL_DOWN)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Volume Down">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_MUTE)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Mute">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
      </button>
      <button @click="sendMedia(MEDIA_VOL_UP)" :disabled="!transport.isConnected.value" class="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Volume Up">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a10 10 0 010 12.728M11 5L6 9H2v6h4l5 4V5z"/></svg>
      </button>
    </div>

    <div class="w-5 h-px bg-slate-700 shrink-0" />

    <!-- Modifier Locks -->
    <ModifierLocks />

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Paste Text -->
    <button @click="showPaste = true" :disabled="!transport.isConnected.value" class="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-400" title="Paste Text to Target">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
    </button>

    <!-- Settings -->
    <button @click="showSettings = true" class="p-1.5 rounded hover:bg-slate-700 text-slate-400" title="Settings">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
    </button>

    <!-- Theme Toggle -->
    <button @click="toggleTheme" class="p-1.5 rounded hover:bg-slate-700 text-slate-400" :title="darkMode ? 'Light Mode' : 'Dark Mode'">
      <svg v-if="darkMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
      <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
    </button>

    <!-- Modals -->
    <PasteTextDialog v-if="showPaste" @close="showPaste = false" />
    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>
