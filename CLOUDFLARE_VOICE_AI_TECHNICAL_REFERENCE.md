# Cloudflare Realtime Voice AI - Complete Technical Reference

## Overview
Cloudflare's Realtime Voice AI platform enables developers to build real-time voice-enabled AI applications using WebRTC, Workers AI, and edge computing infrastructure across 330+ global locations.

## Core Services & Components

### 1. Cloudflare Realtime Agents
- **Purpose**: Orchestrate voice AI pipelines with component chaining
- **Runtime**: Executes on Cloudflare's edge network
- **Base Class**: `RealtimeAgent<Env>`

### 2. Workers AI
- **Models Supported**: Multiple AI providers (OpenAI, Anthropic, Meta Llama)
- **Inference**: Real-time AI processing at the edge
- **Integration**: Direct API access via `env.AI.run()`

### 3. WebRTC Audio Processing
- **Codec Support**: Opus to PCM conversion
- **Transport**: Direct WebRTC audio streaming
- **Latency**: Optimized for <800ms conversation response

### 4. Realtime SFU (Selective Forwarding Unit)
- **Function**: Routes audio streams between participants
- **Network**: Global deployment across Cloudflare edge
- **Features**: Handles WebRTC signaling and media routing

### 5. WebSocket AI Inference
- **Protocol**: WebSocket-based real-time communication
- **Audio Streaming**: Bidirectional audio data exchange
- **Event Handling**: Real-time message processing

## Architecture Patterns

### RealtimeAgent Base Class
```javascript
class MyAgent extends RealtimeAgent<Env> {
  async init(agentId, meetingId, authToken) {
    // Initialize components
    const textHandler = new MyTextHandler(this.env);
    const transport = new RealtimeKitTransport(meetingId, authToken);

    // Setup pipeline chain
    await this.initPipeline([
      transport,           // WebRTC transport layer
      new DeepgramSTT(),   // Speech-to-text
      textHandler,         // AI processing
      new ElevenLabsTTS(), // Text-to-speech
      transport            // Output back to transport
    ]);
  }
}
```

### Text Processing Component
```javascript
class MyTextHandler extends TextComponent {
  async onTranscript(text: string) {
    // Run AI inference using Workers AI
    const { response } = await this.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct', 
      { 
        prompt: text,
        max_tokens: 256,
        temperature: 0.8
      }
    );
    
    // Send response back to TTS
    this.speak(response);
  }
  
  async onInterruption() {
    // Handle conversation interruptions
    this.stopSpeaking();
  }
}
```

### Pipeline Component Interface
```typescript
interface PipelineComponent {
  process(data: AudioData | TextData): Promise<any>;
  onError(error: Error): void;
  onInterruption(): Promise<void>;
}
```

## WebSocket AI Inference Implementation

### Python Example (Server-side)
```python
import asyncio
import json
import websockets
import numpy as np

async def run_inference(audio_data: bytes) -> dict:
    """Process audio through WebSocket AI endpoint"""
    
    # Connect to Cloudflare Workers AI WebSocket
    async with websockets.connect(WEBSOCKET_URL) as websocket:
        # Send configuration
        await websocket.send(json.dumps({
            'type': 'configure',
            'model': '@cf/deepgram/nova-3',
            'voice': '@cf/deepgram/aura-1',
            'language': 'en'
        }))
        
        # Stream audio data
        await websocket.send(audio_data)
        
        # Receive processed response
        response = await websocket.recv()
        return json.loads(response)

async def process_audio_stream(audio_stream):
    """Handle continuous audio processing"""
    async for audio_chunk in audio_stream:
        result = await run_inference(audio_chunk)
        
        if result['type'] == 'transcription':
            print(f"User said: {result['text']}")
        elif result['type'] == 'audio_response':
            # Play AI voice response
            play_audio(result['audio_data'])
```

### JavaScript/TypeScript Client Implementation
```typescript
interface VoiceAIConfig {
  model: string;
  voice: string;
  language: string;
  enableRealtime: boolean;
}

class CloudflareVoiceAI {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;

  async initialize(config: VoiceAIConfig): Promise<void> {
    // Setup WebSocket connection
    const wsUrl = `wss://your-worker.your-subdomain.workers.dev/ws/voice-ai`;
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({
        type: 'configure',
        ...config
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    // Setup audio capture
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    this.audioContext = new AudioContext({ sampleRate: 48000 });
    await this.setupAudioProcessing();
  }

  private async setupAudioProcessing(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) return;

    // Create audio worklet for real-time processing
    await this.audioContext.audioWorklet.addModule('/audio-processor.js');
    
    const processor = new AudioWorkletNode(this.audioContext, 'voice-ai-processor');
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    source.connect(processor);
    
    processor.port.onmessage = (event) => {
      const audioData = event.data;
      this.sendAudioData(audioData);
    };
  }

  private sendAudioData(audioData: Float32Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Convert to base64 for WebSocket transmission
      const buffer = new ArrayBuffer(audioData.length * 4);
      const view = new Float32Array(buffer);
      view.set(audioData);
      
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      
      this.ws.send(JSON.stringify({
        type: 'audio_data',
        data: base64,
        timestamp: Date.now()
      }));
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'transcription':
        console.log('Transcription:', data.text);
        this.onTranscription?.(data.text);
        break;
        
      case 'audio_response':
        this.playAudioResponse(data.audioData);
        break;
        
      case 'conversation_turn':
        this.onConversationTurn?.(data.isSpeaking);
        break;
        
      case 'error':
        console.error('Voice AI Error:', data.message);
        break;
    }
  }

  private async playAudioResponse(base64Audio: string): Promise<void> {
    if (!this.audioContext) return;

    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  // Event handlers (to be implemented by consumer)
  onTranscription?: (text: string) => void;
  onConversationTurn?: (isSpeaking: boolean) => void;
  onError?: (error: string) => void;
}
```

## Audio Worklet Implementation

### audio-processor.js
```javascript
class VoiceAIProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex] = channelData[i];
        this.bufferIndex++;
        
        // Send buffer when full
        if (this.bufferIndex >= this.bufferSize) {
          this.port.postMessage(this.buffer.slice());
          this.bufferIndex = 0;
        }
      }
    }
    
    return true;
  }
}

registerProcessor('voice-ai-processor', VoiceAIProcessor);
```

## Cloudflare Workers Implementation

### Voice AI Worker
```typescript
interface Env {
  AI: Ai;
  VOICE_AI_DO: DurableObjectNamespace;
  DEEPGRAM_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws/voice-ai') {
      return handleWebSocket(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleWebSocket(request: Request, env: Env): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  // Handle WebSocket events
  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      await processVoiceMessage(data, server, env);
    } catch (error) {
      server.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

async function processVoiceMessage(data: any, websocket: WebSocket, env: Env): Promise<void> {
  switch (data.type) {
    case 'configure':
      // Setup voice AI configuration
      await configureVoiceAI(data, websocket, env);
      break;
      
    case 'audio_data':
      // Process incoming audio
      await processAudioData(data, websocket, env);
      break;
  }
}

async function processAudioData(data: any, websocket: WebSocket, env: Env): Promise<void> {
  // Decode base64 audio data
  const audioBuffer = Uint8Array.from(atob(data.data), c => c.charCodeAt(0));
  
  // Speech-to-Text using Deepgram via Workers AI
  const transcription = await env.AI.run('@cf/deepgram/nova-3', {
    audio: audioBuffer,
    language: 'en'
  });
  
  if (transcription.text) {
    // Send transcription to client
    websocket.send(JSON.stringify({
      type: 'transcription',
      text: transcription.text,
      timestamp: Date.now()
    }));
    
    // Generate AI response
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      prompt: transcription.text,
      max_tokens: 256
    });
    
    // Text-to-Speech using Deepgram
    const audioResponse = await env.AI.run('@cf/deepgram/aura-1', {
      text: aiResponse.response,
      voice: 'aura-asteria-en'
    });
    
    // Send audio response back
    websocket.send(JSON.stringify({
      type: 'audio_response',
      audioData: btoa(String.fromCharCode(...new Uint8Array(audioResponse.audio))),
      timestamp: Date.now()
    }));
  }
}
```

## Performance Specifications

### Latency Targets
- **Conversation Latency**: <800ms end-to-end
- **Audio Processing**: <100ms per chunk
- **AI Inference**: <300ms for most models
- **Network Transport**: <50ms (edge optimization)

### Scalability
- **Global Network**: 330+ cities worldwide
- **Concurrent Sessions**: Unlimited (edge-based)
- **Audio Quality**: 48kHz, 16-bit, mono/stereo
- **Codec Support**: Opus, PCM, WebRTC standards

### Resource Requirements
- **Bandwidth**: ~64kbps per voice connection
- **CPU**: Optimized edge processing
- **Memory**: Minimal client-side footprint
- **Storage**: Session-based (no persistent storage)

## Integration Requirements

### Prerequisites
- Cloudflare Workers account
- Workers AI access
- Realtime SFU access (beta)
- Domain with Cloudflare DNS

### Setup Steps
1. **Configure Workers AI**: Enable AI models in dashboard
2. **Setup Realtime SFU**: Request beta access
3. **Deploy Workers**: Upload voice AI worker code
4. **Configure Environment**: Set API keys and bindings
5. **Test Integration**: Verify WebRTC and AI pipeline

### Environment Variables
```bash
DEEPGRAM_API_KEY=your_deepgram_key
OPENAI_API_KEY=your_openai_key  # Optional
ANTHROPIC_API_KEY=your_anthropic_key  # Optional
```

### Bindings
```toml
# wrangler.toml
[[durable_objects.bindings]]
name = "VOICE_AI_DO"
class_name = "VoiceAIWebSocket"

[ai]
binding = "AI"
```

## Error Handling & Fallbacks

### Common Error Scenarios
```typescript
interface ErrorHandler {
  handleAudioError(error: Error): void;
  handleNetworkError(error: Error): void;
  handleAIError(error: Error): void;
  handleLatencyTimeout(): void;
}

class RobustVoiceAI implements ErrorHandler {
  handleAudioError(error: Error): void {
    // Fallback to basic audio processing
    console.error('Audio processing failed:', error);
    this.initializeFallbackAudio();
  }
  
  handleNetworkError(error: Error): void {
    // Implement reconnection logic
    this.reconnectWithBackoff();
  }
  
  handleAIError(error: Error): void {
    // Switch to backup AI provider
    this.switchToBackupProvider();
  }
  
  handleLatencyTimeout(): void {
    // Optimize for reduced latency
    this.reduceAudioQuality();
  }
}
```

## Testing & Debugging

### Performance Monitoring
```typescript
interface VoiceMetrics {
  latency: number;
  audioQuality: number;
  connectionStability: number;
  aiResponseTime: number;
}

class VoiceAIMetrics {
  trackLatency(startTime: number): void {
    const latency = Date.now() - startTime;
    console.log(`Voice AI latency: ${latency}ms`);
  }
  
  trackAudioQuality(audioData: Float32Array): number {
    // Implement audio quality measurement
    return this.calculateAudioQuality(audioData);
  }
}
```

### Debug Configuration
```typescript
const DEBUG_CONFIG = {
  enableAudioVisualization: true,
  logAudioMetrics: true,
  showLatencyStats: true,
  enableNetworkDiagnostics: true
};
```

This comprehensive reference provides all the technical details needed to implement Cloudflare's Realtime Voice AI platform, from basic setup through advanced optimization and error handling.