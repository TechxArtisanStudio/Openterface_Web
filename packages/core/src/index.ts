/**
 * @openterface/core - Shared types and utilities for Openterface Web.
 *
 * Provides shared interfaces for transport, device state, and WASM loading
 * used by both @openterface/usb and @openterface/webrtc packages.
 */

import type { InjectionKey, Ref } from 'vue'

/** Transport connection state */
export enum TransportState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

/** Device information exposed by a transport */
export interface TransportDeviceInfo {
  name: string
  firmwareVersion?: string
  targetConnected: boolean
  numLock: boolean
  capsLock: boolean
  scrollLock: boolean
}

/** HID transport interface used by control UI composables */
export interface HIDTransport {
  state: Ref<TransportState>
  deviceInfo: Ref<TransportDeviceInfo | null>
  isConnected: Ref<boolean>
  connect(): Promise<boolean>
  disconnect(): Promise<void>
  write(data: Uint8Array): Promise<void>
  queryDeviceInfo?(): Promise<void>
}

/** Vue injection key for the active HID transport */
export const HIDTransportKey: InjectionKey<HIDTransport> = Symbol('HIDTransport')

/** Load the Core WASM module (openterface.js) */
export async function loadWasm(): Promise<void> {
  if (typeof window === 'undefined') return
  if ((window as any).createOpenterfaceModule) return // already loaded

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'openterface.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load openterface.js'))
    document.head.appendChild(script)
  })
}

/** HID command helpers (injected by transport implementations) */
export interface HidCommands {
  sendMouseAbsolute(button: number, x: number, y: number, wheel: number): void
}

export const HidCommandsKey: InjectionKey<HidCommands> = Symbol('HidCommands')

/** HID command builders — transport-agnostic composable */
export { useHidCommands } from './useHidCommands'

/** Paste text composable — transport-agnostic */
export { usePasteText } from './usePasteText'

/** Viewer keyboard composable — transport-agnostic */
export { useViewerKeyboard } from './useViewerKeyboard'
