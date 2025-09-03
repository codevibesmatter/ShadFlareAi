/**
 * UserSysDO - User System Durable Object
 * 
 * Handles user-scoped real-time events including:
 * - Session invalidation/remote signouts
 * - Real-time notifications
 * - System announcements
 * - Multi-tab coordination
 */

export interface UserSystemEvent {
  type: 'session-invalidated' | 'notification' | 'system-announcement' | 'tab-sync'
  sessionId?: string
  userId: string
  data?: any
  timestamp: number
  reason?: string
}

export class UserSysDO {
  private connections = new Map<string, WebSocket>()
  private events: UserSystemEvent[] = []
  private state: DurableObjectState
  private env: any

  constructor(state: DurableObjectState, env: any) {
    this.state = state
    this.env = env
    this.loadEvents()
  }

  async loadEvents() {
    const stored = await this.state.storage.get<UserSystemEvent[]>('events')
    this.events = stored || []
    // Clean up events older than 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000
    this.events = this.events.filter(e => e.timestamp > dayAgo)
  }

  async saveEvents() {
    await this.state.storage.put('events', this.events)
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle WebSocket upgrade for real-time events
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request)
    }

    // Handle SSE connection
    if (path.endsWith('/events')) {
      return this.handleSSE(request)
    }

    // Handle event broadcasting
    if (path.endsWith('/broadcast') && request.method === 'POST') {
      return this.handleBroadcast(request)
    }

    // Handle getting recent events
    if (path.endsWith('/recent')) {
      return this.handleRecentEvents(request)
    }

    return new Response('Not found', { status: 404 })
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    const connectionId = crypto.randomUUID()
    this.connections.set(connectionId, server)

    server.accept()

    // Send recent events to new connection
    const recentEvents = this.events.slice(-10) // Last 10 events
    server.send(JSON.stringify({
      type: 'initial-events',
      events: recentEvents
    }))

    server.addEventListener('close', () => {
      this.connections.delete(connectionId)
    })

    server.addEventListener('error', () => {
      this.connections.delete(connectionId)
    })

    // Handle ping/pong for connection health
    server.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string)
        if (message.type === 'ping') {
          server.send(JSON.stringify({ type: 'pong' }))
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private async handleSSE(request: Request): Promise<Response> {
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      return new Response('Missing userId', { status: 400 })
    }

    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Send recent events immediately
    const recentEvents = this.events.filter(e => e.userId === userId).slice(-5)
    for (const event of recentEvents) {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    }

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(`event: heartbeat\ndata: ${Date.now()}\n\n`))
      } catch (error) {
        clearInterval(heartbeat)
      }
    }, 30000)

    // Store SSE connection for broadcasting
    const connectionId = crypto.randomUUID()
    this.connections.set(connectionId, {
      send: async (data: string) => {
        try {
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        } catch (error) {
          this.connections.delete(connectionId)
          clearInterval(heartbeat)
        }
      }
    } as any)

    // Clean up on close
    request.signal?.addEventListener('abort', () => {
      this.connections.delete(connectionId)
      clearInterval(heartbeat)
      writer.close()
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    })
  }

  private async handleBroadcast(request: Request): Promise<Response> {
    try {
      const event: UserSystemEvent = await request.json()
      
      // Add timestamp
      event.timestamp = Date.now()
      
      // Store event
      this.events.push(event)
      await this.saveEvents()

      // Broadcast to all active connections for this user
      const message = JSON.stringify(event)
      const disconnected: string[] = []

      for (const [connectionId, ws] of this.connections) {
        try {
          ws.send(message)
        } catch (error) {
          disconnected.push(connectionId)
        }
      }

      // Clean up disconnected connections
      disconnected.forEach(id => this.connections.delete(id))

      return Response.json({ 
        success: true, 
        broadcasted: this.connections.size,
        stored: this.events.length 
      })
    } catch (error) {
      return Response.json({ error: 'Failed to broadcast event' }, { status: 500 })
    }
  }

  private async handleRecentEvents(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    const since = parseInt(url.searchParams.get('since') || '0')

    if (!userId) {
      return new Response('Missing userId', { status: 400 })
    }

    const userEvents = this.events
      .filter(e => e.userId === userId && e.timestamp > since)
      .slice(-20) // Last 20 events

    return Response.json({ events: userEvents })
  }

  // Helper method for other parts of the system to broadcast events
  async broadcastEvent(event: UserSystemEvent) {
    return this.handleBroadcast(new Request('http://localhost/broadcast', {
      method: 'POST',
      body: JSON.stringify(event),
      headers: { 'Content-Type': 'application/json' }
    }))
  }

  // Specific helper for session invalidation
  async invalidateSession(userId: string, sessionId: string, reason: string = 'logout') {
    return this.broadcastEvent({
      type: 'session-invalidated',
      userId,
      sessionId,
      reason,
      timestamp: Date.now()
    })
  }

  // Helper for notifications
  async sendNotification(userId: string, notification: any) {
    return this.broadcastEvent({
      type: 'notification',
      userId,
      data: notification,
      timestamp: Date.now()
    })
  }
}