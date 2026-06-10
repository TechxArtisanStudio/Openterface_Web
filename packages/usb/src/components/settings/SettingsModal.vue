<script setup lang="ts">
import { ref } from 'vue'
import { useViewerMedia, CAMERA_RESOLUTIONS } from '../../composables/useViewerMedia'
import { useSerial } from '../../composables/useSerial'
import { useInputSettings } from '../../composables/useInputSettings'
import { useVideoOverlaySettings } from '../../composables/useVideoOverlaySettings'

const emit = defineEmits<{ close: [] }>()

const pasteDelay = ref(30)
const showAllDevices = ref(false)
const showOverlaySettings = ref(false)

const media = useViewerMedia()
const serial = useSerial()
const { mouseMode, setMouseMode } = useInputSettings()
const overlaySettings = useVideoOverlaySettings()

async function applyResolution(res: typeof CAMERA_RESOLUTIONS[number]): Promise<void> {
  await media.applySettings({ width: res.width, height: res.height })
}

function forgetDevices(): void {
  localStorage.removeItem('serial-port-selected')
  emit('close')
}

function resetOverlaySettings(): void {
  overlaySettings.resetAll()
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="emit('close')">
    <div class="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">Settings</h2>
        <button @click="emit('close')" class="p-1 rounded hover:bg-slate-800 text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="space-y-5">
        <!-- Camera -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Camera Device</label>
          <select
            v-model="media.selectedDevice.value"
            @change="media.changeDevice(media.selectedDevice.value)"
            class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option v-for="d in media.devices.value" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || d.deviceId }}
            </option>
          </select>
          <label class="flex items-center gap-2 mt-2">
            <input v-model="showAllDevices" type="checkbox" class="rounded border-slate-700 bg-slate-800 text-orange-500" />
            <span class="text-xs text-slate-500">Show all video devices</span>
          </label>
        </div>

        <!-- Resolution -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Resolution</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="res in CAMERA_RESOLUTIONS"
              :key="res.label"
              @click="applyResolution(res)"
              class="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              {{ res.label }}
            </button>
          </div>
        </div>

        <!-- Mouse Mode -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Mouse Mode</label>
          <div class="flex gap-2">
            <button
              @click="setMouseMode('absolute')"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="mouseMode === 'absolute' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'"
            >
              Absolute
            </button>
            <button
              @click="setMouseMode('relative')"
              class="flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              :class="mouseMode === 'relative' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'"
            >
              Relative (Pointer Lock)
            </button>
          </div>
        </div>

        <!-- Paste Delay -->
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-1.5">Paste Delay</label>
          <div class="flex items-center gap-3">
            <input
              v-model.number="pasteDelay"
              type="range"
              min="10"
              max="200"
              class="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <span class="text-xs font-mono text-slate-300 w-12 text-right">{{ pasteDelay }}ms</span>
          </div>
        </div>

        <!-- Serial Logging -->
        <div>
          <label class="flex items-center gap-2">
            <input
              v-model="serial.logEnabled.value"
              type="checkbox"
              class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
            />
            <span class="text-sm font-medium text-slate-300">Serial Console Logging</span>
          </label>
          <p class="text-xs text-slate-500 mt-1">Print serial protocol frames to browser console</p>
        </div>

        <!-- Video Overlay Settings -->
        <div class="pt-4 border-t border-slate-800">
          <button
            @click="showOverlaySettings = !showOverlaySettings"
            class="flex items-center justify-between w-full group"
          >
            <span class="text-sm font-medium text-slate-300">Video Overlay Settings</span>
            <svg
              class="w-4 h-4 text-slate-500 transition-transform group-hover:text-slate-400"
              :class="showOverlaySettings ? 'rotate-180' : ''"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <p class="text-xs text-slate-500 mt-1">Control visibility of video overlay indicators</p>

          <div v-if="showOverlaySettings" class="mt-4 space-y-3 pl-1">
            <!-- Toggle All -->
            <label class="flex items-center gap-2 border-b border-slate-800 pb-2 mb-1">
              <input
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4 cursor-pointer"
                :checked="overlaySettings.allEnabled.value"
                :indeterminate.prop="!overlaySettings.allEnabled.value && overlaySettings.someEnabled.value"
                @change="overlaySettings.toggleAll()"
              />
              <span class="text-sm font-medium text-white">Show All Overlays</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showMouseStatus.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Mouse Status</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showResolution.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Resolution</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showPixelClock.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Pixel Clock</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showBaudRate.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Baud Rate</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showTargetMousePosition.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Target Mouse Position</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showPointerPosition.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Pointer Position</span>
            </label>
            <label class="flex items-center gap-2">
              <input
                v-model="overlaySettings.showCenterButton.value"
                type="checkbox"
                class="rounded border-slate-700 bg-slate-800 text-orange-500 w-4 h-4"
              />
              <span class="text-sm text-slate-400">Show Center Button</span>
            </label>
            <button
              @click="resetOverlaySettings()"
              class="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="pt-4 border-t border-slate-800">
          <button
            @click="forgetDevices()"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Forget Saved Devices
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
