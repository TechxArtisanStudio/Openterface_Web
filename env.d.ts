/// <reference types="vite/client" />

declare module '*.wasm' {
  const value: string
  export default value
}

declare interface WasmExports {
  _malloc(size: number): number
  _free(ptr: number): void
  memory: WebAssembly.Memory
  _km_hid_code(namePtr: number): number
  _km_hid_code_for_char(c: number, shiftPtr: number): number
  _km_hid_code_label(code: number): number
  _km_build_keyboard(outPtr: number, mod: number, keysPtr: number, n: number): number
  _km_build_mouse_rel(outPtr: number, btn: number, dx: number, dy: number, w: number): number
  _km_build_press_release(outPtr: number, mod: number, code: number): number
  _km_parse_macro(inputPtr: number, outPtr: number, max: number): number
  _km_tokenize_script(inputPtr: number, outPtr: number, max: number): number
  _km_checksum(ptr: number, len: number): number
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $wasm: WasmExports | null
  }
}
