/// <reference types="w3c-web-serial" />

import { ref, computed } from 'vue'
import { SerialState, type DeviceInfo } from '../types/serial'
import { USB, FrameParser, Command, hexDump } from '../utils/serial'

// Module-level shared state so all callers see the same values
export const serialPort = ref<SerialPort | null>(null)
let writer: WritableStreamDefaultWriter | null = null
let readLoopRunning = false

const state = ref<SerialState>(SerialState.Disconnected)
const deviceInfo = ref<DeviceInfo | null>(null)
const logLines = ref<string[]>([])
const logEnabled = ref(false)
const baudrate = ref(0)

const parser = new FrameParser()

let reader: ReadableStreamDefaultReader | null = null

export function useSerial() {
  const isConnected = computed(() => state.value === SerialState.Connected)

  async function connect(): Promise<boolean> {
    if (state.value !== SerialState.Disconnected) return false
    if (!('serial' in navigator)) {
      log('WebSerial API not available')
      return false
    }

    state.value = SerialState.Opening
    log('Requesting serial port...')

    try {
      const ports = await navigator.serial.getPorts()
      if (ports.length > 0) {
        log(`Reusing existing port (${ports.length} available)`)
        serialPort.value = ports[0]
      } else {
        serialPort.value = await navigator.serial.requestPort({
          filters: [{ usbVendorId: USB.VID }],
        })
      }

      if (!serialPort.value) {
        log('No port selected')
        state.value = SerialState.Disconnected
        return false
      }

      const info = serialPort.value.getInfo()
      log(`USB Product ID: 0x${info.usbProductId?.toString(16) ?? 'unknown'}`)

      let baud: number
      // Use existing baudrate if already set (for baudrate switching), otherwise default to 115200
      if (baudrate.value > 0) {
        baud = baudrate.value
      } else {
        baud = USB.MINIKVM_BAUDRATE
      }

      await serialPort.value.open({ baudRate: baud })
      log(`Connected at ${baud} baud`)
      baudrate.value = baud

      writer = serialPort.value.writable!.getWriter()

      state.value = SerialState.Connected
      startReadLoop()

      await writeQuery(Command.CMD_GET_INFO)

      return true
    } catch (err) {
      log(`Connection error: ${err}`)
      state.value = SerialState.Disconnected
      serialPort.value = null
      return false
    }
  }

  async function disconnect(): Promise<void> {
    state.value = SerialState.Disconnected
    readLoopRunning = false

    // Cancel the reader to unblock any pending read() call
    if (reader) {
      try {
        await reader.cancel()
      } catch {
        /* ignore */
      }
      reader = null
    }

    if (writer) {
      try {
        await writer.releaseLock()
      } catch {
        /* ignore */
      }
      writer = null
    }

    if (serialPort.value) {
      try {
        await serialPort.value.close()
      } catch {
        /* ignore */
      }
      serialPort.value = null
    }

    deviceInfo.value = null
    baudrate.value = 0
    log('Disconnected')
  }

  async function setBaudrate(newBaud: number): Promise<boolean> {
    await disconnect()
    baudrate.value = newBaud
    // Wait for port to fully close
    await new Promise(r => setTimeout(r, 200))
    // Reconnect at new baudrate — connect() will use baudrate.value if set
    return connect()
  }

  async function write(data: Uint8Array): Promise<void> {
    if (!writer || state.value !== SerialState.Connected) {
      log(`Cannot write: state=${state.value}, writer=${!!writer}`)
      return
    }
    try {
      log(`TX: ${hexDump(data)}`)
      await writer.write(data)
    } catch (err) {
      log(`Write error: ${err}`)
    }
  }

  async function writeQuery(cmd: number): Promise<void> {
    if (state.value !== SerialState.Connected) return
    const frame = new Uint8Array(6)
    frame[0] = 0x57
    frame[1] = 0xab
    frame[2] = 0x00
    frame[3] = cmd
    frame[4] = 0x00
    frame[5] = computeChecksum(frame.subarray(0, 5))
    await write(frame)
  }

  function startReadLoop(): void {
    if (!serialPort.value?.readable) return
    readLoopRunning = true

    reader = serialPort.value.readable.getReader()

    async function loop(): Promise<void> {
      try {
        while (readLoopRunning) {
          const { value, done } = await reader!.read()
          if (done) break
          if (!value) continue

          const frames = parser.feed(value)
          for (const frame of frames) {
            handleFrame(frame)
          }
        }
      } catch (err) {
        if (readLoopRunning) {
          log(`Read error: ${err}`)
        }
      } finally {
        try {
          reader!.releaseLock()
        } catch {
          /* ignore */
        }
      }
    }

    loop()
  }

  function handleFrame(frame: Uint8Array): void {
    log(`RX: ${hexDump(frame)}`)

    const cmd = frame[3]

    // CMD_GET_INFO response = 0x81
    if (cmd === 0x81 && frame.length >= 9) {
      const version = frame[5].toString(16)
      const targetConnected = frame[6] === 1
      const lockByte = frame[7]
      const scrollLock = (lockByte & 0x01) !== 0
      const capsLock = (lockByte & 0x02) !== 0
      const numLock = (lockByte & 0x04) !== 0

      deviceInfo.value = {
        firmwareVersion: `1.${version}`,
        targetConnected,
        numLock,
        capsLock,
        scrollLock,
      }

      log(`Device: CH9329 v1.${version} | Target: ${targetConnected ? 'connected' : 'disconnected'} | NL:${numLock} CL:${capsLock} SL:${scrollLock}`)
    }
  }

  async function queryDeviceInfo(): Promise<void> {
    await writeQuery(Command.CMD_GET_INFO)
  }

  function computeChecksum(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return sum & 0xff
  }

  function log(msg: string): void {
    if (logEnabled.value) {
      console.log(`[Serial] ${msg}`)
    }
    logLines.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
    if (logLines.value.length > 200) logLines.value.shift()
  }

  return {
    state,
    deviceInfo,
    logLines,
    logEnabled,
    baudrate,
    isConnected,
    connect,
    disconnect,
    write,
    writeQuery,
    setBaudrate,
    queryDeviceInfo,
  }
}
