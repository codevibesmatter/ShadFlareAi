/**
 * Integration hook that connects Legend State auth with UserSysDO
 * Provides reactive session management and remote signout capabilities
 */

import { useEffect } from 'react'
import { useAuthUser } from '@/stores/hooks'
import { useUserSysEvents } from './use-user-sys-events'
import { signOut } from '@/lib/auth-client'
import { authActions } from '@/stores'

export function useAuthSysIntegration() {
  const user = useAuthUser()
  const userId = user?.accountNo || null
  
  // Connect to UserSysDO events for this user
  const { broadcastEvent, invalidateSession } = useUserSysEvents(userId)

  // Enhanced logout that notifies other sessions
  const enhancedLogout = async (reason: string = 'user_logout') => {
    try {
      // 1. Broadcast session invalidation to other tabs/devices
      if (userId) {
        await invalidateSession('current-session', reason)
      }

      // 2. Call Better Auth signOut 
      await signOut()

      // 3. Clear Legend State (this will trigger reactive redirect via AuthGuard)
      authActions.logout()
      
      return true
    } catch (error) {
      console.error('Enhanced logout failed:', error)
      // Fallback to local logout only
      authActions.logout()
      return false
    }
  }

  // Send notification to user across all sessions
  const sendUserNotification = async (notification: any) => {
    if (!userId) return false
    
    return broadcastEvent({
      type: 'notification',
      data: notification
    })
  }

  // Broadcast system announcement to user
  const sendSystemAnnouncement = async (announcement: any) => {
    if (!userId) return false
    
    return broadcastEvent({
      type: 'system-announcement', 
      data: announcement
    })
  }

  // Sync state across tabs
  const syncTabState = async (state: any) => {
    if (!userId) return false
    
    return broadcastEvent({
      type: 'tab-sync',
      data: state
    })
  }

  return {
    enhancedLogout,
    sendUserNotification,
    sendSystemAnnouncement,
    syncTabState,
    isConnected: !!userId
  }
}