/**
 * WASM loader for Openterface_Core (keymod library).
 * Loads the Emscripten-generated keymod.js from the public directory at runtime.
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
  /** Build an absolute mouse packet */
  buildMouseAbs(buttons: number, x: number, y: number, wheel: number): Uint8Array
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
  HEAPU8: Uint8Array
  HEAP32: Int32Array
}

type CreateModule = () => Promise<EmscriptenModule>

let keymod: KeymodWASM | null = null
let wasmReady = false
let wasmLoadPromise: Promise<KeymodWASM> | null = null

export async function loadWasm(): Promise<KeymodWASM> {
  if (keymod) return keymod
  if (wasmLoadPromise) return wasmLoadPromise

  wasmLoadPromise = (async () => {
    console.log('[WASM] loading keymod.js...')

    // Load the Emscripten-generated module via dynamic script tag
    // keymod.js is served from the public directory
    await loadScript('keymod.js')
    console.log('[WASM] keymod.js loaded, instantiating WASM...')

    // The MODULARIZE build exposes createKeymodModule as a global
    const createModule = (window as any).createKeymodModule as CreateModule
    if (!createModule) {
      throw new Error('Emscripten module not found. keymod.js failed to load.')
    }

    const mod = await createModule()
    console.log('[WASM] WASM instantiated, wrapping functions...')

    const { ccall, _malloc, _free } = mod

    // HEAPU8/HEAP32 are now exported on the Module object via EXPORTED_RUNTIME_METHODS
    const heapU8 = mod.HEAPU8 as Uint8Array
    const heapI32 = mod.HEAP32 as Int32Array

    if (!heapU8 || !heapI32) {
      console.error('[WASM] HEAPU8:', heapU8, 'HEAP32:', heapI32)
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
        const needsShift = heapI32[shiftPtr >> 2] !== 0
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
          heapI32[(keysPtr >> 2) + i] = keys[i]
        }
        ccall('km_build_keyboard', null, ['number', 'number', 'number', 'number'], [outPtr, modifiers, keysPtr, Math.min(keys.length, 6)])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 14))
        _free(outPtr)
        _free(keysPtr)
        return result
      },

      buildMouseRel(buttons: number, dx: number, dy: number, wheel: number): Uint8Array {
        const outPtr = _malloc(11)
        ccall('km_build_mouse_rel', null, ['number', 'number', 'number', 'number', 'number'], [outPtr, buttons, dx, dy, wheel])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 11))
        _free(outPtr)
        return result
      },

      buildMouseAbs(buttons: number, x: number, y: number, wheel: number): Uint8Array {
        const outPtr = _malloc(13)
        ccall('km_build_mouse_abs', null, ['number', 'number', 'number', 'number', 'number'], [outPtr, buttons, x, y, wheel])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 13))
        _free(outPtr)
        return result
      },

      buildPressRelease(modifiers: number, hidCode: number): Uint8Array {
        const outPtr = _malloc(28)
        ccall('km_build_press_release', null, ['number', 'number', 'number'], [outPtr, modifiers, hidCode])
        const result = new Uint8Array(heapU8.slice(outPtr, outPtr + 28))
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
        const result = ccall('km_checksum', 'number', ['number', 'number'], [ptr, data.length])
        _free(ptr)
        return result
      },
    }

    wasmReady = true
    console.log('[WASM] loaded successfully')

    return keymod
  })()

  return wasmLoadPromise
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

export function getKeymod(): KeymodWASM {
  if (!keymod) {
    throw new Error('WASM not loaded. Call loadWasm() first.')
  }
  return keymod
}

export function isWasmReady(): boolean {
  return wasmReady
}
