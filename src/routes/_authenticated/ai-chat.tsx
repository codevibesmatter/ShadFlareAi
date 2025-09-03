import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Loader2, Bot, Wrench, Sparkles, Mic, MicOff, Volume2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useState, useRef, useEffect } from 'react'
import { useWebSocket } from '@/hooks/use-websocket'
import type { WebSocketMessage } from '@/lib/websocket-manager'
import { Streamdown } from 'streamdown'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/conversation'
import { Message, MessageContent, MessageAvatar } from '@/components/message'
import { ArtifactMessageComponent } from '@/components/artifacts/artifact-message'
import { useArtifacts } from '@/hooks/use-artifacts'
import { parseArtifactsFromContent, shouldCreateArtifact } from '@/utils/artifact-parser'
import type { ArtifactMessage } from '@/types/artifacts'
import { Actions, Action } from '@/components/actions'
import { Suggestions, Suggestion } from '@/components/suggestion'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/reasoning'
import { CodeBlock, CodeBlockCopyButton } from '@/components/code-block'
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Share, BookmarkPlus } from 'lucide-react'
import { aiLog, voiceLog } from '@/lib/logger'

// Use ArtifactMessage type for enhanced message handling

function AIChatPage() {
  // Using AI Elements components for better chat experience
  const [selectedModel, setSelectedModel] = useState('llama-3-8b')
  const [messages, setMessages] = useState<ArtifactMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enableFunctionCalling, setEnableFunctionCalling] = useState(false)
  const [useWebSocketEnabled, setUseWebSocketEnabled] = useState(true)
  const [enableArtifacts, setEnableArtifacts] = useState(true)
  
  // Voice AI integration
  const [isVoiceMode, setIsVoiceMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('@cf/deepgram/aura-1')
  const [selectedVoiceModel, setSelectedVoiceModel] = useState('@cf/deepgram/nova-3')
  const [liveTranscription, setLiveTranscription] = useState('')
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([])
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const conversationRef = useRef<HTMLDivElement | null>(null)
  const { artifacts, createArtifact } = useArtifacts()
  const lastUserMessageRef = useRef<string>('')
  
  // WebSocket management
  const { 
    isConnected: wsConnected, 
    sessionId, 
    sendChatMessage, 
    setEnabled: setWebSocketEnabled,
    stopGeneration: stopWebSocketGeneration
  } = useWebSocket({
    enabled: useWebSocketEnabled,
    model: selectedModel,
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      const logger = aiLog('ai-chat.tsx')
      logger.error('WebSocket connection error', error)
      setError(error.message || 'WebSocket connection error')
    }
  })
  
  // Voice AI refs
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const voiceWsRef = useRef<WebSocket | null>(null)

  // Voice AI functions
  const startVoiceRecording = async () => {
    const logger = aiLog('ai-chat.tsx')
    const voiceLogger = voiceLog('ai-chat.tsx')
    
    try {
      voiceLogger.info('Starting voice recording...')
      setIsRecording(true)
      setIsProcessingVoice(false)
      
      // Clear previous transcriptions
      setLiveTranscription('')
      setTranscriptionHistory([])
      setInput('')
      
      // Get microphone access with proper audio constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      })
      mediaStreamRef.current = stream
      
      // Connect to voice WebSocket
      const voiceWs = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/voice-ai?voice=${encodeURIComponent(selectedVoice)}&model=${encodeURIComponent(selectedVoiceModel)}`)
      voiceWsRef.current = voiceWs
      
      voiceWs.onopen = async () => {
        voiceLogger.info('Voice WebSocket connected')
        
        // Start audio processing
        const audioContext = new AudioContext({ sampleRate: 16000 })
        const source = audioContext.createMediaStreamSource(stream)
        
        // Create and connect ScriptProcessorNode for audio processing
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        
        processor.onaudioprocess = (event) => {
          if (!isRecording || voiceWs.readyState !== WebSocket.OPEN) return
          
          const inputBuffer = event.inputBuffer
          const inputData = inputBuffer.getChannelData(0)
          
          // Convert Float32Array to 16-bit PCM
          const samples = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            samples[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
          }
          
          // Convert to base64 for transmission
          const buffer = new ArrayBuffer(samples.length * 2)
          const view = new DataView(buffer)
          for (let i = 0; i < samples.length; i++) {
            view.setInt16(i * 2, samples[i], true)
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
          
          // Send audio chunk
          voiceWs.send(JSON.stringify({
            type: 'audio_chunk',
            data: base64,
            timestamp: Date.now()
          }))
        }
        
        source.connect(processor)
        processor.connect(audioContext.destination)
        
        // Send start recording message
        voiceWs.send(JSON.stringify({ type: 'start_recording' }))
      }
      
      voiceWs.onmessage = (event) => {
        const data = JSON.parse(event.data)
        voiceLogger.debug('Voice message received', { type: data.type })
        
        if (data.type === 'live_transcription' && data.text) {
          voiceLogger.debug('Live transcription received', { text: data.text.substring(0, 50) + '...' })
          
          // Update live transcription display
          setLiveTranscription(prev => {
            // If the transcription is new, add it to history
            if (data.text && !transcriptionHistory.includes(data.text)) {
              setTranscriptionHistory(prev => [...prev, data.text])
            }
            return data.text
          })
          
          // Auto-populate input field with accumulated transcription
          const fullTranscription = transcriptionHistory.join(' ') + ' ' + data.text
          setInput(fullTranscription.trim())
        } else if (data.type === 'transcription' && data.text) {
          // Handle old format for compatibility
          voiceLogger.info('Final transcription received', { length: data.text.length })
          setInput(data.text)
          stopVoiceRecording()
        }
      }
      
      voiceWs.onerror = (error) => {
        voiceLogger.error('Voice WebSocket error', error)
        stopVoiceRecording()
      }
      
    } catch (error) {
      voiceLogger.error('Error starting voice recording', error)
      setIsRecording(false)
    }
  }

  const stopVoiceRecording = () => {
    const voiceLogger = voiceLog('ai-chat.tsx')
    voiceLogger.info('Stopping voice recording...')
    setIsRecording(false)
    setIsProcessingVoice(true)
    
    // Send stop recording message
    if (voiceWsRef.current && voiceWsRef.current.readyState === WebSocket.OPEN) {
      voiceWsRef.current.send(JSON.stringify({ type: 'stop_recording' }))
    }
    
    // Stop microphone after a brief delay to allow final audio chunks
    setTimeout(() => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
        mediaStreamRef.current = null
      }
      
      // Close voice WebSocket
      if (voiceWsRef.current) {
        voiceWsRef.current.close()
        voiceWsRef.current = null
      }
      
      setIsProcessingVoice(false)
    }, 500)
  }
  
  const playAudioResponse = async (base64Audio: string) => {
    try {
      // Decode base64 audio
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0))
      
      // Create audio context and decode
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(audioData.buffer)
      
      // Play the audio
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      source.start()
      
      const voiceLogger = voiceLog('ai-chat.tsx')
      voiceLogger.info('AI audio response played successfully')
    } catch (error) {
      const voiceLogger = voiceLog('ai-chat.tsx')
      voiceLogger.error('Error playing audio response', error)
    }
  }

  const toggleVoiceMode = () => {
    setIsVoiceMode(!isVoiceMode)
    if (isRecording) {
      stopVoiceRecording()
    }
  }

  // WebSocket message handler
  function handleWebSocketMessage(data: WebSocketMessage) {
    const logger = aiLog('ai-chat.tsx')
    logger.debug('WebSocket message received', { type: data.type, messageId: data.messageId })
    
    switch (data.type) {
      case 'connection':
        logger.info('Connection established', { sessionId: data.sessionId })
        break
        
      case 'stream_start':
        logger.info('Stream started', { messageId: data.messageId })
        setMessages(prev => [...prev, {
          id: data.messageId!,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          artifacts: []
        }])
        break

      case 'stream_chunk':
        logger.debug('Stream chunk received', { contentLength: data.content?.length, messageId: data.messageId })
        setMessages(prev => prev.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: msg.content + data.content }
            : msg
        ))

        if (data.done) {
          logger.info('Stream completed', { messageId: data.messageId })
          setIsLoading(false)
          
          // Parse artifacts from completed message if artifacts are enabled
          if (enableArtifacts) {
            setMessages(prevMessages => {
              const assistantMessage = prevMessages.find(msg => msg.id === data.messageId)
              if (assistantMessage && shouldCreateArtifact(lastUserMessageRef.current, assistantMessage.content)) {
                const artifacts = parseArtifactsFromContent(assistantMessage.content, data.messageId!)
                if (artifacts.length > 0) {
                  return prevMessages.map(msg =>
                    msg.id === data.messageId
                      ? { ...msg, artifacts: artifacts }
                      : msg
                  )
                }
              }
              return prevMessages
            })
          }
        }
        break

      case 'function_calling_complete':
        logger.info('Function calling completed', { messageId: data.messageId, contentLength: data.content?.length })
        const functionMessage: ArtifactMessage = {
          id: data.messageId!,
          role: 'assistant',
          content: data.content!,
          timestamp: Date.now(),
          artifacts: []
        }
        
        // Parse artifacts from function calling result if artifacts are enabled
        if (enableArtifacts && shouldCreateArtifact(lastUserMessageRef.current, data.content!)) {
          const artifacts = parseArtifactsFromContent(data.content!, data.messageId!)
          functionMessage.artifacts = artifacts
        }
        
        setMessages(prev => [...prev, functionMessage])
        setIsLoading(false)
        break

      case 'error':
      case 'stream_error':
      case 'function_calling_error':
        logger.error('WebSocket error', data.message || data.error)
        setError(data.message || data.error)
        setIsLoading(false)
        break

      case 'pong':
        logger.debug('Pong received')
        break

      case 'generation_stopped':
        logger.info('Generation stopped confirmation received')
        setIsLoading(false)
        break

      default:
        logger.warn('Unknown message type', { type: data.type })
    }
  }

  const getContextualSuggestions = () => {
    if (messages.length === 0) {
      return [
        'Create a simple React component',
        'Write a Python function',
        'Help me debug this code',
        'Explain this concept',
        'Generate a HTML page'
      ]
    }
    
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant') {
      if (lastMessage.artifacts && lastMessage.artifacts.length > 0) {
        return [
          'Modify the component',
          'Add more features',
          'Explain how this works',
          'Create a similar component',
          'Add styling'
        ]
      } else {
        return [
          'Can you show me code examples?',
          'Create an artifact for this',
          'Make this interactive',
          'Add more details',
          'What are the alternatives?'
        ]
      }
    }
    
    return [
      'Continue this conversation',
      'Ask a follow-up question',
      'Create something new',
      'Explain further',
      'Show me examples'
    ]
  }

  // WebSocket message sending helper
  const sendWebSocketMessage = (content: string) => {
    const logger = aiLog('ai-chat.tsx')
    
    if (!wsConnected) {
      logger.error('WebSocket not connected')
      setError('WebSocket not connected. Please try again.')
      return
    }

    const messageId = crypto.randomUUID()
    logger.info('Sending message via WebSocket', { messageId, contentLength: content.length })
    
    // Store user message for artifact parsing
    lastUserMessageRef.current = content
    
    // Add user message immediately
    const userMessage: ArtifactMessage = {
      id: `user_${messageId}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      artifacts: []
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    // Send via WebSocket manager
    const success = sendChatMessage(content, { enableFunctionCalling })
    
    if (!success) {
      setError('Failed to send message. Please try again.')
      setIsLoading(false)
      // Remove the user message if send failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    }
  }

  // Update WebSocket enabled state
  useEffect(() => {
    setWebSocketEnabled(useWebSocketEnabled)
  }, [useWebSocketEnabled, setWebSocketEnabled])

  // Auto-scroll effect when messages change
  useEffect(() => {
    if (messages.length > 0 && conversationRef.current) {
      // Use a small timeout to ensure content is rendered
      setTimeout(() => {
        const scrollContainer = conversationRef.current?.querySelector('[role="log"]')
        if (scrollContainer) {
          // Scroll to bottom with smooth behavior
          scrollContainer.scrollTo({
            top: scrollContainer.scrollHeight,
            behavior: 'smooth'
          })
        }
      }, 100)
    }
  }, [messages])

  // Additional effect to handle streaming content updates
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content) {
      // Scroll on content updates for streaming
      setTimeout(() => {
        const scrollContainer = conversationRef.current?.querySelector('[role="log"]')
        if (scrollContainer) {
          const shouldAutoScroll = scrollContainer.scrollTop + scrollContainer.clientHeight + 100 >= scrollContainer.scrollHeight
          if (shouldAutoScroll) {
            scrollContainer.scrollTo({
              top: scrollContainer.scrollHeight,
              behavior: 'smooth'
            })
          }
        }
      }, 50)
    }
  }, [messages.map(m => m.content).join('')])
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // Use WebSocket or HTTP based on toggle
    if (useWebSocketEnabled) {
      if (!wsConnected) {
        setError('WebSocket not connected. Please try again.')
        return
      }
      sendWebSocketMessage(input.trim())
      setInput('')
      return
    }

    // Store user message for artifact parsing
    lastUserMessageRef.current = input.trim()
    
    const userMessage: ArtifactMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      artifacts: []
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      // Use function calling API if enabled and supported model is selected
      const shouldUseFunctionCalling = enableFunctionCalling && (selectedModel === 'hermes-2-pro' || selectedModel === 'gemini-2.5-flash-lite')
      const apiEndpoint = shouldUseFunctionCalling ? '/api/chat-tools' : '/api/chat'
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel,
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Create assistant message
      const assistantMessage: ArtifactMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        artifacts: []
      }

      setMessages(prev => [...prev, assistantMessage])

      if (shouldUseFunctionCalling) {
        // Handle function calling response (non-streaming)
        const data: any = await response.json()
        
        // Parse artifacts from function calling result if artifacts are enabled
        let artifacts: any[] = []
        if (enableArtifacts && shouldCreateArtifact(lastUserMessageRef.current, data.content)) {
          artifacts = parseArtifactsFromContent(data.content, assistantMessage.id)
        }
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessage.id 
              ? { ...m, content: data.content, artifacts }
              : m
          )
        )
      } else {
        // Handle streaming response
        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        let fullContent = ''
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
                  setMessages(prev => 
                    prev.map(m => 
                      m.id === assistantMessage.id 
                        ? { ...m, content: m.content + content }
                        : m
                    )
                  )
                }
              } catch (e) {
                // Ignore parsing errors for individual chunks
              }
            }
          }
        }
        
        // Parse artifacts from completed message if artifacts are enabled
        if (enableArtifacts && shouldCreateArtifact(lastUserMessageRef.current, fullContent)) {
          const artifacts = parseArtifactsFromContent(fullContent, assistantMessage.id)
          if (artifacts.length > 0) {
            setMessages(prev => 
              prev.map(m => 
                m.id === assistantMessage.id 
                  ? { ...m, artifacts }
                  : m
              )
            )
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was aborted, don't set error
        return
      }
      setError(err.message || 'Failed to send message')
      setMessages(prev => prev.filter(m => m.id !== userMessage.id))
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const stop = () => {
    const logger = aiLog('ai-chat.tsx')
    logger.info('Stopping generation...')
    
    // Stop HTTP requests if using HTTP mode or as fallback
    if (abortControllerRef.current) {
      logger.debug('Aborting HTTP request')
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // Stop WebSocket generation if using WebSocket mode
    if (useWebSocketEnabled && wsConnected) {
      logger.debug('Stopping WebSocket generation')
      const success = stopWebSocketGeneration()
      if (!success) {
        logger.warn('Failed to send WebSocket stop signal')
      }
    }
    
    // Always set loading to false
    setIsLoading(false)
    logger.info('Generation stopped')
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const handleRegenerateResponse = (messageId: string) => {
    // Find the user message before this assistant message
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex > 0) {
      const userMessage = messages[messageIndex - 1]
      if (userMessage.role === 'user') {
        // Remove the assistant message and regenerate
        setMessages(prev => prev.filter(m => m.id !== messageId))
        if (useWebSocketEnabled) {
          sendWebSocketMessage(userMessage.content)
        } else {
          // Trigger HTTP regeneration
          lastUserMessageRef.current = userMessage.content
          handleSubmit({ preventDefault: () => {} } as React.FormEvent)
        }
      }
    }
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main fixed>
        <Card className='h-[calc(100vh-12rem)] flex flex-col'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-3 flex-shrink-0'>
            <div>
              <CardTitle>Chat Interface</CardTitle>
              <CardDescription>Ask questions and get AI-powered responses</CardDescription>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='websocket-mode'
                  checked={useWebSocketEnabled}
                  onCheckedChange={setUseWebSocketEnabled}
                />
                <Label htmlFor='websocket-mode' className='flex items-center gap-1 text-sm'>
                  WebSocket
                  {wsConnected && <span className='h-2 w-2 bg-green-500 rounded-full ml-1' />}
                  {sessionId && <span className='text-xs text-muted-foreground ml-1'>({sessionId.slice(0, 8)})</span>}
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='function-calling'
                  checked={enableFunctionCalling}
                  onCheckedChange={setEnableFunctionCalling}
                  disabled={selectedModel !== 'hermes-2-pro' && selectedModel !== 'gemini-2.5-flash-lite'}
                />
                <Label htmlFor='function-calling' className='flex items-center gap-1 text-sm'>
                  <Wrench className='h-3 w-3' />
                  Tools
                </Label>
              </div>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='artifacts'
                  checked={enableArtifacts}
                  onCheckedChange={setEnableArtifacts}
                />
                <Label htmlFor='artifacts' className='flex items-center gap-1 text-sm'>
                  <Sparkles className='h-3 w-3' />
                  Artifacts
                </Label>
              </div>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className='w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='llama-3-8b'>Llama 3 8B</SelectItem>
                  <SelectItem value='mistral-7b'>Mistral 7B</SelectItem>
                  <SelectItem value='qwen-1.5'>Qwen 1.5 14B</SelectItem>
                  <SelectItem value='codellama'>Code Llama</SelectItem>
                  <SelectItem value='hermes-2-pro'>Hermes 2 Pro (Function Calling)</SelectItem>
                  <SelectItem value='gemini-2.5-flash-lite'>Gemini 2.5 Flash Lite (AI Gateway)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className='flex flex-col flex-1 p-0 min-h-0'>
            <div className='flex-1 min-h-0 relative'>
              {messages.length === 0 && !isLoading ? (
                <div className='flex h-full items-center justify-center'>
                  <div className='text-center max-w-md'>
                    <Bot className='mx-auto h-12 w-12 text-muted-foreground/50' />
                    <p className='mt-4 text-muted-foreground'>
                      Start a conversation with the AI assistant
                    </p>
                    <div className='space-y-4'>
                      {enableFunctionCalling && (selectedModel === 'hermes-2-pro' || selectedModel === 'gemini-2.5-flash-lite') && (
                        <div className='p-3 bg-blue-50 dark:bg-blue-950 rounded-lg'>
                          <div className='flex items-center gap-2 text-blue-700 dark:text-blue-300 mb-2'>
                            <Wrench className='h-4 w-4' />
                            <span className='font-medium'>Function Calling Enabled</span>
                          </div>
                          <p className='text-sm text-blue-600 dark:text-blue-400'>
                            The AI can now use tools like calculator, current time, random numbers, task creation, and API testing.
                          </p>
                        </div>
                      )}
                      
                      {enableArtifacts && (
                        <div className='p-3 bg-purple-50 dark:bg-purple-950 rounded-lg'>
                          <div className='flex items-center gap-2 text-purple-700 dark:text-purple-300 mb-2'>
                            <Sparkles className='h-4 w-4' />
                            <span className='font-medium'>Artifacts Enabled</span>
                          </div>
                          <p className='text-sm text-purple-600 dark:text-purple-400'>
                            The AI can create interactive artifacts like code components, HTML pages, and visualizations.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div ref={conversationRef} className='h-full'>
                  <Conversation className='h-full'>
                    <ConversationContent>
                      {messages.map((message, index) => {
                        const isLastMessage = index === messages.length - 1
                        const isStreaming = isLoading && isLastMessage && message.role === 'assistant'
                        
                        return (
                          <Message key={message.id} from={message.role}>
                            <MessageAvatar
                              src={message.role === 'user' ? '/user-avatar.png' : '/bot-avatar.png'}
                              name={message.role === 'user' ? 'You' : 'AI'}
                            />
                            <MessageContent>
                              {/* Add reasoning display for assistant messages */}
                              {message.role === 'assistant' && (
                                <Reasoning
                                  isStreaming={isStreaming}
                                  defaultOpen={false}
                                  duration={isStreaming ? 0 : Math.floor(Math.random() * 3) + 1}
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>
                                    Analyzing the request and determining the best approach to provide a helpful and accurate response. Considering context, technical requirements, and user needs.
                                  </ReasoningContent>
                                </Reasoning>
                              )}
                              
                              <ArtifactMessageComponent 
                                message={message}
                              />
                              
                              {/* Add message actions for assistant messages */}
                              {message.role === 'assistant' && message.content && (
                                <Actions className="mt-2">
                                  <Action
                                    tooltip="Copy message"
                                    onClick={() => handleCopyMessage(message.content)}
                                  >
                                    <Copy size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Good response"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat.tsx')
                                      logger.debug('Thumbs up clicked', { messageId: message.id })
                                    }}
                                  >
                                    <ThumbsUp size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Poor response"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat.tsx')
                                      logger.debug('Thumbs down clicked', { messageId: message.id })
                                    }}
                                  >
                                    <ThumbsDown size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Regenerate response"
                                    onClick={() => handleRegenerateResponse(message.id)}
                                  >
                                    <RefreshCw size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Share message"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat.tsx')
                                      logger.debug('Share clicked', { messageId: message.id })
                                    }}
                                  >
                                    <Share size={14} />
                                  </Action>
                                  <Action
                                    tooltip="Save message"
                                    onClick={() => {
                                      const logger = aiLog('ai-chat.tsx')
                                      logger.debug('Save clicked', { messageId: message.id })
                                    }}
                                  >
                                    <BookmarkPlus size={14} />
                                  </Action>
                                </Actions>
                              )}
                            </MessageContent>
                          </Message>
                        )
                      })}
                      
                      {isLoading && (
                        <Message from="assistant">
                          <MessageAvatar
                            src="/bot-avatar.png"
                            name="AI"
                          />
                          <MessageContent>
                            <div className='flex items-center gap-2'>
                              <Loader2 className='h-4 w-4 animate-spin' />
                              <span className='text-sm text-muted-foreground'>
                                {useWebSocketEnabled ? `Connected via WebSocket ${wsConnected ? '✓' : '✗'}` : 'Processing...'}
                              </span>
                            </div>
                          </MessageContent>
                        </Message>
                      )}
                    </ConversationContent>
                    
                    <ConversationScrollButton />
                  </Conversation>
                </div>
              )}
              
              {error && (
                <div className='absolute bottom-0 left-0 right-0 text-center text-sm text-red-500 bg-background/80 p-2'>
                  Error: {error}
                </div>
              )}
            </div>

            <div className='border-t p-4 flex-shrink-0'>
              {/* Add contextual suggestions */}
              {!isLoading && (
                <div className="mb-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {messages.length === 0 ? 'Try these suggestions:' : 'Continue with:'}
                  </p>
                  <Suggestions>
                    {getContextualSuggestions().map((suggestion, index) => (
                      <Suggestion
                        key={index}
                        suggestion={suggestion}
                        onClick={handleSuggestionClick}
                      />
                    ))}
                  </Suggestions>
                </div>
              )}
              
              {/* Live Transcription Display */}
              {isVoiceMode && (isRecording || liveTranscription) && (
                <div className='bg-blue-50 border border-blue-200 rounded-lg p-3 min-h-[60px] mb-4'>
                  <div className='flex items-center gap-2 mb-2'>
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className='text-sm font-medium text-blue-700'>
                      {isRecording ? 'Listening...' : 'Transcription Complete'}
                    </span>
                  </div>
                  <div className='text-sm text-gray-700'>
                    {liveTranscription || (isRecording ? 'Start speaking...' : '')}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className='flex gap-2'>
                  <div className='flex-1 relative'>
                    <Input
                      value={input}
                      onChange={handleInputChange}
                      placeholder={isVoiceMode ? 'Click microphone to speak...' : 'Type your message...'}
                      disabled={isLoading || isRecording}
                      className='pr-12'
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={toggleVoiceMode}
                      className='absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0'
                    >
                      <Volume2 className={`h-4 w-4 ${isVoiceMode ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    </Button>
                  </div>
                  
                  {isVoiceMode ? (
                    <Button
                      type='button'
                      onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                      disabled={isProcessingVoice}
                      className={`${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
                    >
                      {isProcessingVoice ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : isRecording ? (
                        <MicOff className='h-4 w-4' />
                      ) : (
                        <Mic className='h-4 w-4' />
                      )}
                    </Button>
                  ) : (
                    <Button type='submit' disabled={isLoading || !input.trim()}>
                      {isLoading ? (
                        <Loader2 className='h-4 w-4 animate-spin' />
                      ) : (
                        <Send className='h-4 w-4' />
                      )}
                    </Button>
                  )}
                  
                  {isLoading && (
                    <Button onClick={stop} variant='outline' type='button'>
                      Stop
                    </Button>
                  )}
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/ai-chat')({
  component: AIChatPage,
})