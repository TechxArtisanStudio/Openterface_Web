/**
 * WASM loader for Openterface_Core (keymod library).
 * Compiles the keymod.wasm file and provides typed JS wrappers around C functions.
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

let keymod: KeymodWASM | null = null

export async function loadWasm(baseUrl: string = ''): Promise<KeymodWASM> {
  if (keymod) return keymod

  const wasmUrl = new URL('keymod.wasm', baseUrl || window.location.origin + (import.meta.env.BASE_URL || '/'))

  // Emscripten MODULARIZE=1 generates a factory that returns the module instance
  // We load and instantiate it directly
  const wasmBytes = await (await fetch(wasmUrl.toString())).arrayBuffer()

  // Manual WASM instantiation (no Emscripten glue needed for our simple C functions)
  const { instance } = await WebAssembly.instantiate(wasmBytes, {
    env: {
      memory: new WebAssembly.Memory({ initial: 16 }),
    },
  })

  const exports = instance.exports as WasmExports

  const mem = new DataView(exports.memory.buffer)

  function writeString(str: string): number {
    const ptr = exports._malloc(str.length + 1)
    for (let i = 0; i < str.length; i++) {
      mem.setUint8(ptr + i, str.charCodeAt(i))
    }
    mem.setUint8(ptr + str.length, 0)
    return ptr
  }

  function readString(ptr: number): string {
    let result = ''
    let i = 0
    while (true) {
      const c = mem.getUint8(ptr + i)
      if (c === 0) break
      result += String.fromCharCode(c)
      i++
    }
    return result
  }

  keymod = {
    hidCode(keyName: string): number {
      const ptr = writeString(keyName)
      const code = exports._km_hid_code(ptr)
      exports._free(ptr)
      return code
    },

    hidCodeForChar(c: string): { code: number; needsShift: boolean } | null {
      if (c.length !== 1) return null
      const shiftPtr = exports._malloc(4)
      const code = exports._km_hid_code_for_char(c.charCodeAt(0), shiftPtr)
      const needsShift = mem.getInt32(shiftPtr, true) !== 0
      exports._free(shiftPtr)
      if (code < 0) return null
      return { code, needsShift }
    },

    hidCodeLabel(code: number): string {
      const ptr = exports._km_hid_code_label(code)
      return readString(ptr)
    },

    buildKeyboard(modifiers: number, keys: number[]): Uint8Array {
      const outPtr = exports._malloc(14)
      const keysPtr = exports._malloc(keys.length * 4)
      for (let i = 0; i < keys.length; i++) {
        mem.setInt32(keysPtr + i * 4, keys[i], true)
      }
      exports._km_build_keyboard(outPtr, modifiers, keysPtr, Math.min(keys.length, 6))
      const result = new Uint8Array(14)
      for (let i = 0; i < 14; i++) {
        result[i] = mem.getUint8(outPtr + i)
      }
      exports._free(outPtr)
      exports._free(keysPtr)
      return result
    },

    buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array {
      const outPtr = exports._malloc(11)
      exports._km_build_mouse_rel(outPtr, buttons, dx, dy, wheel)
      const result = new Uint8Array(11)
      for (let i = 0; i < 11; i++) {
        result[i] = mem.getUint8(outPtr + i)
      }
      exports._free(outPtr)
      return result
    },

    buildPressRelease(modifiers: number, hidCode: number): Uint8Array {
      const outPtr = exports._malloc(28)
      exports._km_build_press_release(outPtr, modifiers, hidCode)
      const result = new Uint8Array(28)
      for (let i = 0; i < 28; i++) {
        result[i] = mem.getUint8(outPtr + i)
      }
      exports._free(outPtr)
      return result
    },

    parseMacro(input: string): Array<{ hidCode: number; modifiers: number }> {
      const inputPtr = writeString(input)
      // Each entry is 2 ints (8 bytes on wasm32)
      const max = input.length * 2
      const outPtr = exports._malloc(max * 8)
      const count = exports._km_parse_macro(inputPtr, outPtr, max)
      const results: Array<{ hidCode: number; modifiers: number }> = []
      for (let i = 0; i < count; i++) {
        const offset = outPtr + i * 8
        results.push({
          hidCode: mem.getInt32(offset, true),
          modifiers: mem.getInt32(offset + 4, true),
        })
      }
      exports._free(inputPtr)
      exports._free(outPtr)
      return results
    },

    checksum(data: Uint8Array): number {
      const ptr = exports._malloc(data.length)
      for (let i = 0; i < data.length; i++) {
        mem.setUint8(ptr + i, data[i])
      }
      const result = exports._km_checksum(ptr, data.length)
      exports._free(ptr)
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
