/**
 * Auth Store with Legend State v3
 * 
 * Manages authentication state with fine-grained reactivity and persistence
 */

import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'

// Auth types
export interface AuthUser {
  accountNo: string
  email: string
  role: string[]
  exp: number
  displayName?: string
  avatar?: string
}

export interface AuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

interface AuthStore {
  // Core state
  user: AuthUser | null
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // UI state
  loginRedirectPath: string | null
  rememberMe: boolean
}

// Initialize auth state - start with loading to prevent premature redirects
const initializeAuthState = (): AuthStore => {
  return {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true, // Start loading to wait for session check
    error: null,
    loginRedirectPath: null,
    rememberMe: false
  }
}

// Create the auth observable store
export const auth$ = observable<AuthStore>(initializeAuthState())

// Sync auth preferences to localStorage
syncObservable(auth$, {
  persist: {
    name: 'auth-preferences',
    transform: {
      // Only persist certain fields
      save: (value: AuthStore) => ({
        rememberMe: value.rememberMe,
        loginRedirectPath: value.loginRedirectPath
      }),
      load: (value: any) => ({
        rememberMe: value?.rememberMe || false,
        loginRedirectPath: value?.loginRedirectPath || null
      })
    }
  }
})

// WebSocket connection for remote auth events
let authWebSocket: WebSocket | null = null

const connectAuthWebSocket = (userId: string) => {
  if (authWebSocket?.readyState === WebSocket.OPEN) return
  
  authWebSocket = new WebSocket(`ws://${window.location.host}/ws/user-sys/${userId}`)
  
  authWebSocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      if (message.type === 'session-invalidated') {
        console.log('🚪 Remote signout received, logging out...')
        authActions.logout()
      }
    } catch (error) {
      console.error('Auth WebSocket message error:', error)
    }
  }
  
  authWebSocket.onclose = () => {
    console.log('Auth WebSocket closed')
    authWebSocket = null
  }
}

// Initialize auth from Better Auth session
export const initializeAuth = async () => {
  try {
    const { getSession } = await import('@/lib/auth-client')
    const { data: sessionData } = await getSession()
    
    if (sessionData?.session && sessionData?.user) {
      auth$.assign({
        user: {
          accountNo: sessionData.user.id,
          email: sessionData.user.email,
          role: sessionData.user.role || [],
          exp: new Date(sessionData.session.expiresAt).getTime() / 1000,
          displayName: sessionData.user.name,
          avatar: sessionData.user.image
        },
        session: {
          accessToken: sessionData.session.token,
          expiresAt: new Date(sessionData.session.expiresAt).getTime()
        },
        isAuthenticated: true,
        isLoading: false
      })
      
      // Connect to UserSysDO for session events
      connectAuthWebSocket(sessionData.user.id)
    } else {
      // No valid session
      auth$.assign({
        isAuthenticated: false,
        isLoading: false
      })
    }
  } catch (error) {
    console.warn('Failed to initialize auth session:', error)
    auth$.assign({
      isAuthenticated: false,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Session initialization failed'
    })
  }
}

// Auth actions
export const authActions = {
  // Login with credentials using Better Auth
  login: async (credentials: { email: string; password: string; rememberMe?: boolean }) => {
    auth$.isLoading.set(true)
    auth$.error.set(null)
    
    try {
      const { signIn } = await import('@/lib/auth-client')
      
      const { data, error } = await signIn.email({
        email: credentials.email,
        password: credentials.password,
        rememberMe: credentials.rememberMe
      })
      
      if (error) {
        throw new Error(error.message || 'Login failed')
      }
      
      if (data?.session && data?.user) {
        // Update state with Better Auth data
        auth$.assign({
          user: {
            accountNo: data.user.id,
            email: data.user.email,
            role: data.user.role || [],
            exp: new Date(data.session.expiresAt).getTime() / 1000,
            displayName: data.user.name,
            avatar: data.user.image
          },
          session: {
            accessToken: data.session.token,
            expiresAt: new Date(data.session.expiresAt).getTime()
          },
          isAuthenticated: true,
          isLoading: false,
          rememberMe: credentials.rememberMe || false,
          loginRedirectPath: null
        })
        
        // Connect to UserSysDO for session events
        connectAuthWebSocket(data.user.id)
      }
      
    } catch (error) {
      auth$.assign({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      })
      throw error
    }
  },
  
  // Logout user (client-side only - for remote signout)
  logout: () => {
    // Close auth WebSocket
    if (authWebSocket) {
      authWebSocket.close()
      authWebSocket = null
    }
    
    // Reset state but preserve rememberMe
    const rememberMe = auth$.rememberMe.get()
    auth$.assign({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      loginRedirectPath: null,
      rememberMe
    })
  },

  // Remote logout - uses Better Auth to revoke all sessions  
  remoteLogout: async (reason: string = 'user_logout') => {
    try {
      const { revokeOtherSessions, signOut } = await import('@/lib/auth-client')
      
      // 1. Revoke all other sessions via Better Auth
      await revokeOtherSessions()
      
      // 2. Sign out current session (this will trigger server-side WebSocket broadcast)
      await signOut()
      
      // 3. Clear local state (this also handles reactive redirect)
      authActions.logout()
      
    } catch (error) {
      console.error('Remote logout failed:', error)
      // Fallback to local logout
      authActions.logout()
    }
  },
  
  // Refresh authentication using Better Auth getSession
  refreshAuth: async () => {
    try {
      const { getSession } = await import('@/lib/auth-client')
      const { data: sessionData } = await getSession()
      
      if (sessionData?.session && sessionData?.user) {
        // Update state with refreshed session data
        auth$.assign({
          user: {
            accountNo: sessionData.user.id,
            email: sessionData.user.email,
            role: sessionData.user.role || [],
            exp: new Date(sessionData.session.expiresAt).getTime() / 1000,
            displayName: sessionData.user.name,
            avatar: sessionData.user.image
          },
          session: {
            accessToken: sessionData.session.token,
            expiresAt: new Date(sessionData.session.expiresAt).getTime()
          },
          isAuthenticated: true,
          isLoading: false
        })
      } else {
        // No valid session - logout
        authActions.logout()
      }
      
    } catch (error) {
      console.error('Session refresh failed:', error)
      authActions.logout()
    }
  },
  
  // Set user
  setUser: (user: AuthUser | null) => {
    auth$.assign({
      user,
      isAuthenticated: !!user
    })
    
    // Connect to UserSysDO when user logs in
    if (user?.accountNo) {
      connectAuthWebSocket(user.accountNo)
    }
  },
  
  // Update user partially
  updateUser: (updates: Partial<AuthUser>) => {
    const currentUser = auth$.user.get()
    if (currentUser) {
      auth$.user.set({ ...currentUser, ...updates })
    }
  },
  
  // Set session (Better Auth handles cookies automatically)
  setSession: (session: AuthSession | null) => {
    auth$.assign({
      session,
      isAuthenticated: !!session
    })
  },
  
  // Clear session (Better Auth handles cookies automatically)
  clearSession: () => {
    auth$.assign({
      session: null,
      isAuthenticated: false
    })
  },
  
  // Set error
  setError: (error: string | null) => {
    auth$.error.set(error)
  },
  
  // Set loading
  setLoading: (loading: boolean) => {
    auth$.isLoading.set(loading)
  },
  
  // Set redirect path
  setLoginRedirectPath: (path: string | null) => {
    auth$.loginRedirectPath.set(path)
  },
  
  // Reset all state (Better Auth handles cookies automatically)
  reset: () => {
    auth$.assign(initializeAuthState())
  }
}

// Computed values
export const authComputed = {
  // Check if session is expired
  isSessionExpired: () => {
    const session = auth$.session.get()
    if (!session?.expiresAt) return false
    return Date.now() > session.expiresAt
  },
  
  // Get user display name
  userDisplayName: () => {
    const user = auth$.user.get()
    if (!user) return null
    return user.displayName || user.email.split('@')[0]
  },
  
  // Check user role
  hasRole: (role: string) => {
    const user = auth$.user.get()
    return user?.role?.includes(role) || false
  },
  
  // Check if user has any admin role
  isAdmin: () => {
    const user = auth$.user.get()
    return user?.role?.some(role => 
      ['admin', 'super_admin', 'moderator'].includes(role)
    ) || false
  }
}

// Export commonly used selectors for convenience
export const authSelectors = {
  user: () => auth$.user.get(),
  isAuthenticated: () => auth$.isAuthenticated.get(),
  isLoading: () => auth$.isLoading.get(),
  error: () => auth$.error.get(),
  session: () => auth$.session.get()
}