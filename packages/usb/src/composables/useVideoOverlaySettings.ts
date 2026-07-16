import { ref, computed } from 'vue'

const OVERLAY_SETTINGS_STORAGE_KEY = 'openterface-overlay-settings'

interface StoredOverlaySettings {
  showMouseStatus?: boolean
  showResolution?: boolean
  showPixelClock?: boolean
  showBaudRate?: boolean
  showTargetMousePosition?: boolean
  showPointerPosition?: boolean
  showCenterButton?: boolean
}

const defaultSettings: StoredOverlaySettings = {
  showMouseStatus: true,
  showResolution: true,
  showPixelClock: true,
  showBaudRate: true,
  showTargetMousePosition: true,
  showPointerPosition: true,
  showCenterButton: true,
}

const showMouseStatus = ref(defaultSettings.showMouseStatus!)
const showResolution = ref(defaultSettings.showResolution!)
const showPixelClock = ref(defaultSettings.showPixelClock!)
const showBaudRate = ref(defaultSettings.showBaudRate!)
const showTargetMousePosition = ref(defaultSettings.showTargetMousePosition!)
const showPointerPosition = ref(defaultSettings.showPointerPosition!)
const showCenterButton = ref(defaultSettings.showCenterButton!)

function readStoredSettings(): StoredOverlaySettings {
  if (typeof window === 'undefined') {
    return defaultSettings
  }

  try {
    const raw = window.localStorage.getItem(OVERLAY_SETTINGS_STORAGE_KEY)
    if (!raw) {
      return defaultSettings
    }

    const parsed = JSON.parse(raw) as StoredOverlaySettings
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultSettings
    }

    return { ...defaultSettings, ...parsed }
  } catch {
    return defaultSettings
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined') {
    return
  }

  const settings: StoredOverlaySettings = {
    showMouseStatus: showMouseStatus.value,
    showResolution: showResolution.value,
    showPixelClock: showPixelClock.value,
    showBaudRate: showBaudRate.value,
    showTargetMousePosition: showTargetMousePosition.value,
    showPointerPosition: showPointerPosition.value,
    showCenterButton: showCenterButton.value,
  }

  window.localStorage.setItem(OVERLAY_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

// Initialize from storage
const storedSettings = readStoredSettings()
showMouseStatus.value = storedSettings.showMouseStatus ?? defaultSettings.showMouseStatus!
showResolution.value = storedSettings.showResolution ?? defaultSettings.showResolution!
showPixelClock.value = storedSettings.showPixelClock ?? defaultSettings.showPixelClock!
showBaudRate.value = storedSettings.showBaudRate ?? defaultSettings.showBaudRate!
showTargetMousePosition.value = storedSettings.showTargetMousePosition ?? defaultSettings.showTargetMousePosition!
showPointerPosition.value = storedSettings.showPointerPosition ?? defaultSettings.showPointerPosition!
showCenterButton.value = storedSettings.showCenterButton ?? defaultSettings.showCenterButton!

const allEnabled = computed(() =>
  showMouseStatus.value &&
  showResolution.value &&
  showPixelClock.value &&
  showBaudRate.value &&
  showTargetMousePosition.value &&
  showPointerPosition.value &&
  showCenterButton.value,
)

const someEnabled = computed(() =>
  showMouseStatus.value ||
  showResolution.value ||
  showPixelClock.value ||
  showBaudRate.value ||
  showTargetMousePosition.value ||
  showPointerPosition.value ||
  showCenterButton.value,
)

function toggleAll(): void {
  const target = !allEnabled.value
  showMouseStatus.value = target
  showResolution.value = target
  showPixelClock.value = target
  showBaudRate.value = target
  showTargetMousePosition.value = target
  showPointerPosition.value = target
  showCenterButton.value = target
  persistSettings()
}

export function useVideoOverlaySettings() {
  function setShowMouseStatus(value: boolean): void {
    showMouseStatus.value = value
    persistSettings()
  }

  function setShowResolution(value: boolean): void {
    showResolution.value = value
    persistSettings()
  }

  function setShowPixelClock(value: boolean): void {
    showPixelClock.value = value
    persistSettings()
  }

  function setShowBaudRate(value: boolean): void {
    showBaudRate.value = value
    persistSettings()
  }

  function setShowTargetMousePosition(value: boolean): void {
    showTargetMousePosition.value = value
    persistSettings()
  }

  function setShowPointerPosition(value: boolean): void {
    showPointerPosition.value = value
    persistSettings()
  }

  function setShowCenterButton(value: boolean): void {
    showCenterButton.value = value
    persistSettings()
  }

  function resetAll(): void {
    showMouseStatus.value = defaultSettings.showMouseStatus!
    showResolution.value = defaultSettings.showResolution!
    showPixelClock.value = defaultSettings.showPixelClock!
    showBaudRate.value = defaultSettings.showBaudRate!
    showTargetMousePosition.value = defaultSettings.showTargetMousePosition!
    showPointerPosition.value = defaultSettings.showPointerPosition!
    showCenterButton.value = defaultSettings.showCenterButton!
    persistSettings()
  }

  return {
    showMouseStatus,
    showResolution,
    showPixelClock,
    showBaudRate,
    showTargetMousePosition,
    showPointerPosition,
    showCenterButton,
    allEnabled,
    someEnabled,
    setShowMouseStatus,
    setShowResolution,
    setShowPixelClock,
    setShowBaudRate,
    setShowTargetMousePosition,
    setShowPointerPosition,
    setShowCenterButton,
    toggleAll,
    resetAll,
  }
}
