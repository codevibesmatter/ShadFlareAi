import { DurableObject } from 'cloudflare:workers'
import { Env } from './index'

interface VoiceSession {
  sessionId: string
  websocket: WebSocket
  model: string
  voice: string
  isRecording: boolean
  isProcessing: boolean
  createdAt: number
  lastActivity: number
  wavTestChunks?: string[] // For accumulating WAV test chunks
  expectedWavChunks?: number // Total expected chunks
  isConversationMode?: boolean // Flag for conversation mode
  conversationHistory?: ConversationTurn[] // Chat history for context
  transcriptionMode?: 'live' | 'turn' // New mode setting
  isProcessingPartial?: boolean // Separate flag for partial transcription
}

interface ConversationTurn {
  role: 'user' | 'assistant'
  text: string
  timestamp: number
}

interface AudioChunk {
  id: string
  sessionId: string
  data: string // Base64 encoded audio
  timestamp: number
  processed: boolean
  format?: string // Audio format (e.g., 'pcm_s16le', 'opus')
  sampleRate?: number // Sample rate in Hz
}

export class VoiceAIWebSocket extends DurableObject {
  private sessions = new Map<string, VoiceSession>()
  private audioBuffer = new Map<string, AudioChunk[]>()
  private env: Env
  
  // ASR Rate Limiting: 720 requests/minute = 12 requests/second  
  private lastASRCallTime: number = 0
  private minASRInterval: number = 1000 // 1 second between calls for live transcription

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    // Only handle WebSocket upgrade requests
    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }

    console.log('🎤 Voice AI WebSocket connection request')

    // Get parameters
    const voice = url.searchParams.get('voice') || 'eleven-labs-nova'
    const model = url.searchParams.get('model') || 'whisper-tiny-en'

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Accept the connection
    server.accept()
    
    // Generate session ID
    const sessionId = crypto.randomUUID()
    
    // Create session
    const session: VoiceSession = {
      sessionId,
      websocket: server,
      model,
      voice,
      isRecording: false,
      isProcessing: false,
      createdAt: Date.now(),
      lastActivity: Date.now()
    }
    
    this.sessions.set(sessionId, session)
    this.audioBuffer.set(sessionId, [])

    console.log(`🎯 Voice AI session created: ${sessionId} with voice: ${voice}, model: ${model}`)

    // Set up event handlers
    server.addEventListener('message', async (event) => {
      await this.handleMessage(sessionId, event.data)
    })

    server.addEventListener('close', (event) => {
      console.log(`🔌 Voice AI WebSocket closed: ${event.code} ${event.reason}`)
      this.cleanup(sessionId)
    })

    server.addEventListener('error', (event) => {
      console.error('❌ Voice AI WebSocket error:', event)
      this.cleanup(sessionId)
    })

    // Send initial connection confirmation
    this.sendMessage(sessionId, {
      type: 'session_created',
      sessionId,
      voice,
      model,
      timestamp: Date.now()
    })

    // Return the client WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private async handleMessage(sessionId: string, data: string) {
    try {
      const session = this.sessions.get(sessionId)
      if (!session) {
        console.error('Session not found:', sessionId)
        return
      }

      session.lastActivity = Date.now()
      const message = JSON.parse(data)
      
      console.log(`📨 Voice AI message received:`, message.type)

      switch (message.type) {
        case 'configure':
          await this.handleConfigure(sessionId, message)
          break
          
        case 'start_recording':
          await this.handleStartRecording(sessionId)
          break
          
        case 'stop_recording':
          await this.handleStopRecording(sessionId)
          break
          
        case 'audio_chunk':
        case 'audio_data':
          // Auto-start recording if we receive audio data
          if (!session.isRecording) {
            console.log('📣 Auto-starting recording due to audio data')
            session.isRecording = true
          }
          await this.handleAudioChunk(sessionId, message)
          break
          
        case 'audio_chunk_pcm':
          // Handle raw PCM audio data
          if (!session.isRecording) {
            console.log('📣 Auto-starting recording due to PCM audio data')
            session.isRecording = true
          }
          await this.handlePCMAudioChunk(sessionId, message)
          break
          
        case 'ping':
          this.sendMessage(sessionId, { type: 'pong' })
          break
          
        case 'test_transcription':
          console.log('🧪 Test transcription requested')
          this.sendMessage(sessionId, {
            type: 'live_transcription',
            text: 'This is a test transcription to verify the frontend is working correctly.',
            timestamp: Date.now()
          })
          break
          
        case 'wav_test_chunk':
          await this.handleWavTestChunk(sessionId, message)
          break
          
        case 'start_conversation':
          await this.handleStartConversation(sessionId, message)
          break
          
        case 'stop_conversation':
          await this.handleStopConversation(sessionId, message)
          break
          
        case 'process_turn':
          await this.handleProcessTurn(sessionId, message)
          break
          
        case 'generate_response':
          await this.handleGenerateResponse(sessionId, message)
          break
          
        case 'generate_tts':
          await this.handleGenerateTTS(sessionId, message)
          break
          
        case 'update_voice':
          await this.handleUpdateVoice(sessionId, message)
          break
          
        default:
          console.warn('❓ Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('❌ Error handling message:', error)
      this.sendError(sessionId, 'Failed to process message')
    }
  }

  private async handleWavTestChunk(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const { data, chunkIndex, totalChunks, isComplete } = message

    // Initialize WAV test chunk accumulation
    if (chunkIndex === 0) {
      session.wavTestChunks = []
      session.expectedWavChunks = totalChunks
      console.log(`🎵 Starting WAV test file reception: ${totalChunks} chunks expected`)
    }

    // Accumulate the chunk
    if (!session.wavTestChunks) session.wavTestChunks = []
    session.wavTestChunks[chunkIndex] = data

    console.log(`📦 Received WAV chunk ${chunkIndex + 1}/${totalChunks} (${data.length} chars)`)

    // Check if we have all chunks
    if (isComplete && session.wavTestChunks.length === totalChunks) {
      console.log(`✅ All WAV chunks received, combining and processing...`)
      
      // Combine all chunks into complete base64 audio
      const completeBase64Audio = session.wavTestChunks.join('')
      console.log(`🎵 Combined WAV file: ${completeBase64Audio.length} base64 characters`)

      // Create a virtual audio chunk for processing
      const testChunk: AudioChunk = {
        id: `wav-test-${Date.now()}`,
        sessionId,
        data: completeBase64Audio,
        timestamp: Date.now(),
        processed: false,
        format: 'wav', // WAV file format
        sampleRate: 16000 // Standard sample rate for WAV files
      }

      // Process with Nova-3
      try {
        console.log(`🔄 Processing WAV test file with ${session.model}...`)
        let transcription = await this.performSpeechToText(testChunk, session.model)
        
        if (transcription) {
          console.log(`✅ WAV test transcription successful: "${transcription}"`)
          
          this.sendMessage(sessionId, {
            type: 'live_transcription',
            text: `WAV Test Result: ${transcription}`,
            timestamp: Date.now(),
            chunkId: testChunk.id,
            confidence: 0.95
          })
        } else {
          console.log('❌ WAV test: No transcription returned')
          this.sendMessage(sessionId, {
            type: 'live_transcription',
            text: 'WAV Test: No transcription could be generated',
            timestamp: Date.now()
          })
        }
      } catch (error) {
        console.error('❌ WAV test error:', error)
        this.sendError(sessionId, `WAV test failed: ${error.message}`)
      }

      // Clean up
      session.wavTestChunks = undefined
      session.expectedWavChunks = undefined
    }
  }

  private async handleConfigure(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // Update session configuration
    if (message.voice) session.voice = message.voice
    if (message.model) session.model = message.model

    this.sendMessage(sessionId, {
      type: 'configured',
      voice: session.voice,
      model: session.model
    })

    console.log(`⚙️ Session ${sessionId} configured: voice=${session.voice}, model=${session.model}`)
  }

  private async handleStartRecording(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.isRecording = true
    
    this.sendMessage(sessionId, {
      type: 'recording_started',
      sessionId
    })

    console.log(`🎤 Recording started for session: ${sessionId}`)
  }

  private async handleStopRecording(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    session.isRecording = false
    
    // Process accumulated audio chunks (like WAV test)
    await this.processAccumulatedAudioForTranscription(sessionId)
    
    this.sendMessage(sessionId, {
      type: 'recording_stopped',
      sessionId
    })

    console.log(`🛑 Recording stopped for session: ${sessionId}`)
  }

  private async processAccumulatedAudioForTranscription(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const buffer = this.audioBuffer.get(sessionId) || []
    if (buffer.length === 0) {
      console.log('📭 No audio chunks to process for transcription')
      return
    }

    console.log(`🎵 Processing complete recording session: ${buffer.length} chunks accumulated`)

    try {
      // Combine ALL audio chunks from the recording session into one large chunk
      const allAudioData = buffer.map(chunk => chunk.data).join('')
      console.log(`📊 Combined audio data: ${allAudioData.length} base64 characters`)

      // Create a single large audio chunk for processing (like WAV test)
      const combinedChunk: AudioChunk = {
        id: `recording-session-${Date.now()}`,
        sessionId,
        data: allAudioData,
        timestamp: Date.now(),
        processed: false
      }

      // Process with Nova-3 using the proven working format
      console.log('🔄 Processing combined recording session with Nova-3...')
      const transcription = await this.performSpeechToText(combinedChunk, session.model)
      
      if (transcription) {
        console.log(`✅ Recording session transcription successful: "${transcription}"`)
        
        this.sendMessage(sessionId, {
          type: 'live_transcription',
          text: `Recording Complete: ${transcription}`,
          timestamp: Date.now(),
          chunkId: combinedChunk.id,
          confidence: 0.95,
          isComplete: true // Flag to indicate this is the final transcription
        })
      } else {
        console.log('❌ Recording session: No transcription returned')
        this.sendMessage(sessionId, {
          type: 'live_transcription',
          text: 'Recording Complete: No transcription could be generated',
          timestamp: Date.now(),
          isComplete: true
        })
      }

      // Clear the buffer after processing the complete session
      this.audioBuffer.set(sessionId, [])
      console.log('🧹 Audio buffer cleared after processing complete session')

    } catch (error) {
      console.error('❌ Error processing accumulated audio for transcription:', error)
      this.sendError(sessionId, `Recording transcription failed: ${error.message}`)
    }
  }

  private async handleAudioChunk(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.log('❌ No session found for audio chunk:', sessionId)
      return
    }
    
    if (!session.isRecording) {
      console.log('📣 Session not recording, starting now for session:', sessionId)
      session.isRecording = true
    }

    // Store audio chunk
    const chunk: AudioChunk = {
      id: crypto.randomUUID(),
      sessionId,
      data: message.data,
      timestamp: Date.now(),
      processed: false
    }

    const buffer = this.audioBuffer.get(sessionId) || []
    buffer.push(chunk)
    this.audioBuffer.set(sessionId, buffer)

    console.log(`🔊 Audio chunk received for session ${sessionId}, buffer size: ${buffer.length}, data length: ${message.data?.length || 0}`)

    // Real-time partial transcription + full transcription system
    const minChunksForPartial = 3 // Partial transcription every 3 chunks (~6KB) for live feedback
    const minChunksForFull = 8 // Full transcription every 8 chunks (~16KB) for accuracy
    const now = Date.now()
    const timeSinceLastCall = now - this.lastASRCallTime
    
    // Check for partial transcription (live feedback)
    const hasPartialAudio = buffer.length >= minChunksForPartial && buffer.length % minChunksForPartial === 0
    const canCallAPI = timeSinceLastCall >= this.minASRInterval
    const hasFullAudio = buffer.length >= minChunksForFull
    const accumulatingTooLong = buffer.length > 0 && timeSinceLastCall >= 8000 // 8+ seconds without processing
    
    // Handle transcription based on mode
    const isLiveMode = session.transcriptionMode === 'live'
    console.log(`📝 Mode: ${session.transcriptionMode}, chunks: ${buffer.length}`)
    
    if (isLiveMode) {
      // LIVE MODE: Show partial transcriptions, wait for explicit process_turn for full
      if (!session.isProcessing && hasPartialAudio && canCallAPI && !hasFullAudio) {
        console.log(`🔄 [LIVE] Partial transcription with ${buffer.length} chunks...`)
        this.lastASRCallTime = now
        await this.processPartialTranscription(sessionId)
      }
      // In live mode, don't auto-process full transcription - wait for process_turn message
      else if (session.isProcessing) {
        console.log('⏳ Already processing, queuing chunk...')
      }
    } else {
      // TURN MODE: No partials, only process full transcription when ready
      if (!session.isProcessing && (hasFullAudio || accumulatingTooLong) && canCallAPI) {
        const reason = hasFullAudio ? 'full chunks' : 'accumulating too long'
        console.log(`🚀 [TURN] Full transcription (${reason}) with ${buffer.length} chunks...`)
        this.lastASRCallTime = now
        await this.processAccumulatedAudioChunks(sessionId)
      } else if (session.isProcessing) {
        console.log('⏳ Already processing, queuing chunk...')
      } else if (!canCallAPI) {
        console.log(`⏰ Rate limiting: ${Math.round((this.minASRInterval - timeSinceLastCall) / 1000)}s remaining, buffering chunk ${buffer.length}`)
      } else {
        console.log(`📝 Accumulating audio... ${buffer.length} chunks (partial at ${minChunksForPartial}, full at ${minChunksForFull})`)
      }
    }

    // Send metrics update
    this.sendMessage(sessionId, {
      type: 'metrics',
      latency: Date.now() - chunk.timestamp,
      bufferSize: buffer.length,
      quality: this.calculateAudioQuality(buffer)
    })
  }

  private async processPartialTranscription(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      // Don't set isProcessing for partial transcription to avoid blocking
      
      const buffer = this.audioBuffer.get(sessionId) || []
      // Take last N chunks for partial transcription (not just unprocessed)
      const chunksToProcess = buffer.slice(-6)  // Use most recent 6 chunks
      
      if (chunksToProcess.length < 6) {
        console.log(`⏳ Not enough chunks for partial (${chunksToProcess.length}/6 required)`)
        return
      }
      
      console.log(`🔄 Processing ${chunksToProcess.length} chunks for partial transcription`)
      
      // Combine chunks for partial transcription
      const combinedAudioData = this.combineAudioChunks(chunksToProcess)
      
      // Log audio data size for debugging
      const audioSize = Buffer.from(combinedAudioData, 'base64').length
      console.log(`📊 Partial audio size: ${audioSize} bytes (${chunksToProcess.length} chunks combined)`)
      
      // Create partial chunk - use actual sample rate from chunks
      const partialChunk: AudioChunk = {
        id: `partial-${Date.now()}`,
        sessionId,
        data: combinedAudioData,
        timestamp: Date.now(),
        processed: false,
        format: 'pcm_s16le',
        sampleRate: chunksToProcess[0]?.sampleRate || 16000
      }

      // Get partial transcription
      console.log(`🎤 Calling STT for partial with model: ${session.model}`)
      const transcriptionResult = await this.performSpeechToText(partialChunk, session.model)
      
      if (transcriptionResult && transcriptionResult.trim()) {
        console.log(`✅ Partial transcription: "${transcriptionResult}"`)
        
        // Send partial transcription to client
        this.sendMessage(sessionId, {
          type: 'partial_transcription',
          text: transcriptionResult,
          timestamp: Date.now(),
          isPartial: true
        })
      } else {
        console.log('⚠️ Partial transcription returned empty/null')
      }
      
    } catch (error) {
      console.error('❌ Partial transcription error:', {
        message: error?.message,
        type: error?.constructor?.name,
        stack: error?.stack?.slice(0, 300)
      })
      this.sendMessage(sessionId, {
        type: 'error',
        error: 'Partial transcription failed',
        details: error?.message || String(error)
      })
    } finally {
      // Don't modify isProcessing for partial transcription
    }
  }

  private async processAccumulatedAudioChunks(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      session.isProcessing = true
      
      const buffer = this.audioBuffer.get(sessionId) || []
      const unprocessedChunks = buffer.filter(chunk => !chunk.processed)
      
      if (unprocessedChunks.length === 0) return
      
      console.log(`🔄 Processing ${unprocessedChunks.length} accumulated audio chunks with model: ${session.model}`)
      
      // Combine all unprocessed chunks into a single larger audio buffer
      const combinedAudioData = this.combineAudioChunks(unprocessedChunks)
      
      // Create a virtual chunk representing the combined audio
      const combinedChunk: AudioChunk = {
        id: `combined-${Date.now()}`,
        sessionId,
        data: combinedAudioData,
        timestamp: Date.now(),
        processed: false,
        format: unprocessedChunks[0]?.format, // Preserve format from original chunks
        sampleRate: unprocessedChunks[0]?.sampleRate || 16000 // Preserve sample rate
      }
      
      // Process the combined larger audio chunk
      let transcription: string | null = null
      
      // Use AI model for speech-to-text
      console.log(`🔄 Using ${session.model} for speech-to-text...`)
      transcription = await this.performSpeechToText(combinedChunk, session.model)
      
      if (transcription) {
        console.log('📝 Transcription successful:', transcription)
        
        // Send live transcription to client
        this.sendMessage(sessionId, {
          type: 'live_transcription',
          text: transcription,
          timestamp: Date.now(),
          chunkId: combinedChunk.id,
          confidence: 0.9
        })
      } else {
        console.log('📝 No transcription returned - audio may be silence')
      }

      // Mark all processed chunks as processed
      unprocessedChunks.forEach(chunk => chunk.processed = true)
      
    } catch (error) {
      console.error('❌ Error processing accumulated audio chunks:', error)
      this.sendError(sessionId, 'Failed to process audio')
    } finally {
      session.isProcessing = false
    }
  }

  private async processAudioChunk(sessionId: string, chunk: AudioChunk) {
    // This method is kept for backward compatibility but now just calls the accumulated version
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      session.isProcessing = true

      console.log(`🔄 Processing single audio chunk ${chunk.id} with model: ${session.model}`)

      // Use Nova-3 for speech-to-text only  
      let transcription: string | null = null
      
      console.log(`🔄 Using ${session.model} for single chunk speech-to-text...`)
      transcription = await this.performSpeechToText(chunk, session.model)
      
      if (transcription) {
        console.log('📝 Transcription successful:', transcription)
        
        this.sendMessage(sessionId, {
          type: 'live_transcription',
          text: transcription,
          timestamp: Date.now(),
          chunkId: chunk.id,
          confidence: 0.9
        })
      } else {
        console.log('📝 No transcription returned - audio may be silence')
      }

      chunk.processed = true
      
    } catch (error) {
      console.error('❌ Error processing audio chunk:', error)
      this.sendError(sessionId, 'Failed to process audio')
    } finally {
      session.isProcessing = false
    }
  }

  private async handlePCMAudioChunk(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.log('❌ No session found for PCM audio chunk:', sessionId)
      return
    }
    
    if (!session.isRecording) {
      console.log('📣 Session not recording, starting now for PCM session:', sessionId)
      session.isRecording = true
    }

    // Store PCM audio chunk
    const chunk: AudioChunk = {
      id: crypto.randomUUID(),
      sessionId,
      data: message.data,
      timestamp: Date.now(),
      processed: false,
      format: 'pcm_s16le', // Mark as PCM format
      sampleRate: message.sampleRate || 16000
    }

    const buffer = this.audioBuffer.get(sessionId) || []
    buffer.push(chunk)
    this.audioBuffer.set(sessionId, buffer)

    console.log(`🔊 PCM Audio chunk received for session ${sessionId}, buffer size: ${buffer.length}, data length: ${message.data?.length || 0}, sample rate: ${chunk.sampleRate}Hz`)

    // Different processing logic for conversation mode vs regular voice mode
    if (session.isConversationMode) {
      // Real-time partial transcription + full transcription system for conversation mode
      const minChunksForPartial = 6 // Partial transcription every 6 chunks (~12KB) for better accuracy
      const minChunksForFull = 12 // Full transcription every 12 chunks (~24KB) for final accuracy
      const now = Date.now()
      const timeSinceLastCall = now - this.lastASRCallTime
      
      // Check for partial transcription (live feedback)
      const hasPartialAudio = buffer.length >= minChunksForPartial && buffer.length % minChunksForPartial === 0
      const canCallAPI = timeSinceLastCall >= this.minASRInterval
      const hasFullAudio = buffer.length >= minChunksForFull
      const accumulatingTooLong = buffer.length > 0 && timeSinceLastCall >= 8000 // 8+ seconds without processing
      
      // Handle partial transcription for real-time feedback (only in live mode)
      if (session.transcriptionMode === 'live' && !session.isProcessing && hasPartialAudio && canCallAPI && !hasFullAudio) {
        console.log(`🔄 Starting partial transcription with ${buffer.length} chunks for live feedback...`)
        this.lastASRCallTime = now
        await this.processPartialTranscription(sessionId)
      }
      // Skip processing if already processing a conversation turn
      else if (session.isProcessing) {
        console.log('⏳ Already processing conversation turn, skipping...')
        return
      } else if (!canCallAPI) {
        console.log(`⏰ Rate limiting: ${Math.round((this.minASRInterval - timeSinceLastCall) / 1000)}s remaining, buffering chunk ${buffer.length}`)
      } else {
        console.log(`🎯 Conversation mode: accumulating audio... ${buffer.length} chunks (partial at ${minChunksForPartial}, full at ${minChunksForFull})`)
      }
      
      // No server-side turn detection for final processing - wait for client to send process_turn message
      // Just accumulate audio chunks for when the client triggers processing
      
    } else {
      // Regular voice mode: Process immediately for live transcription
      const minChunksForProcessing = 5 // Fast threshold for responsive live transcription
      if (!session.isProcessing && buffer.length >= minChunksForProcessing) {
        console.log(`🚀 Starting PCM transcription processing with ${buffer.length} chunks...`)
        await this.processAccumulatedAudioChunks(sessionId)
      } else if (session.isProcessing) {
        console.log('⏳ Already processing PCM, queuing chunk...')
      } else {
        console.log(`📝 Accumulating PCM audio... ${buffer.length}/${minChunksForProcessing} chunks`)
      }
    }

    // Send metrics update
    this.sendMessage(sessionId, {
      type: 'metrics',
      latency: Date.now() - chunk.timestamp,
      bufferSize: buffer.length,
      quality: this.calculateAudioQuality(buffer),
      format: 'pcm_s16le'
    })
  }

  private async processAccumulatedAudio(sessionId: string) {
    const buffer = this.audioBuffer.get(sessionId) || []
    const unprocessedChunks = buffer.filter(chunk => !chunk.processed)

    if (unprocessedChunks.length === 0) return

    console.log(`🎵 Processing ${unprocessedChunks.length} accumulated audio chunks`)

    // Combine chunks for better transcription accuracy
    const combinedAudio = this.combineAudioChunks(unprocessedChunks)
    
    // Process the combined audio
    for (const chunk of unprocessedChunks) {
      await this.processAudioChunk(sessionId, chunk)
    }
  }

  private async performSpeechToText(chunk: AudioChunk, model: string): Promise<string | null> {
    try {
      console.log(`🔍 Performing STT with model: ${model}, audio data length: ${chunk.data.length}`)

      if (!this.env.AI) {
        console.error('❌ AI binding not available')
        return null
      }

      // Convert base64 audio data to ArrayBuffer
      let audioBuffer = Buffer.from(chunk.data, 'base64')
      console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`)
      
      // Use Nova-3 model for speech-to-text (no artificial minimum size restrictions)
      // Map model names to Cloudflare AI model identifiers
      let aiModel = '@cf/deepgram/nova-2' // default fallback
      if (model.includes('nova-3')) {
        aiModel = '@cf/deepgram/nova-3'
      } else if (model.includes('nova-2')) {
        aiModel = '@cf/deepgram/nova-2'
      } else if (model.includes('whisper-tiny-en')) {
        aiModel = '@cf/openai/whisper-tiny-en'
      }
      console.log(`🤖 Using AI model: ${aiModel}`)
      
      // Determine content type based on format
      let contentType = 'audio/mpeg' // Default fallback
      console.log(`🔍 Audio chunk format: "${chunk.format}", sample rate: ${chunk.sampleRate}Hz`)
      
      if (chunk.format === 'pcm_s16le') {
        console.log('🔧 Converting raw PCM to WAV format...')
        audioBuffer = this.convertPCMToWAV(audioBuffer, chunk.sampleRate || 16000)
        contentType = 'audio/wav'
        console.log(`📊 WAV buffer size: ${audioBuffer.length} bytes`)
      } else if (chunk.format === 'wav') {
        console.log('🎵 Processing WAV file directly...')
        contentType = 'audio/wav'
      } else {
        console.log('🔧 Using default audio/mpeg format...')
      }
      
      // Add timeout to prevent hanging AI calls
      console.log('🚀 Starting AI.run call with timeout...')
      
      // Different input formats for different models
      let aiInput: any
      if (aiModel.includes('whisper')) {
        // Whisper models expect an array of 8-bit unsigned integers
        console.log('🎤 Converting audio buffer to Uint8Array for Whisper...')
        const audioArray = [...new Uint8Array(audioBuffer)]
        aiInput = { audio: audioArray }
        console.log(`📊 Whisper audio array length: ${audioArray.length}`)
      } else {
        // Nova models expect ReadableStream
        console.log('🎤 Using ReadableStream for Nova models...')
        aiInput = {
          audio: {
            body: new Response(audioBuffer).body,  // Convert to ReadableStream
            contentType: contentType
          }
        }
      }
      
      const aiResponse = await Promise.race([
        this.env.AI.run(aiModel, aiInput),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI call timeout after 30 seconds')), 30000)
        )
      ])

      console.log('✅ Speech-to-text transcription completed')
      return this.extractTranscriptionFromResponse(aiResponse)
    } catch (error) {
      console.error('❌ STT Error:', error)
      console.error('❌ STT Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack?.slice(0, 500)
      })
      
      // Send error back to client so they know what happened
      this.sendMessage(chunk.sessionId, {
        type: 'transcription_error',
        error: `Speech-to-text failed: ${error?.message || 'Unknown error'}`,
        timestamp: Date.now()
      })
      
      return null
    }
  }

  private extractTranscriptionFromResponse(aiResponse: any): string | null {
    console.log('📝 Raw AI Response:', JSON.stringify(aiResponse, null, 2))
    
    // Handle the confirmed working response format:
    // { results: { channels: [{ alternatives: [{ transcript: "text", confidence: 0.99 }] }] } }
    if (aiResponse?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      const transcription = aiResponse.results.channels[0].alternatives[0].transcript
      const confidence = aiResponse.results.channels[0].alternatives[0].confidence || 0
      console.log(`✅ STT Success: "${transcription}" (confidence: ${confidence})`)
      return transcription
    }

    // Fallback for old 'text' format
    if (aiResponse && typeof aiResponse === 'object' && 'text' in aiResponse) {
      const transcription = (aiResponse as any).text
      // Ensure we return a string, not a function or other type
      const transcriptionText = (typeof transcription === 'string') ? transcription : String(transcription || '')
      console.log('✅ STT Success (fallback):', transcriptionText)
      return transcriptionText || null
    }

    console.warn('⚠️ No transcription found in response format')
    return null
  }


  private async generateAIResponse(transcription: string, sessionId: string): Promise<string | null> {
    try {
      console.log(`🤖 Generating AI response for: "${transcription}"`)

      // Use Cloudflare AI to generate a response
      const aiResponse = await this.env.AI?.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Keep responses concise and conversational, suitable for voice interaction. Limit responses to 1-2 sentences.'
          },
          {
            role: 'user',
            content: transcription
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      })

      if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
        const response = (aiResponse as any).response
        console.log('✅ AI Response generated:', response)
        return response || null
      }

      console.warn('⚠️ No response returned from AI model')
      return 'I heard you, but I\'m having trouble generating a response right now.'
    } catch (error) {
      console.error('❌ AI Response Error:', error)
      return 'Sorry, I\'m having trouble processing your request right now.'
    }
  }

  private async performTextToSpeech(text: string, voice: string): Promise<string> {
    try {
      console.log(`🗣️ Performing TTS with voice: ${voice}`)

      // Use Aura-1 for text-to-speech
      const aiModel = '@cf/deepgram/aura-1'
      
      // Map voice parameter to valid speaker names
      // Default to 'angus' if voice is just 'aura' or not recognized
      const speakerMap: Record<string, string> = {
        'aura': 'angus',
        'aura-angus': 'angus',
        'aura-stella': 'stella',
        'aura-luna': 'luna',
        'aura-orion': 'orion',
        'aura-arcas': 'arcas',
        'aura-perseus': 'perseus',
        'aura-hera': 'hera'
      }
      
      const speaker = speakerMap[voice] || 'angus'
      
      const aiResponse = await this.env.AI?.run(aiModel, {
        text: text.trim(),
        speaker: speaker
      }, {
        returnRawResponse: true
      })

      if (aiResponse && aiResponse instanceof Response) {
        // Check if response is successful and contains audio data
        if (!aiResponse.ok) {
          const errorText = await aiResponse.text()
          console.error('❌ TTS API Error:', aiResponse.status, errorText)
          return ''
        }

        // Check content type to ensure it's audio data
        const contentType = aiResponse.headers.get('content-type') || ''
        if (!contentType.includes('audio/')) {
          const responseText = await aiResponse.text()
          console.error('❌ TTS returned non-audio response:', contentType, responseText.slice(0, 200))
          return ''
        }

        const audioBuffer = await aiResponse.arrayBuffer()
        
        // Additional check: ensure we got actual audio data (not error JSON)
        if (audioBuffer.byteLength === 0) {
          console.error('❌ TTS returned empty audio buffer')
          return ''
        }

        const base64Audio = Buffer.from(audioBuffer).toString('base64')
        console.log('✅ TTS Success, audio length:', base64Audio.length, 'content-type:', contentType)
        return base64Audio
      }

      console.warn('⚠️ No audio returned from TTS model')
      return ''
    } catch (error) {
      console.error('❌ TTS Error:', error)
      return ''
    }
  }

  private convertPCMToWAV(pcmBuffer: Buffer, sampleRate: number): Buffer {
    // WAV header parameters
    const numChannels = 1 // Mono
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = pcmBuffer.length
    const fileSize = 44 + dataSize

    // Create WAV header (44 bytes)
    const header = Buffer.alloc(44)
    
    // RIFF header
    header.write('RIFF', 0)
    header.writeUInt32LE(fileSize - 8, 4)
    header.write('WAVE', 8)
    
    // fmt chunk
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16) // PCM format chunk size
    header.writeUInt16LE(1, 20)  // PCM format
    header.writeUInt16LE(numChannels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    
    // data chunk
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)
    
    // Combine header and PCM data
    return Buffer.concat([header, pcmBuffer])
  }

  private combineAudioChunks(chunks: AudioChunk[]): string {
    try {
      // Convert all base64 chunks to binary, combine them, then back to base64
      const combinedBuffers: Uint8Array[] = []
      let totalLength = 0
      
      for (const chunk of chunks) {
        const audioBuffer = Buffer.from(chunk.data, 'base64')
        combinedBuffers.push(new Uint8Array(audioBuffer))
        totalLength += audioBuffer.length
      }
      
      // Combine all buffers into one
      const combined = new Uint8Array(totalLength)
      let offset = 0
      
      for (const buffer of combinedBuffers) {
        combined.set(buffer, offset)
        offset += buffer.length
      }
      
      // Convert back to base64
      const combinedBase64 = Buffer.from(combined).toString('base64')
      console.log(`🎵 Combined ${chunks.length} chunks (${totalLength} bytes) into single audio buffer`)
      
      return combinedBase64
    } catch (error) {
      console.error('❌ Error combining audio chunks:', error)
      // Fallback: just concatenate base64 strings (not ideal but better than nothing)
      return chunks.map(c => c.data).join('')
    }
  }

  private calculateAudioQuality(buffer: AudioChunk[]): 'excellent' | 'good' | 'fair' | 'poor' {
    const bufferSize = buffer.length
    const latency = buffer.length > 0 ? Date.now() - buffer[buffer.length - 1].timestamp : 0

    if (bufferSize < 5 && latency < 100) return 'excellent'
    if (bufferSize < 10 && latency < 200) return 'good'
    if (bufferSize < 20 && latency < 500) return 'fair'
    return 'poor'
  }

  private calculateVolume(chunk: AudioChunk): number {
    try {
      // Decode base64 audio data
      const audioBuffer = Buffer.from(chunk.data, 'base64')
      
      // Calculate RMS (Root Mean Square) for volume estimation
      let sum = 0
      for (let i = 0; i < audioBuffer.length; i += 2) {
        // Read 16-bit sample (little-endian)
        const sample = audioBuffer.readInt16LE(i)
        sum += sample * sample
      }
      
      const rms = Math.sqrt(sum / (audioBuffer.length / 2))
      return rms / 32768 // Normalize to 0-1 range
    } catch (error) {
      return 0.5 // Default middle value if calculation fails
    }
  }

  private sendMessage(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (session?.websocket) {
      session.websocket.send(JSON.stringify(message))
    }
  }

  private sendError(sessionId: string, error: string) {
    this.sendMessage(sessionId, {
      type: 'error',
      message: error,
      timestamp: Date.now()
    })
  }

  // Conversational AI handlers
  private async handleStartConversation(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.error(`❌ No session found for handleStartConversation: ${sessionId}`)
      return
    }
    
    console.log('🎯 Starting conversational AI session with Smart Turn v2')
    console.log('📋 Config received:', message.config)
    
    // Update session model configuration
    session.model = message.config?.sttModel || 'nova-3'
    // Keep the original voice parameter from session initialization (e.g., 'aura')
    // Don't overwrite with 'angus' which is a speaker name, not a voice parameter
    session.isRecording = true
    session.isConversationMode = true
    session.transcriptionMode = message.config?.transcriptionMode || 'live' // Set mode from client
    session.conversationHistory = [] // Initialize conversation history
    
    // Send confirmation back to client
    this.sendMessage(sessionId, {
      type: 'conversation_started',
      config: message.config,
      timestamp: Date.now()
    })
  }
  
  private async handleStopConversation(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    console.log('⏹️ Stopping conversational AI session')
    
    session.isRecording = false
    session.isProcessing = false
    
    // Clear any pending audio buffer
    this.audioBuffer.set(sessionId, [])
    
    this.sendMessage(sessionId, {
      type: 'conversation_stopped',
      timestamp: Date.now()
    })
  }
  
  private async processConversationTurn(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    // Skip processing if already processing a conversation turn
    if (session.isProcessing) {
      console.log('⏳ Already processing conversation turn, skipping...')
      return
    }
    
    console.log('🔄 Processing complete conversation turn with 4-model pipeline')
    
    // Process all accumulated PCM audio for the complete turn
    const buffer = this.audioBuffer.get(sessionId) || []
    
    if (buffer.length > 0) {
      session.isProcessing = true
      
      // Clear buffer immediately to prevent other parallel calls from processing the same audio
      this.audioBuffer.set(sessionId, [])
      
      try {
        // Step 1: STT (Nova-3) - Convert audio to text
        const audioChunk: AudioChunk = {
          id: crypto.randomUUID(),
          sessionId,
          data: this.combineAudioChunks(buffer),
          timestamp: Date.now(),
          processed: false,
          format: buffer[0].format || 'pcm_s16le',
          sampleRate: buffer[0].sampleRate || 16000
        }
        
        console.log('🎤 Step 1: Performing STT with Nova-3')
        const transcription = await this.performSpeechToText(audioChunk, session.model)
        
        console.log('🔍 Debug: transcription result:', { transcription, type: typeof transcription })
        
        // Ensure transcription is a string and not empty
        const transcriptionText = (typeof transcription === 'string') ? transcription.trim() : String(transcription || '').trim()
        
        console.log('🔍 Debug: transcriptionText result:', { transcriptionText, length: transcriptionText?.length })
        
        if (transcriptionText && transcriptionText.length > 0) {
          // Add user message to conversation history
          const userTurn: ConversationTurn = {
            role: 'user',
            text: transcriptionText,
            timestamp: Date.now()
          }
          
          if (!session.conversationHistory) session.conversationHistory = []
          session.conversationHistory.push(userTurn)
          
          // Send transcription to client
          this.sendMessage(sessionId, {
            type: 'transcription_result',
            text: transcriptionText,
            confidence: 0.95,
            timestamp: Date.now()
          })
          
          // Step 2: LLM (Llama-2) - Generate response
          console.log('🤖 Step 2: Generating response with Llama-2')
          const llmResponse = await this.generateConversationResponse(transcriptionText, session.conversationHistory)
          
          if (llmResponse) {
            // Add AI response to conversation history
            const aiTurn: ConversationTurn = {
              role: 'assistant',
              text: llmResponse,
              timestamp: Date.now()
            }
            session.conversationHistory.push(aiTurn)
            
            // Send LLM response to client
            this.sendMessage(sessionId, {
              type: 'llm_response',
              text: llmResponse,
              timestamp: Date.now()
            })
            
            // Step 3: TTS (Aura-1) - Convert response to speech
            console.log('🗣️ Step 3: Generating speech with Aura-1')
            const audioResponse = await this.performTextToSpeech(llmResponse, session.voice)
            
            console.log('🔍 Debug: audioResponse result:', { hasAudio: !!audioResponse, length: audioResponse?.length })
            
            if (audioResponse) {
              // Send TTS audio to client
              console.log('📤 Sending tts_ready to client')
              this.sendMessage(sessionId, {
                type: 'tts_ready',
                audioData: audioResponse,
                timestamp: Date.now()
              })
            } else {
              console.warn('⚠️ No audio response from TTS - not sending tts_ready')
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Conversation turn processing failed:', error)
        this.sendMessage(sessionId, {
          type: 'conversation_error',
          error: 'Failed to process conversation turn',
          timestamp: Date.now()
        })
      } finally {
        session.isProcessing = false
      }
    }
  }
  
  private async generateConversationResponse(userText: string, conversationHistory: ConversationTurn[]): Promise<string | null> {
    try {
      console.log(`🤖 Generating LLM response for: "${userText}"`)
      
      // Build conversation context for Llama-2
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful AI assistant engaged in natural voice conversation. Keep responses concise and conversational, suitable for voice interaction. Limit responses to 1-2 sentences unless more detail is specifically requested.'
        }
      ]
      
      // Add recent conversation history for context (last 5 turns)
      for (const turn of conversationHistory.slice(-5)) {
        messages.push({
          role: turn.role === 'user' ? 'user' : 'assistant',
          content: turn.text
        })
      }
      
      // Generate response using Llama-2
      const aiResponse = await this.env.AI?.run('@cf/meta/llama-2-7b-chat-int8', {
        messages,
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9
      })
      
      if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
        const responseText = (aiResponse as any).response
        console.log('✅ LLM response generated:', responseText)
        return responseText
      }
      
      console.warn('⚠️ No response returned from Llama-2')
      return 'I heard you, but I\'m having trouble generating a response right now.'
      
    } catch (error) {
      console.error('❌ LLM generation error:', error)
      return 'Sorry, I\'m having trouble processing your request right now.'
    }
  }

  private async handleProcessTurn(sessionId: string, message: any) {
    console.log('📨 Client-side turn detection triggered - processing conversation turn')
    await this.processConversationTurn(sessionId)
  }
  
  private async handleUpdateVoice(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    console.log(`🎵 Updating voice for session ${sessionId} to: ${message.voice}`)
    
    // Update the session's voice preference
    session.voice = message.voice
    
    // Send confirmation back to client
    session.webSocket?.send(JSON.stringify({
      type: 'voice_updated',
      voice: message.voice,
      timestamp: Date.now()
    }))
  }
  
  private async handleGenerateResponse(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    // Skip if in conversation mode - this is handled by processConversationTurn
    if (session.isConversationMode) {
      console.log('⏩ Skipping handleGenerateResponse - conversation mode uses processConversationTurn')
      return
    }
    
    console.log(`🤖 Generating LLM response for: "${message.text}"`)
    
    try {
      // Use conversational context if provided
      const conversationHistory = message.conversationHistory || []
      
      // Build conversation context
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful AI assistant engaged in natural voice conversation. Keep responses concise and conversational, suitable for voice interaction. Limit responses to 1-2 sentences unless more detail is specifically requested.'
        }
      ]
      
      // Add recent conversation history for context
      for (const turn of conversationHistory.slice(-5)) {
        messages.push({
          role: turn.type === 'user' ? 'user' : 'assistant',
          content: turn.text
        })
      }
      
      // Add current user message
      messages.push({
        role: 'user',
        content: message.text
      })
      
      // Generate response using Llama
      const aiResponse = await this.env.AI?.run('@cf/meta/llama-2-7b-chat-int8', {
        messages,
        max_tokens: 150,
        temperature: 0.7,
        top_p: 0.9
      })
      
      let responseText = 'I heard you, but I\'m having trouble generating a response right now.'
      
      if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
        responseText = (aiResponse as any).response
      }
      
      // Send LLM response back to client
      this.sendMessage(sessionId, {
        type: 'llm_response',
        text: responseText,
        timestamp: Date.now()
      })
      
      console.log('✅ LLM response generated successfully')
      
    } catch (error) {
      console.error('❌ LLM generation error:', error)
      
      this.sendMessage(sessionId, {
        type: 'llm_response',
        text: 'Sorry, I\'m having trouble processing your request right now.',
        timestamp: Date.now()
      })
    }
  }
  
  private async handleGenerateTTS(sessionId: string, message: any) {
    const session = this.sessions.get(sessionId)
    if (!session) return
    
    // Skip if in conversation mode - this is handled by processConversationTurn
    if (session.isConversationMode) {
      console.log('⏩ Skipping handleGenerateTTS - conversation mode uses processConversationTurn')
      return
    }
    
    console.log(`🗣️ Generating TTS for: "${message.text.slice(0, 50)}..."`)
    
    try {
      // Generate TTS using simplified parameters (same as working TTS test)
      const aiResponse = await this.env.AI?.run('@cf/deepgram/aura-1', {
        text: message.text.trim(),
        speaker: message.voice || 'angus'
      }, {
        returnRawResponse: true
      })
      
      if (aiResponse && aiResponse instanceof Response) {
        const audioBuffer = await aiResponse.arrayBuffer()
        
        // Convert audio buffer to base64 for transmission
        const audioBytes = new Uint8Array(audioBuffer)
        let binary = ''
        for (let i = 0; i < audioBytes.length; i++) {
          binary += String.fromCharCode(audioBytes[i])
        }
        const base64Audio = btoa(binary)
        
        // Send TTS audio back to client as base64
        this.sendMessage(sessionId, {
          type: 'tts_ready',
          audioData: base64Audio,
          timestamp: Date.now()
        })
        
        console.log('✅ TTS generation successful for conversation')
        
      } else {
        throw new Error('No audio response from TTS model')
      }
      
    } catch (error) {
      console.error('❌ TTS generation error:', error)
      
      this.sendMessage(sessionId, {
        type: 'tts_error',
        error: 'Failed to generate speech audio',
        timestamp: Date.now()
      })
    }
  }
  
  private async checkSmartTurnDetection(sessionId: string, latestChunk: AudioChunk) {
    try {
      console.log('🎯 Checking Smart Turn v2 for conversation turn detection...')
      
      // Get current audio buffer for Smart Turn analysis
      const buffer = this.audioBuffer.get(sessionId) || []
      if (buffer.length < 3) return
      
      // Combine recent chunks for Smart Turn v2 analysis
      const recentChunks = buffer.slice(-5) // Use last 5 chunks for turn detection
      const combinedAudio = this.combineAudioChunks(recentChunks)
      
      const turnResult = await this.performSmartTurnDetection({
        id: crypto.randomUUID(),
        sessionId,
        data: combinedAudio,
        timestamp: Date.now(),
        processed: false,
        format: 'pcm_s16le',
        sampleRate: latestChunk.sampleRate
      })
      
      console.log(`🎯 Smart Turn v2 result: complete=${turnResult.is_complete}, probability=${turnResult.probability}`)
      
      // If turn is detected with high confidence, process the complete turn
      // Increased threshold to prevent premature turn detection
      if (turnResult.is_complete || turnResult.probability > 0.7) {
        console.log('✅ Smart Turn v2 detected end of turn - processing complete conversation turn')
        await this.processConversationTurn(sessionId)
      }
      
    } catch (error) {
      console.error('❌ Smart Turn v2 detection failed:', error)
      // Fallback: process turn after accumulating enough audio  
      const buffer = this.audioBuffer.get(sessionId) || []
      if (buffer.length >= 5) {
        console.log('🔄 Fallback: Processing turn due to buffer size (user likely stopped speaking)')
        await this.processConversationTurn(sessionId)
      }
    }
  }

  private async performSmartTurnDetection(audioChunk: AudioChunk): Promise<{ is_complete: boolean; probability: number }> {
    try {
      console.log('🎯 Running Smart Turn v2 detection...')
      
      // Convert PCM to WAV for Smart Turn v2
      const audioBuffer = Buffer.from(audioChunk.data, 'base64')
      const wavBuffer = this.convertPCMToWAV(audioBuffer, audioChunk.sampleRate)
      
      // Convert WAV buffer to base64 for Smart Turn v2
      const base64Audio = Buffer.from(wavBuffer).toString('base64')
      
      // DISABLED: Smart Turn v2 API format issue - falling back to volume detection
      // const turnResponse = await this.env.AI?.run('@cf/pipecat-ai/smart-turn-v2', {
      //   audio: {
      //     body: base64Audio,
      //     contentType: 'audio/wav'
      //   }
      // })
      const turnResponse = null // Force fallback to volume-based detection
      
      if (turnResponse && typeof turnResponse === 'object') {
        const isComplete = (turnResponse as any).is_complete || false
        const probability = (turnResponse as any).probability || 0
        
        console.log(`🎯 Smart Turn v2 result: complete=${isComplete}, confidence=${probability}`)
        
        return { is_complete: isComplete, probability }
      }
      
      // Fallback: simple silence detection - lower probability to prevent premature turn detection
      return { is_complete: false, probability: 0.1 }
      
    } catch (error) {
      console.error('❌ Smart Turn v2 error:', error)
      // Fallback: assume turn is not complete
      return { is_complete: false, probability: 0.1 }
    }
  }

  private cleanup(sessionId: string) {
    console.log(`🗑️ Cleaning up session: ${sessionId}`)
    
    this.sessions.delete(sessionId)
    this.audioBuffer.delete(sessionId)
  }

  // Periodic cleanup of old sessions (called by the runtime)
  async alarm() {
    console.log('🕒 Running periodic cleanup for Voice AI sessions')
    
    const now = Date.now()
    const CLEANUP_THRESHOLD = 30 * 60 * 1000 // 30 minutes

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > CLEANUP_THRESHOLD) {
        console.log(`🧹 Cleaning up inactive session: ${sessionId}`)
        this.cleanup(sessionId)
      }
    }

    // Schedule next cleanup
    await this.ctx.storage.setAlarm(Date.now() + 5 * 60 * 1000) // Every 5 minutes
  }
}