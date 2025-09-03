import { Hono } from 'hono'
import type { Env } from './index'

export const testSimpleNova3Router = new Hono<{ Bindings: Env }>()

testSimpleNova3Router.post('/test-simple-nova3', async (c) => {
  try {
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    console.log('🧪 Starting simple Nova-3 test with generated WAV...')
    
    // Create a minimal WAV file for testing (1 second of silence at 16kHz, 16-bit)
    const sampleRate = 16000
    const samples = sampleRate * 1 // 1 second
    
    // WAV header (44 bytes) + audio data
    const buffer = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, buffer.byteLength - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM format chunk size
    view.setUint16(20, 1, true)  // PCM format
    view.setUint16(22, 1, true)  // Mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true)  // Block align
    view.setUint16(34, 16, true) // Bits per sample
    writeString(36, 'data')
    view.setUint32(40, samples * 2, true)
    
    // Fill with silence (zeros)
    for (let i = 44; i < buffer.byteLength; i += 2) {
      view.setInt16(i, 0, true)
    }
    
    console.log(`📊 Generated WAV: ${buffer.byteLength} bytes`)
    
    // Use the EXACT format that worked in previous tests: new Response(audioBuffer).body
    const audioStream = new Response(buffer).body
    
    console.log('🔄 Testing Nova-3 with ReadableStream + audio/mpeg format...')
    const response = await c.env.AI.run('@cf/deepgram/nova-3', {
      audio: {
        body: audioStream,
        contentType: 'audio/mpeg'
      }
    })
    
    console.log('✅ Nova-3 response:', response)
    
    return c.json({
      success: true,
      audioSize: buffer.byteLength,
      response: response
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return c.json({ 
      success: false,
      error: error.message 
    }, 500)
  }
})

testSimpleNova3Router.post('/test-gemini-flash', async (c) => {
  try {
    console.log('🧪 Starting Gemini Flash Lite test with generated WAV...')
    
    if (!c.env.GOOGLE_API_KEY || !c.env.AI_GATEWAY_URL) {
      return c.json({ 
        error: 'Missing GOOGLE_API_KEY or AI_GATEWAY_URL environment variables',
        hasGoogleKey: !!c.env.GOOGLE_API_KEY,
        hasGatewayUrl: !!c.env.AI_GATEWAY_URL
      }, 500)
    }

    // Create a minimal WAV file for testing (1 second of silence at 16kHz, 16-bit)
    const sampleRate = 16000
    const samples = sampleRate * 1 // 1 second
    
    // WAV header (44 bytes) + audio data
    const buffer = new ArrayBuffer(44 + samples * 2)
    const view = new DataView(buffer)
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, buffer.byteLength - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM format chunk size
    view.setUint16(20, 1, true)  // PCM format
    view.setUint16(22, 1, true)  // Mono
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true) // byte rate
    view.setUint16(32, 2, true)  // Block align
    view.setUint16(34, 16, true) // Bits per sample
    writeString(36, 'data')
    view.setUint32(40, samples * 2, true)
    
    // Fill with silence (zeros)
    for (let i = 44; i < buffer.byteLength; i += 2) {
      view.setInt16(i, 0, true)
    }
    
    console.log(`📊 Generated WAV: ${buffer.byteLength} bytes`)
    
    // Use Gemini Flash Lite model
    const geminiModel = 'gemini-2.5-flash-lite'
    console.log(`🤖 Using Gemini model: ${geminiModel}`)
    
    // Create the AI Gateway URL for Google AI Studio
    const gatewayUrl = `${c.env.AI_GATEWAY_URL}/google-ai-studio/v1/models/${geminiModel}:generateContent`
    console.log(`🌐 Gateway URL: ${gatewayUrl}`)
    
    // Convert buffer to base64
    const audioBuffer = Buffer.from(buffer)
    const base64Audio = audioBuffer.toString('base64')
    
    // Prepare the request body for Gemini
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "Generate a transcript of the speech in this audio file. Only return the transcript text, no additional formatting or explanations."
            },
            {
              inline_data: {
                mime_type: 'audio/wav',
                data: base64Audio
              }
            }
          ]
        }
      ]
    }

    console.log(`🔄 Testing Gemini Flash Lite via AI Gateway...`)
    const response = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': c.env.GOOGLE_API_KEY
      },
      body: JSON.stringify(requestBody)
    })

    console.log(`📊 Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Gemini API error: ${response.status} ${response.statusText}`)
      console.error('❌ Error details:', errorText)
      return c.json({ 
        success: false,
        error: `Gemini API error: ${response.status} ${response.statusText}`,
        details: errorText,
        gatewayUrl: gatewayUrl
      }, response.status)
    }

    const geminiResponse = await response.json() as any
    console.log('✅ Gemini response received')
    console.log('📝 Raw Gemini Response:', JSON.stringify(geminiResponse, null, 2))

    // Extract transcription from Gemini response
    let transcription = null
    if (geminiResponse?.candidates?.[0]?.content?.parts?.[0]?.text) {
      transcription = geminiResponse.candidates[0].content.parts[0].text.trim()
      console.log(`✅ Gemini STT Success: "${transcription}"`)
    }
    
    return c.json({
      success: true,
      audioSize: buffer.byteLength,
      model: geminiModel,
      transcription: transcription,
      rawResponse: geminiResponse,
      gatewayUrl: gatewayUrl
    })
    
  } catch (error) {
    console.error('❌ Gemini test failed:', error)
    return c.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, 500)
  }
})