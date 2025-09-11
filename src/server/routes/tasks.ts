import { OpenAPIHono } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/d1'
import { and, eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { task } from '../../../database/schema'
import {
  getTasksRoute,
  getTaskRoute,
  createTaskRoute,
  updateTaskRoute,
  deleteTaskRoute,
} from './index'
import { requireAuth } from '../middleware/auth'

type Bindings = {
  DB: D1Database
}

const tasksApp = new OpenAPIHono<{ Bindings: Bindings }>()

// Apply auth middleware to all routes
tasksApp.use('*', requireAuth)

// GET /api/tasks - List tasks for authenticated user
tasksApp.openapi(getTasksRoute, async (c) => {
  try {
    const user = c.get('user')
    const db = drizzle(c.env.DB)
    
    const tasks = await db
      .select()
      .from(task)
      .where(eq(task.userId, user.id))
      .orderBy(desc(task.createdAt))
      .all()

    // Convert timestamps to ISO strings
    const tasksWithDates = tasks.map(t => ({
      ...t,
      dueDate: t.dueDate ? (t.dueDate instanceof Date ? t.dueDate.toISOString() : new Date(t.dueDate).toISOString()) : null,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : new Date(t.createdAt).toISOString(),
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : new Date(t.updatedAt).toISOString(),
    }))

    return c.json(tasksWithDates)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return c.json({ error: 'Failed to fetch tasks' }, 500)
  }
})

// GET /api/tasks/:id - Get specific task for authenticated user
tasksApp.openapi(getTaskRoute, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)
    
    const [taskRecord] = await db
      .select()
      .from(task)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))
      .limit(1)

    if (!taskRecord) {
      return c.json({ error: 'Task not found' }, 404)
    }

    // Convert timestamps to ISO strings
    const taskWithDates = {
      ...taskRecord,
      dueDate: taskRecord.dueDate ? (taskRecord.dueDate instanceof Date ? taskRecord.dueDate.toISOString() : new Date(taskRecord.dueDate).toISOString()) : null,
      createdAt: taskRecord.createdAt instanceof Date ? taskRecord.createdAt.toISOString() : new Date(taskRecord.createdAt).toISOString(),
      updatedAt: taskRecord.updatedAt instanceof Date ? taskRecord.updatedAt.toISOString() : new Date(taskRecord.updatedAt).toISOString(),
    }

    return c.json(taskWithDates)
  } catch (error) {
    console.error('Error fetching task:', error)
    return c.json({ error: 'Failed to fetch task' }, 500)
  }
})

// POST /api/tasks - Create new task for authenticated user
tasksApp.openapi(createTaskRoute, async (c) => {
  try {
    const user = c.get('user')
    const body = c.req.valid('json')
    const db = drizzle(c.env.DB)
    
    const newTask = {
      id: `TASK-${nanoid(8)}`,
      userId: user.id,
      title: body.title,
      description: body.description || null,
      status: body.status || 'todo',
      label: body.label || null,
      priority: body.priority || 'medium',
      assignee: body.assignee || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(task).values(newTask)

    // Return task with ISO string timestamps
    const taskWithDates = {
      ...newTask,
      dueDate: newTask.dueDate ? newTask.dueDate.toISOString() : null,
      createdAt: newTask.createdAt.toISOString(),
      updatedAt: newTask.updatedAt.toISOString(),
    }

    return c.json(taskWithDates, 201)
  } catch (error) {
    console.error('Error creating task:', error)
    return c.json({ error: 'Failed to create task' }, 500)
  }
})

// PUT /api/tasks/:id - Update task for authenticated user
tasksApp.openapi(updateTaskRoute, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const body = c.req.valid('json')
    const db = drizzle(c.env.DB)
    
    // Check if task exists and belongs to user
    const [existingTask] = await db
      .select()
      .from(task)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))
      .limit(1)

    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404)
    }

    const updateData: Partial<typeof task.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.label !== undefined) updateData.label = body.label
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.assignee !== undefined) updateData.assignee = body.assignee
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
    }

    await db
      .update(task)
      .set(updateData)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))

    // Fetch updated task
    const [updatedTask] = await db
      .select()
      .from(task)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))
      .limit(1)

    // Convert timestamps to ISO strings
    const taskWithDates = {
      ...updatedTask!,
      dueDate: updatedTask!.dueDate ? (updatedTask!.dueDate instanceof Date ? updatedTask!.dueDate.toISOString() : new Date(updatedTask!.dueDate).toISOString()) : null,
      createdAt: updatedTask!.createdAt instanceof Date ? updatedTask!.createdAt.toISOString() : new Date(updatedTask!.createdAt).toISOString(),
      updatedAt: updatedTask!.updatedAt instanceof Date ? updatedTask!.updatedAt.toISOString() : new Date(updatedTask!.updatedAt).toISOString(),
    }

    return c.json(taskWithDates)
  } catch (error) {
    console.error('Error updating task:', error)
    return c.json({ error: 'Failed to update task' }, 500)
  }
})

// DELETE /api/tasks/:id - Delete task for authenticated user
tasksApp.openapi(deleteTaskRoute, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.valid('param')
    const db = drizzle(c.env.DB)
    
    // Check if task exists and belongs to user
    const [existingTask] = await db
      .select()
      .from(task)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))
      .limit(1)

    if (!existingTask) {
      return c.json({ error: 'Task not found' }, 404)
    }

    await db
      .delete(task)
      .where(and(eq(task.id, id), eq(task.userId, user.id)))

    return c.json({ success: true, message: 'Task deleted successfully' })
  } catch (error) {
    console.error('Error deleting task:', error)
    return c.json({ error: 'Failed to delete task' }, 500)
  }
})

export { tasksApp }