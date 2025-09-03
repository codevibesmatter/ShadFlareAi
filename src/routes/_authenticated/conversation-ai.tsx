import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Mic, 
  MicOff, 
  MessageCircle, 
  Brain, 
  Volume2, 
  VolumeX,
  Play, 
  Pause, 
  RotateCcw,
  Users,
  Zap
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useVoiceWebSocket } from '@/hooks/use-voice-websocket'

interface ConversationTurn {
  id: string
  type: 'user' | 'ai'
  text: string
  timestamp: Date
  audioUrl?: string
  confidence?: number
  processing?: boolean
}

interface ConversationState {
  phase: 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  turnProgress: number
  currentTurn?: string
}

function ConversationAIPage() {
  // Conversation state
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: 'idle',
    turnProgress: 0
  })
  
  // Audio settings
  const [isEnabled, setIsEnabled] = useState(false)
  const [voiceVolume, setVoiceVolume] = useState(0.8)
  const [selectedVoice, setSelectedVoice] = useState('angus')
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  
  // WebSocket connection - always enabled for connection, but conversation controlled by isEnabled
  const { 
    isConnected, 
    send,
    sendAudioChunk,
    setEnabled 
  } = useVoiceWebSocket({
    enabled: true, // Always maintain WebSocket connection
    voice: 'aura',
    model: 'nova-3',
    onMessage: handleVoiceMessage,
    onError: (error) => {
      console.error('Voice WebSocket error:', error)
      setConversationState(prev => ({ ...prev, phase: 'error' }))
    }
  })

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const conversationEndRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  
  // Audio capture state
  const [isMicActive, setIsMicActive] = useState(false)
  
  // Helper function to convert base64 audio to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  function handleVoiceMessage(data: any) {
    console.log('🎯 Conversation AI message:', data.type, data)
    
    switch (data.type) {
      case 'connection':
        console.log('🔗 Conversation AI connected')
        break
        
      case 'session_created':
        console.log('🎯 Conversation AI session created:', data.sessionId)
        break
        
      case 'conversation_started':
        console.log('✅ Conversation AI started successfully')
        setConversationState(prev => ({ ...prev, phase: 'listening' }))
        // Start microphone capture when conversation begins
        startMicrophone()
        break
        
      case 'turn_detected':
        // Smart Turn v2 detected end of user speech
        if (data.is_complete && data.probability > 0.7) {
          setConversationState(prev => ({
            ...prev,
            phase: 'processing',
            turnProgress: 0
          }))
          
          // Trigger STT processing
          send({
            type: 'process_turn',
            sessionId: data.sessionId
          })
        }
        break
        
      case 'transcription_result':
        // STT completed - add user message and trigger LLM
        if (data.text && data.text.trim()) {
          const userTurn: ConversationTurn = {
            id: `user-${Date.now()}`,
            type: 'user',
            text: data.text.trim(),
            timestamp: new Date(),
            confidence: data.confidence
          }
          
          setConversation(prev => [...prev, userTurn])
          setConversationState(prev => ({
            ...prev,
            phase: 'processing',
            turnProgress: 33,
            currentTurn: 'Thinking...'
          }))
          
          // Trigger LLM processing
          send({
            type: 'generate_response',
            text: data.text.trim(),
            conversationHistory: conversation.slice(-5) // Last 5 turns for context
          })
        }
        break
        
      case 'llm_response':
        // LLM completed - add AI message and trigger TTS
        if (data.text) {
          const aiTurn: ConversationTurn = {
            id: `ai-${Date.now()}`,
            type: 'ai',
            text: data.text,
            timestamp: new Date(),
            processing: true
          }
          
          setConversation(prev => [...prev, aiTurn])
          setConversationState(prev => ({
            ...prev,
            phase: 'processing',
            turnProgress: 66,
            currentTurn: 'Generating voice...'
          }))
          
          // Trigger TTS
          send({
            type: 'generate_tts',
            text: data.text,
            voice: selectedVoice
          })
        }
        break
        
      case 'tts_ready':
        // TTS completed - play audio (guard against multiple concurrent audio plays)
        if (data.audioData && !isPlayingAudio) {
          setIsPlayingAudio(true)
          setConversationState(prev => ({
            ...prev,
            phase: 'speaking',
            turnProgress: 100,
            currentTurn: 'Speaking...'
          }))
          
          // Convert base64 audio to blob URL (Aura-1 TTS generates MP3 format)
          const audioBlob = base64ToBlob(data.audioData, 'audio/mp3')
          const audioUrl = URL.createObjectURL(audioBlob)
          
          // Update conversation with audio URL (find the most recent AI message)
          setConversation(prev => prev.map((turn, index) => 
            turn.type === 'ai' && index === prev.length - 1 
              ? { ...turn, audioUrl: audioUrl, processing: false } 
              : turn
          ))
          
          // Play TTS audio
          playAIResponse(audioUrl)
        } else if (isPlayingAudio) {
          console.log('🔊 TTS audio already playing, ignoring duplicate message')
        }
        break
        
      case 'conversation_error':
        // Handle conversation processing errors
        console.error('❌ Conversation error:', data.error)
        setConversationState(prev => ({ 
          ...prev, 
          phase: 'error',
          currentTurn: data.error 
        }))
        break
        
      case 'audio_chunk':
        // Real-time audio processing for Smart Turn v2
        setConversationState(prev => ({
          ...prev,
          phase: 'listening',
          turnProgress: Math.min((data.chunkIndex || 0) * 5, 95)
        }))
        break
        
      case 'transcription_result':
        // Handle STT completion from the 4-model pipeline
        if (data.text && data.text.trim()) {
          console.log('📝 STT transcription received:', data.text)
          
          // Add transcription as user message
          const userTurn: ConversationTurn = {
            id: `user-${Date.now()}`,
            type: 'user',
            text: data.text.trim(),
            timestamp: new Date(),
            confidence: data.confidence
          }
          
          setConversation(prev => [...prev, userTurn])
          setConversationState(prev => ({
            ...prev,
            phase: 'processing',
            turnProgress: 33,
            currentTurn: 'Thinking...'
          }))
        }
        break
        
      case 'metrics':
        // Handle audio quality metrics - just log for now
        console.log(`📊 Audio metrics: ${data.quality} quality, ${data.latency}ms latency, buffer: ${data.bufferSize}`)
        break
        
      case 'conversation_stopped':
        console.log('🛑 Conversation stopped by server')
        break
        
      case 'conversation_error':
        console.error('❌ Conversation error:', data.error || data.message)
        break
        
      case 'tts_error':
        console.error('❌ TTS error:', data.error)
        setConversationState(prev => ({ 
          ...prev, 
          phase: 'error',
          currentTurn: `Speech generation failed: ${data.error}` 
        }))
        break
        
      default:
        console.log('❓ Unknown conversation message:', data.type)
    }
  }

  // Audio capture functions
  const startMicrophone = async () => {
    try {
      console.log('🎤 Starting microphone for conversation AI...')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      // Create AudioContext for PCM audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor
      
      processor.onaudioprocess = (event) => {
        if (isConnected && isEnabled) {
          const inputBuffer = event.inputBuffer
          const inputData = inputBuffer.getChannelData(0)
          
          // Calculate audio level for silence detection
          let sum = 0
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i]
          }
          const rms = Math.sqrt(sum / inputData.length)
          
          // Send audio if above silence threshold (0.003 similar to voice-test)
          if (rms > 0.003) {
            // Convert Float32Array to 16-bit PCM
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
            }
            
            // Convert to base64 and send
            const buffer = pcmData.buffer
            const bytes = new Uint8Array(buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            const base64Data = btoa(binary)
            
            sendAudioChunk(base64Data, 16000, 'pcm_s16le')
          }
        }
      }
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      setIsMicActive(true)
      console.log('✅ Microphone started successfully')
      
    } catch (error) {
      console.error('❌ Microphone access error:', error)
      setConversationState(prev => ({ ...prev, phase: 'error' }))
    }
  }
  
  const stopMicrophone = () => {
    console.log('🎤 Stopping microphone...')
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    setIsMicActive(false)
    console.log('✅ Microphone stopped')
  }

  function playAIResponse(audioUrl: string) {
    if (audioRef.current) {
      audioRef.current.src = audioUrl
      audioRef.current.volume = voiceVolume
      
      // Add event listeners to reset playing state
      audioRef.current.onended = () => {
        setIsPlayingAudio(false)
        setConversationState(prev => ({ ...prev, phase: 'listening' }))
      }
      
      audioRef.current.onerror = () => {
        setIsPlayingAudio(false)
        setConversationState(prev => ({ ...prev, phase: 'error' }))
      }
      
      audioRef.current.play().then(() => {
        console.log('🔊 AI response playing')
      }).catch(error => {
        console.error('Audio play error:', error)
        setIsPlayingAudio(false)
        setConversationState(prev => ({ ...prev, phase: 'error' }))
      })
    }
  }

  function startConversation() {
    if (!isConnected) {
      console.warn('WebSocket not connected')
      return
    }
    
    setIsEnabled(true)
    setConversationState({ phase: 'listening', turnProgress: 0 })
    
    // Start Smart Turn v2 monitoring
    send({
      type: 'start_conversation',
      config: {
        vadModel: 'smart-turn-v2',
        sttModel: 'nova-3',
        llmModel: 'llama-2-7b-chat-int8',
        ttsModel: 'aura-1',
        voice: selectedVoice,
        turnThreshold: 0.7 // Smart Turn v2 confidence threshold
      }
    })
  }

  function stopConversation() {
    setIsEnabled(false)
    setConversationState({ phase: 'idle', turnProgress: 0 })
    
    // Stop microphone capture
    stopMicrophone()
    
    send({
      type: 'stop_conversation'
    })
    
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  function resetConversation() {
    stopConversation()
    setConversation([])
    setConversationState({ phase: 'idle', turnProgress: 0 })
  }

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  // Cleanup audio and microphone on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      stopMicrophone()
    }
  }, [])

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'listening': return 'bg-blue-500'
      case 'processing': return 'bg-yellow-500'
      case 'speaking': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'listening': return <Mic className="h-4 w-4" />
      case 'processing': return <Brain className="h-4 w-4 animate-pulse" />
      case 'speaking': return <Volume2 className="h-4 w-4" />
      case 'error': return <VolumeX className="h-4 w-4" />
      default: return <MessageCircle className="h-4 w-4" />
    }
  }

  return (
    <div className='flex h-full'>
      <Main className='flex-1'>
        <Header sticky>
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>

        <div className='container mx-auto p-6 space-y-6'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold'>Conversational Voice AI</h1>
            <p className='text-muted-foreground'>
              Full-duplex voice conversation using Smart Turn v2, Nova-3 STT, Llama-2 LLM, and Aura-1 TTS
            </p>
          </div>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                {getPhaseIcon(conversationState.phase)}
                Conversation Status
                <Badge variant={isConnected ? "default" : "destructive"} className='ml-auto'>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Real-time voice conversation pipeline status
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm font-medium capitalize'>
                      {conversationState.phase === 'idle' ? 'Ready' : conversationState.phase}
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {conversationState.currentTurn || ''}
                    </span>
                  </div>
                  <Progress 
                    value={conversationState.turnProgress} 
                    className={`h-2 ${getPhaseColor(conversationState.phase)}`}
                  />
                </div>
              </div>

              {/* Control Buttons */}
              <div className='flex gap-2'>
                {conversationState.phase === 'idle' ? (
                  <Button 
                    onClick={startConversation}
                    disabled={!isConnected}
                    className='flex-1'
                  >
                    <Mic className='mr-2 h-4 w-4' />
                    Start Conversation
                  </Button>
                ) : (
                  <Button 
                    onClick={stopConversation}
                    variant="destructive"
                    className='flex-1'
                  >
                    <MicOff className='mr-2 h-4 w-4' />
                    Stop Conversation
                  </Button>
                )}
                
                <Button 
                  onClick={resetConversation}
                  variant="outline"
                >
                  <RotateCcw className='h-4 w-4' />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Conversation History */}
          <Card className='flex-1'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Users className='h-5 w-5' />
                Conversation History
                {conversation.length > 0 && (
                  <Badge variant="secondary" className='ml-auto'>
                    {conversation.length} {conversation.length === 1 ? 'turn' : 'turns'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className='h-96'>
                <div className='space-y-4 pr-4'>
                  {conversation.length === 0 ? (
                    <div className='text-center text-muted-foreground py-8'>
                      <MessageCircle className='h-12 w-12 mx-auto mb-4 opacity-50' />
                      <p>Start a conversation to see messages here</p>
                      <p className='text-sm mt-2'>The AI will respond to your voice input</p>
                    </div>
                  ) : (
                    conversation.map((turn) => (
                      <div 
                        key={turn.id}
                        className={`flex ${turn.type === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          turn.type === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <div className='flex items-start gap-2'>
                            {turn.type === 'user' ? (
                              <Mic className='h-4 w-4 mt-0.5 flex-shrink-0' />
                            ) : (
                              <Brain className='h-4 w-4 mt-0.5 flex-shrink-0' />
                            )}
                            <div className='flex-1'>
                              <p className='text-sm'>{turn.text}</p>
                              <div className='flex items-center gap-2 mt-2'>
                                <span className='text-xs opacity-70'>
                                  {turn.timestamp.toLocaleTimeString()}
                                </span>
                                {turn.confidence && (
                                  <Badge variant="secondary" className='text-xs'>
                                    {Math.round(turn.confidence * 100)}% confident
                                  </Badge>
                                )}
                                {turn.processing && (
                                  <Badge variant="secondary" className='text-xs animate-pulse'>
                                    Processing...
                                  </Badge>
                                )}
                                {turn.audioUrl && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => playAIResponse(turn.audioUrl!)}
                                    className='h-6 w-6 p-0'
                                  >
                                    <Play className='h-3 w-3' />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={conversationEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Pipeline Overview */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Zap className='h-5 w-5' />
                AI Pipeline
              </CardTitle>
              <CardDescription>
                Voice processing pipeline with Smart Turn v2 turn detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 md:grid-cols-5 gap-4 text-center'>
                <div className='space-y-2'>
                  <div className='w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center mx-auto'>
                    <Mic className='h-6 w-6 text-blue-600 dark:text-blue-400' />
                  </div>
                  <div>
                    <div className='font-medium text-sm'>Audio Input</div>
                    <div className='text-xs text-muted-foreground'>Microphone</div>
                  </div>
                </div>
                
                <div className='space-y-2'>
                  <div className='w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mx-auto'>
                    <Users className='h-6 w-6 text-purple-600 dark:text-purple-400' />
                  </div>
                  <div>
                    <div className='font-medium text-sm'>Turn Detection</div>
                    <div className='text-xs text-muted-foreground'>Smart Turn v2</div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto'>
                    <MessageCircle className='h-6 w-6 text-green-600 dark:text-green-400' />
                  </div>
                  <div>
                    <div className='font-medium text-sm'>Speech-to-Text</div>
                    <div className='text-xs text-muted-foreground'>Nova-3</div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center mx-auto'>
                    <Brain className='h-6 w-6 text-yellow-600 dark:text-yellow-400' />
                  </div>
                  <div>
                    <div className='font-medium text-sm'>Language Model</div>
                    <div className='text-xs text-muted-foreground'>Llama-2</div>
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mx-auto'>
                    <Volume2 className='h-6 w-6 text-red-600 dark:text-red-400' />
                  </div>
                  <div>
                    <div className='font-medium text-sm'>Text-to-Speech</div>
                    <div className='text-xs text-muted-foreground'>Aura-1</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>

      {/* Hidden audio element for AI responses */}
      <audio
        ref={audioRef}
        onEnded={() => {
          setConversationState(prev => ({ 
            ...prev, 
            phase: 'listening',
            turnProgress: 0,
            currentTurn: undefined
          }))
        }}
        onError={() => {
          setConversationState(prev => ({ ...prev, phase: 'error' }))
        }}
      />
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/conversation-ai')({
  component: ConversationAIPage,
})