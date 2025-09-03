/**
 * Voice AI Audio Processor Worklet
 * Handles real-time audio processing for Cloudflare Voice AI integration
 */

class VoiceAIProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    
    // Audio buffer configuration
    this.bufferSize = 4096; // ~85ms at 48kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // Audio analysis
    this.volumeThreshold = 0.01;
    this.silenceCount = 0;
    this.maxSilenceFrames = 20; // ~1.7s of silence
    
    // Processing state
    this.isProcessing = true;
    this.sampleRate = 48000;
    
    // Voice Activity Detection
    this.vadBuffer = new Float32Array(512);
    this.vadIndex = 0;
    this.vadThreshold = 0.005;
    
    // Setup message handling
    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    
    console.log('🎵 VoiceAI AudioWorklet initialized');
  }

  handleMessage(data) {
    switch (data.type) {
      case 'configure':
        this.sampleRate = data.sampleRate || 48000;
        this.bufferSize = data.bufferSize || 4096;
        this.volumeThreshold = data.volumeThreshold || 0.01;
        break;
        
      case 'start':
        this.isProcessing = true;
        break;
        
      case 'stop':
        this.isProcessing = false;
        break;
        
      case 'reset':
        this.bufferIndex = 0;
        this.silenceCount = 0;
        this.vadIndex = 0;
        break;
    }
  }

  process(inputs, outputs, parameters) {
    if (!this.isProcessing) {
      return true;
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0]; // Mono audio
    if (!channelData || channelData.length === 0) {
      return true;
    }

    // Process audio samples
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      
      // Add to main buffer
      this.buffer[this.bufferIndex] = sample;
      this.bufferIndex++;
      
      // Add to VAD buffer
      this.vadBuffer[this.vadIndex] = Math.abs(sample);
      this.vadIndex = (this.vadIndex + 1) % this.vadBuffer.length;
      
      // Send buffer when full
      if (this.bufferIndex >= this.bufferSize) {
        this.processBuffer();
        this.bufferIndex = 0;
      }
    }

    return true;
  }

  processBuffer() {
    // Calculate audio metrics
    const metrics = this.calculateAudioMetrics(this.buffer);
    
    // Voice Activity Detection
    const isVoiceActive = this.detectVoiceActivity();
    
    // Only send audio if voice is detected or we're in a conversation
    if (isVoiceActive || metrics.volume > this.volumeThreshold) {
      this.silenceCount = 0;
      
      // Send audio data to main thread
      this.port.postMessage({
        type: 'audio_data',
        audioData: this.buffer.slice(), // Copy buffer
        metrics: {
          volume: metrics.volume,
          rms: metrics.rms,
          peak: metrics.peak,
          voiceActive: isVoiceActive,
          timestamp: currentTime
        }
      });
    } else {
      this.silenceCount++;
      
      // Send silence notification after threshold
      if (this.silenceCount === this.maxSilenceFrames) {
        this.port.postMessage({
          type: 'silence_detected',
          duration: (this.maxSilenceFrames * this.bufferSize) / this.sampleRate
        });
      }
    }
  }

  calculateAudioMetrics(buffer) {
    let sum = 0;
    let peak = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const abs = Math.abs(buffer[i]);
      sum += abs * abs;
      peak = Math.max(peak, abs);
    }
    
    const rms = Math.sqrt(sum / buffer.length);
    const volume = Math.min(1.0, rms * 10); // Normalize volume
    
    return { volume, rms, peak };
  }

  detectVoiceActivity() {
    // Simple VAD using RMS energy over short window
    let energy = 0;
    for (let i = 0; i < this.vadBuffer.length; i++) {
      energy += this.vadBuffer[i] * this.vadBuffer[i];
    }
    
    const rmsEnergy = Math.sqrt(energy / this.vadBuffer.length);
    return rmsEnergy > this.vadThreshold;
  }

  // Handle worklet lifecycle
  static get parameterDescriptors() {
    return [
      {
        name: 'volume',
        defaultValue: 0,
        minValue: 0,
        maxValue: 1
      },
      {
        name: 'threshold',
        defaultValue: 0.01,
        minValue: 0,
        maxValue: 0.1
      }
    ];
  }
}

// Register the processor
registerProcessor('voice-ai-processor', VoiceAIProcessor);

console.log('🎵 VoiceAI AudioWorklet registered successfully');