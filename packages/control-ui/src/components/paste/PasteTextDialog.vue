<script setup lang="ts">
import { ref, inject } from 'vue'
import { HIDTransportKey } from '@openterface/core'
import { usePasteText } from '@openterface/core'

const emit = defineEmits<{ close: [] }>()

const transport = inject(HIDTransportKey)!
const text = ref('')
const { isPasting, progress, totalChars, delay, error, paste, cancel, pasteFromClipboard } = usePasteText()

async function doPaste(): Promise<void> {
  if (!text.value.trim()) return
  await paste(text.value)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-white">Paste Text to Target</h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-800 text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <p class="text-xs text-slate-500 mb-3">
        This will type out the text one character at a time. Input from the viewer will be blocked until this completes.
      </p>

      <textarea
        v-model="text"
        :disabled="isPasting"
        rows="6"
        placeholder="Enter text to paste..."
        class="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
      />

      <!-- Delay Control -->
      <div class="flex items-center gap-3 mt-3">
        <label class="text-xs text-slate-400">Delay per char:</label>
        <input
          v-model.number="delay"
          type="range"
          min="10"
          max="200"
          :disabled="isPasting"
          class="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <span class="text-xs font-mono text-slate-300 w-12 text-right">{{ delay }}ms</span>
      </div>

      <!-- Progress -->
      <div v-if="isPasting" class="mt-3">
        <div class="flex justify-between text-xs mb-1">
          <span class="text-slate-400">Typing...</span>
          <span class="font-mono text-slate-300">{{ progress }}/{{ totalChars }}</span>
        </div>
        <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full bg-orange-500 transition-all duration-100" :style="{ width: `${(progress / totalChars) * 100}%` }" />
        </div>
      </div>

      <!-- Error -->
      <p v-if="error" class="mt-2 text-xs text-red-400">{{ error }}</p>

      <!-- Actions -->
      <div class="flex items-center justify-between mt-4">
        <button
          @click="pasteFromClipboard()"
          :disabled="isPasting || !transport.isConnected.value"
          class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Paste from Clipboard
        </button>
        <div class="flex gap-2">
          <button
            v-if="isPasting"
            @click="cancel()"
            class="px-4 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="doPaste()"
            :disabled="isPasting || !text.trim() || !transport.isConnected.value"
            class="px-4 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ isPasting ? 'Typing...' : 'Send' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
