/**
 * React Hook for Voice AI WebSocket Manager
 * 
 * Provides React interface to the standalone Voice AI WebSocket manager
 */

import { useState, useEffect, useCallback } from 'react'
import { voiceWsManager, type VoiceWebSocketMessage, type VoiceWebSocketEventHandler } from '@/lib/voice-websocket-manager'

export interface UseVoiceWebSocketConfig {
  enabled?: boolean
  voice?: string
  model?: string
  onMessage?: (data: VoiceWebSocketMessage) => void
  onConnected?: () => void
  onDisconnected?: (data: { code?: number; reason?: string }) => void
  onError?: (error: any) => void
}

export interface UseVoiceWebSocketReturn {
  // Status
  isConnected: boolean
  sessionId: string | null
  reconnectAttempts: number
  
  // Actions
  connect: (voice?: string, model?: string) => void
  disconnect: () => void
  send: (message: VoiceWebSocketMessage) => boolean
  setEnabled: (enabled: boolean) => void
  
  // Voice-specific helpers
  sendAudioChunk: (data: string, sampleRate?: number, format?: string) => boolean
  sendTestTranscription: () => boolean
  sendWAVTestChunk: (data: string, chunkIndex: number, totalChunks: number, isComplete: boolean) => boolean
}

export function useVoiceWebSocket(config: UseVoiceWebSocketConfig = {}): UseVoiceWebSocketReturn {
  const { enabled = true, voice = 'aura', model = 'nova-3' } = config
  
  const [isConnected, setIsConnected] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  // Update status from manager
  const updateStatus = useCallback(() => {
    const status = voiceWsManager.getStatus()
    setIsConnected(status.isConnected)
    setSessionId(status.sessionId)
    setReconnectAttempts(status.reconnectAttempts)
  }, [])

  // Event handlers
  const handleConnected = useCallback(() => {
    updateStatus()
    config.onConnected?.(void 0)
  }, [updateStatus, config.onConnected])

  const handleDisconnected = useCallback((data: VoiceWebSocketMessage) => {
    updateStatus()
    config.onDisconnected?.({ 
      code: data.code as number, 
      reason: data.reason as string 
    })
  }, [updateStatus, config.onDisconnected])

  const handleMessage = useCallback((data: VoiceWebSocketMessage) => {
    updateStatus()
    config.onMessage?.(data)
  }, [updateStatus, config.onMessage])

  const handleError = useCallback((data: VoiceWebSocketMessage) => {
    updateStatus()
    config.onError?.(data.error || data)
  }, [updateStatus, config.onError])

  // Setup event listeners
  useEffect(() => {
    voiceWsManager.on('connected', handleConnected)
    voiceWsManager.on('disconnected', handleDisconnected)
    voiceWsManager.on('message', handleMessage)
    voiceWsManager.on('error', handleError)

    // Initial status update
    updateStatus()

    return () => {
      voiceWsManager.off('connected', handleConnected)
      voiceWsManager.off('disconnected', handleDisconnected)
      voiceWsManager.off('message', handleMessage)
      voiceWsManager.off('error', handleError)
    }
  }, [handleConnected, handleDisconnected, handleMessage, handleError, updateStatus])

  // Enable/disable based on config - only when actually changing
  useEffect(() => {
    const status = voiceWsManager.getStatus()
    
    // Only change state if needed to prevent multiple connections
    if (enabled && !status.isConnected) {
      voiceWsManager.setEnabled(enabled)
      voiceWsManager.connect(voice, model)
    } else if (!enabled && status.isConnected) {
      voiceWsManager.setEnabled(enabled)
    }
  }, [enabled, voice, model])

  // Actions
  const connect = useCallback((connectVoice?: string, connectModel?: string) => {
    voiceWsManager.connect(connectVoice || voice, connectModel || model)
  }, [voice, model])

  const disconnect = useCallback(() => {
    voiceWsManager.disconnect()
  }, [])

  const send = useCallback((message: VoiceWebSocketMessage): boolean => {
    return voiceWsManager.send(message)
  }, [])

  const setEnabled = useCallback((enabledState: boolean) => {
    voiceWsManager.setEnabled(enabledState)
  }, [])

  const sendAudioChunk = useCallback((data: string, sampleRate: number = 16000, format: string = 'pcm_s16le'): boolean => {
    const message: VoiceWebSocketMessage = {
      type: 'audio_chunk_pcm',
      data,
      sampleRate,
      format
    }
    
    return voiceWsManager.send(message)
  }, [])

  const sendTestTranscription = useCallback((): boolean => {
    const message: VoiceWebSocketMessage = {
      type: 'test_transcription'
    }
    
    return voiceWsManager.send(message)
  }, [])

  const sendWAVTestChunk = useCallback((data: string, chunkIndex: number, totalChunks: number, isComplete: boolean): boolean => {
    const message: VoiceWebSocketMessage = {
      type: 'wav_test_chunk',
      data,
      chunkIndex,
      totalChunks,
      isComplete
    }
    
    return voiceWsManager.send(message)
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
    
    // Voice helpers
    sendAudioChunk,
    sendTestTranscription,
    sendWAVTestChunk
  }
}