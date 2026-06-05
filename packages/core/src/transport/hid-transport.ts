import type { InjectionKey, Ref, ComputedRef } from 'vue'

export enum TransportState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

export interface TransportDeviceInfo {
  firmwareVersion: string
  targetConnected: boolean
  numLock: boolean
  capsLock: boolean
  scrollLock: boolean
}

/**
 * Abstract HID transport interface.
 * Both USB (Web Serial) and WebRTC (DataChannel) implement this.
 */
export interface HIDTransport {
  /** Current connection state */
  readonly state: Ref<TransportState>
  /** Device info from HID chip */
  readonly deviceInfo: Ref<TransportDeviceInfo | null>
  /** Whether currently connected */
  readonly isConnected: ComputedRef<boolean>
  /** Connect to the transport */
  connect(): Promise<boolean>
  /** Disconnect from the transport */
  disconnect(): Promise<void>
  /** Write raw CH9329 frame data */
  write(data: Uint8Array): Promise<void>
  /** Query device info (sends CMD_GET_INFO) */
  queryDeviceInfo(): Promise<void>
}

/** Vue injection key for HIDTransport */
export const HIDTransportKey: InjectionKey<HIDTransport> = Symbol('HIDTransport')
