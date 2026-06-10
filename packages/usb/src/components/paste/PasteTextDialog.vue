<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePasteText } from '../../composables/usePasteText'
import { useSerial } from '../../composables/useSerial'

const emit = defineEmits<{ close: [] }>()

const text = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const { isConnected } = useSerial()
const { isPasting, progress, totalChars, delay, error, paste, cancel, pasteFromClipboard } = usePasteText()

// Undo/Redo history
interface HistoryState {
  text: string
  selectionStart: number
  selectionEnd: number
}

const history = ref<HistoryState[]>([])
const historyIndex = ref(-1)
const maxHistorySize = 50

function saveHistory(): void {
  const textarea = textareaRef.value
  const state: HistoryState = {
    text: text.value,
    selectionStart: textarea?.selectionStart ?? 0,
    selectionEnd: textarea?.selectionEnd ?? 0,
  }

  // Remove any future states if we're in the middle of history
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }

  history.value.push(state)

  // Limit history size
  if (history.value.length > maxHistorySize) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

function undo(): void {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    text.value = state.text
    // Restore cursor position
    setTimeout(() => {
      textareaRef.value?.setSelectionRange(state.selectionStart, state.selectionEnd)
    }, 0)
  }
}

function redo(): void {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    text.value = state.text
    // Restore cursor position
    setTimeout(() => {
      textareaRef.value?.setSelectionRange(state.selectionStart, state.selectionEnd)
    }, 0)
  }
}

function clearText(): void {
  saveHistory()
  text.value = ''
}

async function doPaste(): Promise<void> {
  if (!text.value.trim()) return
  await paste(text.value)
}

async function doPasteFromClipboard(): Promise<void> {
  saveHistory()
  try {
    const clipboardText = await navigator.clipboard.readText()
    if (clipboardText) {
      const textarea = textareaRef.value
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      text.value = text.value.substring(0, start) + clipboardText + text.value.substring(end)
      setTimeout(() => {
        textarea?.setSelectionRange(start + clipboardText.length, start + clipboardText.length)
      }, 0)
    }
  } catch {
    console.warn('[Paste] Clipboard access denied')
  }
}

async function handleKeyDown(e: KeyboardEvent): Promise<void> {
  // Check if Ctrl+Z or Cmd+Z (Undo)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    if (document.activeElement === textareaRef.value) {
      e.preventDefault()
      undo()
      return
    }
  }

  // Check if Ctrl+Y or Cmd+Shift+Z (Redo)
  if ((e.ctrlKey && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
    if (document.activeElement === textareaRef.value) {
      e.preventDefault()
      redo()
      return
    }
  }

  // Check if Ctrl+V or Cmd+V is pressed (Paste)
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    if (document.activeElement === textareaRef.value) {
      saveHistory() // Save state before paste
      e.preventDefault()
      try {
        const clipboardText = await navigator.clipboard.readText()
        if (clipboardText) {
          const textarea = textareaRef.value
          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          text.value = text.value.substring(0, start) + clipboardText + text.value.substring(end)
          textarea.setSelectionRange(start + clipboardText.length, start + clipboardText.length)
        }
      } catch {
        console.warn('[Paste] Clipboard access denied')
      }
      return
    }
  }

  // Save history on regular typing (debounced)
  if (document.activeElement === textareaRef.value) {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Character input - save history before the change
      if (history.value.length === 0) {
        saveHistory()
      }
    }
  }
}

function handleInput(): void {
  // Save history on input events
  if (history.value.length === 0 || historyIndex.value === history.value.length - 1) {
    // Only save if we're at the end of history
    const lastState = history.value[history.value.length - 1]
    if (!lastState || lastState.text !== text.value) {
      saveHistory()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  // Initialize history with empty state
  saveHistory()
  // Auto-focus textarea after a short delay to ensure DOM is ready
  setTimeout(() => {
    textareaRef.value?.focus()
  }, 50)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
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

      <!-- Textarea with toolbar -->
      <div class="relative">
        <!-- Toolbar -->
        <div class="flex items-center gap-1 mb-1">
          <button
            @click="undo()"
            :disabled="historyIndex <= 0 || isPasting"
            title="Undo (Ctrl+Z)"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4"/>
            </svg>
          </button>
          <button
            @click="redo()"
            :disabled="historyIndex >= history.length - 1 || isPasting"
            title="Redo (Ctrl+Y)"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4"/>
            </svg>
          </button>
          <button
            @click="clearText()"
            :disabled="!text || isPasting"
            title="Clear text"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
          <div class="w-px h-4 bg-slate-700 mx-1"></div>
          <button
            @click="doPasteFromClipboard()"
            :disabled="isPasting"
            title="Paste from Clipboard (Ctrl+V)"
            class="p-1.5 rounded hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </button>
          <span class="ml-auto text-xs text-slate-500">{{ text.length }} chars</span>
        </div>

        <textarea
          ref="textareaRef"
          v-model="text"
          :disabled="isPasting"
          rows="6"
          placeholder="Enter text to paste... (Ctrl+V to paste, Ctrl+Z to undo, Ctrl+Y/Ctrl+Shift+Z to redo)"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
          @input="handleInput"
        />
      </div>

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
          :disabled="isPasting || !isConnected"
          class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Send Clipboard to Target
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
            :disabled="isPasting || !text.trim() || !isConnected"
            class="px-4 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ isPasting ? 'Typing...' : 'Send' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
