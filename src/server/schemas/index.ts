import { z } from '@hono/zod-openapi'

// Common response schemas
export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: 'Internal server error' }),
    message: z.string().openapi({ example: 'Something went wrong' }),
  })
  .openapi('Error')

export const SuccessSchema = z
  .object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: 'Operation completed successfully' }),
  })
  .openapi('Success')

// Task schemas
export const TaskSchema = z
  .object({
    id: z.string().openapi({ example: 'TASK-1234' }),
    userId: z.string().openapi({ example: 'user_123' }),
    title: z.string().openapi({ example: 'Complete project setup' }),
    description: z.string().nullable().openapi({ example: 'Set up the initial project structure' }),
    status: z.enum(['backlog', 'todo', 'in progress', 'done', 'canceled']).openapi({ example: 'todo' }),
    label: z.enum(['bug', 'feature', 'documentation']).nullable().openapi({ example: 'feature' }),
    priority: z.enum(['low', 'medium', 'high', 'critical']).openapi({ example: 'medium' }),
    assignee: z.string().nullable().openapi({ example: 'John Doe' }),
    dueDate: z.string().nullable().openapi({ example: '2025-01-15T10:30:00Z' }),
    createdAt: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
    updatedAt: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
  })
  .openapi('Task')

export const CreateTaskSchema = z
  .object({
    title: z.string().min(1).openapi({ example: 'Complete project setup' }),
    description: z.string().optional().openapi({ example: 'Set up the initial project structure' }),
    status: z.enum(['backlog', 'todo', 'in progress', 'done', 'canceled']).optional().openapi({ example: 'todo' }),
    label: z.enum(['bug', 'feature', 'documentation']).optional().openapi({ example: 'feature' }),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().openapi({ example: 'medium' }),
    assignee: z.string().optional().openapi({ example: 'John Doe' }),
    dueDate: z.string().optional().openapi({ example: '2025-01-15T10:30:00Z' }),
  })
  .openapi('CreateTask')

export const UpdateTaskSchema = z
  .object({
    title: z.string().min(1).optional().openapi({ example: 'Updated task title' }),
    description: z.string().optional().openapi({ example: 'Updated description' }),
    status: z.enum(['backlog', 'todo', 'in progress', 'done', 'canceled']).optional().openapi({ example: 'in progress' }),
    label: z.enum(['bug', 'feature', 'documentation']).optional().openapi({ example: 'bug' }),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().openapi({ example: 'high' }),
    assignee: z.string().optional().openapi({ example: 'Jane Smith' }),
    dueDate: z.string().optional().openapi({ example: '2025-01-20T10:30:00Z' }),
  })
  .openapi('UpdateTask')

// User schemas
export const UserSchema = z
  .object({
    id: z.string().openapi({ example: '1' }),
    name: z.string().openapi({ example: 'John Doe' }),
    email: z.string().email().openapi({ example: 'john.doe@example.com' }),
    avatar: z.string().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
    role: z.enum(['admin', 'user']).openapi({ example: 'user' }),
    createdAt: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
  })
  .openapi('User')

export const CreateUserSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'John Doe' }),
    email: z.string().email().openapi({ example: 'john.doe@example.com' }),
    avatar: z.string().optional().openapi({ example: 'https://example.com/avatar.jpg' }),
    role: z.enum(['admin', 'user']).optional().openapi({ example: 'user' }),
  })
  .openapi('CreateUser')

// Chat schemas
export const MessageSchema = z
  .object({
    role: z.enum(['user', 'assistant', 'system']).openapi({ example: 'user' }),
    content: z.string().openapi({ example: 'Hello, how can you help me?' }),
  })
  .openapi('Message')

export const ChatRequestSchema = z
  .object({
    messages: z.array(MessageSchema),
    model: z.string().optional().openapi({ example: 'llama-3-8b' }),
    stream: z.boolean().optional().openapi({ example: true }),
  })
  .openapi('ChatRequest')

export const ChatResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'chat_123' }),
    object: z.string().openapi({ example: 'chat.completion' }),
    created: z.number().openapi({ example: 1673361400 }),
    model: z.string().openapi({ example: 'llama-3-8b' }),
    choices: z.array(
      z.object({
        index: z.number().openapi({ example: 0 }),
        message: MessageSchema,
        finish_reason: z.string().openapi({ example: 'stop' }),
      })
    ),
  })
  .openapi('ChatResponse')

// Voice AI schemas
export const VoiceConfigSchema = z
  .object({
    voice: z.string().openapi({ example: '@cf/deepgram/aura-1' }),
    model: z.string().openapi({ example: '@cf/deepgram/nova-3' }),
  })
  .openapi('VoiceConfig')

export const VoiceSessionSchema = z
  .object({
    sessionId: z.string().openapi({ example: 'voice_session_123' }),
    voice: z.string().openapi({ example: '@cf/deepgram/aura-1' }),
    model: z.string().openapi({ example: '@cf/deepgram/nova-3' }),
    status: z.enum(['connected', 'recording', 'processing', 'disconnected']).openapi({ example: 'connected' }),
    createdAt: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
  })
  .openapi('VoiceSession')

// Parameter schemas
export const TaskParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: 'id',
        in: 'path',
      },
      example: '1',
    }),
})

export const UserParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({
      param: {
        name: 'id',
        in: 'path',
      },
      example: '1',
    }),
})

// Health check schema
export const HealthCheckSchema = z
  .object({
    status: z.string().openapi({ example: 'ok' }),
    timestamp: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
    version: z.string().openapi({ example: '1.0.0' }),
  })
  .openapi('HealthCheck')