import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Task } from '../data/schema'

// API client functions
const tasksApi = {
  async getTasks(): Promise<Task[]> {
    const response = await fetch('/api/tasks', {
      credentials: 'include', // Include session cookies
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch tasks')
    }
    
    return response.json()
  },

  async getTask(id: string): Promise<Task> {
    const response = await fetch(`/api/tasks/${id}`, {
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch task')
    }
    
    return response.json()
  },

  async createTask(data: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create task')
    }
    
    return response.json()
  },

  async updateTask(id: string, data: Partial<Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<Task> {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update task')
    }
    
    return response.json()
  },

  async deleteTask(id: string): Promise<void> {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete task')
    }
  },
}

// Query keys
const tasksKeys = {
  all: ['tasks'] as const,
  lists: () => [...tasksKeys.all, 'list'] as const,
  list: (filters: string) => [...tasksKeys.lists(), { filters }] as const,
  details: () => [...tasksKeys.all, 'detail'] as const,
  detail: (id: string) => [...tasksKeys.details(), id] as const,
}

// Custom hooks
export function useTasks() {
  return useQuery({
    queryKey: tasksKeys.lists(),
    queryFn: tasksApi.getTasks,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: tasksKeys.detail(id),
    queryFn: () => tasksApi.getTask(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: tasksApi.createTask,
    onSuccess: (newTask) => {
      // Invalidate and refetch tasks list
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() })
      
      // Optimistically update the cache
      queryClient.setQueryData<Task[]>(tasksKeys.lists(), (old) => {
        if (!old) return [newTask]
        return [newTask, ...old]
      })
      
      toast.success('Task created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create task')
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> }) =>
      tasksApi.updateTask(id, data),
    onSuccess: (updatedTask) => {
      // Update the specific task in cache
      queryClient.setQueryData<Task>(tasksKeys.detail(updatedTask.id), updatedTask)
      
      // Update the task in the list cache
      queryClient.setQueryData<Task[]>(tasksKeys.lists(), (old) => {
        if (!old) return [updatedTask]
        return old.map(task => task.id === updatedTask.id ? updatedTask : task)
      })
      
      toast.success('Task updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update task')
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: tasksApi.deleteTask,
    onSuccess: (_, deletedTaskId) => {
      // Remove the task from list cache
      queryClient.setQueryData<Task[]>(tasksKeys.lists(), (old) => {
        if (!old) return []
        return old.filter(task => task.id !== deletedTaskId)
      })
      
      // Remove the specific task cache
      queryClient.removeQueries({ queryKey: tasksKeys.detail(deletedTaskId) })
      
      toast.success('Task deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete task')
    },
  })
}

export function useBulkDeleteTasks() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      // Delete tasks in parallel
      const deletePromises = taskIds.map(id => tasksApi.deleteTask(id))
      await Promise.all(deletePromises)
      return taskIds
    },
    onSuccess: (deletedTaskIds) => {
      // Remove the tasks from list cache
      queryClient.setQueryData<Task[]>(tasksKeys.lists(), (old) => {
        if (!old) return []
        return old.filter(task => !deletedTaskIds.includes(task.id))
      })
      
      // Remove the specific task caches
      deletedTaskIds.forEach(id => {
        queryClient.removeQueries({ queryKey: tasksKeys.detail(id) })
      })
      
      toast.success(`${deletedTaskIds.length} task${deletedTaskIds.length > 1 ? 's' : ''} deleted successfully`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete tasks')
    },
  })
}

export function useBulkUpdateTasks() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ taskIds, updates }: { 
      taskIds: string[], 
      updates: Partial<Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> 
    }) => {
      // Update tasks in parallel
      const updatePromises = taskIds.map(id => tasksApi.updateTask(id, updates))
      const updatedTasks = await Promise.all(updatePromises)
      return updatedTasks
    },
    onSuccess: (updatedTasks) => {
      // Update the tasks in list cache
      queryClient.setQueryData<Task[]>(tasksKeys.lists(), (old) => {
        if (!old) return updatedTasks
        return old.map(task => {
          const updatedTask = updatedTasks.find(ut => ut.id === task.id)
          return updatedTask || task
        })
      })
      
      // Update individual task caches
      updatedTasks.forEach(updatedTask => {
        queryClient.setQueryData<Task>(tasksKeys.detail(updatedTask.id), updatedTask)
      })
      
      toast.success(`${updatedTasks.length} task${updatedTasks.length > 1 ? 's' : ''} updated successfully`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update tasks')
    },
  })
}