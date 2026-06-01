/**
 * WASM loader for Openterface_Core unified API.
 * Loads the Emscripten-generated openterface.js at runtime via dynamic <script> injection.
 * All packet building, HID lookup, and input mapping use the Core op_* functions.
 */

export interface CoreWASM {
  /** Get HID usage code by key name (e.g. "Enter" → 0x28) */
  hidCode(keyName: string): number
  /** Get HID code + shift flag for a character */
  hidCodeForChar(c: string): { code: number; needsShift: boolean } | null
  /** Human-readable label for a HID code */
  hidCodeLabel(code: number): string
  /** Build a keyboard packet: modifiers + HID code → Uint8Array (14 bytes) */
  buildKeyboard(modifiers: number, keys: number[]): Uint8Array
  /** Build a press+release packet (press then release, 28 bytes) */
  buildPressRelease(modifiers: number, hidCode: number): Uint8Array
  /** Build a relative mouse packet */
  buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array
  /** Build an absolute mouse packet */
  buildMouseAbs(buttons: number, x: number, y: number, wheel: number): Uint8Array
  /** Build a USB mode switch packet (0x00 = host, 0x01 = target) */
  buildUsbSwitch(requestType: number): Uint8Array
  /** Parse a macro string into (hid_code, modifiers) pairs */
  parseMacro(input: string): Array<{ hidCode: number; modifiers: number }>
  /** Compute checksum for a packet */
  checksum(data: Uint8Array): number
  /** Map DOM KeyboardEvent.code to HID usage code */
  hidCodeFromDomCode(domCode: string): number
}

// Emscripten module type
interface EmscriptenModule {
  ccall(ident: string, returnType: string | null, argTypes: string[], args: any[]): any
  _malloc(size: number): number
  _free(ptr: number): void
  HEAPU8: Uint8Array
  HEAP32: Int32Array
}

type CreateModule = () => Promise<EmscriptenModule>

let coreMod: CoreWASM | null = null
let coreReady = false
let coreLoadPromise: Promise<CoreWASM> | null = null

export async function loadWasm(): Promise<CoreWASM> {
  if (coreMod) return coreMod
  if (coreLoadPromise) return coreLoadPromise

  coreLoadPromise = (async () => {
    console.log('[Core] loading openterface.js...')

    await loadScript('openterface.js')
    const createModule = (window as any).createOpenterfaceModule as CreateModule
    if (!createModule) {
      throw new Error('Emscripten module not found. openterface.js failed to load.')
    }

    const mod = await createModule()
    console.log('[Core] openterface instantiated')

    const { ccall, _malloc, _free } = mod
    const heapU8 = mod.HEAPU8 as Uint8Array
    const heapI32 = mod.HEAP32 as Int32Array

    if (!heapU8 || !heapI32) {
      console.error('[Core] HEAPU8:', heapU8, 'HEAP32:', heapI32)
      throw new Error('WASM heaps not available after module instantiation')
    }

    function writeString(str: string): number {
      const ptr = _malloc(str.length + 1)
      for (let i = 0; i < str.length; i++) {
        heapU8[ptr + i] = str.charCodeAt(i)
      }
      heapU8[ptr + str.length] = 0
      return ptr
    }

    function readString(ptr: number): string {
      let result = ''
      let i = 0
      while (true) {
        const c = heapU8[ptr + i]
        if (c === 0) break
        result += String.fromCharCode(c)
        i++
      }
      return result
    }

    coreMod = {
      hidCode(keyName: string): number {
        const ptr = writeString(keyName)
        const code = ccall('op_input_hid_code_from_name', 'number', ['number'], [ptr])
        _free(ptr)
        return code
      },

      hidCodeForChar(c: string): { code: number; needsShift: boolean } | null {
        if (c.length !== 1) return null
        const shiftPtr = _malloc(4)
        const code = ccall('op_input_hid_code_from_char', 'number', ['number', 'number'], [c.charCodeAt(0), shiftPtr])
        const needsShift = heapI32[shiftPtr >> 2] !== 0
        _free(shiftPtr)
        if (code < 0) return null
        return { code, needsShift }
      },

      hidCodeLabel(code: number): string {
        const ptr = ccall('op_input_hid_code_label', 'number', ['number'], [code])
        return readString(ptr)
      },

      buildKeyboard(modifiers: number, keys: number[]): Uint8Array {
        const outPtr = _malloc(14)
        const keysPtr = _malloc(keys.length * 4)
        for (let i = 0; i < keys.length; i++) {
          heapI32[(keysPtr >> 2) + i] = keys[i]
        }
        ccall('op_ch9329_build_keyboard_packet', null, ['number', 'number', 'number', 'number'], [outPtr, modifiers, keysPtr, Math.min(keys.length, 6)])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 14))
        _free(outPtr)
        _free(keysPtr)
        return result
      },

      buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array {
        const outPtr = _malloc(11)
        ccall('op_ch9329_build_mouse_rel_packet', null, ['number', 'number', 'number', 'number', 'number'], [outPtr, buttons, dx, dy, wheel])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 11))
        _free(outPtr)
        return result
      },

      buildMouseAbs(buttons: number, x: number, y: number, wheel: number): Uint8Array {
        const outPtr = _malloc(13)
        ccall('op_ch9329_build_mouse_abs_packet', null, ['number', 'number', 'number', 'number', 'number'], [outPtr, buttons, x, y, wheel])
        // C produces 13 bytes with a 0x01 protocol indicator at position 5.
        // CH9329 standard absolute mouse frame is 12 bytes without that indicator:
        //   57 AB 00 04 07 buttons x_lo x_hi y_lo y_hi wheel checksum
        // Overwrite to remove 0x01, shift data left, and truncate to 12 bytes.
        heapU8[outPtr + 4] = 0x07
        heapU8[outPtr + 5] = buttons
        heapU8[outPtr + 6] = x & 0xFF
        heapU8[outPtr + 7] = (x >> 8) & 0xFF
        heapU8[outPtr + 8] = y & 0xFF
        heapU8[outPtr + 9] = (y >> 8) & 0xFF
        heapU8[outPtr + 10] = wheel & 0xFF
        // Recalculate checksum for 12-byte packet (sum bytes 0..10)
        let sum = 0
        for (let i = 0; i < 11; i++) sum += heapU8[outPtr + i]
        heapU8[outPtr + 11] = sum & 0xFF
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 12))
        _free(outPtr)
        console.log('[Core] buildMouseAbs: btn=' + buttons, 'x=' + x, 'y=' + y, 'wheel=' + wheel, 'packet=' + Array.from(result).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '))
        return result
      },

      buildUsbSwitch(requestType: number): Uint8Array {
        const outPtr = _malloc(11)
        ccall('op_ch9329_build_usb_switch_packet', 'number', ['number', 'number'], [outPtr, requestType])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 11))
        _free(outPtr)
        return result
      },

      buildPressRelease(modifiers: number, hidCode: number): Uint8Array {
        const outPtr = _malloc(28)
        ccall('op_ch9329_build_press_release_packets', null, ['number', 'number', 'number'], [outPtr, modifiers, hidCode])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 28))
        _free(outPtr)
        return result
      },

      parseMacro(input: string): Array<{ hidCode: number; modifiers: number }> {
        const inputPtr = writeString(input)
        const max = input.length * 2
        const outPtr = _malloc(max * 8)
        const count = ccall('op_input_macro_parse', 'number', ['number', 'number', 'number'], [inputPtr, outPtr, max])
        const results: Array<{ hidCode: number; modifiers: number }> = []
        for (let i = 0; i < count; i++) {
          const offset = (outPtr >> 2) + i * 2
          results.push({
            hidCode: heapI32[offset],
            modifiers: heapI32[offset + 1],
          })
        }
        _free(inputPtr)
        _free(outPtr)
        return results
      },

      checksum(data: Uint8Array): number {
        const ptr = _malloc(data.length)
        for (let i = 0; i < data.length; i++) {
          heapU8[ptr + i] = data[i]
        }
        const result = ccall('op_ch9329_checksum', 'number', ['number', 'number'], [ptr, data.length])
        _free(ptr)
        return result
      },

      hidCodeFromDomCode(domCode: string): number {
        const ptr = writeString(domCode)
        const code = ccall('op_input_hid_code_from_dom_code', 'number', ['number'], [ptr])
        _free(ptr)
        return code
      },
    }

    coreReady = true
    console.log('[Core] loaded successfully')

    return coreMod
  })()

  return coreLoadPromise
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

export function getKeymod(): CoreWASM {
  if (!coreMod) {
    throw new Error('Core WASM not loaded. Call loadWasm() first.')
  }
  return coreMod
}

export function isWasmReady(): boolean {
  return coreReady
}
