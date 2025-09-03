/**
 * Hook for connecting to UserSysDO real-time events
 * Handles session invalidation, notifications, and other user-scoped events
 */

import { useEffect, useRef } from 'react'
import { authActions } from '@/stores'

export interface UserSystemEvent {
  type: 'session-invalidated' | 'notification' | 'system-announcement' | 'tab-sync'
  sessionId?: string
  userId: string
  data?: any
  timestamp: number
  reason?: string
}

export function useUserSysEvents(userId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    if (!userId) {
      // Clean up if no user
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    const connect = () => {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }

      console.log(`🔌 Connecting to UserSysDO events for user: ${userId}`)
      
      const eventSource = new EventSource(`/api/user-sys/${userId}/events`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('✅ UserSysDO connection established')
        reconnectAttempts.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const userEvent: UserSystemEvent = JSON.parse(event.data)
          console.log('📨 UserSys event received:', userEvent)

          switch (userEvent.type) {
            case 'session-invalidated':
              console.log('🚪 Session invalidated, logging out...', userEvent.reason)
              authActions.logout()
              break

            case 'notification':
              console.log('🔔 Notification received:', userEvent.data)
              // Handle notifications (could show toast, update store, etc.)
              break

            case 'system-announcement':
              console.log('📢 System announcement:', userEvent.data)
              // Handle system announcements
              break

            case 'tab-sync':
              console.log('🔄 Tab sync event:', userEvent.data)
              // Handle multi-tab coordination
              break

            default:
              console.log('❓ Unknown event type:', userEvent.type)
          }
        } catch (error) {
          console.error('Failed to parse UserSys event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('❌ UserSysDO connection error:', error)
        eventSource.close()

        // Implement exponential backoff for reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
          console.log(`🔄 Reconnecting to UserSysDO in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++
            connect()
          }, delay)
        } else {
          console.error('💥 Max reconnection attempts reached for UserSysDO')
        }
      }
    }

    // Initial connection
    connect()

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [userId])

  // Return helper functions for broadcasting events
  return {
    broadcastEvent: async (event: Omit<UserSystemEvent, 'userId' | 'timestamp'>) => {
      if (!userId) return false
      
      try {
        const response = await fetch(`/api/user-sys/${userId}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        })
        return response.ok
      } catch (error) {
        console.error('Failed to broadcast event:', error)
        return false
      }
    },

    invalidateSession: async (sessionId: string, reason: string = 'logout') => {
      if (!userId) return false
      
      try {
        const response = await fetch(`/api/user-sys/${userId}/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'session-invalidated',
            sessionId,
            reason
          })
        })
        return response.ok
      } catch (error) {
        console.error('Failed to invalidate session:', error)
        return false
      }
    }
  }
}