import { createRoute } from '@hono/zod-openapi'
import {
  TaskSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskParamsSchema,
  UserSchema,
  CreateUserSchema,
  UserParamsSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  VoiceConfigSchema,
  VoiceSessionSchema,
  HealthCheckSchema,
  ErrorSchema,
  SuccessSchema,
} from '../schemas'

// Health check routes
export const healthRoute = createRoute({
  method: 'get',
  path: '/api/health',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthCheckSchema,
        },
      },
      description: 'Service health status',
    },
  },
  tags: ['Health'],
})

// Task routes
export const getTasksRoute = createRoute({
  method: 'get',
  path: '/api/tasks',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(TaskSchema),
        },
      },
      description: 'List of tasks',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Tasks'],
})

export const getTaskRoute = createRoute({
  method: 'get',
  path: '/api/tasks/{id}',
  request: {
    params: TaskParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskSchema,
        },
      },
      description: 'Task details',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Task not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Tasks'],
})

export const createTaskRoute = createRoute({
  method: 'post',
  path: '/api/tasks',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTaskSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TaskSchema,
        },
      },
      description: 'Task created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Tasks'],
})

export const updateTaskRoute = createRoute({
  method: 'put',
  path: '/api/tasks/{id}',
  request: {
    params: TaskParamsSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateTaskSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskSchema,
        },
      },
      description: 'Task updated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Task not found',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Tasks'],
})

export const deleteTaskRoute = createRoute({
  method: 'delete',
  path: '/api/tasks/{id}',
  request: {
    params: TaskParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessSchema,
        },
      },
      description: 'Task deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Task not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Tasks'],
})

// User routes
export const getUsersRoute = createRoute({
  method: 'get',
  path: '/api/users',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(UserSchema),
        },
      },
      description: 'List of users',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Users'],
})

export const getUserRoute = createRoute({
  method: 'get',
  path: '/api/users/{id}',
  request: {
    params: UserParamsSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'User details',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'User not found',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Users'],
})

export const createUserRoute = createRoute({
  method: 'post',
  path: '/api/users',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
      description: 'User created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['Users'],
})

// Chat routes
export const chatRoute = createRoute({
  method: 'post',
  path: '/api/chat',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'text/plain': {
          schema: z.string(),
        },
        'application/json': {
          schema: ChatResponseSchema,
        },
      },
      description: 'Chat response (streaming or JSON)',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Invalid request data',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
  tags: ['AI Chat'],
})

// Test route
export const testRoute = createRoute({
  method: 'get',
  path: '/api/test',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({ example: 'API is working!' }),
            timestamp: z.string().openapi({ example: '2025-01-15T10:30:00Z' }),
          }),
        },
      },
      description: 'Test API response',
    },
  },
  tags: ['Test'],
})

// New Status route (example of how easy it is to add new routes)
export const statusRoute = createRoute({
  method: 'get',
  path: '/api/status',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            service: z.string().openapi({ example: 'Shadcn Admin API' }),
            status: z.enum(['online', 'maintenance', 'degraded']).openapi({ example: 'online' }),
            uptime: z.number().openapi({ example: 3600 }),
            requests: z.number().openapi({ example: 1234 }),
          }),
        },
      },
      description: 'Service status information',
    },
  },
  tags: ['Health'],
})

// Add z import at the top of the file for array schemas
import { z } from '@hono/zod-openapi'