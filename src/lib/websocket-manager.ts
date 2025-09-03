/**
 * Standalone WebSocket Manager
 * 
 * Manages WebSocket connections outside of React to avoid lifecycle issues
 */

import { createWebSocketLogger } from './logger'

export interface WebSocketMessage {
  type: string
  content?: string
  messageId?: string
  sessionId?: string
  enableFunctionCalling?: boolean
  [key: string]: any
}

export type WebSocketEventHandler = (data: WebSocketMessage) => void

export class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string = ''
  private isConnected: boolean = false
  private sessionId: string | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 3000
  private reconnectTimer: NodeJS.Timeout | null = null
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map()
  private isEnabled: boolean = true
  private logger = createWebSocketLogger('websocket-manager.ts')

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
   * Connect to WebSocket
   */
  connect(model: string = 'llama-3-8b'): void {
    // Prevent multiple connections
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      this.logger.debug('WebSocket already connected or connecting')
      return
    }

    // Close any existing connection
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Create WebSocket URL
    const wsUrl = new URL('/ws/ai-chat', window.location.origin)
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    wsUrl.searchParams.set('model', model)
    
    this.url = wsUrl.toString()
    this.logger.info('Connecting to WebSocket', { url: this.url })

    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = this.onOpen
      this.ws.onmessage = this.onMessage
      this.ws.onclose = this.onClose
      this.ws.onerror = this.onError
    } catch (error) {
      this.logger.error('Failed to create WebSocket', error)
      this.emit('error', { type: 'connection_error', error: error })
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.logger.info('Disconnecting WebSocket...')
    
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
   * Send message via WebSocket
   */
  send(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.error('WebSocket not connected')
      this.emit('error', { type: 'not_connected', message: 'WebSocket not connected' })
      return false
    }

    try {
      const messageStr = JSON.stringify(message)
      this.logger.debug('Sending WebSocket message', { type: message.type, messageId: message.messageId })
      this.ws.send(messageStr)
      return true
    } catch (error) {
      this.logger.error('Failed to send WebSocket message', error)
      this.emit('error', { type: 'send_error', error: error })
      return false
    }
  }

  /**
   * Stop current generation/streaming
   */
  stopGeneration(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('WebSocket not connected, cannot send stop signal')
      return false
    }

    try {
      const stopMessage: WebSocketMessage = {
        type: 'stop_generation',
        timestamp: Date.now()
      }
      
      this.logger.debug('Sending stop generation signal via WebSocket')
      this.ws.send(JSON.stringify(stopMessage))
      return true
    } catch (error) {
      this.logger.error('Failed to send stop generation signal', error)
      return false
    }
  }

  /**
   * Enable/disable WebSocket functionality
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    
    if (enabled) {
      this.connect()
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
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: WebSocketEventHandler): void {
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
  private emit(event: string, data: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          this.logger.error('Error in WebSocket event handler', error)
        }
      })
    }
  }

  /**
   * Handle WebSocket open
   */
  private onOpen(): void {
    this.logger.connectionState('connected')
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
   * Handle WebSocket message
   */
  private onMessage(event: MessageEvent): void {
    this.logger.messageReceived('message', event.data?.length)
    
    try {
      const data = JSON.parse(event.data) as WebSocketMessage
      this.logger.debug('Parsed message', { type: data.type, messageId: data.messageId })
      
      // Handle connection confirmation
      if (data.type === 'connection') {
        this.sessionId = data.sessionId || null
        this.logger.connectionState('session_established', { sessionId: this.sessionId })
      }
      
      // Emit to all listeners
      this.emit('message', data)
      this.emit(data.type, data)
      
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', error)
      this.emit('error', { type: 'parse_error', error: error, rawData: event.data })
    }
  }

  /**
   * Handle WebSocket close
   */
  private onClose(event: CloseEvent): void {
    this.logger.connectionState('closed', { code: event.code, reason: event.reason })
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
   * Handle WebSocket error
   */
  private onError(event: Event): void {
    this.logger.error('WebSocket connection error', event)
    this.emit('error', { type: 'websocket_error', error: event })
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached')
      this.emit('error', { 
        type: 'max_reconnects_reached', 
        attempts: this.reconnectAttempts 
      })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1)
    
    this.logger.info('Scheduling reconnection attempt', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts, delay })
    
    this.reconnectTimer = setTimeout(() => {
      if (this.isEnabled && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        this.logger.info('Starting reconnection attempt', { attempt: this.reconnectAttempts, maxAttempts: this.maxReconnectAttempts })
        this.connect()
      }
    }, delay)
  }
}

// Global WebSocket manager singleton - survives HMR
let wsManagerInstance: WebSocketManager

function getWebSocketManager(): WebSocketManager {
  // Check if we already have a global instance (survives HMR)
  if (typeof window !== 'undefined') {
    if (!(window as any).__wsManager) {
      (window as any).__wsManager = new WebSocketManager()
    }
    return (window as any).__wsManager
  }
  
  // Fallback for SSR
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager()
  }
  return wsManagerInstance
}

export const wsManager = getWebSocketManager()