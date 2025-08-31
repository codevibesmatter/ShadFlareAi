/**
 * React Hook for WebSocket Manager
 * 
 * Provides React interface to the standalone WebSocket manager
 */

import { useState, useEffect, useCallback } from 'react'
import { wsManager, type WebSocketMessage, type WebSocketEventHandler } from '@/lib/websocket-manager'
import type { ArtifactMessage } from '@/types/artifacts'

export interface UseWebSocketConfig {
  enabled?: boolean
  model?: string
  onMessage?: (data: WebSocketMessage) => void
  onConnected?: () => void
  onDisconnected?: (data: { code?: number; reason?: string }) => void
  onError?: (error: any) => void
}

export interface UseWebSocketReturn {
  // Status
  isConnected: boolean
  sessionId: string | null
  reconnectAttempts: number
  
  // Actions
  connect: (model?: string) => void
  disconnect: () => void
  send: (message: WebSocketMessage) => boolean
  setEnabled: (enabled: boolean) => void
  
  // Chat-specific helpers
  sendChatMessage: (content: string, options?: { enableFunctionCalling?: boolean }) => boolean
}

export function useWebSocket(config: UseWebSocketConfig = {}): UseWebSocketReturn {
  const { enabled = true, model = 'llama-3-8b' } = config
  
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Update status from manager
  const updateStatus = useCallback(() => {
    const status = wsManager.getStatus()
    setIsConnected(status.isConnected)
    setSessionId(status.sessionId)
    setReconnectAttempts(status.reconnectAttempts)
  }, [])

  // Event handlers
  const handleConnected = useCallback(() => {
    updateStatus()
    config.onConnected?.()
  }, [updateStatus, config.onConnected])

  const handleDisconnected = useCallback((data: WebSocketMessage) => {
    updateStatus()
    config.onDisconnected?.({ 
      code: data.code as number, 
      reason: data.reason as string 
    })
  }, [updateStatus, config.onDisconnected])

  const handleMessage = useCallback((data: WebSocketMessage) => {
    updateStatus()
    config.onMessage?.(data)
  }, [updateStatus, config.onMessage])

  const handleError = useCallback((data: WebSocketMessage) => {
    updateStatus()
    config.onError?.(data.error || data)
  }, [updateStatus, config.onError])

  // Setup event listeners
  useEffect(() => {
    wsManager.on('connected', handleConnected)
    wsManager.on('disconnected', handleDisconnected)
    wsManager.on('message', handleMessage)
    wsManager.on('error', handleError)

    // Initial status update
    updateStatus()

    return () => {
      wsManager.off('connected', handleConnected)
      wsManager.off('disconnected', handleDisconnected)
      wsManager.off('message', handleMessage)
      wsManager.off('error', handleError)
    }
  }, [handleConnected, handleDisconnected, handleMessage, handleError, updateStatus])

  // Enable/disable based on config - only when actually changing
  useEffect(() => {
    const status = wsManager.getStatus()
    
    // Only change state if needed to prevent multiple connections
    if (enabled && !status.isConnected) {
      wsManager.setEnabled(enabled)
      wsManager.connect(model)
    } else if (!enabled && status.isConnected) {
      wsManager.setEnabled(enabled)
    }
  }, [enabled, model])

  // Actions
  const connect = useCallback((connectModel?: string) => {
    wsManager.connect(connectModel || model)
  }, [model])

  const disconnect = useCallback(() => {
    wsManager.disconnect()
  }, [])

  const send = useCallback((message: WebSocketMessage): boolean => {
    return wsManager.send(message)
  }, [])

  const setEnabled = useCallback((enabledState: boolean) => {
    wsManager.setEnabled(enabledState)
  }, [])

  const sendChatMessage = useCallback((content: string, options: { enableFunctionCalling?: boolean } = {}): boolean => {
    const messageId = crypto.randomUUID()
    const message: WebSocketMessage = {
      type: 'chat',
      content,
      messageId,
      enableFunctionCalling: options.enableFunctionCalling || false
    }
    
    return wsManager.send(message)
  }, [])

  return {
    // Status
    isConnected,
    sessionId,
    reconnectAttempts,
    
    // Actions
    connect,
    disconnect,
    send,
    setEnabled,
    
    // Chat helpers
    sendChatMessage
  }
}