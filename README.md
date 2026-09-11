# Openterface Web

Web-based USB HID client for Openterface devices. Connect and control target devices directly from your browser via Web Serial API.

## Architecture

```
Openterface_Web (this repo)                    Openterface_WebUI (submodule)
├── packages/                                  ├── packages/
│   ├── core/                    @openterface/core  │   ├── control-ui/      @openterface/control-ui
│   │   HID protocol, WASM,      ─────────────► │   ├── webrtc-core/     @openterface/webrtc-core
│   │   keyboard mapping          (npm dep)     │   └── webrtc/          @openterface/webrtc
│   └── usb/                     @openterface/usb
│       Web Serial HID app
└── submodules/
    └── Openterface_WebUI/  ← git submodule (shared UI + WebRTC client)
```

### Packages

| Package | Description |
|---------|-------------|
| `@openterface/core` | HID protocol (CH9329), WASM keymod, keyboard/mouse composables, serial frame builder |
| `@openterface/usb` | USB WebHID app — uses `@openterface/core` for protocol and `@openterface/control-ui` for UI |

### Shared Packages (from WebUI submodule)

| Package | Description |
|---------|-------------|
| `@openterface/control-ui` | Reusable Vue UI components: Layout, VideoStream, TopBar, BottomBar, StatusBar, etc. |
| `@openterface/webrtc-core` | WebRTC transport with CH9329→JSON frame translation |
| `@openterface/webrtc` | WebRTC client app (consumed by Openterface_Android) |

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/TechxArtisanStudio/Openterface_Web.git
cd Openterface_Web
git submodule update --init --recursive
npm install
```

### USB App

```bash
npm run dev:usb          # Dev server (port 5173)
npm run build:usb        # Production build → dist/
npm run preview:usb      # Preview production build
```

### WebRTC App

```bash
npm run dev:webrtc          # Dev server (port 5173)
npm run build:webrtc:android # Production build → dist/webrtc-android/
npm run preview:webrtc       # Preview production build
```

### Type Check

```bash
npm run typecheck
```

## Build Output

| Package | Output |
|---------|--------|
| `@openterface/usb` | `packages/usb/dist/` |
| `@openterface/webrtc` | `submodules/Openterface_WebUI/packages/webrtc/dist/webrtc-android/` |

The WebRTC output is consumed by [Openterface_Android](https://github.com/TechxArtisanStudio/Openterface_Android) via its Gradle build process.

## WebRTC Signaling

The WebRTC client communicates with the Android NanoHTTPD server:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Serve index.html |
| `/offer` | POST | Submit SDP offer |
| `/sdp` | GET | Poll for SDP answer |
| `/ice` | POST | Submit ICE candidates |

DataChannel messages (JSON):
- **Keyboard:** `{"type": "keyboard", "keysym": number, "down": boolean}`
- **Mouse:** `{"type": "mouse", "buttonMask": number, "x": number, "y": number, "pressed": boolean}`

## Related Projects

- [Openterface_WebUI](https://github.com/TechxArtisanStudio/Openterface_WebUI) — Shared UI components and WebRTC client
- [Openterface_Android](https://github.com/TechxArtisanStudio/Openterface_Android) — Android app with WebRTC server
- [Openterface_Core](https://github.com/TechxArtisanStudio/Openterface_Core) — C library for HID key encoding (compiled to WASM)

## License

MIT
