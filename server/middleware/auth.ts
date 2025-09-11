import type { Context } from 'hono';
import { createAuth } from '../auth/config';
import type { Env } from '../../worker';
import { authLog } from '../../src/lib/logger';

const authLogger = authLog('server/middleware/auth.ts');

export async function requireAuth(c: Context<{ Bindings: Env }>) {
  try {
    const auth = createAuth(c.env);
    
    // Use Better Auth's native session validation
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers
    });
    
    if (!sessionData?.session || !sessionData?.user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    // Add user and session to context
    c.set('user', sessionData.user);
    c.set('session', sessionData.session);
    
    return null; // Continue to next handler
  } catch (error) {
    authLogger.error('Auth error', error);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}

export async function optionalAuth(c: Context<{ Bindings: Env }>) {
  try {
    const auth = createAuth(c.env);
    
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers
    });
    
    if (sessionData?.session && sessionData?.user) {
      c.set('user', sessionData.user);
      c.set('session', sessionData.session);
    }
  } catch {
    // Silent fail for optional auth
  }
  
  return null;
}