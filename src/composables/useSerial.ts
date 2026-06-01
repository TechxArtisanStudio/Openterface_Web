/// <reference types="w3c-web-serial" />

import { ref, computed } from 'vue'
import { SerialState, type DeviceInfo, type DeviceGeneration } from '../types/serial'
import { GENERATIONS, FrameParser, Command, hexDump } from '../utils/serial'
import {
  detectMs21xxKind,
  ensureMs21xxHidOpen,
  getMs21xxHidFilters,
  pickMs21xxHidDevice,
  readMs21xxUsbModeDetails,
  writeMs21xxUsbMode,
  type Ms21xxWebHidDevice,
} from '../utils/ms21xxHid'

// Module-level shared state so all callers see the same values
export const serialPort = ref<SerialPort | null>(null)
let writer: WritableStreamDefaultWriter | null = null
let readLoopRunning = false

const state = ref<SerialState>(SerialState.Disconnected)
const deviceInfo = ref<DeviceInfo | null>(null)
const generation = ref<DeviceGeneration>('unknown')
const usbMode = ref<'host' | 'target' | 'unknown'>('unknown')
const logLines = ref<string[]>([])
const logEnabled = ref(true)
const baudrate = ref(0)
const usbProductId = ref<number | null>(null)
const usbModeHidDevice = ref<Ms21xxWebHidDevice | null>(null)
const usbModeBackend = ref<'serial' | 'hid' | 'unsupported'>('unsupported')
const usbSyncStatus = ref<'synced' | 'out-of-sync'>('synced')

const parser = new FrameParser()

let reader: ReadableStreamDefaultReader | null = null
let usbModePollTimer: number | null = null
let usbStatusQueryToken = 0
let lastUsbStatusResponseToken = 0
let usbStatusUnsupportedLogged = false
let lastKnownGpio0: boolean | null = null

export function useSerial() {
  const isConnected = computed(() => state.value === SerialState.Connected)

  /**
   * Distinguish Gen2/Gen3/V3 by checking for their WebHID capture chip.
   * All three share serial PID 0xFE0C, so we probe the HID device store.
   * MS2130S (345F:2132) = Gen3, MS2109S (345F:2109) = V3, no HID = Gen2.
   */
  async function detectGen2Gen3V3(): Promise<void> {
    const hid = getNavigatorHid()
    if (!hid) {
      // No WebHID API — default to Gen2 behavior (serial protocol)
      generation.value = 'gen2'
      return
    }

    try {
      const grantedDevices = ((await hid.getDevices()) as Ms21xxWebHidDevice[])
      for (const device of grantedDevices) {
        const kind = detectMs21xxKind(device)
        if (kind === 'MS2130S') {
          generation.value = 'gen3'
          return
        }
        if (kind === 'MS2109S') {
          generation.value = 'v3'
          return
        }
      }
      // No granted HID device yet — try to request one
      const requestedDevices = ((await hid.requestDevice({ filters: getMs21xxHidFilters() })) as Ms21xxWebHidDevice[])
      for (const device of requestedDevices) {
        const kind = detectMs21xxKind(device)
        if (kind === 'MS2130S') {
          generation.value = 'gen3'
          return
        }
        if (kind === 'MS2109S') {
          generation.value = 'v3'
          return
        }
      }
      // User cancelled the HID picker — fall back to Gen2 (serial-only)
      log('WebHID device selection cancelled or not granted; assuming Gen2')
      generation.value = 'gen2'
    } catch (err) {
      log(`HID generation detection failed: ${err}; assuming Gen2`)
      generation.value = 'gen2'
    }
  }

  async function connect(options?: { allowHidPrompt?: boolean }): Promise<boolean> {
    if (state.value !== SerialState.Disconnected) return false
    if (!('serial' in navigator)) {
      log('WebSerial API not available')
      return false
    }

    const allowHidPrompt = options?.allowHidPrompt ?? true

    state.value = SerialState.Opening
    log('Requesting serial port...')

    try {
      const ports = await navigator.serial.getPorts()
      if (ports.length > 0) {
        log(`Reusing existing port (${ports.length} available)`)
        serialPort.value = ports[0]
      } else {
        serialPort.value = await navigator.serial.requestPort()
      }

      if (!serialPort.value) {
        log('No port selected')
        state.value = SerialState.Disconnected
        return false
      }

      const info = serialPort.value.getInfo()
      usbProductId.value = info.usbProductId ?? null
      log(`USB Product ID: 0x${info.usbProductId?.toString(16) ?? 'unknown'}`)

      // Determine generation from serial product ID, then refine via WebHID for Gen2/Gen3
      if (info.usbProductId === GENERATIONS.GEN1.serialPid) {
        generation.value = 'gen1'
      } else if (info.usbProductId === GENERATIONS.GEN2.serialPid) {
        // Gen2, Gen3 and V3 share the same serial PID — distinguish via WebHID capture chip
        await detectGen2Gen3V3()
      }

      const genLabel = GENERATIONS[generation.value.toUpperCase() as keyof typeof GENERATIONS]?.label ?? generation.value
      log(`Device generation: ${genLabel}`)

      let baud: number
      if (baudrate.value > 0) {
        baud = baudrate.value
      } else if (generation.value === 'gen1') {
        baud = GENERATIONS.GEN1.baudrate
      } else {
        baud = GENERATIONS.GEN2.baudrate
      }

      await serialPort.value.open({ baudRate: baud })
      log(`Connected at ${baud} baud`)
      baudrate.value = baud

      writer = serialPort.value.writable!.getWriter()

      state.value = SerialState.Connected
      startReadLoop()

      if (generation.value === 'gen1') {
        log('Gen1: serial CMD_SWITCH_USB not available; USB mode via MS2109 WebHID')
        await ensureUsbModeHid(allowHidPrompt)
      } else if (generation.value === 'gen3' || generation.value === 'v3') {
        const chip = generation.value === 'gen3' ? 'MS2130S' : 'MS2109S'
        log(`${generation.value.toUpperCase()} (${chip}): USB mode via WebHID`)
        await ensureUsbModeHid(allowHidPrompt)
      } else {
        log('Gen2: using 9600 baud, USB mode via serial 0x97 protocol')
      }

      await queryDeviceInfo()
      await queryUsbStatus()
      startUsbModePolling()

      return true
    } catch (err) {
      stopUsbModePolling()
      await closeUsbModeHid()
      log(`Connection error: ${err}`)
      state.value = SerialState.Disconnected
      serialPort.value = null
      return false
    }
  }

  async function disconnect(): Promise<void> {
    state.value = SerialState.Disconnected
    readLoopRunning = false
    stopUsbModePolling()

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
        writer.releaseLock()
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

    await closeUsbModeHid()

    deviceInfo.value = null
    generation.value = 'unknown'
    usbMode.value = 'unknown'
    baudrate.value = 0
    usbProductId.value = null
    usbModeBackend.value = 'unsupported'
    usbSyncStatus.value = 'synced'
    usbStatusUnsupportedLogged = false
    lastKnownGpio0 = null
    log('Disconnected')
  }

  async function setBaudrate(newBaud: number): Promise<boolean> {
    await disconnect()
    baudrate.value = newBaud
    // Wait for port to fully close
    await new Promise(r => setTimeout(r, 200))
    // Reconnect at new baudrate — connect() will use baudrate.value if set
    return connect({ allowHidPrompt: false })
  }

  async function write(data: Uint8Array): Promise<void> {
    if (!writer || state.value !== SerialState.Connected) {
      log(`Cannot write: state=${state.value}, writer=${!!writer}`)
      console.warn('[Serial] write BLOCKED: state=', state.value, 'writer=', !!writer)
      return
    }
    try {
      log(`TX len=${data.length} cmd=0x${data[3]?.toString(16).padStart(2, '0') ?? '--'} data=${hexDump(data)}`)
      await writer.write(data)
    } catch (err) {
      log(`Write error: ${err}`)
      console.error('[Serial] Write error:', err)
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

          log(`RX chunk len=${value.length}: ${hexDump(value)}`)
          const frames = parser.feed(value)
          if (frames.length === 0) {
            log('RX chunk parsed 0 complete frame(s)')
          } else {
            log(`RX chunk parsed ${frames.length} complete frame(s)`)
          }
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
    log(`RX frame len=${frame.length} cmd=0x${frame[3]?.toString(16).padStart(2, '0') ?? '--'} data=${hexDump(frame)}`)

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
      return
    }

    if (cmd === 0x97 && frame.length >= 7) {
      lastUsbStatusResponseToken = usbStatusQueryToken
      const modeByte = frame[5]
      if (modeByte === 0x00) {
        usbMode.value = 'host'
        log('USB mode: host')
      } else if (modeByte === 0x01) {
        usbMode.value = 'target'
        log('USB mode: target')
      } else {
        usbMode.value = 'unknown'
        log(`USB mode: unknown (0x${modeByte.toString(16).padStart(2, '0')})`)
      }
      return
    }

    log(`Unhandled RX frame cmd=0x${cmd.toString(16).padStart(2, '0')}`)
  }

  async function queryDeviceInfo(): Promise<void> {
    await writeQuery(Command.CMD_GET_INFO)
  }

  async function queryUsbStatus(): Promise<void> {
    if (state.value !== SerialState.Connected) return
    if (supportsSerialUsbModeQuery()) {
      usbStatusQueryToken += 1
      const currentToken = usbStatusQueryToken
      const frame = new Uint8Array(11)
      frame[0] = 0x57
      frame[1] = 0xab
      frame[2] = 0x00
      frame[3] = Command.CMD_SWITCH_USB
      frame[4] = 0x05
      frame[5] = 0x00
      frame[6] = 0x00
      frame[7] = 0x00
      frame[8] = 0x00
      frame[9] = 0x03
      frame[10] = computeChecksum(frame.subarray(0, 10))
      log(`USB status query #${currentToken} scheduled`)
      await write(frame)

      window.setTimeout(() => {
        if (currentToken > lastUsbStatusResponseToken && state.value === SerialState.Connected) {
          log(`USB status query #${currentToken} timed out: no 0x97 response received`)
        }
      }, 800)
      return
    }

    const hidReady = await ensureUsbModeHid(false)
    if (!hidReady || !usbModeHidDevice.value) {
      if (!usbStatusUnsupportedLogged) {
        log('Skipping USB status query: Gen1/Gen3 requires WebHID permission to read Host/Target state')
        usbStatusUnsupportedLogged = true
      }
      usbModeBackend.value = 'unsupported'
      usbMode.value = 'unknown'
      return
    }

    try {
      const details = await readMs21xxUsbModeDetails(usbModeHidDevice.value)
      usbMode.value = details.mode
      usbModeBackend.value = 'hid'

      // Detect sync status between hardware switch (GPIO0) and software control (SPDIFOUT)
      const gpio0Target = details.gpio0Value === 0x01
      if (details.gpio0Value !== null && lastKnownGpio0 !== null && lastKnownGpio0 !== gpio0Target) {
        // Hardware switch moved — sync SPDIFOUT to match
        log(`Hardware switch moved (GPIO0 ${lastKnownGpio0 ? 'target' : 'host'} → ${gpio0Target ? 'target' : 'host'}), syncing SPDIFOUT`)
        try {
          await writeMs21xxUsbMode(usbModeHidDevice.value, gpio0Target ? 'target' : 'host')
          log('SPDIFOUT synced to hardware switch')
        } catch (err) {
          log(`SPDIFOUT sync failed: ${err}`)
        }
      }
      lastKnownGpio0 = gpio0Target

      const spdifoutSet = (details.spdifoutValue & details.enabledBit) !== 0
      const synced = details.gpio0Value === null || gpio0Target === spdifoutSet
      usbSyncStatus.value = synced ? 'synced' : 'out-of-sync'

      log(`USB mode: ${details.mode} | chip=${details.chipKind} | GPIO0[0x${details.gpio0Addr.toString(16)}]=0x${details.gpio0Value === null ? 'n/a' : details.gpio0Value.toString(16)} | SPDIFOUT[0x${details.spdifoutAddr.toString(16)}]=0x${details.spdifoutValue.toString(16)} | sync=${usbSyncStatus.value} | fw=${details.firmwareVersionCode ?? 'unknown'} | bit=0x${details.enabledBit.toString(16)}${details.usedFallbackBitDetection ? ' | fallback-bit-detect' : ''}`)
    } catch (err) {
      usbMode.value = 'unknown'
      usbModeBackend.value = 'unsupported'
      log(`USB mode read via WebHID failed: ${err}`)
    }
  }

  async function setUsbMode(nextMode: 'host' | 'target'): Promise<boolean> {
    if (state.value !== SerialState.Connected) {
      return false
    }

    if (supportsSerialUsbModeQuery()) {
      const frame = new Uint8Array(11)
      frame[0] = 0x57
      frame[1] = 0xab
      frame[2] = 0x00
      frame[3] = Command.CMD_SWITCH_USB
      frame[4] = 0x05
      frame[5] = 0x00
      frame[6] = 0x00
      frame[7] = 0x00
      frame[8] = 0x00
      frame[9] = nextMode === 'target' ? 0x01 : 0x00
      frame[10] = computeChecksum(frame.subarray(0, 10))
      log(`USB mode set via serial: ${nextMode}`)
      await write(frame)
      window.setTimeout(() => {
        void queryUsbStatus()
      }, 120)
      return true
    }

    const hidReady = await ensureUsbModeHid(true)
    if (!hidReady || !usbModeHidDevice.value) {
      log('Cannot set USB mode: WebHID companion not connected')
      return false
    }

    try {
      await writeMs21xxUsbMode(usbModeHidDevice.value, nextMode)
      usbModeBackend.value = 'hid'
      log(`USB mode set via WebHID: ${nextMode}`)
      await queryUsbStatus()
      return true
    } catch (err) {
      log(`USB mode set via WebHID failed: ${err}`)
      return false
    }
  }

  async function requestUsbModeHidPermission(): Promise<boolean> {
    if (generation.value !== 'gen1' && generation.value !== 'gen3' && generation.value !== 'v3') {
      return false
    }

    const hidReady = await ensureUsbModeHid(true)
    if (!hidReady) {
      log('WebHID permission was not granted')
      return false
    }

    await queryUsbStatus()
    return true
  }

  function startUsbModePolling(): void {
    stopUsbModePolling()
    usbModePollTimer = window.setInterval(() => {
      void queryUsbStatus()
    }, 1500)
  }

  function stopUsbModePolling(): void {
    if (usbModePollTimer !== null) {
      window.clearInterval(usbModePollTimer)
      usbModePollTimer = null
    }
  }

  function computeChecksum(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    return sum & 0xff
  }

  function supportsSerialUsbModeQuery(): boolean {
    return generation.value !== 'gen1' && generation.value !== 'gen3'
  }

  async function ensureUsbModeHid(allowPrompt: boolean): Promise<boolean> {
    if (generation.value !== 'gen1' && generation.value !== 'gen3' && generation.value !== 'v3') {
      return false
    }

    const hid = getNavigatorHid()
    if (!hid) {
      if (!usbStatusUnsupportedLogged) {
        log('WebHID API not available: USB mode cannot be read in this browser')
        usbStatusUnsupportedLogged = true
      }
      return false
    }

    if (usbModeHidDevice.value) {
      try {
        await ensureMs21xxHidOpen(usbModeHidDevice.value)
        usbModeBackend.value = 'hid'
        return true
      } catch (err) {
        log(`Existing WebHID device reopen failed: ${err}`)
        usbModeHidDevice.value = null
      }
    }

    const grantedDevices = ((await hid.getDevices()) as Ms21xxWebHidDevice[])
    let nextDevice = pickMs21xxHidDevice(grantedDevices)

    if (!nextDevice && allowPrompt) {
      const requestedDevices = ((await hid.requestDevice({ filters: getMs21xxHidFilters() })) as Ms21xxWebHidDevice[])
      nextDevice = pickMs21xxHidDevice(requestedDevices)
    }

    if (!nextDevice) {
      return false
    }

    await ensureMs21xxHidOpen(nextDevice)
    usbModeHidDevice.value = nextDevice
    usbModeBackend.value = 'hid'
    usbStatusUnsupportedLogged = false
    log(`WebHID connected: ${detectMs21xxKind(nextDevice) ?? 'unknown'} 0x${nextDevice.vendorId.toString(16)}:0x${nextDevice.productId.toString(16)}`)
    return true
  }

  async function closeUsbModeHid(): Promise<void> {
    if (!usbModeHidDevice.value) {
      return
    }

    try {
      if (usbModeHidDevice.value.opened) {
        await usbModeHidDevice.value.close()
      }
    } catch {
      /* ignore */
    }

    usbModeHidDevice.value = null
  }

  function getNavigatorHid(): { getDevices(): Promise<unknown[]>; requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<unknown[]> } | null {
    const nav = navigator as Navigator & {
      hid?: {
        getDevices(): Promise<unknown[]>
        requestDevice(options: { filters: Array<{ vendorId: number; productId: number }> }): Promise<unknown[]>
      }
    }
    return nav.hid ?? null
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
    generation,
    usbMode,
    usbSyncStatus,
    logLines,
    logEnabled,
    baudrate,
    usbProductId,
    usbModeBackend,
    isConnected,
    connect,
    disconnect,
    write,
    writeQuery,
    setBaudrate,
    queryDeviceInfo,
    queryUsbStatus,
    setUsbMode,
    requestUsbModeHidPermission,
  }
}
