import { z } from 'zod'

// Task schema matching the D1 database schema
export const taskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(['backlog', 'todo', 'in progress', 'done', 'canceled']),
  label: z.enum(['bug', 'feature', 'documentation']).nullable(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assignee: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Task = z.infer<typeof taskSchema>
