import { ref } from 'vue'

const INPUT_SETTINGS_STORAGE_KEY = 'openterface-input-settings'

const defaultMouseSensitivity = 1
const minMouseSensitivity = 0.2
const maxMouseSensitivity = 2
const defaultMouseMode = 'absolute'

export type MouseMode = 'absolute' | 'relative'

interface StoredInputSettings {
  mouseSensitivity?: number
  mouseMode?: MouseMode
}

function clampMouseSensitivity(value: number): number {
  return Math.min(maxMouseSensitivity, Math.max(minMouseSensitivity, value))
}

function normalizeMouseMode(value: unknown): MouseMode {
  return value === 'relative' ? 'relative' : 'absolute'
}

function readStoredSettings(): StoredInputSettings {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(INPUT_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as StoredInputSettings
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined') {
    return
  }

  const settings: StoredInputSettings = {
    mouseSensitivity: mouseSensitivity.value,
    mouseMode: mouseMode.value,
  }

  window.localStorage.setItem(INPUT_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

const storedSettings = readStoredSettings()
const mouseSensitivity = ref(
  clampMouseSensitivity(storedSettings.mouseSensitivity ?? defaultMouseSensitivity),
)
const mouseMode = ref<MouseMode>(normalizeMouseMode(storedSettings.mouseMode ?? defaultMouseMode))

export function useInputSettings() {
  function setMouseSensitivity(nextValue: number): void {
    if (!Number.isFinite(nextValue)) {
      return
    }

    mouseSensitivity.value = clampMouseSensitivity(nextValue)
    persistSettings()
  }

  function setMouseMode(nextMode: MouseMode): void {
    mouseMode.value = normalizeMouseMode(nextMode)
    persistSettings()
  }

  function resetMouseSensitivity(): void {
    mouseSensitivity.value = defaultMouseSensitivity
    persistSettings()
  }

  return {
    mouseSensitivity,
    mouseMode,
    setMouseSensitivity,
    setMouseMode,
    resetMouseSensitivity,
    defaultMouseSensitivity,
    minMouseSensitivity,
    maxMouseSensitivity,
    defaultMouseMode,
  }
}