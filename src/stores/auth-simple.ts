/**
 * Simplified Auth Store - Better Auth + Legend State persistence
 * 
 * Uses Better Auth's native session management with Legend State's reactive persistence
 * for client-side preferences and auto remember me
 */

import { useSession as useBetterAuthSession, signOut, revokeOtherSessions } from '@/lib/auth-client'
import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'

// Client-side preferences with Legend State persistence
interface AuthPreferences {
  lastRedirectPath: string | null
  preferredTheme: 'light' | 'dark' | 'system'
  // Auto remember me - always true in modern apps
}

// Create persisted preferences observable
const authPreferences$ = observable<AuthPreferences>({
  lastRedirectPath: null,
  preferredTheme: 'system'
})

// Auto-sync to localStorage with Legend State
syncObservable(authPreferences$, {
  persist: {
    name: 'auth-preferences',
    plugin: ObservablePersistLocalStorage,
    retrySync: true,
    transform: {
      save: (value: AuthPreferences) => value,
      load: (value: any) => ({
        lastRedirectPath: value?.lastRedirectPath || null,
        preferredTheme: value?.preferredTheme || 'system'
      })
    }
  }
})

// Export Better Auth's native useSession hook directly
export const useSession = useBetterAuthSession

// Simplified logout that uses Better Auth's native patterns
export const logout = async () => {
  try {
    await signOut()
    // Better Auth handles all cleanup automatically via cookies
    // Clear redirect path on logout
    authPreferences$.lastRedirectPath.set(null)
  } catch (error) {
    console.error('Logout failed:', error)
    throw error
  }
}

// Cross-device logout using Better Auth's native session revocation  
export const logoutAllDevices = async () => {
  try {
    // Revoke all other sessions first
    await revokeOtherSessions()
    // Then sign out current session
    await signOut()
    // Clear redirect path
    authPreferences$.lastRedirectPath.set(null)
  } catch (error) {
    console.error('Cross-device logout failed:', error)
    throw error
  }
}

// Enhanced auth hook - Better Auth + reactive preferences
export const useAuth = () => {
  const session = useSession()
  
  return {
    user: session.data?.user || null,
    session: session.data?.session || null,
    isAuthenticated: !!session.data?.session,
    isLoading: session.isPending,
    error: session.error,
    refetch: session.refetch,
    // Reactive preferences from Legend State
    preferences: authPreferences$.get(),
    setRedirectPath: (path: string | null) => authPreferences$.lastRedirectPath.set(path),
    setTheme: (theme: 'light' | 'dark' | 'system') => authPreferences$.preferredTheme.set(theme),
  }
}

// Helper computed values
export const useAuthHelpers = () => {
  const { user, isAuthenticated } = useAuth()
  
  return {
    userDisplayName: user?.name || user?.email?.split('@')[0] || 'User',
    hasRole: (role: string) => user?.role?.includes(role) || false,
    isAdmin: () => user?.role?.some((role: string) => 
      ['admin', 'super_admin', 'moderator'].includes(role)
    ) || false,
    isAuthenticated,
  }
}

// Hook for reactive redirect management with Legend State
export const useAuthRedirect = () => {
  return {
    redirectPath: authPreferences$.lastRedirectPath.get(),
    setRedirectPath: (path: string | null) => authPreferences$.lastRedirectPath.set(path),
    clearRedirectPath: () => authPreferences$.lastRedirectPath.set(null),
  }
}

// Hook for reactive theme management  
export const useAuthTheme = () => {
  return {
    theme: authPreferences$.preferredTheme.get(),
    setTheme: (theme: 'light' | 'dark' | 'system') => authPreferences$.preferredTheme.set(theme),
  }
}