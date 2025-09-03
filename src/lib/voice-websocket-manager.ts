/**
 * Standalone Voice AI WebSocket Manager
 * 
 * Manages Voice AI WebSocket connections outside of React to avoid lifecycle issues
 */

export interface VoiceWebSocketMessage {
  type: string
  data?: string
  text?: string
  chunkIndex?: number
  totalChunks?: number
  isComplete?: boolean
  sampleRate?: number
  format?: string
  [key: string]: any
}

export type VoiceWebSocketEventHandler = (data: VoiceWebSocketMessage) => void

export class VoiceWebSocketManager {
  private ws: WebSocket | null = null
  private url: string = ''
  private isConnected: boolean = false
  private sessionId: string | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 3000
  private reconnectTimer: NodeJS.Timeout | null = null
  private eventHandlers: Map<string, Set<VoiceWebSocketEventHandler>> = new Map()
  private isEnabled: boolean = true

  constructor() {
    // Bind methods to preserve context
    this.connect = this.connect.bind(this)
    this.disconnect = this.disconnect.bind(this)
    this.send = this.send.bind(this)
    this.onMessage = this.onMessage.bind(this)
    this.onOpen = this.onOpen.bind(this)
    this.onClose = this.onClose.bind(this)
    this.onError = this.onError.bind(this)
  }

  /**
   * Connect to Voice AI WebSocket
   */
  connect(voice: string = 'aura', model: string = 'whisper-tiny-en'): void {
    // Prevent multiple connections
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('Voice WebSocket already connected or connecting')
      return
    }

    // Close any existing connection
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Create WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/voice-ai?voice=${voice}&model=${model}`
    
    this.url = wsUrl
    console.log('🎤 Connecting to Voice WebSocket:', this.url)

    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = this.onOpen
      this.ws.onmessage = this.onMessage
      this.ws.onclose = this.onClose
      this.ws.onerror = this.onError
    } catch (error) {
      console.error('❌ Failed to create Voice WebSocket:', error)
      this.emit('error', { type: 'connection_error', error: error })
    }
  }

  /**
   * Disconnect Voice WebSocket
   */
  disconnect(): void {
    console.log('🔌 Disconnecting Voice WebSocket...')
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      // Remove event listeners to prevent reconnection
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
    this.sessionId = null
    this.reconnectAttempts = 0
    
    this.emit('disconnected', { type: 'disconnected' })
  }

  /**
   * Send message via Voice WebSocket
   */
  send(message: VoiceWebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ Voice WebSocket not connected')
      this.emit('error', { type: 'not_connected', message: 'Voice WebSocket not connected' })
      return false
    }

    try {
      const messageStr = JSON.stringify(message)
      console.log('🎤 Sending Voice WebSocket message:', message.type)
      this.ws.send(messageStr)
      return true
    } catch (error) {
      console.error('❌ Failed to send Voice WebSocket message:', error)
      this.emit('error', { type: 'send_error', error: error })
      return false
    }
  }

  /**
   * Enable/disable Voice WebSocket functionality
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    
    if (enabled) {
      this.connect('aura', 'whisper-tiny-en')
    } else {
      this.disconnect()
    }
  }

  /**
   * Get connection status
   */
  getStatus(): { isConnected: boolean; sessionId: string | null; reconnectAttempts: number } {
    return {
      isConnected: this.isConnected,
      sessionId: this.sessionId,
      reconnectAttempts: this.reconnectAttempts
    }
  }

  /**
   * Add event listener
   */
  on(event: string, handler: VoiceWebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: VoiceWebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(event)
      }
    }
  }

  /**
   * Emit event to all handlers
   */
  private emit(event: string, data: VoiceWebSocketMessage): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error('❌ Error in Voice WebSocket event handler:', error)
        }
      })
    }
  }

  /**
   * Handle Voice WebSocket open
   */
  private onOpen(): void {
    console.log('✅ Voice WebSocket connected successfully!')
    this.isConnected = true
    this.reconnectAttempts = 0
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    this.emit('connected', { type: 'connected' })
  }

  /**
   * Handle Voice WebSocket message
   */
  private onMessage(event: MessageEvent): void {
    console.log('🎤 Voice WebSocket message received:', event.data.slice(0, 100) + '...')
    
    try {
      const data = JSON.parse(event.data) as VoiceWebSocketMessage
      console.log('🎤 Parsed message type:', data.type)
      
      // Handle connection confirmation
      if (data.type === 'connection') {
        this.sessionId = data.sessionId || null
        console.log('🔗 Voice connection established, session ID:', this.sessionId)
      }
      
      // Emit to all listeners
      this.emit('message', data)
      this.emit(data.type, data)
      
    } catch (error) {
      console.error('❌ Failed to parse Voice WebSocket message:', error, event.data)
      this.emit('error', { type: 'parse_error', error: error, rawData: event.data })
    }
  }

  /**
   * Handle Voice WebSocket close
   */
  private onClose(event: CloseEvent): void {
    console.log('🔌 Voice WebSocket closed:', event.code, event.reason)
    this.isConnected = false
    
    this.emit('disconnected', { 
      type: 'disconnected', 
      code: event.code, 
      reason: event.reason 
    })

    // Auto-reconnect if enabled and not a clean close or going away
    if (this.isEnabled && event.code !== 1000 && event.code !== 1001) {
      this.scheduleReconnect()
    }
  }

  /**
   * Handle Voice WebSocket error
   */
  private onError(event: Event): void {
    console.error('❌ Voice WebSocket error:', event)
    this.emit('error', { type: 'websocket_error', error: event })
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max Voice WebSocket reconnection attempts reached')
      this.emit('error', { 
        type: 'max_reconnects_reached', 
        attempts: this.reconnectAttempts 
      })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)
    
    console.log(`🔄 Scheduling Voice WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)
    
    this.reconnectTimer = setTimeout(() => {
      if (this.isEnabled && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        console.log(`🔄 Voice WebSocket reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
        this.connect('aura', 'whisper-tiny-en')
      }
    }, delay)
  }
}

// Global Voice WebSocket manager singleton - survives HMR
let voiceWsManagerInstance: VoiceWebSocketManager

function getVoiceWebSocketManager(): VoiceWebSocketManager {
  // Check if we already have a global instance (survives HMR)
  if (typeof window !== 'undefined') {
    if (!(window as any).__voiceWsManager) {
      (window as any).__voiceWsManager = new VoiceWebSocketManager()
    }
    return (window as any).__voiceWsManager
  }
  
  // Fallback for SSR
  if (!voiceWsManagerInstance) {
    voiceWsManagerInstance = new VoiceWebSocketManager()
  }
  return voiceWsManagerInstance
}

export const voiceWsManager = getVoiceWebSocketManager()