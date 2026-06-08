export enum SerialState {
  Disconnected = 'disconnected',
  Opening = 'opening',
  Connected = 'connected',
}

export type DeviceGeneration = 'gen1' | 'gen2' | 'gen3' | 'v3' | 'unknown'

export const enum SerialCommand {
  CMD_GET_INFO = 0x01,
  CMD_SEND_KB_GENERAL_DATA = 0x02,
  CMD_SEND_KB_MEDIA_DATA = 0x03,
  CMD_SEND_MS_ABS_DATA = 0x04,
  CMD_SEND_MS_REL_DATA = 0x05,
  CMD_GET_PARA_CFG = 0x08,
  CMD_SET_PARA_CFG = 0x09,
  CMD_SET_DEFAULT_CFG = 0x0C,
  CMD_RESET = 0x0F,
  CMD_SWITCH_USB = 0x17,
}

export interface DeviceInfo {
  firmwareVersion: string
  targetConnected: boolean
  numLock: boolean
  capsLock: boolean
  scrollLock: boolean
}
