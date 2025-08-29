import { useState, useEffect, useCallback, useRef } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface WebSocketChatState {
  messages: ChatMessage[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
  sessionId: string | null
}

interface WebSocketChatActions {
  sendMessage: (content: string, messageId?: string) => void
  changeModel: (model: string) => void
  connect: () => void
  disconnect: () => void
  retry: () => void
}

interface UseWebSocketChatProps {
  model: string
  enableFunctionCalling?: boolean
  autoConnect?: boolean
}

export function useWebSocketChat({
  model,
  enableFunctionCalling = false,
  autoConnect = true
}: UseWebSocketChatProps): [WebSocketChatState, WebSocketChatActions] {
  const [state, setState] = useState<WebSocketChatState>({
    messages: [],
    isConnected: false,
    isLoading: false,
    error: null,
    sessionId: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 3

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // With Cloudflare Vite plugin, always use same origin
      const wsUrl = new URL('/ws/ai-chat', window.location.origin)
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl.searchParams.set('model', model)

      const ws = new WebSocket(wsUrl.toString())
      wsRef.current = ws

      ws.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          isLoading: false,
          error: null
        }))
        reconnectAttemptsRef.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          switch (data.type) {
            case 'connection':
              setState(prev => ({ ...prev, sessionId: data.sessionId }))
              break
              
            case 'stream_start':
              setState(prev => ({
                ...prev,
                messages: [...prev.messages, {
                  id: data.messageId,
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now()
                }]
              }))
              break

            case 'stream_chunk':
              setState(prev => ({
                ...prev,
                messages: prev.messages.map(msg =>
                  msg.id === data.messageId
                    ? { ...msg, content: msg.content + data.content }
                    : msg
                )
              }))

              if (data.done) {
                setState(prev => ({ ...prev, isLoading: false }))
              }
              break

            case 'function_calling_start':
              setState(prev => ({ ...prev, isLoading: true }))
              break

            case 'function_calling_complete':
              setState(prev => ({
                ...prev,
                isLoading: false,
                messages: [...prev.messages, {
                  id: data.messageId,
                  role: 'assistant',
                  content: data.content,
                  timestamp: Date.now()
                }]
              }))
              break

            case 'error':
            case 'stream_error':
            case 'function_calling_error':
              setState(prev => ({
                ...prev,
                isLoading: false,
                error: data.message || data.error
              }))
              break

            case 'pong':
              // Handle ping/pong for connection health
              break

            case 'model_changed':
              // Model successfully changed
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false, isLoading: false }))
        
        // Auto-reconnect logic
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000 // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1
            connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isLoading: false,
          error: 'WebSocket connection error'
        }))
      }

    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to establish WebSocket connection'
      }))
    }
  }, [model])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setState(prev => ({
      ...prev,
      isConnected: false,
      isLoading: false
    }))
  }, [])

  const sendMessage = useCallback((content: string, messageId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'Not connected to WebSocket' }))
      return
    }

    const id = messageId || crypto.randomUUID()
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user_${id}`,
      role: 'user',
      content,
      timestamp: Date.now()
    }

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null
    }))

    // Send to WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      content,
      messageId: id,
      enableFunctionCalling
    }))
  }, [enableFunctionCalling])

  const changeModel = useCallback((newModel: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setState(prev => ({ ...prev, error: 'Not connected to WebSocket' }))
      return
    }

    wsRef.current.send(JSON.stringify({
      type: 'change_model',
      model: newModel
    }))
  }, [])

  const retry = useCallback(() => {
    reconnectAttemptsRef.current = 0
    setState(prev => ({ ...prev, error: null }))
    connect()
  }, [connect])

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  // Send periodic pings to keep connection alive
  useEffect(() => {
    if (!state.isConnected) return

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds

    return () => clearInterval(pingInterval)
  }, [state.isConnected])

  return [
    state,
    {
      sendMessage,
      changeModel,
      connect,
      disconnect,
      retry
    }
  ]
}