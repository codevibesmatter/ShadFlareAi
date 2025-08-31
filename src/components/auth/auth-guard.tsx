/**
 * Reactive Authentication Guard with Legend State v3
 * 
 * Automatically redirects to sign-in when authentication state changes
 */

import { useNavigate, useLocation } from '@tanstack/react-router'
import { useObserve } from '@legendapp/state/react'
import { auth$, authActions } from '@/stores'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Reactive observer - automatically runs when auth state changes
  useObserve(() => {
    const isAuthenticated = auth$.isAuthenticated.get()
    const isLoading = auth$.isLoading.get()
    
    // When authentication becomes false, immediately redirect
    if (!isLoading && !isAuthenticated) {
      const currentPath = location.href
      
      // Store redirect path reactively
      auth$.loginRedirectPath.set(currentPath)
      
      // Immediate reactive redirect
      navigate({
        to: '/sign-in',
        search: { redirect: currentPath },
        replace: true,
      })
    }
  })

  // Reactive rendering based on auth state
  const isAuthenticated = auth$.isAuthenticated.get()
  const isLoading = auth$.isLoading.get()

  // Show nothing while checking auth or if not authenticated
  if (isLoading || !isAuthenticated) {
    return null
  }

  return <>{children}</>
}