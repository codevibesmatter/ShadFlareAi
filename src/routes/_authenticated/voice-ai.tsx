import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings, Zap, Wifi, WifiOff } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { CloudflareVoiceAI } from '@/lib/cloudflare-voice-ai'

interface VoiceMetrics {
  volume: number
  rms: number
  peak: number
  voiceActive: boolean
  latency: number
  quality: 'excellent' | 'good' | 'fair' | 'poor'
  timestamp: number
}

function VoiceAIPage() {
  // Voice AI State
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics>({
    volume: 0,
    rms: 0,
    peak: 0,
    voiceActive: false,
    latency: 0,
    quality: 'excellent',
    timestamp: 0
  })
  
  // Configuration
  const [selectedVoice, setSelectedVoice] = useState('@cf/deepgram/aura-1')
  const [selectedModel, setSelectedModel] = useState('@cf/deepgram/nova-3')
  const [enableRealtime, setEnableRealtime] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  // Voice AI refs and state
  const voiceAIRef = useRef<CloudflareVoiceAI | null>(null)
  const visualizerRef = useRef<HTMLCanvasElement>(null)
  const [transcriptions, setTranscriptions] = useState<string[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // Audio visualization based on metrics
  const updateAudioVisualization = useCallback(() => {
    if (!visualizerRef.current) return

    const canvas = visualizerRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const draw = () => {
      requestAnimationFrame(draw)
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Create visual bars based on current metrics
      const barCount = 32
      const barWidth = canvas.width / barCount
      
      for (let i = 0; i < barCount; i++) {
        // Simulate frequency data based on volume and voice activity
        const intensity = voiceMetrics.voiceActive ? 
          voiceMetrics.volume * (0.5 + 0.5 * Math.sin(Date.now() * 0.01 + i * 0.3)) :
          voiceMetrics.volume * 0.1
          
        const barHeight = (intensity / 100) * canvas.height
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
        if (voiceMetrics.voiceActive) {
          gradient.addColorStop(0, 'hsl(120, 70%, 50%)')
          gradient.addColorStop(1, 'hsl(160, 70%, 70%)')
        } else {
          gradient.addColorStop(0, 'hsl(220, 50%, 40%)')
          gradient.addColorStop(1, 'hsl(260, 50%, 60%)')
        }
        
        ctx.fillStyle = gradient
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 1, barHeight)
      }
    }
    
    draw()
  }, [voiceMetrics])

  // Initialize Cloudflare Voice AI
  const initializeVoiceAI = async () => {
    try {
      console.log('🔄 Initializing Cloudflare Voice AI...')
      setConnectionError(null)
      
      // Create Voice AI instance
      const voiceAI = new CloudflareVoiceAI({
        model: selectedModel,
        voice: selectedVoice,
        language: 'en',
        enableRealtime: enableRealtime,
        latencyTarget: 800
      })
      
      // Setup event handlers
      voiceAI.onConnectionChange = (connected) => {
        setIsConnected(connected)
        if (!connected) {
          setIsRecording(false)
          setSessionId(null)
        }
      }
      
      voiceAI.onTranscription = (text) => {
        console.log('📝 Transcription:', text)
        setTranscriptions(prev => [...prev.slice(-4), text])
      }
      
      voiceAI.onMetricsUpdate = (metrics) => {
        setVoiceMetrics(metrics)
      }
      
      voiceAI.onConversationTurn = (isSpeaking) => {
        setIsPlaying(isSpeaking)
      }
      
      voiceAI.onError = (error) => {
        console.error('Voice AI Error:', error)
        setConnectionError(error)
      }
      
      // Initialize the system
      await voiceAI.initialize()
      
      voiceAIRef.current = voiceAI
      setSessionId(voiceAI.getSessionId())
      
      console.log('✅ Cloudflare Voice AI initialized successfully')
      return voiceAI
    } catch (error) {
      console.error('❌ Error initializing Voice AI:', error)
      setConnectionError(`Initialization failed: ${error.message}`)
      throw error
    }
  }

  // Reconnect to Voice AI
  const reconnectVoiceAI = async () => {
    if (voiceAIRef.current) {
      await voiceAIRef.current.disconnect()
    }
    await initializeVoiceAI()
  }

  // Handle configuration changes
  const handleConfigChange = async (config: Partial<{ model: string; voice: string; realtime: boolean }>) => {
    if (config.model && config.model !== selectedModel) {
      setSelectedModel(config.model)
    }
    if (config.voice && config.voice !== selectedVoice) {
      setSelectedVoice(config.voice)
    }
    if (config.realtime !== undefined && config.realtime !== enableRealtime) {
      setEnableRealtime(config.realtime)
    }
    
    // Reinitialize if connected
    if (isConnected && voiceAIRef.current) {
      await reconnectVoiceAI()
    }
  }

  // Start voice recording and streaming
  const startVoiceSession = async () => {
    try {
      if (!voiceAIRef.current) {
        await initializeVoiceAI()
      }
      
      if (voiceAIRef.current) {
        await voiceAIRef.current.startRecording()
        setIsRecording(true)
        console.log('🎤 Voice session started')
      }
    } catch (error) {
      console.error('❌ Failed to start voice session:', error)
      setConnectionError(`Failed to start session: ${error.message}`)
    }
  }

  // Stop voice session
  const stopVoiceSession = async () => {
    console.log('🛑 Stopping voice session...')
    
    if (voiceAIRef.current) {
      await voiceAIRef.current.stopRecording()
      await voiceAIRef.current.disconnect()
      voiceAIRef.current = null
    }
    
    setIsRecording(false)
    setIsConnected(false)
    setSessionId(null)
    setTranscriptions([])
    setConnectionError(null)
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
    // Note: Muting would need to be implemented in CloudflareVoiceAI class
    console.log(isMuted ? '🔊 Unmuted' : '🔇 Muted')
  }

  // Initialize audio visualization
  useEffect(() => {
    updateAudioVisualization()
  }, [updateAudioVisualization])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession()
    }
  }, [])

  // Handle configuration changes (removed problematic useEffect that causes infinite reconnections)

  const getQualityColor = (quality: VoiceMetrics['quality']) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-blue-500'
      case 'fair': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
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
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Voice AI Agent
              </CardTitle>
              <CardDescription>
                Real-time voice conversation with AI using Cloudflare WebRTC
              </CardDescription>
            </div>
            <div className='flex items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Switch 
                  id='realtime-mode'
                  checked={enableRealtime}
                  onCheckedChange={setEnableRealtime}
                />
                <Label htmlFor='realtime-mode' className='flex items-center gap-1 text-sm'>
                  Realtime Mode
                  {isConnected && <span className='h-2 w-2 bg-green-500 rounded-full ml-1' />}
                </Label>
              </div>
              
              <Select 
                value={selectedVoice} 
                onValueChange={(value) => handleConfigChange({ voice: value })}
              >
                <SelectTrigger className='w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='@cf/deepgram/aura-1'>Deepgram Aura-1 (Cloudflare)</SelectItem>
                  <SelectItem value='@cf/elevenlabs/voices'>ElevenLabs Voice</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedModel} 
                onValueChange={(value) => handleConfigChange({ model: value })}
              >
                <SelectTrigger className='w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='@cf/deepgram/nova-3'>Deepgram Nova-3 (Cloudflare)</SelectItem>
                  <SelectItem value='@cf/meta/llama-3.1-8b-instruct'>Llama 3.1 8B</SelectItem>
                  <SelectItem value='@cf/openai/whisper'>OpenAI Whisper</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          
          <CardContent className='flex flex-col flex-1 p-6 min-h-0'>
            {/* Voice Status and Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Connection Status</p>
                      <p className="text-2xl font-bold">
                        {isConnected ? 'Connected' : 'Disconnected'}
                      </p>
                    </div>
                    <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  {sessionId && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Session: {sessionId.slice(0, 8)}
                    </p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Voice Level</p>
                      <Badge variant={voiceMetrics.voiceActive ? 'default' : 'secondary'}>
                        {voiceMetrics.voiceActive ? 'Speaking' : 'Silent'}
                      </Badge>
                    </div>
                    <Progress value={voiceMetrics.volume} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(voiceMetrics.volume)}% volume | RMS: {voiceMetrics.rms.toFixed(3)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Quality</p>
                      <Badge className={getQualityColor(voiceMetrics.quality)}>
                        {voiceMetrics.quality}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {voiceMetrics.latency}ms latency
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Audio Visualization */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium">Audio Visualization</p>
                  <div className="flex items-center gap-2">
                    {isPlaying && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3" />
                        AI Speaking
                      </Badge>
                    )}
                    {voiceMetrics.voiceActive && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Mic className="h-3 w-3" />
                        You Speaking
                      </Badge>
                    )}
                    {isConnected ? (
                      <Badge variant="default" className="flex items-center gap-1">
                        <Wifi className="h-3 w-3" />
                        WebRTC Connected
                      </Badge>
                    ) : connectionError ? (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <WifiOff className="h-3 w-3" />
                        Error: {connectionError}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <canvas
                  ref={visualizerRef}
                  width={800}
                  height={150}
                  className="w-full h-24 bg-muted rounded-lg"
                />
              </CardContent>
            </Card>

            {/* Control Buttons */}
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <Button
                    size="lg"
                    onClick={startVoiceSession}
                    className="h-16 w-16 rounded-full"
                  >
                    <Phone className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopVoiceSession}
                    className="h-16 w-16 rounded-full"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </Button>
                )}
                
                <Button
                  size="lg"
                  variant={isMuted ? "destructive" : "outline"}
                  onClick={toggleMute}
                  disabled={!isRecording}
                  className="h-16 w-16 rounded-full"
                >
                  {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                
                <Button
                  size="lg"
                  variant="outline"
                  disabled={!isConnected}
                  className="h-16 w-16 rounded-full"
                >
                  <Settings className="h-6 w-6" />
                </Button>
              </div>
            </div>

            {/* Recent Transcriptions */}
            {transcriptions.length > 0 && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-sm">Recent Conversation</CardTitle>
                </CardHeader>
                <CardContent className="p-4 max-h-32 overflow-y-auto">
                  <div className="space-y-2">
                    {transcriptions.map((text, index) => (
                      <div 
                        key={index} 
                        className="text-sm p-2 bg-muted rounded border-l-2 border-blue-500"
                      >
                        <span className="text-muted-foreground text-xs">You:</span> {text}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Status Messages */}
            <div className="text-center space-y-2">
              {connectionError && (
                <p className="text-red-600 text-sm">
                  {connectionError}
                </p>
              )}
              {!isConnected && !connectionError && (
                <p className="text-muted-foreground">
                  Click the phone button to start a voice conversation with AI using Cloudflare WebRTC
                </p>
              )}
              {isConnected && !isRecording && (
                <p className="text-muted-foreground">
                  WebRTC Connected - Ready to start voice chat with sub-800ms latency
                </p>
              )}
              {isRecording && (
                <p className="text-green-600">
                  Voice session active - Speak naturally with the AI agent powered by Cloudflare Edge
                </p>
              )}
              {sessionId && (
                <p className="text-xs text-muted-foreground">
                  Session ID: {sessionId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/voice-ai')({
  component: VoiceAIPage,
})