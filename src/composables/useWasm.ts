/**
 * WASM loader for Openterface_Core (keymod library).
 * Uses the Emscripten-generated JS glue (keymod.js) which loads keymod.wasm.
 */

export interface KeymodWASM {
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
  /** Parse a macro string into (hid_code, modifiers) pairs */
  parseMacro(input: string): Array<{ hidCode: number; modifiers: number }>
  /** Compute checksum for a packet */
  checksum(data: Uint8Array): number
}

// Emscripten module type
interface EmscriptenModule {
  ccall(ident: string, returnType: string | null, argTypes: string[], args: any[]): any
  _malloc(size: number): number
  _free(ptr: number): void
  HEAP8: Int8Array
  HEAPU8: Uint8Array
  HEAP32: Int32Array
}

let keymod: KeymodWASM | null = null

export async function loadWasm(): Promise<KeymodWASM> {
  if (keymod) return keymod

  // Import the Emscripten-generated module (keymod.js + keymod.wasm are co-located)
  const createModule = (await import(/* @vite-ignore */ '/keymod.js')).default

  const mod = await createModule() as EmscriptenModule

  const { ccall, _malloc, _free, HEAPU8, HEAP32 } = mod

  function writeString(str: string): number {
    const ptr = _malloc(str.length + 1)
    for (let i = 0; i < str.length; i++) {
      HEAPU8[ptr + i] = str.charCodeAt(i)
    }
    HEAPU8[ptr + str.length] = 0
    return ptr
  }

  function readString(ptr: number): string {
    let result = ''
    let i = 0
    while (true) {
      const c = HEAPU8[ptr + i]
      if (c === 0) break
      result += String.fromCharCode(c)
      i++
    }
    return result
  }

  keymod = {
    hidCode(keyName: string): number {
      const ptr = writeString(keyName)
      const code = ccall('km_hid_code', 'number', ['number'], [ptr])
      _free(ptr)
      return code
    },

    hidCodeForChar(c: string): { code: number; needsShift: boolean } | null {
      if (c.length !== 1) return null
      const shiftPtr = _malloc(4)
      const code = ccall('km_hid_code_for_char', 'number', ['number', 'number'], [c.charCodeAt(0), shiftPtr])
      const needsShift = HEAP32[shiftPtr >> 2] !== 0
      _free(shiftPtr)
      if (code < 0) return null
      return { code, needsShift }
    },

    hidCodeLabel(code: number): string {
      const ptr = ccall('km_hid_code_label', 'number', ['number'], [code])
      return readString(ptr)
    },

    buildKeyboard(modifiers: number, keys: number[]): Uint8Array {
      const outPtr = _malloc(14)
      const keysPtr = _malloc(keys.length * 4)
      for (let i = 0; i < keys.length; i++) {
        HEAP32[(keysPtr >> 2) + i] = keys[i]
      }
      ccall('km_build_keyboard', null, ['number', 'number', 'number', 'number'], [outPtr, modifiers, keysPtr, Math.min(keys.length, 6)])
      const result = new Uint8Array(HEAPU8.slice(outPtr, outPtr + 14))
      _free(outPtr)
      _free(keysPtr)
      return result
    },

    buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array {
      const outPtr = _malloc(11)
      ccall('km_build_mouse_rel', null, ['number', 'number', 'number', 'number', 'number'], [outPtr, buttons, dx, dy, wheel])
      const result = new Uint8Array(HEAPU8.slice(outPtr, outPtr + 11))
      _free(outPtr)
      return result
    },

    buildPressRelease(modifiers: number, hidCode: number): Uint8Array {
      const outPtr = _malloc(28)
      ccall('km_build_press_release', null, ['number', 'number', 'number'], [outPtr, modifiers, hidCode])
      const result = new Uint8Array(HEAPU8.slice(outPtr, outPtr + 28))
      _free(outPtr)
      return result
    },

    parseMacro(input: string): Array<{ hidCode: number; modifiers: number }> {
      const inputPtr = writeString(input)
      const max = input.length * 2
      const outPtr = _malloc(max * 8)
      const count = ccall('km_parse_macro', 'number', ['number', 'number', 'number'], [inputPtr, outPtr, max])
      const results: Array<{ hidCode: number; modifiers: number }> = []
      for (let i = 0; i < count; i++) {
        const offset = (outPtr >> 2) + i * 2
        results.push({
          hidCode: HEAP32[offset],
          modifiers: HEAP32[offset + 1],
        })
      }
      _free(inputPtr)
      _free(outPtr)
      return results
    },

    checksum(data: Uint8Array): number {
      const ptr = _malloc(data.length)
      for (let i = 0; i < data.length; i++) {
        HEAPU8[ptr + i] = data[i]
      }
      const result = ccall('km_checksum', 'number', ['number', 'number'], [ptr, data.length])
      _free(ptr)
      return result
    },
  }

  return keymod
}

export function getKeymod(): KeymodWASM {
  if (!keymod) {
    throw new Error('WASM not loaded. Call loadWasm() first.')
  }
  return keymod
}
