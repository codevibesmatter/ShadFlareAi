/**
 * Test endpoint for debugging Nova-3 API formats with prerecorded WAV file
 */

import { Hono } from 'hono'
import type { Env } from './index'

export const testNova3Router = new Hono<{ Bindings: Env }>()

testNova3Router.post('/test-nova-3', async (c) => {
  try {
    console.log('🧪 Starting Nova-3 API format test via POST...')
    
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    const body = await c.req.json()
    const testAudioBase64 = body.audio_base64
    
    return performNova3Tests(c, testAudioBase64)
  } catch (error) {
    console.error('❌ Test error:', error)
    return c.json({ error: 'Test failed', details: error.message }, 500)
  }
})

testNova3Router.get('/test-nova-3', async (c) => {
  try {
    console.log('🧪 Starting Nova-3 API format test via GET...')
    
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    // For Workers environment, we'll accept audio data via URL parameter or use a test buffer
    const testAudioBase64 = c.req.query('audio')
    
    return performNova3Tests(c, testAudioBase64)
  } catch (error) {
    console.error('❌ Test error:', error)
    return c.json({ error: 'Test failed', details: error.message }, 500)
  }
})

async function performNova3Tests(c: any, testAudioBase64?: string) {
  try {
    let audioBuffer: ArrayBuffer
    
    if (testAudioBase64) {
      // Decode base64 audio data from query parameter
      console.log(`📂 Using base64 audio from query parameter`)
      const binaryString = atob(testAudioBase64)
      audioBuffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        ;(audioBuffer as Uint8Array)[i] = binaryString.charCodeAt(i)
      }
      console.log(`📊 Decoded audio: ${audioBuffer.byteLength} bytes`)
    } else {
      // Create a minimal WAV file for testing (1 second of silence at 16kHz, 16-bit)
      console.log(`📂 Using generated test WAV file`)
      const sampleRate = 16000
      const samples = sampleRate * 1 // 1 second
      const byteRate = sampleRate * 2 // 16-bit = 2 bytes per sample
      
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
      view.setUint32(28, byteRate, true)
      view.setUint16(32, 2, true)  // Block align
      view.setUint16(34, 16, true) // Bits per sample
      writeString(36, 'data')
      view.setUint32(40, samples * 2, true)
      
      // Fill with silence (zeros)
      for (let i = 44; i < buffer.byteLength; i += 2) {
        view.setInt16(i, 0, true)
      }
      
      audioBuffer = buffer
      console.log(`📊 Generated test WAV: ${audioBuffer.byteLength} bytes`)
    }

    const aiModel = '@cf/deepgram/nova-3'
    const results = []
    
    // Check if this is Opus data
    const isOpus = testAudioBase64 && audioBuffer.length > 4 && 
      audioBuffer[0] === 0x4F && audioBuffer[1] === 0x67 && 
      audioBuffer[2] === 0x67 && audioBuffer[3] === 0x53
    
    console.log(`🎵 Audio format detected: ${isOpus ? 'Ogg Opus' : 'WAV/PCM'}`)

    // Test Format 1: Direct buffer (Whisper-style)
    console.log('🔄 Testing Format 1: Direct buffer...')
    try {
      const startTime = Date.now()
      const response1 = await c.env.AI.run(aiModel, audioBuffer)
      const duration = Date.now() - startTime
      console.log('✅ Format 1 SUCCESS:', response1)
      results.push({
        format: 'direct_buffer',
        success: true,
        response: response1,
        duration,
        code: `AI.run('${aiModel}', audioBuffer)`
      })
    } catch (error) {
      console.log('❌ Format 1 FAILED:', error.message)
      results.push({
        format: 'direct_buffer',
        success: false,
        error: error.message,
        code: `AI.run('${aiModel}', audioBuffer)`
      })
    }

    // Test Format 2: Input parameter
    console.log('🔄 Testing Format 2: Input parameter...')
    try {
      const startTime = Date.now()
      const response2 = await c.env.AI.run(aiModel, {
        input: {
          body: audioBuffer,
          contentType: 'audio/wav'
        }
      })
      const duration = Date.now() - startTime
      console.log('✅ Format 2 SUCCESS:', response2)
      results.push({
        format: 'input_parameter',
        success: true,
        response: response2,
        duration,
        code: `AI.run('${aiModel}', { input: { body: audioBuffer, contentType: 'audio/wav' } })`
      })
    } catch (error) {
      console.log('❌ Format 2 FAILED:', error.message)
      results.push({
        format: 'input_parameter',
        success: false,
        error: error.message,
        code: `AI.run('${aiModel}', { input: { body: audioBuffer, contentType: 'audio/wav' } })`
      })
    }

    // Test Format 3: Direct object with body/contentType
    console.log('🔄 Testing Format 3: Direct object...')
    try {
      const startTime = Date.now()
      const response3 = await c.env.AI.run(aiModel, {
        body: audioBuffer,
        contentType: 'audio/wav'
      })
      const duration = Date.now() - startTime
      console.log('✅ Format 3 SUCCESS:', response3)
      results.push({
        format: 'direct_object',
        success: true,
        response: response3,
        duration,
        code: `AI.run('${aiModel}', { body: audioBuffer, contentType: 'audio/wav' })`
      })
    } catch (error) {
      console.log('❌ Format 3 FAILED:', error.message)
      results.push({
        format: 'direct_object',
        success: false,
        error: error.message,
        code: `AI.run('${aiModel}', { body: audioBuffer, contentType: 'audio/wav' })`
      })
    }

    // Based on official docs, Nova-3 expects: { audio: { body: stream.body, contentType: "audio/mpeg" } }
    // The body should be a ReadableStream, not ArrayBuffer
    
    // Dynamic test cases based on audio format
    const testCases = []
    
    if (isOpus) {
      testCases.push(
        { 
          body: new Response(audioBuffer).body, 
          contentType: 'audio/ogg; codecs=opus', 
          desc: 'ReadableStream + audio/ogg; codecs=opus',
          encoding: 'opus'
        },
        { 
          body: new Response(audioBuffer).body, 
          contentType: 'audio/webm; codecs=opus', 
          desc: 'ReadableStream + audio/webm; codecs=opus',
          encoding: 'opus'
        }
      )
    } else {
      testCases.push(
        { 
          body: new Response(audioBuffer).body, 
          contentType: 'audio/wav', 
          desc: 'ReadableStream + audio/wav',
          encoding: 'linear16'
        }
      )
    }
    
    testCases.push(
      { 
        body: new Response(audioBuffer).body, 
        contentType: 'audio/mpeg', 
        desc: 'ReadableStream + audio/mpeg' 
      },
      // Test original ArrayBuffer formats (should fail based on docs)
      { body: audioBuffer, contentType: 'audio/wav', desc: 'ArrayBuffer + audio/wav' },
      { body: new Uint8Array(audioBuffer), contentType: 'audio/wav', desc: 'Uint8Array + audio/wav' }
    ]

    let testIndex = 0
    for (const testCase of testCases) {
      testIndex++
      console.log(`🔄 Testing Format 4.${testIndex}: ${testCase.desc}...`)
      try {
        const startTime = Date.now()
        const response = await c.env.AI.run(aiModel, {
          audio: {
            body: testCase.body,
            contentType: testCase.contentType
          }
        })
        const duration = Date.now() - startTime
        console.log(`✅ Format 4.${testIndex} SUCCESS:`, response)
        results.push({
          format: `nested_audio_${testIndex}`,
          success: true,
          response: response,
          duration,
          description: testCase.desc,
          code: `AI.run('${aiModel}', { audio: { body: ${testCase.desc.split(' + ')[0]}, contentType: '${testCase.contentType}' } })`
        })
        break // Stop on first success
      } catch (error) {
        console.log(`❌ Format 4.${testIndex} FAILED:`, error.message)
        results.push({
          format: `nested_audio_${testIndex}`,
          success: false,
          error: error.message,
          description: testCase.desc,
          code: `AI.run('${aiModel}', { audio: { body: ${testCase.desc.split(' + ')[0]}, contentType: '${testCase.contentType}' } })`
        })
      }
    }

    console.log('🧪 Nova-3 API format test completed!')
    
    // Return comprehensive results
    return c.json({
      message: 'Nova-3 API format test completed',
      audioSource: testAudioBase64 ? 'base64_parameter' : 'generated_wav',
      audioSize: audioBuffer.byteLength,
      model: aiModel,
      results,
      summary: {
        totalTests: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => r.success === false).length,
        workingFormats: results.filter(r => r.success).map(r => r.format)
      }
    })
  } catch (error) {
    console.error('❌ Nova-3 test error:', error)
    return c.json({ 
      error: 'Test failed', 
      message: error.message,
      stack: error.stack 
    }, 500)
  }
}