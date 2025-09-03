import { Hono } from 'hono'
import type { Env } from './index'

export const testOpusRouter = new Hono<{ Bindings: Env }>()

testOpusRouter.post('/test-opus', async (c) => {
  try {
    if (!c.env.AI) {
      return c.json({ error: 'AI binding not available' }, 500)
    }

    const body = await c.req.json()
    const audioBase64 = body.audio_base64
    
    if (!audioBase64) {
      return c.json({ error: 'audio_base64 required' }, 400)
    }

    // Convert base64 to ArrayBuffer
    const binaryString = atob(audioBase64)
    const audioBuffer = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      audioBuffer[i] = binaryString.charCodeAt(i)
    }
    
    console.log(`📊 Audio buffer size: ${audioBuffer.length} bytes`)
    
    // Create ReadableStream
    const audioStream = new ReadableStream({
      start(controller) {
        controller.enqueue(audioBuffer)
        controller.close()
      }
    })
    
    // Test with format that worked in previous tests: audio/mpeg with ReadableStream
    const response = await c.env.AI.run('@cf/deepgram/nova-3', {
      audio: {
        body: audioStream,
        contentType: 'audio/mpeg'
      }
    })
    
    console.log('✅ Nova-3 response:', response)
    
    return c.json({
      success: true,
      response: response,
      audioSize: audioBuffer.length
    })
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return c.json({ 
      success: false,
      error: error.message 
    }, 500)
  }
})