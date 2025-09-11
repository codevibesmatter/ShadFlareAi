/**
 * Simplified Auth Store - Wrapper around Better Auth native patterns
 * 
 * This replaces the complex custom session management with native Better Auth patterns
 */

import { useSession as useBetterAuthSession, signOut, revokeOtherSessions } from '@/lib/auth-client'

// Export Better Auth's native useSession hook directly
export const useSession = useBetterAuthSession

// Simplified logout that uses Better Auth's native patterns
export const logout = async () => {
  try {
    await signOut()
    // Better Auth handles all cleanup automatically via cookies
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
  } catch (error) {
    console.error('Cross-device logout failed:', error)
    throw error
  }
}

// Helper to check if user is authenticated
export const useAuth = () => {
  const session = useSession()
  
  return {
    user: session.data?.user || null,
    session: session.data?.session || null,
    isAuthenticated: !!session.data?.session,
    isLoading: session.isPending,
    error: session.error,
    refetch: session.refetch,
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