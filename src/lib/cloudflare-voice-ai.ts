/**
 * Cloudflare Realtime Voice AI Integration
 * Implements WebRTC-based real-time voice AI using Cloudflare's platform
 */

interface VoiceAIConfig {
  model: string;
  voice: string;
  language: string;
  enableRealtime: boolean;
  latencyTarget?: number;
}

interface VoiceMetrics {
  volume: number;
  rms: number;
  peak: number;
  voiceActive: boolean;
  latency: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  timestamp: number;
}

interface AudioData {
  audioData: Float32Array;
  metrics: VoiceMetrics;
  sessionId: string;
  timestamp: number;
}

export class CloudflareVoiceAI {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  
  // Configuration
  private config: VoiceAIConfig;
  private sessionId: string | null = null;
  private isConnected = false;
  private isRecording = false;
  
  // Metrics tracking
  private metrics: VoiceMetrics = {
    volume: 0,
    rms: 0,
    peak: 0,
    voiceActive: false,
    latency: 0,
    quality: 'excellent',
    timestamp: 0
  };
  
  // Event handlers
  public onTranscription?: (text: string) => void;
  public onAudioResponse?: (audioData: ArrayBuffer) => void;
  public onConversationTurn?: (isSpeaking: boolean) => void;
  public onMetricsUpdate?: (metrics: VoiceMetrics) => void;
  public onError?: (error: string) => void;
  public onConnectionChange?: (connected: boolean) => void;

  constructor(config: VoiceAIConfig) {
    this.config = {
      latencyTarget: 800,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔄 Initializing Cloudflare Voice AI...');
      
      // Setup audio context and capture
      await this.setupAudioCapture();
      
      // Setup WebSocket connection
      await this.setupWebSocket();
      
      // Initialize WebRTC if available
      await this.setupWebRTC();
      
      console.log('✅ Cloudflare Voice AI initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Voice AI:', error);
      this.onError?.(`Initialization failed: ${error.message}`);
      throw error;
    }
  }

  private async setupAudioCapture(): Promise<void> {
    // Get user media with optimal settings for voice AI
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Cloudflare optimized settings
        suppressLocalAudioPlayback: true
      }
    });

    // Create audio context
    this.audioContext = new AudioContext({ 
      sampleRate: 48000,
      latencyHint: 'interactive'
    });

    // Wait for audio context to be running
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Load audio worklet processor
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    
    // Create and configure audio worklet
    this.audioWorklet = new AudioWorkletNode(this.audioContext, 'voice-ai-processor', {
      processorOptions: {
        bufferSize: 4096,
        sampleRate: 48000
      }
    });

    // Connect audio source to worklet
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    source.connect(this.audioWorklet);

    // Handle audio worklet messages
    this.audioWorklet.port.onmessage = (event) => {
      this.handleAudioWorkletMessage(event.data);
    };

    console.log('🎵 Audio capture setup complete');
  }

  private async setupWebSocket(): Promise<void> {
    const wsUrl = new URL('/ws/voice-ai', window.location.origin);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Add configuration parameters
    wsUrl.searchParams.set('model', this.config.model);
    wsUrl.searchParams.set('voice', this.config.voice);
    wsUrl.searchParams.set('language', this.config.language);
    wsUrl.searchParams.set('realtime', this.config.enableRealtime.toString());

    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onopen = () => {
      console.log('✅ Voice AI WebSocket connected');
      this.isConnected = true;
      this.onConnectionChange?.(true);
      
      // Send initial configuration
      this.sendMessage({
        type: 'configure',
        config: this.config,
        timestamp: Date.now()
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('🔌 Voice AI WebSocket closed:', event.code, event.reason);
      this.isConnected = false;
      this.onConnectionChange?.(false);
      
      // Attempt reconnection if not intentional
      if (event.code !== 1000) {
        setTimeout(() => this.reconnect(), 2000);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.onError?.('WebSocket connection failed');
    };
  }

  private async setupWebRTC(): Promise<void> {
    // WebRTC configuration for Cloudflare edge network
    const rtcConfig: RTCConfiguration = {
      iceServers: [
        // Cloudflare's STUN servers (if available)
        { urls: 'stun:stun.cloudflare.com:3478' },
        // Fallback to public STUN servers
        { urls: 'stun:stun.l.google.com:19302' }
      ],
      bundlePolicy: 'max-bundle',
      iceTransportPolicy: 'all'
    };

    this.peerConnection = new RTCPeerConnection(rtcConfig);

    // Add audio track to peer connection
    if (this.mediaStream) {
      const audioTrack = this.mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        this.peerConnection.addTrack(audioTrack, this.mediaStream);
      }
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
          timestamp: Date.now()
        });
      }
    };

    // Handle remote audio stream
    this.peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      this.handleRemoteAudioStream(remoteStream);
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', this.peerConnection?.connectionState);
      
      if (this.peerConnection?.connectionState === 'failed') {
        this.handleWebRTCFailure();
      }
    };

    console.log('🔗 WebRTC setup complete');
  }

  private handleAudioWorkletMessage(data: any): void {
    switch (data.type) {
      case 'audio_data':
        this.handleAudioData(data);
        break;
        
      case 'silence_detected':
        this.handleSilence(data.duration);
        break;
    }
  }

  private handleAudioData(data: any): void {
    const audioData: AudioData = {
      audioData: data.audioData,
      metrics: data.metrics,
      sessionId: this.sessionId || '',
      timestamp: Date.now()
    };

    // Update metrics
    this.metrics = { ...this.metrics, ...data.metrics };
    this.onMetricsUpdate?.(this.metrics);

    // Send audio data to server
    if (this.isConnected && this.isRecording) {
      this.sendAudioData(audioData);
    }
  }

  private sendAudioData(audioData: AudioData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Convert Float32Array to base64 for transmission
    const buffer = new ArrayBuffer(audioData.audioData.length * 4);
    const view = new Float32Array(buffer);
    view.set(audioData.audioData);
    
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    this.sendMessage({
      type: 'audio_data',
      data: base64,
      metrics: audioData.metrics,
      sessionId: audioData.sessionId,
      timestamp: audioData.timestamp
    });
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'session_created':
        this.sessionId = data.sessionId;
        console.log('🎯 Voice AI session created:', this.sessionId);
        break;

      case 'configured':
        console.log('⚙️ Voice AI configured:', data);
        break;

      case 'recording_started':
        console.log('🎤 Recording started by server');
        break;

      case 'recording_stopped':
        console.log('🛑 Recording stopped by server');
        break;

      case 'transcription':
        console.log('📝 Transcription:', data.text);
        this.onTranscription?.(data.text);
        break;

      case 'audio_response':
        console.log('🔊 Received audio response');
        this.handleAudioResponse(data.audioData);
        break;

      case 'conversation_turn':
        this.onConversationTurn?.(data.isSpeaking);
        break;

      case 'metrics':
        this.updateMetrics(data.metrics);
        break;

      case 'webrtc_offer':
        this.handleWebRTCOffer(data.offer);
        break;

      case 'ice_candidate':
        this.handleRemoteICECandidate(data.candidate);
        break;

      case 'error':
        console.error('❌ Voice AI error:', data.message);
        this.onError?.(data.message);
        break;

      default:
        console.log('❓ Unknown message type:', data.type, data);
    }
  }

  private async handleAudioResponse(base64Audio: string): Promise<void> {
    if (!this.audioContext) return;

    try {
      // Decode base64 audio
      const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer);

      // Play audio response
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();

      // Notify callback
      this.onAudioResponse?.(audioData.buffer);
      
      console.log('🔊 AI audio response played');
    } catch (error) {
      console.error('Failed to play audio response:', error);
    }
  }

  private async handleWebRTCOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer back
      this.sendMessage({
        type: 'webrtc_answer',
        answer: answer,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('WebRTC offer handling failed:', error);
    }
  }

  private async handleRemoteICECandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  private handleRemoteAudioStream(stream: MediaStream): void {
    // Create audio element for remote stream playback
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play().catch(console.error);
  }

  private handleWebRTCFailure(): void {
    console.warn('WebRTC connection failed, falling back to WebSocket');
    // Fallback to WebSocket-only mode
    this.peerConnection = null;
  }

  private updateMetrics(metrics: Partial<VoiceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
    this.onMetricsUpdate?.(this.metrics);
  }

  private handleSilence(duration: number): void {
    console.log(`🔇 Silence detected: ${duration}s`);
    // Could be used for conversation turn detection
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private async reconnect(): Promise<void> {
    if (this.isConnected) return;

    console.log('🔄 Attempting to reconnect...');
    try {
      await this.setupWebSocket();
    } catch (error) {
      console.error('Reconnection failed:', error);
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  // Public API methods
  async startRecording(): Promise<void> {
    if (!this.audioWorklet) {
      throw new Error('Audio worklet not initialized');
    }

    this.isRecording = true;
    
    // Start audio processing
    this.audioWorklet.port.postMessage({
      type: 'start'
    });

    console.log('🎤 Recording started');
  }

  async stopRecording(): Promise<void> {
    this.isRecording = false;
    
    if (this.audioWorklet) {
      this.audioWorklet.port.postMessage({
        type: 'stop'
      });
    }

    console.log('🛑 Recording stopped');
  }

  getMetrics(): VoiceMetrics {
    return { ...this.metrics };
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  async disconnect(): Promise<void> {
    this.isRecording = false;
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }

    // Close WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isConnected = false;
    console.log('🔌 Voice AI disconnected');
  }
}