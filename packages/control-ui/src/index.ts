// Control UI exports for @openterface/control-ui

// Components - Layout
export { default as Layout } from './components/layout/Layout.vue'
export { default as TopBar } from './components/layout/TopBar.vue'
export { default as BottomBar } from './components/layout/BottomBar.vue'
export { default as StatusBar } from './components/layout/StatusBar.vue'

// Components - Video
export { default as VideoStream } from './components/video/VideoStream.vue'
export { default as CameraSelector } from './components/video/CameraSelector.vue'

// Components - Input
export { default as ModifierLocks } from './components/input/ModifierLocks.vue'

// Components - Paste
export { default as PasteTextDialog } from './components/paste/PasteTextDialog.vue'

// Components - Settings
export { default as SettingsModal } from './components/settings/SettingsModal.vue'
export { default as BrowserWarningModal } from './components/settings/BrowserWarningModal.vue'

// Components - USB
export { default as HostTargetToggle } from './components/usb/HostTargetToggle.vue'

// Composables
export { useBrowserDetection } from './composables/useBrowserDetection'
export { useDeviceState } from './composables/useDeviceState'
export { useViewerMouse } from './composables/useViewerMouse'
