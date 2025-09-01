import { DurableObject } from 'cloudflare:workers'
import { webSocketLog, aiLog } from '../lib/logger'

const wsLog = webSocketLog('src/server/ai-chat-websocket.ts')
const aiLogger = aiLog('src/server/ai-chat-websocket.ts')

interface ChatSession {
  id: string
  socket: WebSocket
  model: string
  messages: Array<{ role: 'user' | 'assistant', content: string }>
}

export class AIChatWebSocket extends DurableObject {
  private sessions = new Map<WebSocket, ChatSession>()
  private activeStreams = new Map<string, boolean>() // Track active streams to allow cancellation
  private env: any

  constructor(ctx: any, env: any) {
    super(ctx, env)
    
    // Store the environment for later access
    this.env = env
    
    // Initialize SQLite tables for message history and artifacts
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        message_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        language TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    
    // Restore hibernating WebSocket connections
    wsLog.info('Initializing Durable Object, restoring WebSocket sessions')
    wsLog.debug('Available environment bindings', Object.keys(env))
    wsLog.info('AI binding available', { available: !!env.AI })
    
    this.ctx.getWebSockets().forEach((ws: WebSocket) => {
      const attachment = ws.deserializeAttachment()
      if (attachment) {
        wsLog.info('Restoring session from hibernation', { sessionId: attachment.id })
        this.sessions.set(ws, {
          id: attachment.id,
          socket: ws,
          model: attachment.model,
          messages: [] // Messages loaded from SQLite on demand
        })
      }
    })
    wsLog.info('Restored WebSocket sessions', { count: this.sessions.size })
  }

  async fetch(request: Request): Promise<Response> {
    wsLog.debug('Durable Object fetch called for WebSocket upgrade')
    
    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade')
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 })
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    // Generate session ID
    const sessionId = crypto.randomUUID()

    // Get model and initial parameters from URL
    const url = new URL(request.url)
    const model = url.searchParams.get('model') || 'llama-3-8b'
    
    wsLog.info('Creating session', { sessionId, model })

    // Create session and store it with server socket as key for hibernation events
    const session: ChatSession = {
      id: sessionId,
      socket: server,
      model,
      messages: []
    }

    // Store session using WebSocket as key (proper hibernation pattern)
    this.sessions.set(server, session)

    // Store minimal session metadata for hibernation restoration
    server.serializeAttachment({
      id: sessionId,
      model
    })
    
    // Accept the WebSocket connection for hibernation - this MUST be called last
    this.ctx.acceptWebSocket(server)
    wsLog.connectionState('accepted', { sessionId })

    // Send immediate connection confirmation since hibernation events may not trigger in dev
    try {
      const connectionMessage = JSON.stringify({
        type: 'connection',
        sessionId: session.id,
        model: session.model,
        message: 'Connected to AI chat'
      })
      server.send(connectionMessage)
      wsLog.info('Sent immediate connection confirmation', { sessionId })
    } catch (error) {
      wsLog.error('Error sending immediate connection confirmation', error)
    }

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  // Note: webSocketOpen doesn't exist in hibernation API
  // Connection messages are sent immediately in fetch() method

  // WebSocket hibernation handler for messages
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    try {
      const data = typeof message === 'string' ? message : new TextDecoder().decode(message)
      const parsedMessage = JSON.parse(data)
      
      wsLog.messageReceived(parsedMessage.type, JSON.stringify(parsedMessage).length)
      
      // Get session directly from WebSocket key (proper hibernation pattern)
      const session = this.sessions.get(ws)
      
      if (!session) {
        wsLog.error('Session not found for WebSocket', { availableSessions: this.sessions.size })
        // Try to restore session from attachment
        const attachment = ws.deserializeAttachment()
        if (attachment) {
          wsLog.info('Restoring session from attachment', { sessionId: attachment.id })
          const restoredSession: ChatSession = {
            id: attachment.id,
            socket: ws,
            model: attachment.model,
            messages: attachment.messages || []
          }
          this.sessions.set(ws, restoredSession)
          wsLog.info('Session restored from attachment')
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Session not found and cannot be restored' }))
          return
        }
      }
      
      const currentSession = this.sessions.get(ws)!
      wsLog.debug('Found session', { sessionId: currentSession.id, messageType: parsedMessage.type })
      
      switch (parsedMessage.type) {
        case 'chat':
          await this.handleChatMessage(currentSession, parsedMessage)
          break
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
        case 'change_model':
          currentSession.model = parsedMessage.model
          // Update attachment with new model
          ws.serializeAttachment({
            id: currentSession.id,
            model: parsedMessage.model,
            messages: currentSession.messages
          })
          ws.send(JSON.stringify({ 
            type: 'model_changed', 
            model: parsedMessage.model 
          }))
          break
        
        case 'get_artifacts':
          const artifacts = this.loadArtifactsFromDB(currentSession.id, parsedMessage.messageId)
          ws.send(JSON.stringify({
            type: 'artifacts_loaded',
            artifacts,
            sessionId: currentSession.id
          }))
          break
          
        case 'update_artifact':
          this.updateArtifactInDB(parsedMessage.artifactId, parsedMessage.updates)
          ws.send(JSON.stringify({
            type: 'artifact_updated',
            artifactId: parsedMessage.artifactId
          }))
          break
          
        case 'delete_artifact':
          this.deleteArtifactFromDB(parsedMessage.artifactId)
          ws.send(JSON.stringify({
            type: 'artifact_deleted',
            artifactId: parsedMessage.artifactId
          }))
          break
          
        case 'stop_generation':
          // Handle stop generation signal
          wsLog.info('Stop generation requested', { sessionId: currentSession.id })
          
          // Stop all active streams for this session
          const streamKeys = Array.from(this.activeStreams.keys())
          for (const streamKey of streamKeys) {
            if (streamKey.startsWith(currentSession.id)) {
              wsLog.info('Stopping active stream', { streamKey })
              this.activeStreams.set(streamKey, false) // Mark as stopped
            }
          }
          
          // Send acknowledgment that generation has been stopped
          ws.send(JSON.stringify({
            type: 'generation_stopped',
            timestamp: Date.now()
          }))
          break
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }))
    }
  }

  // WebSocket hibernation handler for close events
  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean) {
    wsLog.connectionState('closed', { code, reason })
    // Remove the session for this WebSocket (using WebSocket as key)
    const session = this.sessions.get(ws)
    if (session) {
      wsLog.info('Removing session', { sessionId: session.id })
      this.sessions.delete(ws)
    }
  }

  // SQLite helper methods
  private loadMessagesFromDB(sessionId: string): Array<{role: string, content: string}> {
    const cursor = this.ctx.storage.sql.exec(
      'SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT 50',
      sessionId
    )
    return cursor.toArray()
  }

  private saveMessageToDB(sessionId: string, role: string, content: string) {
    this.ctx.storage.sql.exec(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
      sessionId,
      role,
      content
    )
  }

  // Artifact persistence methods
  private saveArtifactToDB(sessionId: string, messageId: string, artifact: any) {
    this.ctx.storage.sql.exec(`
      INSERT INTO artifacts (
        id, session_id, message_id, title, description, type, 
        content, language, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      artifact.id,
      sessionId,
      messageId,
      artifact.title,
      artifact.description || null,
      artifact.type,
      artifact.content,
      artifact.language || null,
      artifact.metadata ? JSON.stringify(artifact.metadata) : null,
      artifact.createdAt,
      artifact.updatedAt
    )
  }

  private loadArtifactsFromDB(sessionId: string, messageId?: string): any[] {
    let query = 'SELECT * FROM artifacts WHERE session_id = ?'
    let params: any[] = [sessionId]
    
    if (messageId) {
      query += ' AND message_id = ?'
      params.push(messageId)
    }
    
    query += ' ORDER BY created_at ASC'
    
    const cursor = this.ctx.storage.sql.exec(query, ...params)
    return cursor.toArray().map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      type: row.type,
      content: row.content,
      language: row.language,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }))
  }

  private updateArtifactInDB(artifactId: string, updates: any) {
    const setClause = []
    const params = []
    
    if (updates.title) {
      setClause.push('title = ?')
      params.push(updates.title)
    }
    if (updates.description) {
      setClause.push('description = ?')
      params.push(updates.description)
    }
    if (updates.content) {
      setClause.push('content = ?')
      params.push(updates.content)
    }
    if (updates.metadata) {
      setClause.push('metadata = ?')
      params.push(JSON.stringify(updates.metadata))
    }
    
    setClause.push('updated_at = ?')
    params.push(Date.now())
    params.push(artifactId)
    
    this.ctx.storage.sql.exec(
      `UPDATE artifacts SET ${setClause.join(', ')} WHERE id = ?`,
      ...params
    )
  }

  private deleteArtifactFromDB(artifactId: string) {
    this.ctx.storage.sql.exec('DELETE FROM artifacts WHERE id = ?', artifactId)
  }

  // Parse artifacts from content and save to database
  private async parseAndSaveArtifacts(sessionId: string, messageId: string, content: string) {
    try {
      // Use the same parsing logic from the frontend
      const artifacts = this.parseArtifactsFromContent(content, messageId)
      
      // Save each artifact to the database
      for (const artifact of artifacts) {
        this.saveArtifactToDB(sessionId, messageId, artifact)
        aiLogger.info('Saved artifact to DB', { title: artifact.title, type: artifact.type })
      }
      
      return artifacts
    } catch (error) {
      aiLogger.error('Error parsing/saving artifacts', error)
      return []
    }
  }

  // Simplified artifact parsing logic for server-side use
  private parseArtifactsFromContent(content: string, messageId: string): any[] {
    const artifacts: any[] = []
    const codeBlocks = this.extractCodeBlocks(content)
    
    codeBlocks.forEach((block, index) => {
      const artifact = this.createArtifactFromCodeBlock(block, index, messageId)
      if (artifact) {
        artifacts.push(artifact)
      }
    })

    return artifacts
  }

  private extractCodeBlocks(content: string) {
    const blocks: { language: string; content: string; fullMatch: string }[] = []
    const regex = /```(\w+)?\s*([\s\S]*?)```/g
    let match

    while ((match = regex.exec(content)) !== null) {
      const [fullMatch, language = '', codeContent] = match
      blocks.push({
        language: language.toLowerCase(),
        content: codeContent.trim(),
        fullMatch
      })
    }

    return blocks
  }

  private createArtifactFromCodeBlock(
    block: { language: string; content: string; fullMatch: string },
    index: number,
    messageId: string
  ): any | null {
    const { language, content } = block
    
    if (!content || content.length < 10) return null

    const languageTypeMap: Record<string, string> = {
      'javascript': 'javascript',
      'js': 'javascript', 
      'typescript': 'typescript',
      'ts': 'typescript',
      'tsx': 'react-component',
      'jsx': 'react-component',
      'react': 'react-component',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'svg': 'svg',
      'xml': 'svg',
      'markdown': 'markdown',
      'md': 'markdown',
    }

    const type = languageTypeMap[language] || 'code'
    const title = this.generateArtifactTitle(type, content, index)
    const description = this.generateArtifactDescription(type, content)

    return {
      id: `${messageId}-${index}-${Date.now()}`,
      title,
      description,
      type,
      content,
      language: language || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  private generateArtifactTitle(type: string, content: string, index: number): string {
    switch (type) {
      case 'react-component': {
        const componentMatch = content.match(/(?:function|const|class)\s+(\w+)/i)
        if (componentMatch) return `${componentMatch[1]} Component`
        return `React Component ${index + 1}`
      }
      case 'javascript':
      case 'typescript': {
        const functionMatch = content.match(/(?:function|const|let|var)\s+(\w+)/i)
        if (functionMatch) return `${functionMatch[1]} Function`
        return `${type.charAt(0).toUpperCase() + type.slice(1)} Code ${index + 1}`
      }
      case 'html': {
        const titleMatch = content.match(/<title>(.*?)<\/title>/i)
        if (titleMatch) return titleMatch[1]
        const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i)
        if (h1Match) return h1Match[1].replace(/<[^>]*>/g, '')
        return `HTML Document ${index + 1}`
      }
      case 'css': {
        const classMatch = content.match(/\.(\w+)\s*\{/)
        if (classMatch) return `${classMatch[1]} Styles`
        return `CSS Styles ${index + 1}`
      }
      default:
        return `Code Snippet ${index + 1}`
    }
  }

  private generateArtifactDescription(type: string, content: string): string {
    const lines = content.split('\n').length
    
    switch (type) {
      case 'react-component':
        return `React component with ${lines} lines of code`
      case 'html':
        return `HTML document with ${lines} lines`
      case 'css':
        return `CSS styles with ${lines} lines`
      case 'javascript':
      case 'typescript':
        return `${type} code with ${lines} lines`
      default:
        return `Code snippet with ${lines} lines`
    }
  }

  private async handleChatMessage(session: ChatSession, message: any) {
    try {
      // Load recent message history from SQLite
      session.messages = this.loadMessagesFromDB(session.id)
      
      // Add user message to history and save to SQLite
      const userMessage = { role: 'user' as const, content: message.content }
      session.messages.push(userMessage)
      this.saveMessageToDB(session.id, 'user', message.content)

      // Send acknowledgment
      session.socket.send(JSON.stringify({
        type: 'message_received',
        messageId: message.messageId
      }))

      // Check if function calling is enabled
      const enableFunctionCalling = message.enableFunctionCalling && 
        (session.model === 'hermes-2-pro' || session.model === 'gemini-2.5-flash-lite')

      if (enableFunctionCalling) {
        await this.handleFunctionCallingChat(session, message)
      } else {
        await this.handleStreamingChat(session, message)
      }

    } catch (error) {
      session.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process chat message',
        error: error instanceof Error ? error.message : String(error)
      }))
    }
  }

  private async handleStreamingChat(session: ChatSession, message: any) {
    try {
      // Create stream tracking key
      const streamKey = `${session.id}-${message.messageId}`
      this.activeStreams.set(streamKey, true) // Mark as active
      
      // Send stream start
      session.socket.send(JSON.stringify({
        type: 'stream_start',
        messageId: message.messageId
      }))

      // For Gemini streaming, we'll use the AI Gateway WebSocket API
      // For now, simulate streaming with the existing HTTP API
      if (session.model === 'gemini-2.5-flash-lite') {
        // Use Gemini API directly for streaming
        const response = await this.streamGeminiResponse(session, message, streamKey)
        return response
      } else {
        // Use Cloudflare Workers AI for streaming
        const response = await this.streamWorkersAIResponse(session, message, streamKey)
        return response
      }

    } catch (error) {
      session.socket.send(JSON.stringify({
        type: 'stream_error',
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error)
      }))
    } finally {
      // Clean up stream tracking
      const streamKey = `${session.id}-${message.messageId}`
      this.activeStreams.delete(streamKey)
    }
  }

  private async handleFunctionCallingChat(session: ChatSession, message: any) {
    // Function calling implementation
    session.socket.send(JSON.stringify({
      type: 'function_calling_start',
      messageId: message.messageId
    }))

    try {
      // Use existing function calling logic but send results via WebSocket
      const result = await this.processFunctionCalling(session, message)
      
      session.socket.send(JSON.stringify({
        type: 'function_calling_complete',
        messageId: message.messageId,
        content: result
      }))

      // Save assistant message to SQLite
      if (result.trim().length > 0) {
        this.saveMessageToDB(session.id, 'assistant', result)
        session.messages.push({ role: 'assistant', content: result })
        
        // Parse and save artifacts if any are created
        await this.parseAndSaveArtifacts(session.id, message.messageId, result)
      }
      
      // Update WebSocket attachment with minimal session info
      session.socket.serializeAttachment({
        id: session.id,
        model: session.model
      })

    } catch (error) {
      session.socket.send(JSON.stringify({
        type: 'function_calling_error',
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error)
      }))
    }
  }

  private async streamGeminiResponse(session: ChatSession, message: any, streamKey: string) {
    try {
      aiLogger.info('Starting Gemini streaming', { messageId: message.messageId })

      // Get environment from Durable Object context - access via this.env
      const env = this.env as any
      
      if (!env.GOOGLE_API_KEY) {
        throw new Error('Google API key not configured')
      }

      // Use AI Gateway URL if configured, otherwise direct Google API
      const baseUrl = env.AI_GATEWAY_URL || 'https://generativelanguage.googleapis.com'
      const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${env.GOOGLE_API_KEY}`

      // Convert messages to Gemini format
      const geminiMessages = session.messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))

      aiLogger.debug('Making Gemini API request', { apiUrl })
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        aiLogger.error('Gemini API error', { error: errorText })
        throw new Error(`Gemini API error: ${errorText}`)
      }

      aiLogger.debug('Reading Gemini streaming response')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let fullContent = ''
      
      try {
        while (true) {
          // Check if stream has been cancelled
          if (!this.activeStreams.get(streamKey)) {
            aiLogger.info('Gemini stream cancelled, breaking out of loop', { streamKey })
            break
          }
          
          const { done, value } = await reader.read()
          if (done) break

          const text = new TextDecoder().decode(value)
          const lines = text.split('\n')

          for (const line of lines) {
            // Check cancellation before processing each line
            if (!this.activeStreams.get(streamKey)) {
              aiLogger.info('Gemini stream cancelled during line processing', { streamKey })
              break
            }
            
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6))
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text
                
                if (content) {
                  aiLogger.debug('Gemini chunk', { preview: content.substring(0, 50) + '...' })
                  fullContent += content
                  
                  session.socket.send(JSON.stringify({
                    type: 'stream_chunk',
                    messageId: message.messageId,
                    content: content,
                    done: false
                  }))
                }
              } catch (e) {
                aiLogger.warn('Failed to parse Gemini chunk', e)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // Send completion signal only if stream wasn't cancelled
      if (this.activeStreams.get(streamKey)) {
        session.socket.send(JSON.stringify({
          type: 'stream_chunk',
          messageId: message.messageId,
          content: '',
          done: true
        }))
      } else {
        aiLogger.info('Gemini stream was cancelled, not sending completion signal', { streamKey })
      }

      // Save assistant message to SQLite
      if (fullContent.trim().length > 0) {
        this.saveMessageToDB(session.id, 'assistant', fullContent)
        session.messages.push({ role: 'assistant', content: fullContent })
        
        // Parse and save artifacts if any are created
        await this.parseAndSaveArtifacts(session.id, message.messageId, fullContent)
      }
      
      // Update WebSocket attachment with minimal session info
      session.socket.serializeAttachment({
        id: session.id,
        model: session.model
      })
      
      aiLogger.info('Gemini streaming completed')

    } catch (error) {
      aiLogger.error('Gemini streaming error', error)
      session.socket.send(JSON.stringify({
        type: 'stream_error',
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error)
      }))
    }
  }

  private async streamWorkersAIResponse(session: ChatSession, message: any, streamKey: string) {
    try {
      aiLogger.info('Starting Workers AI streaming', { messageId: message.messageId })

      // Get environment from Durable Object context - access via this.env
      const env = this.env as any
      
      if (!env.AI) {
        throw new Error('AI binding not available')
      }

      // Map model names to Cloudflare AI model IDs
      const modelMap = {
        'llama-3-8b': '@cf/meta/llama-3-8b-instruct',
        'mistral-7b': '@cf/mistral/mistral-7b-instruct-v0.1',
        'qwen-1.5': '@cf/qwen/qwen1.5-14b-chat-awq',
        'codellama': '@cf/meta/code-llama-7b-instruct-awq',
        'hermes-2-pro': '@hf/nousresearch/hermes-2-pro-mistral-7b',
      }

      const modelId = modelMap[session.model as keyof typeof modelMap] || modelMap['llama-3-8b']
      aiLogger.info('Using Workers AI model', { model: modelId })

      // Convert message history to Workers AI format
      const messages = session.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      aiLogger.debug('Making Workers AI request')
      
      // Call Workers AI with streaming
      const response = await env.AI.run(modelId, {
        messages: messages,
        max_tokens: 4000, // Much larger for complete responses
        temperature: 0.7,
        stream: true
      })

      aiLogger.debug('Processing Workers AI streaming response')

      if (response && typeof response[Symbol.asyncIterator] === 'function') {
        // Handle async iterator streaming response
        let fullContent = ''
        let buffer = ''
        let contentBuffer = ''
        const CHUNK_SIZE = 100 // Optimal chunk size for better streaming UX (50-100 chars)
        let lastSentTime = Date.now()
        const MIN_DELAY = 150 // Minimum delay between chunks (ms)
        
        const sendChunk = (content: string, isDone: boolean = false) => {
          // Check if stream has been cancelled
          if (!this.activeStreams.get(streamKey)) {
            aiLogger.info('Stream cancelled, stopping chunk sending', { streamKey })
            return false // Signal to stop processing
          }
          
          if (content.length > 0 || isDone) {
            session.socket.send(JSON.stringify({
              type: 'stream_chunk',
              messageId: message.messageId,
              content: content,
              done: isDone
            }))
          }
          return true // Continue processing
        }
        
        for await (const chunk of response) {
          // Check if stream has been cancelled before processing each chunk
          if (!this.activeStreams.get(streamKey)) {
            aiLogger.info('Stream cancelled, breaking out of loop', { streamKey })
            break
          }
          
          // Handle Uint8Array chunks (decode to string)
          if (chunk instanceof Uint8Array) {
            const chunkText = new TextDecoder().decode(chunk)
            buffer += chunkText
            
            // Process complete lines from buffer
            const lines = buffer.split('\n')
            // Keep the last incomplete line in buffer
            buffer = lines.pop() || ''
            
            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.trim().substring(6))
                  const content = jsonData.response
                  
                  if (content && typeof content === 'string' && content.length > 0) {
                    fullContent += content
                    contentBuffer += content
                    
                    // Send chunk when buffer reaches optimal size or after minimum delay
                    const now = Date.now()
                    if (contentBuffer.length >= CHUNK_SIZE || (now - lastSentTime) >= MIN_DELAY) {
                      if (!sendChunk(contentBuffer)) {
                        // Stream was cancelled
                        return
                      }
                      contentBuffer = ''
                      lastSentTime = now
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete lines
                  if (line.trim() !== 'data: [DONE]') {
                    aiLogger.warn('Failed to parse line', { preview: line.substring(0, 100) })
                  }
                }
              }
            }
          } else if (chunk && typeof chunk === 'object') {
            const content = chunk.response || chunk.content || (chunk.choices?.[0]?.delta?.content)
            
            if (content && typeof content === 'string') {
              fullContent += content
              contentBuffer += content
              
              // Send chunk when buffer reaches optimal size
              const now = Date.now()
              if (contentBuffer.length >= CHUNK_SIZE || (now - lastSentTime) >= MIN_DELAY) {
                if (!sendChunk(contentBuffer)) {
                  // Stream was cancelled
                  return
                }
                contentBuffer = ''
                lastSentTime = now
              }
            }
          }
        }
        
        // Send any remaining content in buffer if stream wasn't cancelled
        if (contentBuffer.length > 0 && this.activeStreams.get(streamKey)) {
          sendChunk(contentBuffer)
        }

        // Send completion signal with proper timing only if stream wasn't cancelled
        if (this.activeStreams.get(streamKey)) {
          setTimeout(() => {
            session.socket.send(JSON.stringify({
              type: 'stream_chunk',
              messageId: message.messageId,
              content: '',
              done: true
            }))
          }, 50) // Small delay to ensure all chunks are processed
        } else {
          // Stream was cancelled, send stop confirmation
          aiLogger.info('Stream was cancelled, sending final stop signal', { streamKey })
        }

        // Save assistant message to SQLite
        if (fullContent.trim().length > 0) {
          this.saveMessageToDB(session.id, 'assistant', fullContent)
          session.messages.push({ role: 'assistant', content: fullContent })
          
          // Parse and save artifacts if any are created
          await this.parseAndSaveArtifacts(session.id, message.messageId, fullContent)
        }
        
        // Update WebSocket attachment with minimal session info (no messages)
        session.socket.serializeAttachment({
          id: session.id,
          model: session.model
        })
        
        aiLogger.info('Workers AI streaming completed')

      } else if (response && typeof response === 'object' && response.response) {
        // Handle non-streaming response
        const content = response.response
        aiLogger.debug('Workers AI non-streaming response', { preview: content.substring(0, 50) + '...' })
        
        session.socket.send(JSON.stringify({
          type: 'stream_chunk',
          messageId: message.messageId,
          content: content,
          done: true
        }))

        // Save assistant message to SQLite
        if (content.trim().length > 0) {
          this.saveMessageToDB(session.id, 'assistant', content)
          session.messages.push({ role: 'assistant', content: content })
          
          // Parse and save artifacts if any are created
          await this.parseAndSaveArtifacts(session.id, message.messageId, content)
        }
        
        // Update WebSocket attachment with minimal session info
        session.socket.serializeAttachment({
          id: session.id,
          model: session.model
        })
        
        aiLogger.info('Workers AI response completed')

      } else {
        throw new Error('Unexpected response format from Workers AI')
      }

    } catch (error) {
      aiLogger.error('Workers AI streaming error', error)
      session.socket.send(JSON.stringify({
        type: 'stream_error',
        messageId: message.messageId,
        error: error instanceof Error ? error.message : String(error)
      }))
    }
  }

  private async processFunctionCalling(session: ChatSession, message: any): Promise<string> {
    try {
      aiLogger.info('Starting function calling', { messageId: message.messageId })

      // Get environment from Durable Object context - access via this.env
      const env = this.env as any
      
      if (session.model === 'gemini-2.5-flash-lite') {
        return await this.processGeminiFunctionCalling(session, message, env)
      } else {
        return await this.processWorkersFunctionCalling(session, message, env)
      }

    } catch (error) {
      aiLogger.error('Function calling error', error)
      throw error
    }
  }

  private async processGeminiFunctionCalling(session: ChatSession, message: any, env: any): Promise<string> {
    if (!env.GOOGLE_API_KEY) {
      throw new Error('Google API key not configured')
    }

    // Use AI Gateway URL if configured, otherwise direct Google API
    const baseUrl = env.AI_GATEWAY_URL || 'https://generativelanguage.googleapis.com'
    const apiUrl = `${baseUrl}/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${env.GOOGLE_API_KEY}`
    
    // Define tools in Gemini format
    const geminiTools = [{
      function_declarations: [
        {
          name: "calculate",
          description: "Performs basic mathematical calculations",
          parameters: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "The mathematical expression to evaluate"
              }
            },
            required: ["expression"]
          }
        },
        {
          name: "getCurrentTime",
          description: "Gets the current date and time",
          parameters: {
            type: "object",
            properties: {
              timezone: {
                type: "string",
                description: "Timezone (default: UTC)"
              }
            }
          }
        }
      ]
    }]
    
    // Convert messages to Gemini format
    const geminiMessages = session.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        tools: geminiTools,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gemini API error: ${errorText}`)
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    
    if (!candidate) {
      throw new Error('No response candidate from Gemini')
    }
    
    let finalResponse = ''
    
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          const functionResult = await this.executeFunctionCall(part.functionCall.name, part.functionCall.args || {})
          finalResponse += functionResult + '\n\n'
        } else if (part.text) {
          finalResponse += part.text
        }
      }
    }
    
    return finalResponse.trim() || 'Function executed successfully'
  }

  private async processWorkersFunctionCalling(session: ChatSession, message: any, env: any): Promise<string> {
    if (!env.AI) {
      throw new Error('AI binding not available')
    }

    const tools = [
      {
        name: "calculate",
        description: "Performs basic mathematical calculations",
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Mathematical expression to evaluate" }
          },
          required: ["expression"]
        }
      },
      {
        name: "getCurrentTime",
        description: "Gets the current date and time",
        parameters: {
          type: "object",
          properties: {
            timezone: { type: "string", description: "Timezone (default: UTC)" }
          }
        }
      }
    ]
    
    const response = await env.AI.run('@hf/nousresearch/hermes-2-pro-mistral-7b', {
      messages: session.messages,
      tools: tools,
      max_tokens: 500,
      temperature: 0.7
    })
    
    let finalResponse = response.response || ''
    
    if (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        const toolResult = await this.executeFunctionCall(toolCall.name, toolCall.arguments)
        finalResponse += '\n\n' + toolResult
      }
    }
    
    return finalResponse.trim() || 'Function executed successfully'
  }

  private async executeFunctionCall(functionName: string, args: any): Promise<string> {
    aiLogger.info('Executing function', { functionName, args })
    
    switch (functionName) {
      case 'calculate':
        try {
          const expression = args.expression
          if (!/^[\d\s+\-*/.()]+$/.test(expression)) {
            return 'Error: Invalid expression. Only numbers and basic operators are allowed.'
          }
          
          const result = Function('"use strict"; return (' + expression + ')')()
          if (typeof result !== 'number' || !isFinite(result)) {
            return 'Error: Invalid mathematical expression'
          }
          
          return `The result of ${expression} is ${result}`
        } catch (error) {
          return 'Error: Failed to evaluate expression'
        }
        
      case 'getCurrentTime':
        try {
          const timezone = args.timezone || 'UTC'
          const now = new Date()
          const timeString = now.toLocaleString('en-US', { 
            timeZone: timezone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          })
          return `Current time in ${timezone}: ${timeString}`
        } catch (error) {
          return 'Error: Failed to get current time'
        }
        
      default:
        return `Error: Unknown function ${functionName}`
    }
  }

  async webSocketError(ws: WebSocket, error: any) {
    wsLog.error('WebSocket error in Durable Object', error)
    
    // Remove the session for this WebSocket (using WebSocket as key)
    const session = this.sessions.get(ws)
    if (session) {
      wsLog.info('Removing session due to WebSocket error', { sessionId: session.id })
      this.sessions.delete(ws)
    }
    
    // Close the WebSocket with an appropriate error code
    try {
      ws.close(1011, 'WebSocket error occurred')
    } catch (closeError) {
      wsLog.error('Error closing WebSocket', closeError)
    }
  }
}