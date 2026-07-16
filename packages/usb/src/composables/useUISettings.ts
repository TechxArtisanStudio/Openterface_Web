import { ref, watch } from 'vue'

const UI_SETTINGS_STORAGE_KEY = 'openterface-ui-settings'

interface StoredUISettings {
  showKeyDisplay?: boolean
}

const defaultSettings: StoredUISettings = {
  showKeyDisplay: true,
}

function readStoredSettings(): StoredUISettings {
  if (typeof window === 'undefined') {
    return defaultSettings
  }

  try {
    const raw = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return defaultSettings
    }

    const parsed = JSON.parse(raw) as StoredUISettings
    return typeof parsed === 'object' && parsed !== null
      ? { ...defaultSettings, ...parsed }
      : defaultSettings
  } catch {
    return defaultSettings
  }
}

function persistSettings(settings: StoredUISettings): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

const storedSettings = readStoredSettings()
const showKeyDisplay = ref(storedSettings.showKeyDisplay ?? defaultSettings.showKeyDisplay!)

// Auto-persist when the value changes
watch(showKeyDisplay, (newValue) => {
  persistSettings({ showKeyDisplay: newValue })
})

export function useUISettings() {
  function resetAll(): void {
    showKeyDisplay.value = defaultSettings.showKeyDisplay!
  }

  return {
    showKeyDisplay,
    resetAll,
  }
}
