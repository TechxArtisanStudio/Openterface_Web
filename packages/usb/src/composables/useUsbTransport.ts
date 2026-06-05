/// <reference types="w3c-web-serial" />

import { ref, computed } from 'vue'
import {
  TransportState,
  type TransportDeviceInfo,
  type HIDTransport,
  Command,
  FrameParser,
  USB,
  hexDump,
} from '@openterface/core'

// Module-level shared state
const serialPort = ref<SerialPort | null>(null)
let writer: WritableStreamDefaultWriter | null = null
let readLoopRunning = false

const state = ref<TransportState>(TransportState.Disconnected)
const deviceInfo = ref<TransportDeviceInfo | null>(null)
const logLines = ref<string[]>([])
const logEnabled = ref(false)
const baudrate = ref(0)

const parser = new FrameParser()

let reader: ReadableStreamDefaultReader | null = null

/** USB transport implementation using Web Serial API */
export function useUsbTransport(): HIDTransport {
  const isConnected = computed(() => state.value === TransportState.Connected)

  async function connect(): Promise<boolean> {
    if (state.value !== TransportState.Disconnected) return false
    if (!('serial' in navigator)) {
      log('WebSerial API not available')
      return false
    }

    state.value = TransportState.Connecting
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
        state.value = TransportState.Disconnected
        return false
      }

      const info = serialPort.value.getInfo()
      log(`USB Product ID: 0x${info.usbProductId?.toString(16) ?? 'unknown'}`)

      let baud = baudrate.value > 0 ? baudrate.value : USB.MINIKVM_BAUDRATE
      await serialPort.value.open({ baudRate: baud })
      log(`Connected at ${baud} baud`)
      baudrate.value = baud

      writer = serialPort.value.writable!.getWriter()

      state.value = TransportState.Connected
      startReadLoop()

      await writeQuery(Command.CMD_GET_INFO)

      return true
    } catch (err) {
      log(`Connection error: ${err}`)
      state.value = TransportState.Error
      serialPort.value = null
      return false
    }
  }

  async function disconnect(): Promise<void> {
    state.value = TransportState.Disconnected
    readLoopRunning = false

    if (reader) {
      try { await reader.cancel() } catch { /* ignore */ }
      reader = null
    }

    if (writer) {
      try { await writer.releaseLock() } catch { /* ignore */ }
      writer = null
    }

    if (serialPort.value) {
      try { await serialPort.value.close() } catch { /* ignore */ }
      serialPort.value = null
    }

    deviceInfo.value = null
    baudrate.value = 0
    log('Disconnected')
  }

  async function write(data: Uint8Array): Promise<void> {
    if (!writer || state.value !== TransportState.Connected) {
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
    if (state.value !== TransportState.Connected) return
    const frame = new Uint8Array(6)
    frame[0] = 0x57
    frame[1] = 0xab
    frame[2] = 0x00
    frame[3] = cmd
    frame[4] = 0x00
    frame[5] = computeChecksum(frame.subarray(0, 5))
    await write(frame)
  }

  async function queryDeviceInfo(): Promise<void> {
    await writeQuery(Command.CMD_GET_INFO)
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
        if (readLoopRunning) log(`Read error: ${err}`)
      } finally {
        try { reader!.releaseLock() } catch { /* ignore */ }
      }
    }
    loop()
  }

  function handleFrame(frame: Uint8Array): void {
    log(`RX: ${hexDump(frame)}`)

    const cmd = frame[3]
    if (cmd === 0x81 && frame.length >= 9) {
      const version = frame[5].toString(16)
      const targetConnected = frame[6] === 1
      const lockByte = frame[7]
      deviceInfo.value = {
        firmwareVersion: `1.${version}`,
        targetConnected,
        numLock: (lockByte & 0x04) !== 0,
        capsLock: (lockByte & 0x02) !== 0,
        scrollLock: (lockByte & 0x01) !== 0,
      }
      log(`Device: CH9329 v1.${version} | Target: ${targetConnected ? 'connected' : 'disconnected'}`)
    }
  }

  function computeChecksum(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return sum & 0xff
  }

  function log(msg: string): void {
    if (logEnabled.value) console.log(`[Serial] ${msg}`)
    logLines.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
    if (logLines.value.length > 200) logLines.value.shift()
  }

  return {
    state,
    deviceInfo,
    isConnected,
    connect,
    disconnect,
    write,
    queryDeviceInfo,
  }
}

// Exports for external access
export { serialPort, logLines, logEnabled, baudrate }
