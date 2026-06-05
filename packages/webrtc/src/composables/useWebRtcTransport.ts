import { ref, computed } from 'vue'
import { TransportState, type TransportDeviceInfo, type HIDTransport } from '@openterface/core'

/** WebRTC transport implementation using RTCPeerConnection + RTCDataChannel */
export function useWebRtcTransport(): HIDTransport {
  const pc = ref<RTCPeerConnection | null>(null)
  const dc = ref<RTCDataChannel | null>(null)
  const state = ref<TransportState>(TransportState.Disconnected)
  const deviceInfo = ref<TransportDeviceInfo | null>(null)

  const isConnected = computed(() => state.value === TransportState.Connected)

  async function connect(): Promise<boolean> {
    if (state.value !== TransportState.Disconnected) return false

    state.value = TransportState.Connecting
    console.log('[WebRTC] Creating peer connection...')

    try {
      // 1. Create RTCPeerConnection
      pc.value = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      })

      // 2. Create DataChannel for HID commands
      dc.value = pc.value.createDataChannel('hid', { ordered: true })
      dc.value.binaryType = 'arraybuffer'

      dc.value.onopen = () => {
        console.log('[WebRTC] DataChannel opened')
        state.value = TransportState.Connected
      }

      dc.value.onclose = () => {
        console.log('[WebRTC] DataChannel closed')
        state.value = TransportState.Disconnected
      }

      dc.value.onerror = (err) => {
        console.error('[WebRTC] DataChannel error:', err)
        state.value = TransportState.Error
      }

      // 3. Handle remote video track
      pc.value.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind)
        const video = document.querySelector('video') as HTMLVideoElement
        if (video && event.track.kind === 'video') {
          const stream = new MediaStream([event.track])
          video.srcObject = stream
          video.play().catch(e => console.error('[WebRTC] Video play error:', e))
        }
      }

      // 4. Handle ICE candidates
      const iceCandidates: RTCIceCandidateInit[] = []
      pc.value.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON())
          // Send to server
          fetch('/ice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event.candidate.toJSON()),
          }).catch(err => console.error('[WebRTC] ICE send error:', err))
        }
      }

      // 5. Create offer
      const offer = await pc.value.createOffer()
      await pc.value.setLocalDescription(offer)
      console.log('[WebRTC] Created offer')

      // 6. Send offer to server
      const response = await fetch('/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: offer.type, sdp: offer.sdp }),
      })

      if (!response.ok) {
        throw new Error(`Offer failed: ${response.status}`)
      }

      // 7. Poll for answer
      console.log('[WebRTC] Waiting for answer...')
      const answer = await pollForAnswer()

      // 8. Set remote description
      await pc.value.setRemoteDescription(answer)
      console.log('[WebRTC] Set remote description')

      return true
    } catch (err) {
      console.error('[WebRTC] Connection error:', err)
      state.value = TransportState.Error
      return false
    }
  }

  async function pollForAnswer(): Promise<RTCSessionDescriptionInit> {
    const maxAttempts = 60 // 60 seconds timeout
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch('/sdp')
        if (response.ok) {
          const data = await response.json()
          if (data.type === 'answer' && data.sdp) {
            console.log('[WebRTC] Got answer from server')
            return { type: data.type, sdp: data.sdp }
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    throw new Error('Timeout waiting for answer')
  }

  async function disconnect(): Promise<void> {
    state.value = TransportState.Disconnected
    deviceInfo.value = null

    if (dc.value) {
      dc.value.close()
      dc.value = null
    }

    if (pc.value) {
      pc.value.close()
      pc.value = null
    }

    console.log('[WebRTC] Disconnected')
  }

  async function write(data: Uint8Array): Promise<void> {
    if (dc.value?.readyState === 'open') {
      dc.value.send(data)
    } else {
      console.warn('[WebRTC] Cannot write: DataChannel not open')
    }
  }

  async function queryDeviceInfo(): Promise<void> {
    // TODO: Send CMD_GET_INFO via DataChannel and parse response
    // For now, just log
    console.log('[WebRTC] Query device info requested')
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
