import type { Context } from 'hono';
import { createAuth } from '../auth/config';
import type { Env } from '../../worker';

export async function requireAuth(c: Context<{ Bindings: Env }>) {
  const auth = createAuth(c.env);
  
  // Get session token from cookie or Authorization header
  const sessionToken = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1] || 
                      c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    // Verify session with Better Auth
    const session = await auth.verifySession(sessionToken);
    
    if (!session || !session.user) {
      return c.json({ error: 'Invalid session' }, 401);
    }
    
    // Add user to context
    c.set('user', session.user);
    c.set('session', session);
    
    return null; // Continue to next handler
  } catch (error) {
    console.error('Auth error:', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export async function optionalAuth(c: Context<{ Bindings: Env }>) {
  const auth = createAuth(c.env);
  
  const sessionToken = c.req.header('Cookie')?.match(/session=([^;]+)/)?.[1] || 
                      c.req.header('Authorization')?.replace('Bearer ', '');
  
  if (sessionToken) {
    try {
      const session = await auth.verifySession(sessionToken);
      if (session && session.user) {
        c.set('user', session.user);
        c.set('session', session);
      }
    } catch {
      // Silent fail for optional auth
    }
  }
  
  return null;
}