# Logging Strategy

This app implements a contextual logging system with focus modes and quiet mode support to reduce console noise, especially from WebSocket messages and AI operations.

## Quick Start

### Logging Modes (Quiet Mode is Default)

```bash
# Default: Quiet mode (only errors) - ideal for reducing WebSocket noise
npm run dev

# Verbose mode - show all logs for debugging
npm run log:verbose

# Complete silence - no logs at all
npm run log:none
```

### Focus on Specific Areas

```bash
# Focus only on WebSocket operations
npm run log:websocket

# Focus only on AI operations (great for AI development)
npm run log:ai

# Focus only on Voice AI features
npm run log:voice

# Focus only on Authentication
npm run log:auth

# Focus only on UI components
npm run log:ui
```

## Runtime Control (Browser Console)

Open browser console and use these commands:

```javascript
// Set quiet mode (only errors)
logControl.quiet()

// Focus on specific contexts
logControl.focus('websocket')
logControl.focus('ai')

// Multiple contexts
logControl.only('websocket', 'ai', 'voice')

// Complete silence
logControl.none()

// Show all logs
logControl.all()

// Check current status
logControl.status()
```

## Environment Configuration

Add to your `.env.local` file:

```bash
# Quiet mode - only errors
VITE_LOG_FOCUS_MODE=quiet

# Focus on specific contexts
VITE_LOG_FOCUS_MODE=websocket,ai

# Set log level (debug, info, warn, error)
VITE_LOG_LEVEL=info

# Filter heartbeat messages (reduces WebSocket noise)
VITE_LOG_FILTER_HEARTBEATS=true

# Pattern-based filtering (glob patterns supported)
VITE_LOG_PATTERNS=src/server/ai-chat-websocket.ts,src/lib/voice-*
VITE_LOG_DISABLED_PATTERNS=tests/*,archive/*
```

## Log Contexts

The system uses contextual logging with these categories:

- **websocket** 🔌 - WebSocket connections, messages, state
- **auth** 🔐 - Authentication flows, sessions  
- **ai** 🤖 - AI operations, streaming, responses
- **ui** 🎨 - UI components, interactions, rendering
- **data** 💾 - Database operations, API calls
- **voice** 🎤 - Voice AI, transcription, audio processing
- **artifacts** 📦 - Artifact creation, persistence
- **performance** ⚡ - Performance monitoring
- **system** ⚙️ - System operations, workers
- **debug** 🐛 - General debugging

## Usage in Code

```typescript
import { webSocketLog, aiLog, authLog } from '@/lib/logger'

// Create contextual loggers
const wsLog = webSocketLog('src/components/WebSocketComponent.tsx')
const aiLogger = aiLog('src/components/AIChatComponent.tsx')
const authLogger = authLog('src/components/AuthComponent.tsx')

// Use throughout your component
wsLog.info('WebSocket connected', { sessionId })
wsLog.messageReceived('chat_message', 150) // Filters heartbeats automatically
wsLog.connectionState('connected', { url })

aiLogger.info('Starting AI stream', { model: 'llama-3-8b' })
aiLogger.debug('AI chunk received', { content: preview })

authLogger.info('User signed in', { userId, method: 'email' })
```

## WebSocket Noise Reduction

The WebSocket logger automatically filters heartbeat messages:

```typescript
const wsLog = webSocketLog('MyComponent.tsx')

// These are automatically filtered when VITE_LOG_FILTER_HEARTBEATS=true
wsLog.messageReceived('srv_heartbeat', 50)  // Hidden
wsLog.messageReceived('clt_heartbeat', 25)  // Hidden
wsLog.messageReceived('chat_message', 200)  // Shown
```

## Development Workflows

### Clean WebSocket Development
```bash
# Quiet mode filters out all noise except errors
npm run log:quiet
```

### AI Feature Development
```bash
# Only show AI-related logs
npm run log:ai
```

### Full System Debugging
```bash
# Show everything (verbose mode)
npm run log:verbose
```

### Custom Focus (Runtime)
```javascript
// In browser console - focus on multiple areas
logControl.only('websocket', 'ai', 'voice')
```

## Log Output Format

Logs include context emojis and structured data:

```
🔌 ℹ️ [WEBSOCKET] Connection accepted {"sessionId":"abc-123"}
🤖 🔍 [AI] Starting AI stream {"model":"llama-3-8b","messageId":"msg-456"}
🔐 ❌ [AUTH] Authentication failed {"error":"Invalid token"}
```

## Migration from console.log

Replace existing console.log calls:

```typescript
// Before
console.log('WebSocket connected:', sessionId)
console.error('AI error:', error)

// After
const wsLog = webSocketLog(__filename)
const aiLogger = aiLog(__filename)

wsLog.info('WebSocket connected', { sessionId })
aiLogger.error('AI error', error)
```

## Benefits

✅ **Reduced console noise** - Focus on what matters  
✅ **Context isolation** - Filter by functionality area  
✅ **Runtime control** - Switch focus without restarting  
✅ **WebSocket filtering** - Automatic heartbeat noise reduction  
✅ **Structured logging** - Consistent format with metadata  
✅ **Zero configuration** - Works out of the box  
✅ **Environment flexibility** - npm scripts, env vars, and runtime control