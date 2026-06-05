/**
 * Serial protocol constants and helpers for the CH9329/CH32V208 HID chip.
 * Frame format: [0x57 0xAB] [addr] [cmd] [len] [data...] [checksum]
 */

export const FRAME_HEAD = new Uint8Array([0x57, 0xab])
export const FRAME_HEAD_0 = 0x57
export const FRAME_HEAD_1 = 0xab
export const DEFAULT_ADDR = 0x00

export const enum Command {
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

/** Data length for commands that have a fixed size */
export const CMD_LENGTH: Record<number, number | null> = {
  [Command.CMD_GET_INFO]: 0x00,
  [Command.CMD_SEND_KB_GENERAL_DATA]: 0x08,
  [Command.CMD_SEND_KB_MEDIA_DATA]: 0x02,
  [Command.CMD_SEND_MS_ABS_DATA]: 0x07,
  [Command.CMD_SEND_MS_REL_DATA]: 0x05,
  [Command.CMD_GET_PARA_CFG]: 0x00,
  [Command.CMD_SET_PARA_CFG]: 0x50,
  [Command.CMD_SET_DEFAULT_CFG]: 0x00,
  [Command.CMD_RESET]: 0x00,
  [Command.CMD_SWITCH_USB]: 0x05,
}

export const enum ResponseCommand {
  RESP_GET_INFO = 0x81,
  RESP_SEND_KB_GENERAL_DATA = 0x82,
  RESP_SEND_KB_MEDIA_DATA = 0x83,
  RESP_SEND_MS_ABS_DATA = 0x84,
  RESP_SEND_MS_REL_DATA = 0x85,
}

/** USB device identifiers */
export const USB = {
  /** Vendor ID for Openterface */
  VID: 0x1a86,
  /** MiniKVM (CH9329) product ID */
  MINIKVM_PID: 0x7523,
  /** KVMGo (CH32V208) product ID */
  KVMGO_PID: 0xfe0c,
  /** Factory/default baudrate */
  FACTORY_BAUDRATE: 9600,
  /** MiniKVM baudrate */
  MINIKVM_BAUDRATE: 115200,
  /** KVMGo baudrate */
  KVMGO_BAUDRATE: 9600,
} as const

/**
 * Compute the CH9329 checksum for a buffer.
 */
export function checksum(data: Uint8Array): number {
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum & 0xff
}

/**
 * Format a Uint8Array as uppercase hex string (for debugging).
 */
export function hexDump(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ')
}

/**
 * Build a frame with header, address, command, data and checksum.
 */
export function buildFrame(cmd: number, data: Uint8Array): Uint8Array {
  const frame = new Uint8Array(5 + data.length)
  frame[0] = FRAME_HEAD_0
  frame[1] = FRAME_HEAD_1
  frame[2] = DEFAULT_ADDR
  frame[3] = cmd
  frame[4] = data.length
  frame.set(data, 5)
  frame[frame.length - 1] = checksum(frame.subarray(0, frame.length - 1))
  return frame
}

/**
 * Build a query frame (no data).
 */
export function buildQuery(cmd: number): Uint8Array {
  const frame = new Uint8Array(6)
  frame[0] = FRAME_HEAD_0
  frame[1] = FRAME_HEAD_1
  frame[2] = DEFAULT_ADDR
  frame[3] = cmd
  frame[4] = 0x00
  frame[5] = checksum(frame.subarray(0, 5))
  return frame
}

/**
 * Frame parser state machine for parsing incoming serial data.
 */
export class FrameParser {
  private buffer: number[] = []

  /** Feed bytes into the parser. Returns complete frames. */
  feed(data: Uint8Array): Uint8Array[] {
    this.buffer.push(...data)
    const frames: Uint8Array[] = []

    while (true) {
      const frame = this.tryExtractFrame()
      if (!frame) break
      frames.push(frame)
    }

    return frames
  }

  private tryExtractFrame(): Uint8Array | null {
    // Find header
    let headerIdx = -1
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i] === FRAME_HEAD_0 && this.buffer[i + 1] === FRAME_HEAD_1) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) {
      this.buffer = []
      return null
    }

    // Discard bytes before header
    if (headerIdx > 0) {
      this.buffer = this.buffer.slice(headerIdx)
    }

    // Need at least 5 bytes for header + addr + cmd + len + checksum
    if (this.buffer.length < 6) return null

    const dataLen = this.buffer[4]
    const totalLen = 5 + dataLen + 1 // header(5) + data + checksum

    if (this.buffer.length < totalLen) return null

    const frame = new Uint8Array(this.buffer.slice(0, totalLen))
    this.buffer = this.buffer.slice(totalLen)

    // Validate checksum
    const expected = checksum(frame.subarray(0, totalLen - 1))
    if (frame[totalLen - 1] !== expected) {
      console.warn('[Serial] Discarding frame with bad checksum:', hexDump(frame))
      return null
    }

    return frame
  }
}
