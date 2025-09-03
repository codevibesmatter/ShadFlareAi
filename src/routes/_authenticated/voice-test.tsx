import { createFileRoute } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, MicOff, Volume2, Settings } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useVoiceWebSocket } from '@/hooks/use-voice-websocket'
import type { VoiceWebSocketMessage } from '@/lib/voice-websocket-manager'

function VoiceTestPage() {
  const [isMicActive, setIsMicActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [liveTranscription, setLiveTranscription] = useState('')
  const [transcriptionHistory, setTranscriptionHistory] = useState<string[]>([])
  const [currentSessionTranscription, setCurrentSessionTranscription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [manuallyStoppedMic, setManuallyStoppedMic] = useState(false)
  
  // Nova-3 Configuration
  const [silenceThreshold, setSilenceThreshold] = useState(0.003)
  const [sampleRate, setSampleRate] = useState(16000)
  const [bufferSize, setBufferSize] = useState(4096)
  const [language, setLanguage] = useState('en')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)

  // Handle WebSocket messages
  const handleVoiceWebSocketMessage = (message: VoiceWebSocketMessage) => {
    console.log('📨 Voice WebSocket message:', message.type)

    if (message.type === 'live_transcription') {
      setIsProcessing(false) // Clear processing state
      const newText = message.text || ''
      
      // Accumulate text in current session transcription
      if (newText.trim()) {
        setCurrentSessionTranscription(prev => {
          const accumulated = prev ? `${prev} ${newText}` : newText
          setLiveTranscription(accumulated) // Show accumulated text in live display
          return accumulated
        })
      }
      setError(null) // Clear any previous errors on successful transcription
      
      // Only auto-restart microphone if it wasn't manually stopped
      if (isConnected && !isMicActive && !manuallyStoppedMic) {
        console.log('🎤 Auto-restarting microphone after transcription')
        startMicrophone()
      }
    } else if (message.type === 'transcription_error') {
      console.error('❌ Transcription error:', message.error)
      setIsProcessing(false) // Clear processing state
      setError(message.error || 'Transcription failed')
      if (message.error) {
        setTranscriptionHistory(prev => [...prev, `❌ Error: ${message.error}`])
      }
      
      // Only auto-restart microphone if it wasn't manually stopped
      if (isConnected && !isMicActive && !manuallyStoppedMic) {
        console.log('🎤 Auto-restarting microphone after error')
        startMicrophone()
      }
    } else if (message.type === 'processing_audio') {
      setIsProcessing(true) // Show processing state when audio is being processed
    }
  }

  // Initialize WebSocket with new standalone manager
  const { isConnected, sessionId, send, sendAudioChunk, sendTestTranscription, sendWAVTestChunk, connect, disconnect } = useVoiceWebSocket({
    enabled: true,
    voice: 'aura',
    model: 'nova-3',
    onMessage: handleVoiceWebSocketMessage,
    onConnected: () => {
      console.log('✅ Voice WebSocket connected')
      setError(null)
      setManuallyStoppedMic(false) // Reset manual stop flag on new connection
      startMicrophone() // Auto-start microphone when connected
    },
    onDisconnected: () => {
      console.log('🔌 Voice WebSocket disconnected')
      stopMicrophone()
    },
    onError: (error) => {
      console.error('❌ Voice WebSocket error:', error)
      setError('WebSocket connection failed')
    }
  })

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      // Create AudioContext for raw PCM audio processing
      const audioContext = new AudioContext({ sampleRate: sampleRate }) // Configurable sample rate
      audioContextRef.current = audioContext
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1) // Configurable buffer size, mono
      processorRef.current = processor
      
      processor.onaudioprocess = (event) => {
        if (isConnected) {
          const inputBuffer = event.inputBuffer
          const inputData = inputBuffer.getChannelData(0) // Get mono channel
          
          // Detect silence - calculate RMS (Root Mean Square) volume level
          let sum = 0
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i]
          }
          const rms = Math.sqrt(sum / inputData.length)
          
          // Only send audio if it's above the configurable silence threshold
          if (rms > silenceThreshold) {
            console.log(`🎤 Audio detected, RMS: ${rms.toFixed(4)} > threshold: ${silenceThreshold}`)
            // Convert Float32Array to 16-bit PCM
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              // Convert float (-1 to 1) to 16-bit signed integer (-32768 to 32767)
              const sample = Math.max(-1, Math.min(1, inputData[i]))
              pcmData[i] = sample < 0 ? sample * 32768 : sample * 32767
            }
            
            // Convert to base64 for transmission
            const buffer = pcmData.buffer
            const bytes = new Uint8Array(buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            const base64 = btoa(binary)
            
            // Use new WebSocket manager with configurable sample rate
            sendAudioChunk(base64, sampleRate, 'pcm_s16le')
          } else {
            // Silence detected - don't send anything to avoid rate limiting
            console.log(`🤫 Silence detected, RMS: ${rms.toFixed(4)} <= threshold: ${silenceThreshold}`)
          }
        }
      }
      
      // Connect the audio processing chain
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      setIsMicActive(true)
      setLiveTranscription('')
      setCurrentSessionTranscription('') // Clear accumulated transcription for new session
      setError(null)
      console.log(`🎤 Microphone started with ${sampleRate}Hz sample rate, buffer size: ${bufferSize}`)
    } catch (error) {
      console.error('❌ Error starting microphone:', error)
      setError('Failed to start microphone. Please allow microphone access.')
    }
  }

  const stopMicrophone = (isManual = false) => {
    // Stop MediaRecorder if it exists (for fallback)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }
    
    // Stop AudioContext processing
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    // Add current session transcription to history if it exists
    if (currentSessionTranscription.trim()) {
      setTranscriptionHistory(prev => [...prev, currentSessionTranscription])
    }
    
    if (isManual) {
      setManuallyStoppedMic(true)
    }
    
    setIsMicActive(false)
    console.log('🛑 Microphone stopped')
  }


  const clearHistory = () => {
    setTranscriptionHistory([])
    setLiveTranscription('')
    setCurrentSessionTranscription('')
  }

  const handleTestTranscription = () => {
    setIsProcessing(true)
    sendTestTranscription()
  }

  const sendTestWAV = async () => {
    if (isConnected) {
      try {
        setIsProcessing(true)
        // Fetch the known working WAV file and send it over WebSocket
        console.log('🎵 Fetching test WAV file...')
        const response = await fetch('/testing.wav')
        const arrayBuffer = await response.arrayBuffer()
        
        // Convert ArrayBuffer to base64 properly for large files
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        const chunkSize = 8192 // Process in chunks to avoid stack overflow
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize)
          binary += String.fromCharCode(...chunk)
        }
        
        const base64Audio = btoa(binary)
        
        console.log(`📊 Base64 encoded: ${base64Audio.length} characters`)
        
        // Split base64 data into chunks to avoid 1MB WebSocket limit
        const maxChunkSize = 800 * 1024 // 800KB to stay under 1MB limit
        const totalChunks = Math.ceil(base64Audio.length / maxChunkSize)
        
        console.log(`📦 Splitting into ${totalChunks} chunks...`)
        
        // Send chunks sequentially
        for (let i = 0; i < totalChunks; i++) {
          const start = i * maxChunkSize
          const end = Math.min(start + maxChunkSize, base64Audio.length)
          const chunkData = base64Audio.slice(start, end)
          
          // Use new WebSocket manager
          sendWAVTestChunk(chunkData, i, totalChunks, i === totalChunks - 1)
          console.log(`📤 Sent chunk ${i + 1}/${totalChunks} (${chunkData.length} chars)`)
          
          // Small delay between chunks to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        // Add to transcription history for reference
        setTranscriptionHistory(prev => [...prev, `🎵 Sent test WAV file in ${totalChunks} chunks (${Math.round(arrayBuffer.byteLength / 1024)}KB) for transcription...`])
        setError(null) // Clear any previous errors
      } catch (error) {
        console.error('❌ Error sending WAV file:', error)
        setError('Failed to send test WAV file')
        setIsProcessing(false) // Clear processing state on error
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className='flex h-full'>
      <Main className='flex-1'>
        <Header sticky>
          <div className='ml-auto flex items-center space-x-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </Header>

        <div className='container mx-auto p-6 space-y-8'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold'>Voice Transcription Test</h1>
            <p className='text-muted-foreground'>
              Test live speech-to-text using Deepgram Nova-3
            </p>
          </div>

          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Volume2 className='h-5 w-5' />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex items-center gap-2'>
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <Badge variant={isConnected ? 'default' : 'destructive'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
              {error && (
                <div className='mt-2 text-red-600 text-sm'>
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nova-3 Settings */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Settings className='h-5 w-5' />
                Nova-3 Settings
              </CardTitle>
              <CardDescription>
                Adjust parameters to optimize transcription accuracy
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Silence Threshold</label>
                  <div className='flex items-center gap-2'>
                    <input
                      type='range'
                      min='0.001'
                      max='0.01'
                      step='0.001'
                      value={silenceThreshold}
                      onChange={(e) => setSilenceThreshold(Number(e.target.value))}
                      className='flex-1'
                      disabled={isMicActive}
                    />
                    <span className='text-sm text-muted-foreground w-12'>{silenceThreshold.toFixed(3)}</span>
                  </div>
                  <p className='text-xs text-muted-foreground'>Lower = more sensitive to quiet sounds</p>
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Sample Rate (Hz)</label>
                  <Select
                    value={sampleRate.toString()}
                    onValueChange={(value) => setSampleRate(Number(value))}
                    disabled={isMicActive}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder="Select sample rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8000">8000 Hz (Phone quality)</SelectItem>
                      <SelectItem value="16000">16000 Hz (Standard - Recommended)</SelectItem>
                      <SelectItem value="22050">22050 Hz (CD quality)</SelectItem>
                      <SelectItem value="44100">44100 Hz (High quality)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className='text-xs text-muted-foreground'>Higher = better quality, more bandwidth</p>
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Buffer Size</label>
                  <Select
                    value={bufferSize.toString()}
                    onValueChange={(value) => setBufferSize(Number(value))}
                    disabled={isMicActive}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder="Select buffer size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1024">1024 (Low latency)</SelectItem>
                      <SelectItem value="2048">2048 (Balanced)</SelectItem>
                      <SelectItem value="4096">4096 (Standard - Recommended)</SelectItem>
                      <SelectItem value="8192">8192 (High quality)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className='text-xs text-muted-foreground'>Larger = better quality, higher latency</p>
                </div>
                
                <div className='space-y-2'>
                  <label className='text-sm font-medium'>Language</label>
                  <Select
                    value={language}
                    onValueChange={(value) => setLanguage(value)}
                    disabled={isMicActive}
                  >
                    <SelectTrigger className='w-full'>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='en'>English</SelectItem>
                      <SelectItem value='es'>Spanish</SelectItem>
                      <SelectItem value='fr'>French</SelectItem>
                      <SelectItem value='de'>German</SelectItem>
                      <SelectItem value='it'>Italian</SelectItem>
                      <SelectItem value='pt'>Portuguese</SelectItem>
                      <SelectItem value='zh'>Chinese</SelectItem>
                      <SelectItem value='ja'>Japanese</SelectItem>
                      <SelectItem value='ko'>Korean</SelectItem>
                      <SelectItem value='ar'>Arabic</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className='text-xs text-muted-foreground'>Specify expected language for better accuracy</p>
                </div>
              </div>
              
              {isMicActive && (
                <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3'>
                  <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                    ⚠️ Stop microphone to change settings
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Transcription */}
          <Card>
            <CardHeader>
              <CardTitle>Live Transcription</CardTitle>
              <CardDescription>
                Start speaking - transcription happens automatically with Nova-3
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {/* Control Buttons */}
              {isConnected && (
                <div className='flex gap-2 flex-wrap'>
                  {/* Microphone Control */}
                  <Button
                    onClick={() => {
                      if (isMicActive) {
                        stopMicrophone(true) // Manual stop
                      } else {
                        setManuallyStoppedMic(false) // Clear manual stop flag
                        startMicrophone()
                      }
                    }}
                    disabled={isProcessing}
                    variant={isMicActive ? 'destructive' : 'default'}
                    size='sm'
                  >
                    {isMicActive ? (
                      <>
                        <MicOff className='w-4 h-4 mr-2' />
                        Stop Microphone
                      </>
                    ) : (
                      <>
                        <Mic className='w-4 h-4 mr-2' />
                        Start Microphone
                      </>
                    )}
                  </Button>
                  
                  {/* Test Buttons */}
                  <Button
                    onClick={handleTestTranscription}
                    disabled={isProcessing}
                    variant='outline'
                    size='sm'
                  >
                    Test Transcription
                  </Button>
                  <Button
                    onClick={sendTestWAV}
                    disabled={isProcessing}
                    variant='outline'
                    size='sm'
                  >
                    🎵 Test with WAV File
                  </Button>
                </div>
              )}

              {/* Live Transcription Display */}
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-4 min-h-[120px]'>
                <div className='flex items-center gap-2 mb-2'>
                  <div className={`w-2 h-2 rounded-full ${isConnected && isMicActive ? 'bg-green-500 animate-pulse' : isConnected ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                  <span className='text-sm font-medium text-blue-700'>
                    {isConnected && isMicActive ? 'Listening...' : isConnected ? 'Microphone Stopped' : 'Disconnected'}
                  </span>
                </div>
                <div className='text-gray-700 text-lg'>
                  {liveTranscription || (isConnected && isMicActive ? 'Speak into your microphone...' : isConnected ? 'Click "Start Microphone" to begin' : 'Connect to start transcription')}
                </div>
              </div>

              {/* Processing State */}
              {isProcessing && (
                <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
                  <div className='flex items-center gap-2 mb-2'>
                    <div className='w-2 h-2 rounded-full bg-yellow-500 animate-pulse' />
                    <span className='text-sm font-medium text-yellow-700'>Processing Audio</span>
                  </div>
                  <div className='text-gray-700'>
                    Converting speech to text, please wait...
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transcription History */}
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>Transcription History</CardTitle>
                <Button variant='outline' size='sm' onClick={clearHistory}>
                  Clear
                </Button>
              </div>
              <CardDescription>
                Previous transcriptions from this session
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transcriptionHistory.length === 0 ? (
                <div className='text-muted-foreground text-center py-8'>
                  No transcriptions yet. Start recording to see results.
                </div>
              ) : (
                <div className='space-y-2'>
                  {transcriptionHistory.map((text, index) => (
                    <div key={index} className='bg-gray-50 rounded-lg p-3 border'>
                      <div className='text-sm text-gray-500 mb-1'>
                        Transcription #{index + 1}
                      </div>
                      <div className='text-gray-900'>{text}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Main>
    </div>
  )
}

export const Route = createFileRoute('/_authenticated/voice-test')(({
  component: VoiceTestPage,
}))