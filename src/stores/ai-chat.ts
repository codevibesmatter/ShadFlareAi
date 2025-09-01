/**
 * AI Chat Store with Legend State v3
 * 
 * Manages AI chat conversations, WebSocket connections, and voice features with fine-grained reactivity
 */

import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import type { ArtifactMessage } from '@/types/artifacts'
import { parseArtifactsFromContent, shouldCreateArtifact } from '@/utils/artifact-parser'

// Chat types
export interface ChatMessage extends ArtifactMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  artifacts?: any[]
  metadata?: {
    model?: string
    tokensUsed?: number
    duration?: number
  }
}

export interface WebSocketState {
  isConnected: boolean
  connectionId: string | null
  sessionId: string | null
  reconnectAttempts: number
  lastPingTime: number | null
}

export interface VoiceState {
  isEnabled: boolean
  isRecording: boolean
  isProcessing: boolean
  selectedVoice: string
  selectedModel: string
  isConnected: boolean
}

export interface ChatSettings {
  selectedModel: string
  enableFunctionCalling: boolean
  enableArtifacts: boolean
  useWebSocket: boolean
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

interface AIChatStore {
  // Messages
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  
  // WebSocket
  websocket: WebSocketState
  
  // Voice AI
  voice: VoiceState
  
  // Settings
  settings: ChatSettings
  
  // UI state
  input: string
  selectedConversationId: string | null
  showSettings: boolean
}

// Default settings
const defaultSettings: ChatSettings = {
  selectedModel: 'llama-3-8b',
  enableFunctionCalling: false,
  enableArtifacts: true,
  useWebSocket: true,
  temperature: 0.7,
  maxTokens: 2048
}

// Initial state
const initialChatState = (): AIChatStore => ({
  messages: [],
  isLoading: false,
  error: null,
  
  websocket: {
    isConnected: false,
    connectionId: null,
    sessionId: null,
    reconnectAttempts: 0,
    lastPingTime: null
  },
  
  voice: {
    isEnabled: false,
    isRecording: false,
    isProcessing: false,
    selectedVoice: '@cf/deepgram/aura-1',
    selectedModel: '@cf/deepgram/nova-3',
    isConnected: false
  },
  
  settings: defaultSettings,
  
  input: '',
  selectedConversationId: null,
  showSettings: false
})

// WebSocket and voice refs (outside of observable)
let wsRef: WebSocket | null = null
let abortControllerRef: AbortController | null = null
let voiceWsRef: WebSocket | null = null
let mediaStreamRef: MediaStream | null = null
let pingIntervalRef: number | null = null

// Create the AI chat observable store
export const aiChat$ = observable<AIChatStore>(initialChatState())

// Sync AI chat settings to localStorage
syncObservable(aiChat$, {
  persist: {
    name: 'ai-chat-settings',
    transform: {
      // Only persist settings and voice preferences
      save: (value: AIChatStore) => ({
        settings: value.settings,
        voice: {
          selectedVoice: value.voice.selectedVoice,
          selectedModel: value.voice.selectedModel
        }
      }),
      load: (value: any) => ({
        settings: value?.settings || {},
        voice: {
          selectedVoice: value?.voice?.selectedVoice || 'shimmer',
          selectedModel: value?.voice?.selectedModel || 'tts-1'
        }
      })
    }
  }
})

// AI Chat actions
export const aiChatActions = {
  // Add message
  addMessage: (messageData: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = crypto.randomUUID()
    const message: ChatMessage = {
      id,
      timestamp: Date.now(),
      ...messageData
    }
    
    // Add to messages array
    aiChat$.messages.set(prev => [...prev, message])
    
    return id
  },
  
  // Update message
  updateMessage: (id: string, updates: Partial<ChatMessage>) => {
    const messages = aiChat$.messages.get()
    const index = messages.findIndex(msg => msg.id === id)
    
    if (index !== -1) {
      // Update specific message
      aiChat$.messages[index].assign(updates)
    }
  },
  
  // Remove message
  removeMessage: (id: string) => {
    aiChat$.messages.set(prev => prev.filter(msg => msg.id !== id))
  },
  
  // Clear all messages
  clearMessages: () => {
    aiChat$.messages.set([])
  },
  
  // Send message via HTTP or WebSocket
  sendMessage: async (content: string, options: { model?: string } = {}) => {
    const state = aiChat$.get()
    const { settings, websocket } = state
    
    // Add user message
    const userMessageId = aiChatActions.addMessage({
      role: 'user',
      content,
      artifacts: []
    })
    
    aiChat$.assign({
      isLoading: true,
      error: null,
      input: ''
    })
    
    try {
      if (settings.useWebSocket && websocket.isConnected) {
        // Send via WebSocket
        aiChatActions.sendWebSocketMessage(content)
      } else {
        // Send via HTTP
        await aiChatActions.sendHttpMessage(content, options)
      }
    } catch (error) {
      aiChat$.assign({
        error: error instanceof Error ? error.message : 'Failed to send message',
        isLoading: false
      })
      // Remove user message on error
      aiChatActions.removeMessage(userMessageId)
    }
  },
  
  // Send message via HTTP
  sendHttpMessage: async (content: string, options: { model?: string } = {}) => {
    const settings = aiChat$.settings.get()
    const model = options.model || settings.selectedModel
    
    abortControllerRef = new AbortController()
    
    try {
      const apiEndpoint = settings.enableFunctionCalling && 
        (model === 'hermes-2-pro' || model === 'gemini-2.5-flash-lite') 
        ? '/api/chat-tools' 
        : '/api/chat'
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: aiChat$.messages.get().map(m => ({ role: m.role, content: m.content })),
          model,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens
        }),
        signal: abortControllerRef.signal
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Handle response based on endpoint
      if (settings.enableFunctionCalling) {
        const data = await response.json()
        
        // Parse artifacts from function calling result if enabled
        let artifacts: any[] = []
        if (settings.enableArtifacts && shouldCreateArtifact('', data.content)) {
          artifacts = parseArtifactsFromContent(data.content, crypto.randomUUID())
        }
        
        aiChatActions.addMessage({
          role: 'assistant',
          content: data.content,
          artifacts,
          metadata: { model, tokensUsed: data.tokensUsed }
        })
      } else {
        // Handle streaming response
        await aiChatActions.handleStreamingResponse(response, model)
      }
    } finally {
      aiChat$.isLoading.set(false)
      abortControllerRef = null
    }
  },
  
  // Handle streaming response
  handleStreamingResponse: async (response: Response, model: string) => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')
    
    const assistantMessageId = aiChatActions.addMessage({
      role: 'assistant',
      content: '',
      artifacts: [],
      metadata: { model }
    })
    
    let fullContent = ''
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const text = new TextDecoder().decode(value)
        const lines = text.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6))
              const content = data.choices?.[0]?.delta?.content
              if (content) {
                fullContent += content
                aiChatActions.updateMessage(assistantMessageId, { 
                  content: fullContent 
                })
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } finally {
      // Parse artifacts if enabled
      const settings = aiChat$.settings.get()
      if (settings.enableArtifacts && fullContent && shouldCreateArtifact('', fullContent)) {
        const artifacts = parseArtifactsFromContent(fullContent, assistantMessageId)
        if (artifacts.length > 0) {
          aiChatActions.updateMessage(assistantMessageId, { artifacts })
        }
      }
    }
  },
  
  // WebSocket message sending
  sendWebSocketMessage: (content: string) => {
    if (!wsRef || wsRef.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    
    const messageId = crypto.randomUUID()
    const settings = aiChat$.settings.get()
    
    wsRef.send(JSON.stringify({
      type: 'chat',
      content,
      messageId,
      enableFunctionCalling: settings.enableFunctionCalling
    }))
  },
  
  // Connect WebSocket
  connectWebSocket: () => {
    if (wsRef?.readyState === WebSocket.OPEN) return
    
    const settings = aiChat$.settings.get()
    
    try {
      const wsUrl = new URL('/ws/ai-chat', window.location.origin)
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl.searchParams.set('model', settings.selectedModel)
      
      wsRef = new WebSocket(wsUrl.toString())
      
      wsRef.onopen = () => {
        console.log('✅ Legend State WebSocket connected successfully!')
        aiChat$.websocket.assign({
          isConnected: true,
          reconnectAttempts: 0
        })
        aiChat$.error.set(null)
        
        // Start ping interval to keep connection alive
        aiChatActions.startPingInterval()
      }
      
      wsRef.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          aiChatActions.handleWebSocketMessage(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      wsRef.onclose = () => {
        aiChat$.websocket.isConnected.set(false)
        
        // Auto-reconnect logic
        const reconnectAttempts = aiChat$.websocket.reconnectAttempts.get()
        if (reconnectAttempts < 3) {
          setTimeout(() => {
            aiChat$.websocket.reconnectAttempts.set(reconnectAttempts + 1)
            aiChatActions.connectWebSocket()
          }, Math.pow(2, reconnectAttempts) * 1000)
        }
      }
      
      wsRef.onerror = () => {
        aiChat$.assign({
          error: 'WebSocket connection error',
          websocket: { ...aiChat$.websocket.get(), isConnected: false }
        })
      }
      
    } catch (error) {
      aiChat$.error.set('Failed to establish WebSocket connection')
    }
  },
  
  // Handle WebSocket messages
  handleWebSocketMessage: (data: any) => {
    const settings = aiChat$.settings.get()
    
    switch (data.type) {
      case 'connection':
        aiChat$.websocket.sessionId.set(data.sessionId)
        break
        
      case 'stream_start':
        console.log('🚀 Legend State: Stream started for message:', data.messageId)
        aiChatActions.addMessage({
          id: data.messageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          artifacts: []
        })
        break
        
      case 'stream_chunk':
        const messages = aiChat$.messages.get()
        const messageIndex = messages.findIndex(m => m.id === data.messageId)
        if (messageIndex !== -1) {
          const currentContent = aiChat$.messages[messageIndex].content.get()
          aiChat$.messages[messageIndex].content.set(currentContent + data.content)
        }
        
        if (data.done) {
          console.log('✅ Legend State: Stream completed')
          aiChat$.isLoading.set(false)
          
          // Parse artifacts from completed streaming message if enabled
          if (settings.enableArtifacts) {
            const assistantMessage = messages.find(msg => msg.id === data.messageId)
            if (assistantMessage && shouldCreateArtifact('', assistantMessage.content)) {
              const artifacts = parseArtifactsFromContent(assistantMessage.content, data.messageId)
              if (artifacts.length > 0) {
                aiChatActions.updateMessage(data.messageId, { artifacts })
              }
            }
          }
        }
        break
        
      case 'function_calling_complete':
        console.log('🔧 Legend State: Function calling completed:', data.content)
        const functionMessage: ChatMessage = {
          id: data.messageId,
          role: 'assistant',
          content: data.content,
          timestamp: Date.now(),
          artifacts: []
        }
        
        // Parse artifacts from function calling result if artifacts are enabled
        if (settings.enableArtifacts && shouldCreateArtifact('', data.content)) {
          const artifacts = parseArtifactsFromContent(data.content, data.messageId)
          functionMessage.artifacts = artifacts
        }
        
        aiChat$.messages.set(prev => [...prev, functionMessage])
        aiChat$.isLoading.set(false)
        break
        
      case 'error':
      case 'stream_error':
      case 'function_calling_error':
        aiChat$.assign({
          error: data.message || data.error,
          isLoading: false
        })
        break
        
      case 'pong':
        aiChat$.websocket.lastPingTime.set(Date.now())
        break
        
      case 'generation_stopped':
        console.log('✅ Legend State: Generation stopped confirmation received')
        aiChat$.isLoading.set(false)
        break
    }
  },
  
  // Start ping interval
  startPingInterval: () => {
    aiChatActions.stopPingInterval()
    
    pingIntervalRef = setInterval(() => {
      if (wsRef?.readyState === WebSocket.OPEN) {
        wsRef.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // Ping every 30 seconds
  },
  
  // Stop ping interval
  stopPingInterval: () => {
    if (pingIntervalRef) {
      clearInterval(pingIntervalRef)
      pingIntervalRef = null
    }
  },
  
  // Disconnect WebSocket
  disconnectWebSocket: () => {
    aiChatActions.stopPingInterval()
    
    if (wsRef) {
      wsRef.close()
      wsRef = null
    }
    
    aiChat$.websocket.assign({
      isConnected: false,
      sessionId: null,
      connectionId: null
    })
  },
  
  // Voice recording
  startVoiceRecording: async () => {
    try {
      aiChat$.voice.assign({
        isRecording: true,
        isProcessing: false
      })
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef = stream
      
      // Connect to voice WebSocket
      const voice = aiChat$.voice.get()
      const voiceWsUrl = new URL('/ws/voice-ai', window.location.origin)
      voiceWsUrl.protocol = voiceWsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      voiceWsUrl.searchParams.set('voice', voice.selectedVoice)
      voiceWsUrl.searchParams.set('model', voice.selectedModel)
      
      voiceWsRef = new WebSocket(voiceWsUrl.toString())
      
      voiceWsRef.onopen = () => {
        aiChat$.voice.isConnected.set(true)
      }
      
      voiceWsRef.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'transcription' && data.text) {
          aiChat$.input.set(data.text)
          aiChatActions.stopVoiceRecording()
        }
      }
      
    } catch (error) {
      aiChat$.assign({
        voice: { ...aiChat$.voice.get(), isRecording: false },
        error: 'Failed to start voice recording'
      })
    }
  },
  
  // Stop voice recording
  stopVoiceRecording: () => {
    aiChat$.voice.assign({
      isRecording: false,
      isProcessing: true
    })
    
    if (mediaStreamRef) {
      mediaStreamRef.getTracks().forEach(track => track.stop())
      mediaStreamRef = null
    }
    
    if (voiceWsRef) {
      voiceWsRef.close()
      voiceWsRef = null
    }
    
    setTimeout(() => {
      aiChat$.voice.assign({
        isProcessing: false,
        isConnected: false
      })
    }, 1000)
  },
  
  // Toggle voice mode
  toggleVoiceMode: () => {
    const isEnabled = aiChat$.voice.isEnabled.get()
    aiChat$.voice.isEnabled.set(!isEnabled)
    
    if (aiChat$.voice.isRecording.get()) {
      aiChatActions.stopVoiceRecording()
    }
  },
  
  // Update settings
  updateSettings: (updates: Partial<ChatSettings>) => {
    aiChat$.settings.assign(updates)
    
    // Reconnect WebSocket if model changed and connected
    if (updates.selectedModel && aiChat$.websocket.isConnected.get()) {
      aiChatActions.disconnectWebSocket()
      setTimeout(() => aiChatActions.connectWebSocket(), 100)
    }
  },
  
  // Set input
  setInput: (input: string) => {
    aiChat$.input.set(input)
  },
  
  // Set error
  setError: (error: string | null) => {
    aiChat$.error.set(error)
  },
  
  // Set loading
  setLoading: (loading: boolean) => {
    aiChat$.isLoading.set(loading)
  },
  
  // Stop generation
  stopGeneration: () => {
    const settings = aiChat$.settings.get()
    const websocket = aiChat$.websocket.get()
    
    console.log('🛑 Stopping generation...')
    
    // Stop HTTP requests if using HTTP mode or as fallback
    if (abortControllerRef) {
      console.log('🛑 Aborting HTTP request')
      abortControllerRef.abort()
      abortControllerRef = null
    }
    
    // Stop WebSocket generation if using WebSocket mode
    if (settings.useWebSocket && websocket.isConnected && wsRef) {
      console.log('🛑 Sending WebSocket stop signal')
      try {
        wsRef.send(JSON.stringify({
          type: 'stop_generation',
          timestamp: Date.now()
        }))
      } catch (error) {
        console.error('❌ Failed to send WebSocket stop signal:', error)
      }
    }
    
    // Always set loading to false
    aiChat$.isLoading.set(false)
    console.log('✅ Generation stopped')
  },
  
  // Reset all state
  reset: () => {
    aiChatActions.disconnectWebSocket()
    aiChatActions.stopVoiceRecording()
    aiChatActions.stopPingInterval()
    aiChat$.assign(initialChatState())
  }
}

// Computed values using Legend State's computed observables
export const aiChatComputed = {
  // Get last message
  lastMessage: () => {
    const messages = aiChat$.messages.get()
    return messages[messages.length - 1] || null
  },
  
  // Get assistant messages count
  assistantMessageCount: () => {
    return aiChat$.messages.get().filter(m => m.role === 'assistant').length
  },
  
  // Get conversation stats
  conversationStats: () => {
    const messages = aiChat$.messages.get()
    const tokenCount = messages.reduce((sum, msg) => 
      sum + (msg.metadata?.tokensUsed || 0), 0
    )
    
    return {
      messageCount: messages.length,
      tokenCount,
      hasArtifacts: messages.some(m => (m.artifacts?.length || 0) > 0)
    }
  },
  
  // Check if ready to send
  canSend: () => {
    const input = aiChat$.input.get()
    const isLoading = aiChat$.isLoading.get()
    const settings = aiChat$.settings.get()
    const websocket = aiChat$.websocket.get()
    
    return input.trim().length > 0 && 
           !isLoading && 
           (settings.useWebSocket ? websocket.isConnected : true)
  }
}

// Export commonly used selectors for convenience
export const aiChatSelectors = {
  messages: () => aiChat$.messages.get(),
  isLoading: () => aiChat$.isLoading.get(),
  error: () => aiChat$.error.get(),
  input: () => aiChat$.input.get(),
  settings: () => aiChat$.settings.get(),
  websocket: () => aiChat$.websocket.get(),
  voice: () => aiChat$.voice.get()
}