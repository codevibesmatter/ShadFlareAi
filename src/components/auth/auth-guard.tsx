/**
 * Authentication Guard using Better Auth native patterns
 * 
 * Redirects to sign-in when user is not authenticated
 */

import { useEffect } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/stores/auth-simple'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const currentPath = location.href
      
      // Redirect to sign-in with current path for redirect after login
      navigate({
        to: '/sign-in',
        search: { redirect: currentPath },
        replace: true,
      })
    }
  }, [isAuthenticated, isLoading, location.href, navigate])

  // Show nothing while loading or if not authenticated
  if (isLoading || !isAuthenticated) {
    return null
  }

  return <>{children}</>
}