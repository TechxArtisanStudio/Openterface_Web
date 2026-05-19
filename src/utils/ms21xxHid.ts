export type UsbModeValue = 'host' | 'target'
export type Ms21xxKind = 'MS2109' | 'MS2109S' | 'MS2130S'

export interface Ms21xxUsbModeDetails {
  mode: UsbModeValue
  chipKind: Ms21xxKind
  gpio0Value: number | null
  spdifoutValue: number
  firmwareVersionCode: number | null
  enabledBit: number
  clearMask: number
  usedFallbackBitDetection: boolean
  usedGpio0Fallback: boolean
}

export interface Ms21xxWebHidDevice {
  vendorId: number
  productId: number
  productName?: string
  opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>
  receiveFeatureReport?(reportId: number): Promise<DataView>
  getFeatureReport?(reportId: number): Promise<DataView>
}

interface ReadAttempt {
  reportId: number
  reportSize: number
  dataIndex: number
}

interface WriteAttempt {
  reportId: number
  reportSize: number
}

interface RegisterSet {
  gpio0: number
  spdifout: number
  firmwareVersion: [number, number, number, number]
}

const XDATA_READ_COMMAND = 0xb5
const XDATA_WRITE_COMMAND = 0xb6
const REPORT_SHORT_SIZE = 9
const REPORT_EXT_SIZE = 11
const REPORT_LARGE_SIZE = 65
const LEGACY_FIRMWARE_THRESHOLD = 24081309

const FILTERS = [
  { vendorId: 0x534d, productId: 0x2109 },
  { vendorId: 0x345f, productId: 0x2109 },
  { vendorId: 0x345f, productId: 0x2132 },
] as const

const READ_ATTEMPTS: Record<Ms21xxKind, ReadAttempt[]> = {
  MS2109: [
    { reportId: 0x00, reportSize: REPORT_SHORT_SIZE, dataIndex: 4 },
    { reportId: 0x01, reportSize: REPORT_SHORT_SIZE, dataIndex: 4 },
  ],
  MS2109S: [
    { reportId: 0x00, reportSize: REPORT_EXT_SIZE, dataIndex: 4 },
    { reportId: 0x01, reportSize: REPORT_EXT_SIZE, dataIndex: 4 },
    { reportId: 0x00, reportSize: REPORT_LARGE_SIZE, dataIndex: 4 },
  ],
  MS2130S: [
    { reportId: 0x01, reportSize: REPORT_EXT_SIZE, dataIndex: 4 },
    { reportId: 0x00, reportSize: REPORT_EXT_SIZE, dataIndex: 4 },
    { reportId: 0x00, reportSize: REPORT_LARGE_SIZE, dataIndex: 4 },
  ],
}

const WRITE_ATTEMPTS: Record<Ms21xxKind, WriteAttempt[]> = {
  MS2109: [
    { reportId: 0x00, reportSize: REPORT_SHORT_SIZE },
    { reportId: 0x01, reportSize: REPORT_SHORT_SIZE },
  ],
  MS2109S: [
    { reportId: 0x00, reportSize: REPORT_SHORT_SIZE },
    { reportId: 0x00, reportSize: REPORT_EXT_SIZE },
  ],
  MS2130S: [
    { reportId: 0x01, reportSize: REPORT_EXT_SIZE },
    { reportId: 0x00, reportSize: REPORT_EXT_SIZE },
    { reportId: 0x00, reportSize: REPORT_LARGE_SIZE },
  ],
}

const REGISTER_SETS: Record<Ms21xxKind, RegisterSet> = {
  MS2109: {
    gpio0: 0xdf00,
    spdifout: 0xdf01,
    firmwareVersion: [0xcbdc, 0xcbdd, 0xcbde, 0xcbdf],
  },
  MS2109S: {
    gpio0: 0x0000,
    spdifout: 0x0000,
    firmwareVersion: [0xcbdc, 0xcbdd, 0xcbde, 0xcbdf],
  },
  MS2130S: {
    gpio0: 0xdf00,
    spdifout: 0xdf01,
    firmwareVersion: [0x1fdc, 0x1fdd, 0x1fde, 0x1fdf],
  },
}

export function getMs21xxHidFilters(): Array<{ vendorId: number; productId: number }> {
  return FILTERS.map((filter) => ({ ...filter }))
}

export function detectMs21xxKind(device: Ms21xxWebHidDevice): Ms21xxKind | null {
  if (device.vendorId === 0x534d && device.productId === 0x2109) return 'MS2109'
  if (device.vendorId === 0x345f && device.productId === 0x2109) return 'MS2109S'
  if (device.vendorId === 0x345f && device.productId === 0x2132) return 'MS2130S'
  return null
}

export function pickMs21xxHidDevice(devices: Ms21xxWebHidDevice[]): Ms21xxWebHidDevice | null {
  for (const filter of FILTERS) {
    const match = devices.find((device) => device.vendorId === filter.vendorId && device.productId === filter.productId)
    if (match) return match
  }
  return null
}

export async function ensureMs21xxHidOpen(device: Ms21xxWebHidDevice): Promise<void> {
  if (!device.opened) {
    await device.open()
  }
}

export async function readMs21xxUsbMode(device: Ms21xxWebHidDevice): Promise<UsbModeValue> {
  const details = await readMs21xxUsbModeDetails(device)
  return details.mode
}

export async function readMs21xxUsbModeDetails(device: Ms21xxWebHidDevice): Promise<Ms21xxUsbModeDetails> {
  const kind = requireMs21xxKind(device)
  const registers = REGISTER_SETS[kind]
  if (registers.spdifout === 0) {
    throw new Error(`${kind} does not expose USB mode register access`)
  }

  await ensureMs21xxHidOpen(device)
  const bits = await getUsbModeBits(device, kind)
  const gpio0Value = registers.gpio0 !== 0 ? await readRegister(device, kind, registers.gpio0) : null
  const spdifoutValue = await readRegister(device, kind, registers.spdifout)
  const primaryTarget = (spdifoutValue & bits.enabledBit) !== 0
  const fallbackTarget = (spdifoutValue & 0x11) !== 0
  const usedFallbackBitDetection = !primaryTarget && fallbackTarget
  const gpio0SuggestsTarget = kind === 'MS2109' && gpio0Value === 0x01
  const usedGpio0Fallback = !primaryTarget && !usedFallbackBitDetection && gpio0SuggestsTarget

  return {
    mode: primaryTarget || usedFallbackBitDetection || usedGpio0Fallback ? 'target' : 'host',
    chipKind: kind,
    gpio0Value,
    spdifoutValue,
    firmwareVersionCode: bits.firmwareVersionCode,
    enabledBit: bits.enabledBit,
    clearMask: bits.clearMask,
    usedFallbackBitDetection,
    usedGpio0Fallback,
  }
}

export async function writeMs21xxUsbMode(device: Ms21xxWebHidDevice, mode: UsbModeValue): Promise<void> {
  const kind = requireMs21xxKind(device)
  const registers = REGISTER_SETS[kind]
  if (registers.spdifout === 0) {
    throw new Error(`${kind} does not expose USB mode register access`)
  }

  await ensureMs21xxHidOpen(device)
  const bits = await getUsbModeBits(device, kind)
  const currentValue = await readRegister(device, kind, registers.spdifout)

  for (const strategy of buildWriteStrategies(bits)) {
    const nextValue = mode === 'target'
      ? (currentValue | strategy.enabledBit)
      : (currentValue & strategy.clearMask)

    await writeRegister(device, kind, registers.spdifout, nextValue)
    const verify = await readMs21xxUsbModeDetails(device)
    if (verify.mode === mode) {
      return
    }
  }

  throw new Error(`Failed to set USB mode ${mode} via ${kind} HID register writes`)
}

async function getUsbModeBits(device: Ms21xxWebHidDevice, kind: Ms21xxKind): Promise<{ enabledBit: number; clearMask: number; firmwareVersionCode: number | null }> {
  const versionCode = await tryReadFirmwareVersionCode(device, kind)
  if (versionCode !== null && versionCode < LEGACY_FIRMWARE_THRESHOLD) {
    return { enabledBit: 0x10, clearMask: 0xef, firmwareVersionCode: versionCode }
  }
  return { enabledBit: 0x01, clearMask: 0xfe, firmwareVersionCode: versionCode }
}

function buildWriteStrategies(bits: { enabledBit: number; clearMask: number; firmwareVersionCode: number | null }): Array<{ enabledBit: number; clearMask: number }> {
  const primary = { enabledBit: bits.enabledBit, clearMask: bits.clearMask }
  const alternate = bits.enabledBit === 0x10
    ? { enabledBit: 0x01, clearMask: 0xfe }
    : { enabledBit: 0x10, clearMask: 0xef }

  if (bits.firmwareVersionCode === null) {
    return [primary, alternate]
  }

  return [primary]
}

async function tryReadFirmwareVersionCode(device: Ms21xxWebHidDevice, kind: Ms21xxKind): Promise<number | null> {
  const [majorAddr, minorAddr, patchAddr, buildAddr] = REGISTER_SETS[kind].firmwareVersion
  if (majorAddr === 0 || minorAddr === 0 || patchAddr === 0 || buildAddr === 0) {
    return null
  }

  try {
    const major = await readRegister(device, kind, majorAddr)
    const minor = await readRegister(device, kind, minorAddr)
    const patch = await readRegister(device, kind, patchAddr)
    const build = await readRegister(device, kind, buildAddr)
    return major * 1000000 + minor * 10000 + patch * 100 + build
  } catch {
    return null
  }
}

async function readRegister(device: Ms21xxWebHidDevice, kind: Ms21xxKind, address: number): Promise<number> {
  let lastError: unknown = new Error('No compatible read attempt')

  for (const attempt of READ_ATTEMPTS[kind]) {
    try {
      const payload = new Uint8Array(attempt.reportSize - 1)
      payload[0] = XDATA_READ_COMMAND
      payload[1] = (address >> 8) & 0xff
      payload[2] = address & 0xff

      await device.sendFeatureReport(attempt.reportId, payload)
      const response = await receiveFeatureReportCompat(device, attempt.reportId)
      const bytes = new Uint8Array(response.buffer, response.byteOffset, response.byteLength)
      const valueOffset = bytes.length >= attempt.reportSize ? attempt.dataIndex : attempt.dataIndex - 1
      if (valueOffset < 0 || valueOffset >= bytes.length) {
        throw new Error(`Short feature report (${bytes.length} bytes)`)
      }
      return bytes[valueOffset]
    } catch (error) {
      lastError = error
    }
  }

  throw toError(lastError)
}

async function writeRegister(device: Ms21xxWebHidDevice, kind: Ms21xxKind, address: number, value: number): Promise<void> {
  let lastError: unknown = new Error('No compatible write attempt')

  for (const attempt of WRITE_ATTEMPTS[kind]) {
    try {
      const payload = new Uint8Array(attempt.reportSize - 1)
      payload[0] = XDATA_WRITE_COMMAND
      payload[1] = (address >> 8) & 0xff
      payload[2] = address & 0xff
      payload[3] = value & 0xff
      await device.sendFeatureReport(attempt.reportId, payload)
      return
    } catch (error) {
      lastError = error
    }
  }

  throw toError(lastError)
}

async function receiveFeatureReportCompat(device: Ms21xxWebHidDevice, reportId: number): Promise<DataView> {
  if (typeof device.receiveFeatureReport === 'function') {
    return device.receiveFeatureReport(reportId)
  }
  if (typeof device.getFeatureReport === 'function') {
    return device.getFeatureReport(reportId)
  }
  throw new Error('WebHID feature report reads are not supported by this browser')
}

function requireMs21xxKind(device: Ms21xxWebHidDevice): Ms21xxKind {
  const kind = detectMs21xxKind(device)
  if (!kind) {
    throw new Error(`Unsupported WebHID device 0x${device.vendorId.toString(16)}:0x${device.productId.toString(16)}`)
  }
  return kind
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
